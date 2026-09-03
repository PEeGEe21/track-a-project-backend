import axios from 'axios';
import { lookup } from 'dns/promises';
import {
  AuditAction,
  AuditActorType,
  AuditOutcome,
  AuditSource,
  AuditSubjectType,
} from 'src/audit/audit-contract';
import { CapabilityKey } from 'src/entitlements/capability-catalog';
import { IntegrationDeliveryService } from './integration-delivery.service';

jest.mock('axios');
jest.mock('dns/promises', () => ({ lookup: jest.fn() }));

describe('IntegrationDeliveryService', () => {
  const repo = () => ({
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    insert: jest.fn(),
    upsert: jest.fn(),
    create: jest.fn((v) => ({ id: 'new-id', ...v })),
    createQueryBuilder: jest.fn(),
  });
  let endpoints: any;
  let deliveries: any;
  let attempts: any;
  let checkpoints: any;
  let audits: any;
  let memberships: any;
  let projects: any;
  let peers: any;
  let entitlements: any;
  let writer: any;
  let manager: any;
  let service: IntegrationDeliveryService;

  beforeEach(() => {
    endpoints = repo();
    deliveries = repo();
    attempts = repo();
    checkpoints = repo();
    audits = repo();
    memberships = repo();
    projects = repo();
    peers = repo();
    entitlements = {
      assertCapability: jest.fn(),
      resolveOrganization: jest.fn().mockResolvedValue([
        { key: CapabilityKey.RELIABLE_INTEGRATION_DELIVERY, enabled: true },
        { key: CapabilityKey.ADVANCED_AUDIT_TRAIL, enabled: true },
      ]),
    };
    writer = {
      append: jest.fn(),
      correlationId: jest.fn().mockReturnValue('correlation-1'),
    };
    manager = {
      getRepository: jest.fn((entity) =>
        entity.name === 'IntegrationDeliveryAttempt'
          ? attempts
          : entity.name === 'IntegrationDelivery'
            ? deliveries
            : endpoints,
      ),
    };
    service = new IntegrationDeliveryService(
      endpoints,
      deliveries,
      attempts,
      checkpoints,
      audits,
      memberships,
      projects,
      peers,
      entitlements,
      {
        sanitizeChanges: jest.fn((_, value) => value),
        sanitizeMetadata: jest.fn((value) => value),
      } as any,
      writer,
      { transaction: jest.fn((callback) => callback(manager)) } as any,
    );
    (lookup as jest.Mock).mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
    ]);
    (axios.post as jest.Mock).mockReset();
  });

  it('rejects private, loopback, and link-local destinations', () => {
    const privateAddress = (service as any).privateAddress.bind(service);
    expect(privateAddress('127.0.0.1')).toBe(true);
    expect(privateAddress('10.0.0.4')).toBe(true);
    expect(privateAddress('169.254.169.254')).toBe(true);
    expect(privateAddress('::1')).toBe(true);
    expect(privateAddress('::ffff:127.0.0.1')).toBe(true);
    expect(privateAddress('93.184.216.34')).toBe(false);
  });

  it('rejects a hostname when any DNS answer is private', async () => {
    (lookup as jest.Mock).mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.2', family: 4 },
    ]);
    await expect(
      (service as any).validateDestination('https://example.com/hook'),
    ).rejects.toThrow('Endpoint destination is not allowed');
  });

  it('allows domain events and rejects integration control recursion', () => {
    expect(
      (service as any).validateActions([AuditAction.TASK_CREATED]),
    ).toEqual([AuditAction.TASK_CREATED]);
    expect(() =>
      (service as any).validateActions([
        AuditAction.INTEGRATION_ENDPOINT_CREATED,
      ]),
    ).toThrow('Unsupported integration action');
  });

  it('signs canonical bytes and records a successful bounded attempt', async () => {
    const secret = 'whsec_test';
    const endpoint = {
      id: 'endpoint-1',
      organization_id: 'org-1',
      active: true,
      url: 'https://example.com/hooks',
      secret_ciphertext: (service as any).encrypt(secret),
    };
    endpoints.createQueryBuilder.mockReturnValue({
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(endpoint),
    });
    audits.findOne.mockResolvedValue({
      id: 'event-1',
      schema_version: 2,
      organization_id: 'org-1',
      project_id: 7,
      action: AuditAction.TASK_CREATED,
      outcome: AuditOutcome.SUCCEEDED,
      actor_type: AuditActorType.HUMAN,
      actor_id: '4',
      actor_label: 'Member',
      subject_type: AuditSubjectType.TASK,
      subject_id: '9',
      subject_label: 'Task',
      source: AuditSource.API,
      correlation_id: 'correlation-1',
      causation_id: null,
      before_changes: null,
      after_changes: { title: 'Safe' },
      metadata: null,
      occurred_at: new Date('2026-09-03T10:00:00Z'),
      created_at: new Date('2026-09-03T10:00:00Z'),
    });
    (axios.post as jest.Mock).mockResolvedValue({ status: 204, headers: {} });
    deliveries.update.mockResolvedValue({ affected: 1 });
    attempts.insert.mockResolvedValue({});
    await (service as any).send({
      id: 'delivery-1',
      organization_id: 'org-1',
      endpoint_id: 'endpoint-1',
      audit_event_id: 'event-1',
      generation: 1,
      state: 'sending',
      attempt_count: 0,
    });
    const [url, body, options] = (axios.post as jest.Mock).mock.calls[0];
    expect(url).toBe('https://example.com/hooks');
    expect(JSON.parse(body).event.id).toBe('event-1');
    expect(options.maxRedirects).toBe(0);
    expect(options.headers['x-tailpoint-signature']).toMatch(
      /^sha256=[a-f0-9]{64}$/,
    );
    expect(attempts.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        delivery_id: 'delivery-1',
        outcome: 'succeeded',
        status_code: 204,
      }),
    );
  });

  it('signs with current and previous secrets during rotation overlap', () => {
    const endpoint = {
      secret_ciphertext: (service as any).encrypt('current'),
      previous_secret_ciphertext: (service as any).encrypt('previous'),
      previous_secret_expires_at: new Date(Date.now() + 60_000),
    };
    expect(
      (service as any).signatures(endpoint, '123', '{}').split(','),
    ).toHaveLength(2);
    endpoint.previous_secret_expires_at = new Date(Date.now() - 1);
    expect(
      (service as any).signatures(endpoint, '123', '{}').split(','),
    ).toHaveLength(1);
  });

  it('honors bounded Retry-After values', () => {
    expect((service as any).retryDelay(1, '30')).toBe(30_000);
    expect((service as any).retryDelay(1, '99999')).toBe(3_600_000);
  });

  it('restricts project-owner delivery reads to the owned project', async () => {
    memberships.findOne.mockResolvedValue({ role: 'member' });
    peers.findOne.mockResolvedValue({ id: 1 });
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    deliveries.createQueryBuilder.mockReturnValue(qb);
    await service.listDeliveries({ userId: 4 }, 'org-1', { projectId: 7 });
    expect(qb.andWhere).toHaveBeenCalledWith('d.project_id=:ownedProjectId', {
      ownedProjectId: 7,
    });
  });

  it('cancels an unstarted send when the capability is disabled', async () => {
    endpoints.createQueryBuilder.mockReturnValue({
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: 'endpoint-1',
        organization_id: 'org-1',
        active: true,
      }),
    });
    audits.findOne.mockResolvedValue({ id: 'event-1' });
    entitlements.resolveOrganization.mockResolvedValue([
      { key: CapabilityKey.RELIABLE_INTEGRATION_DELIVERY, enabled: false },
    ]);
    await (service as any).send({
      id: 'delivery-1',
      endpoint_id: 'endpoint-1',
      audit_event_id: 'event-1',
    });
    expect(deliveries.update).toHaveBeenCalledWith(
      'delivery-1',
      expect.objectContaining({
        state: 'cancelled',
        failure_code: 'ENDPOINT_UNAVAILABLE',
      }),
    );
    expect(axios.post).not.toHaveBeenCalled();
  });

  it.each([
    [400, 'dead_letter', 'HTTP_PERMANENT'],
    [503, 'queued', 'HTTP_RETRYABLE'],
  ])(
    'classifies HTTP %s into %s',
    async (statusCode, expectedState, expectedCode) => {
      const endpoint = {
        id: 'endpoint-1',
        organization_id: 'org-1',
        active: true,
        url: 'https://example.com/hooks',
        secret_ciphertext: (service as any).encrypt('secret'),
      };
      endpoints.createQueryBuilder.mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(endpoint),
      });
      audits.findOne.mockResolvedValue({
        id: 'event-1',
        schema_version: 2,
        organization_id: 'org-1',
        project_id: null,
        action: AuditAction.TASK_CREATED,
        outcome: AuditOutcome.SUCCEEDED,
        actor_type: AuditActorType.SYSTEM,
        actor_id: 'system',
        actor_label: 'System',
        subject_type: AuditSubjectType.TASK,
        subject_id: '9',
        subject_label: 'Task',
        source: AuditSource.API,
        correlation_id: 'c',
        causation_id: null,
        before_changes: null,
        after_changes: null,
        metadata: null,
        occurred_at: new Date(),
        created_at: new Date(),
      });
      (axios.post as jest.Mock).mockResolvedValue({
        status: statusCode,
        headers: {},
      });
      deliveries.update.mockResolvedValue({ affected: 1 });
      attempts.insert.mockResolvedValue({});
      await (service as any).send({
        id: 'delivery-1',
        endpoint_id: 'endpoint-1',
        audit_event_id: 'event-1',
        attempt_count: 0,
      });
      expect(deliveries.update).toHaveBeenLastCalledWith(
        { id: 'delivery-1', state: 'sending' },
        expect.objectContaining({
          state: expectedState,
          failure_code: expectedCode,
        }),
      );
    },
  );

  it('replay creates a new generation for the original audit event', async () => {
    memberships.findOne.mockResolvedValue({ role: 'org_admin' });
    const source = {
      id: 'delivery-1',
      organization_id: 'org-1',
      project_id: 7,
      endpoint_id: 'endpoint-1',
      audit_event_id: 'event-1',
      generation: 1,
      state: 'dead_letter',
    };
    deliveries.findOne.mockResolvedValue(source);
    deliveries.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ generation: 2 }),
    });
    deliveries.save.mockImplementation(async (value) => value);
    const replay = await service.replay({ userId: 4 }, 'org-1', 'delivery-1', {
      reason: 'Receiver recovered',
    });
    expect(replay).toEqual(
      expect.objectContaining({
        audit_event_id: 'event-1',
        generation: 3,
        state: 'queued',
      }),
    );
    expect(writer.append).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        action: AuditAction.INTEGRATION_DELIVERY_REPLAYED,
      }),
    );
  });

  it('recovers expired leases and conditionally claims one due delivery', async () => {
    const execute = jest.fn().mockResolvedValue({ affected: 1 });
    deliveries.createQueryBuilder.mockReturnValue({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute,
    });
    const due = { id: 'delivery-1', state: 'queued' };
    deliveries.findOne.mockResolvedValue(due);
    deliveries.update.mockResolvedValue({ affected: 1 });
    const send = jest
      .spyOn(service as any, 'send')
      .mockResolvedValue(undefined);
    await service.deliver();
    expect(execute).toHaveBeenCalled();
    expect(deliveries.update).toHaveBeenCalledWith(
      { id: 'delivery-1', state: 'queued' },
      expect.objectContaining({ state: 'sending' }),
    );
    expect(send).toHaveBeenCalledWith(due);
  });

  it('publishes a matching committed audit event with a stable generation', async () => {
    const checkpoint = {
      publisher: 'audit-v2',
      occurred_at: new Date(0),
      event_id: null,
    };
    checkpoints.findOne.mockResolvedValue(checkpoint);
    checkpoints.save.mockResolvedValue(checkpoint);
    const event = {
      id: 'event-1',
      organization_id: 'org-1',
      project_id: 7,
      action: AuditAction.TASK_CREATED,
      occurred_at: new Date('2026-09-03T10:00:00Z'),
      created_at: new Date('2026-09-03T10:00:00Z'),
    };
    const auditQb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([event]),
    };
    audits.createQueryBuilder.mockReturnValue(auditQb);
    endpoints.find.mockResolvedValue([
      {
        id: 'endpoint-1',
        organization_id: 'org-1',
        project_id: 7,
        active: true,
        actions: [AuditAction.TASK_CREATED],
      },
    ]);
    deliveries.upsert.mockResolvedValue({});
    manager.getRepository.mockImplementation((entity) =>
      entity.name === 'IntegrationPublisherCheckpoint'
        ? checkpoints
        : entity.name === 'AuditLog'
          ? audits
          : entity.name === 'IntegrationDelivery'
            ? deliveries
            : endpoints,
    );
    await service.publish();
    expect(deliveries.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint_id: 'endpoint-1',
        audit_event_id: 'event-1',
        generation: 1,
      }),
      ['endpoint_id', 'audit_event_id', 'generation'],
    );
    expect(checkpoint.event_id).toBe('event-1');
  });
});
