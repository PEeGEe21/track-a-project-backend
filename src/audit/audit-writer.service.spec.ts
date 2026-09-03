import { EntityManager } from 'typeorm';
import {
  AuditAction,
  AuditActorType,
  AuditSource,
  AuditSubjectType,
} from './audit-contract';
import { AuditPayloadSanitizer } from './audit-payload-sanitizer';
import { AuditWriterService } from './audit-writer.service';

describe('AuditWriterService', () => {
  const input = {
    organizationId: 'organization-1',
    projectId: 42,
    action: AuditAction.TASK_UPDATED,
    actor: { type: AuditActorType.HUMAN, id: 7, label: 'Project owner' },
    subject: { type: AuditSubjectType.TASK, id: 9, label: 'Safe task' },
    source: AuditSource.API,
    correlationId: 'correlation-1',
    before: { title: 'Before', description: 'private' },
    after: { title: 'After', password: 'secret' },
    metadata: { route: '/tasks/9', token: 'secret' },
    occurredAt: new Date('2026-08-16T10:00:00.000Z'),
  };

  function setup() {
    const repository = {
      create: jest.fn((value) => value),
      insert: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn(),
    };
    const manager = {
      getRepository: jest.fn().mockReturnValue(repository),
      queryRunner: { isTransactionActive: true },
    } as unknown as EntityManager;
    return { repository, manager };
  }

  it('inserts a sanitized version-2 event through the supplied manager', async () => {
    const { repository, manager } = setup();
    const service = new AuditWriterService(new AuditPayloadSanitizer(), {
      correlationId: () => 'request-correlation',
      current: () => ({ requestId: 'request-1' }),
    } as any);

    const id = await service.append(manager, input);

    expect(id).toEqual(expect.any(String));
    expect(repository.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id,
        schema_version: 2,
        organization_id: 'organization-1',
        project_id: 42,
        actor_id: '7',
        subject_id: '9',
        before_changes: { title: 'Before' },
        after_changes: { title: 'After' },
        metadata: { route: '/tasks/9' },
        request_id: 'request-1',
        correlation_id: 'correlation-1',
      }),
    );
  });

  it('returns the existing event ID for a retry identity', async () => {
    const { repository, manager } = setup();
    repository.insert.mockRejectedValue({ code: 'ER_DUP_ENTRY' });
    repository.findOne.mockResolvedValue({ id: 'existing-event' });
    const service = new AuditWriterService(new AuditPayloadSanitizer(), {
      correlationId: () => 'request-correlation',
    } as any);

    await expect(
      service.append(manager, { ...input, sourceEventKey: 'retry-1' }),
    ).resolves.toBe('existing-event');
    expect(repository.findOne).toHaveBeenCalledWith({
      select: { id: true },
      where: {
        organization_id: 'organization-1',
        source: AuditSource.API,
        source_event_key: 'retry-1',
      },
    });
  });

  it('does not swallow unrelated insert failures', async () => {
    const { repository, manager } = setup();
    const failure = new Error('database unavailable');
    repository.insert.mockRejectedValue(failure);
    const service = new AuditWriterService(new AuditPayloadSanitizer(), {
      correlationId: () => 'request-correlation',
    } as any);

    await expect(service.append(manager, input)).rejects.toBe(failure);
  });

  it('rejects a manager outside a database transaction', async () => {
    const { manager } = setup();
    (
      manager.queryRunner as { isTransactionActive: boolean }
    ).isTransactionActive = false;
    const service = new AuditWriterService(new AuditPayloadSanitizer(), {
      correlationId: () => 'request-correlation',
    } as any);

    await expect(service.append(manager, input)).rejects.toThrow(
      'requires an active database transaction',
    );
  });
});
