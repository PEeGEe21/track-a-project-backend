import { createHmac } from 'crypto';
import { GithubService } from './github.service';

describe('GithubService', () => {
  const repo = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    findOneByOrFail: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
    update: jest.fn(),
    delete: jest.fn(),
    insert: jest.fn(),
    upsert: jest.fn(),
    createQueryBuilder: jest.fn(),
  });
  let service: GithubService;
  let connections: any;
  let deliveries: any;
  let artifacts: any;
  let tasks: any;
  let links: any;
  let authorization: any;
  let notifications: any;
  let entitlements: any;
  let dataSource: any;
  let auditWriter: any;
  beforeEach(() => {
    connections = repo();
    deliveries = repo();
    artifacts = repo();
    tasks = repo();
    links = repo();
    authorization = {
      resolveProjectOwnerIds: jest.fn().mockResolvedValue([4]),
      assertProjectPermission: jest.fn().mockResolvedValue({}),
    };
    notifications = { enqueueNotification: jest.fn().mockResolvedValue({}) };
    entitlements = {
      assertCapability: jest.fn().mockResolvedValue(undefined),
      resolveOrganization: jest
        .fn()
        .mockResolvedValue([{ key: 'github_integration', enabled: true }]),
    };
    dataSource = { transaction: jest.fn() };
    auditWriter = {
      append: jest.fn(),
      correlationId: jest.fn().mockReturnValue('correlation-1'),
    };
    service = new GithubService(
      connections,
      deliveries,
      artifacts,
      links,
      tasks,
      authorization,
      entitlements,
      dataSource,
      auditWriter,
      { getBullConnection: jest.fn() } as any,
      {
        increment: jest.fn().mockResolvedValue({ isBlocked: false }),
      } as any,
      notifications as any,
    );
  });

  it('validates the exact GitHub HMAC bytes', () => {
    const raw = Buffer.from('{"issue":1}');
    const signature = `sha256=${createHmac('sha256', 'secret')
      .update(raw)
      .digest('hex')}`;
    expect((service as any).valid('secret', signature, raw)).toBe(true);
    expect((service as any).valid('secret', signature, Buffer.from('{}'))).toBe(
      false,
    );
  });

  it('normalizes a pull request without retaining its body', () => {
    const [artifact] = (service as any).normalize('pull_request', {
      action: 'opened',
      sender: { login: 'octocat' },
      pull_request: {
        id: 10,
        number: 4,
        title: 'Ship TP-42',
        body: 'private TP-43',
        state: 'open',
        merged: false,
        html_url: 'https://github.com/acme/repo/pull/4',
        updated_at: '2026-09-16T00:00:00Z',
        head: { ref: 'tp-42' },
      },
    });
    expect(artifact).toMatchObject({
      type: 'pull_request',
      providerId: '10',
      reference: '#4',
      title: 'Ship TP-42',
      actor: 'octocat',
    });
    expect(artifact.metadata).toEqual({ head_ref: 'tp-42' });
    expect(artifact.taskIds).toEqual([42, 43]);
    expect(artifact.taskReferences).toEqual([
      { taskId: 42, source: 'pull_request_title', value: 'TP-42' },
      { taskId: 43, source: 'pull_request_body', value: 'TP-43' },
    ]);
    expect(JSON.stringify(artifact)).not.toContain('private');
  });

  it('bounds push deliveries to one hundred commits', () => {
    const artifacts = (service as any).normalize('push', {
      commits: Array.from({ length: 120 }, (_, id) => ({
        id: String(id),
        message: `TP-1 commit ${id}`,
        url: `https://github.com/c/${id}`,
      })),
    });
    expect(artifacts).toHaveLength(100);
  });

  it('ignores unsupported event families', () => {
    expect((service as any).normalize('member', {})).toEqual([]);
  });

  it('lists linked and unlinked project activity without crossing project scope', async () => {
    const artifactQuery = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        {
          id: 'artifact-1',
          type: 'commit',
          reference: 'abc1234',
          title: 'General maintenance',
          state: 'pushed',
          url: 'https://github.com/acme/repo/commit/abc1234',
          actor: 'octocat',
          metadata: { push_ref: 'main' },
          providerUpdatedAt: new Date('2026-09-20T12:00:00Z'),
          updatedAt: new Date('2026-09-20T12:00:00Z'),
          repository: 'acme/repo',
          connectionArchivedAt: null,
        },
      ]),
    };
    artifacts.createQueryBuilder.mockReturnValue(artifactQuery);
    const linkQuery = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    links.createQueryBuilder.mockReturnValue(linkQuery);

    await expect(
      service.projectActivity({ userId: 4 }, 'org-1', 7, {
        linked: 'unlinked',
        limit: 25,
      }),
    ).resolves.toMatchObject({
      data: [
        {
          id: 'artifact-1',
          repository: 'acme/repo',
          links: [],
        },
      ],
      meta: { hasMore: false, nextCursor: null },
    });
    expect(authorization.assertProjectPermission).toHaveBeenCalledWith(
      { userId: 4 },
      'org-1',
      7,
      'view',
    );
    expect(artifactQuery.where).toHaveBeenCalledWith(
      'a.organization_id=:org AND a.project_id=:projectId',
      { org: 'org-1', projectId: 7 },
    );
    expect(artifactQuery.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('NOT EXISTS'),
    );
  });

  it('rejects unsafe artifact URL schemes', () => {
    expect(
      (service as any).safeExternalUrl(
        'javascript:alert(1)',
        'https://github.com/acme/repo',
      ),
    ).toBe('https://github.com/acme/repo');
  });

  it('optionally restricts webhook source IPs to configured CIDRs', () => {
    const before = process.env.GITHUB_WEBHOOK_IP_ALLOWLIST;
    process.env.GITHUB_WEBHOOK_IP_ALLOWLIST = '192.30.252.0/22,2a0a:a440::/29';
    expect(() =>
      (service as any).assertAllowedSource('192.30.252.45'),
    ).not.toThrow();
    expect(() => (service as any).assertAllowedSource('203.0.113.10')).toThrow(
      'GitHub webhook source is not allowed',
    );
    if (before === undefined) delete process.env.GITHUB_WEBHOOK_IP_ALLOWLIST;
    else process.env.GITHUB_WEBHOOK_IP_ALLOWLIST = before;
  });

  it('reconciles a signed repository rename by stable provider id', async () => {
    connections.update.mockResolvedValue({ affected: 1 });
    const row = {
      id: 'connection-1',
      project_id: 7,
      organization_id: 'org-1',
      created_by_user_id: 4,
      provider_repository_id: '99',
      repository_full_name: 'acme/old-name',
      repository_renamed_at: null,
    };
    await (service as any).reconcileRepository(row, {
      id: 99,
      full_name: 'acme/new-name',
    });
    expect(connections.update).toHaveBeenCalledWith(
      'connection-1',
      expect.objectContaining({
        provider_repository_id: '99',
        repository_full_name: 'acme/new-name',
        repository_renamed_at: expect.any(Date),
      }),
    );
  });

  it('records connection lifecycle activity and a secret-free audit event', async () => {
    const activities = { create: jest.fn((value) => value), save: jest.fn() };
    const manager = { getRepository: jest.fn().mockReturnValue(activities) };
    await (service as any).recordLifecycle(
      manager,
      { userId: 4 },
      'org-1',
      {
        id: 'connection-1',
        project_id: 7,
        repository_full_name: 'acme/repo',
      },
      'github_connection.created',
      'Connected GitHub repository acme/repo',
      true,
      undefined,
      { repository: 'acme/repo', active: true },
    );
    expect(activities.save).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'github_connection',
        projectId: 7,
      }),
    );
    expect(auditWriter.append).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        organizationId: 'org-1',
        projectId: 7,
        action: 'github_connection.created',
        after: { repository: 'acme/repo', active: true },
      }),
    );
    expect(JSON.stringify(auditWriter.append.mock.calls[0])).not.toContain(
      'secret',
    );
  });

  it('archives connection removal without deleting artifacts or task links', async () => {
    const row = {
      id: 'connection-1',
      organization_id: 'org-1',
      project_id: 7,
      repository_full_name: 'acme/repo',
      active: true,
      archived_at: null,
      health_state: 'healthy',
    };
    jest.spyOn(service as any, 'managed').mockResolvedValue(row);
    jest.spyOn(service as any, 'auditEnabled').mockResolvedValue(false);
    jest.spyOn(service as any, 'recordLifecycle').mockResolvedValue(undefined);
    dataSource.transaction.mockImplementation(async (work) =>
      work({ getRepository: jest.fn().mockReturnValue(connections) }),
    );
    connections.save.mockResolvedValue(row);
    await expect(
      service.archive({ userId: 4 }, 'org-1', 'connection-1'),
    ).resolves.toEqual({ success: true });
    expect(row).toMatchObject({
      active: false,
      archived_at: expect.any(Date),
      health_state: 'archived',
    });
    expect(connections.delete).not.toHaveBeenCalled();
    expect(links.delete).not.toHaveBeenCalled();
  });

  it('rejects an invalid signature before claiming a delivery', async () => {
    const secret = 'correct-secret';
    const encrypted = (service as any).encrypt(secret);
    connections.createQueryBuilder.mockReturnValue({
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: 'connection-1',
        active: true,
        organization_id: 'org-1',
        project_id: 7,
        repository_full_name: 'acme/repo',
        secret_ciphertext: encrypted,
        previous_secret_ciphertext: null,
        previous_secret_expires_at: null,
      }),
    });
    const raw = Buffer.from('{"repository":{"full_name":"acme/repo"}}');
    await expect(
      service.receive(
        'key',
        {
          'x-github-delivery': 'delivery-1',
          'x-github-event': 'issues',
          'x-hub-signature-256': 'sha256=invalid',
        },
        { repository: { full_name: 'acme/repo' } },
        raw,
      ),
    ).rejects.toThrow('Invalid GitHub signature');
    expect(deliveries.insert).not.toHaveBeenCalled();
  });

  it('returns the stored outcome when GitHub redelivers the same delivery id', async () => {
    const secret = 'secret';
    const encrypted = (service as any).encrypt(secret);
    connections.createQueryBuilder.mockReturnValue({
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: 'connection-1',
        active: true,
        organization_id: 'org-1',
        project_id: 7,
        repository_full_name: 'acme/repo',
        secret_ciphertext: encrypted,
        previous_secret_ciphertext: null,
        previous_secret_expires_at: null,
      }),
    });
    deliveries.insert.mockRejectedValue(new Error('duplicate'));
    deliveries.findOne.mockResolvedValue({ state: 'processed' });
    const body = { repository: { id: 99, full_name: 'acme/repo' } };
    const raw = Buffer.from(JSON.stringify(body));
    const signature = `sha256=${createHmac('sha256', secret)
      .update(raw)
      .digest('hex')}`;
    await expect(
      service.receive(
        'key',
        {
          'x-github-delivery': 'delivery-1',
          'x-github-event': 'ping',
          'x-hub-signature-256': signature,
        },
        body,
        raw,
      ),
    ).resolves.toEqual({
      success: true,
      data: { deliveryId: 'delivery-1', state: 'processed', duplicate: true },
    });
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('re-enqueues a claimed queued delivery after an interrupted request', async () => {
    const secret = 'secret';
    const encrypted = (service as any).encrypt(secret);
    connections.createQueryBuilder.mockReturnValue({
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: 'connection-1',
        active: true,
        organization_id: 'org-1',
        project_id: 7,
        repository_full_name: 'acme/repo',
        provider_repository_id: '99',
        secret_ciphertext: encrypted,
        previous_secret_ciphertext: null,
        previous_secret_expires_at: null,
      }),
    });
    deliveries.insert.mockRejectedValue(new Error('duplicate'));
    deliveries.findOne.mockResolvedValue({ state: 'queued' });
    const enqueue = jest
      .spyOn(service as any, 'enqueueDelivery')
      .mockResolvedValue(undefined);
    const body = {
      action: 'opened',
      repository: { id: 99, full_name: 'acme/repo' },
      issue: {
        id: 102,
        number: 13,
        title: 'TRACK-13 interrupted delivery',
        body: null,
        state: 'open',
        html_url: 'https://github.com/acme/repo/issues/13',
        updated_at: '2026-09-20T13:00:00Z',
      },
    };
    const raw = Buffer.from(JSON.stringify(body));
    const signature = `sha256=${createHmac('sha256', secret)
      .update(raw)
      .digest('hex')}`;
    await expect(
      service.receive(
        'key',
        {
          'x-github-delivery': 'delivery-interrupted',
          'x-github-event': 'issues',
          'x-hub-signature-256': signature,
        },
        body,
        raw,
      ),
    ).resolves.toMatchObject({ data: { state: 'queued', accepted: true } });
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryId: 'delivery-interrupted' }),
    );
  });

  it('processes GitHub ping deliveries without waiting for the queue', async () => {
    const secret = 'secret';
    const encrypted = (service as any).encrypt(secret);
    connections.createQueryBuilder.mockReturnValue({
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: 'connection-1',
        active: true,
        organization_id: 'org-1',
        project_id: 7,
        repository_full_name: 'acme/repo',
        provider_repository_id: '99',
        secret_ciphertext: encrypted,
        previous_secret_ciphertext: null,
        previous_secret_expires_at: null,
      }),
    });
    deliveries.insert.mockResolvedValue({});
    deliveries.update.mockResolvedValue({ affected: 1 });
    connections.update.mockResolvedValue({ affected: 1 });
    const enqueue = jest.spyOn(service as any, 'enqueueDelivery');
    const body = { repository: { id: 99, full_name: 'acme/repo' } };
    const raw = Buffer.from(JSON.stringify(body));
    const signature = `sha256=${createHmac('sha256', secret)
      .update(raw)
      .digest('hex')}`;

    await expect(
      service.receive(
        'key',
        {
          'x-github-delivery': 'ping-delivery',
          'x-github-event': 'ping',
          'x-hub-signature-256': signature,
        },
        body,
        raw,
      ),
    ).resolves.toEqual({
      success: true,
      data: { deliveryId: 'ping-delivery', state: 'processed', artifacts: 0 },
    });
    expect(enqueue).not.toHaveBeenCalled();
    expect(deliveries.update).toHaveBeenCalledWith(
      {
        connection_id: 'connection-1',
        provider_delivery_id: 'ping-delivery',
      },
      expect.objectContaining({ state: 'processed', artifact_count: 0 }),
    );
    expect(connections.update).toHaveBeenCalledWith(
      'connection-1',
      expect.objectContaining({
        last_delivery_state: 'processed',
        health_state: 'healthy',
        consecutive_failures: 0,
      }),
    );
  });

  it('reclaims a failed delivery for an idempotent GitHub retry', async () => {
    const secret = 'secret';
    const encrypted = (service as any).encrypt(secret);
    connections.createQueryBuilder.mockReturnValue({
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: 'connection-1',
        active: true,
        organization_id: 'org-1',
        project_id: 7,
        repository_full_name: 'acme/repo',
        secret_ciphertext: encrypted,
        previous_secret_ciphertext: null,
        previous_secret_expires_at: null,
      }),
    });
    deliveries.insert.mockRejectedValue(new Error('duplicate'));
    deliveries.findOne.mockResolvedValue({
      id: 'stored-delivery',
      state: 'failed',
    });
    deliveries.update.mockResolvedValue({ affected: 1 });
    dataSource.transaction.mockResolvedValue(undefined);
    connections.update.mockResolvedValue({});
    const body = { repository: { id: 99, full_name: 'acme/repo' } };
    const raw = Buffer.from(JSON.stringify(body));
    const signature = `sha256=${createHmac('sha256', secret)
      .update(raw)
      .digest('hex')}`;
    await service.receive(
      'key',
      {
        'x-github-delivery': 'delivery-1',
        'x-github-event': 'ping',
        'x-hub-signature-256': signature,
      },
      body,
      raw,
    );
    expect(deliveries.update).toHaveBeenCalledWith(
      { id: 'stored-delivery', state: 'failed' },
      expect.objectContaining({ state: 'queued', failure_code: null }),
    );
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('scopes referenced task lookup to the connection project and organization', async () => {
    const secret = 'secret';
    const encrypted = (service as any).encrypt(secret);
    connections.createQueryBuilder.mockReturnValue({
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: 'connection-1',
        active: true,
        organization_id: 'org-1',
        project_id: 7,
        repository_full_name: 'acme/repo',
        secret_ciphertext: encrypted,
        previous_secret_ciphertext: null,
        previous_secret_expires_at: null,
      }),
    });
    connections.findOneByOrFail.mockResolvedValue({
      id: 'connection-1',
      organization_id: 'org-1',
      project_id: 7,
      repository_full_name: 'acme/repo',
    });
    deliveries.insert.mockResolvedValue({});
    const taskQuery = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    tasks.createQueryBuilder.mockReturnValue(taskQuery);
    dataSource.transaction.mockResolvedValue(undefined);
    connections.update.mockResolvedValue({});
    const body = {
      action: 'opened',
      repository: {
        id: 99,
        full_name: 'acme/repo',
        html_url: 'https://github.com/acme/repo',
      },
      issue: {
        id: 1,
        number: 2,
        title: 'Work on TP-42',
        body: 'Also TP-99',
        state: 'open',
        html_url: 'https://github.com/acme/repo/issues/2',
      },
    };
    const raw = Buffer.from(JSON.stringify(body));
    const signature = `sha256=${createHmac('sha256', secret)
      .update(raw)
      .digest('hex')}`;
    await service.receive(
      'key',
      {
        'x-github-delivery': 'delivery-2',
        'x-github-event': 'issues',
        'x-hub-signature-256': signature,
      },
      body,
      raw,
    );
    expect(dataSource.transaction).not.toHaveBeenCalled();
    await new Promise((resolve) => setImmediate(resolve));
    expect(taskQuery.where).toHaveBeenCalledWith('t.id IN (:...ids)', {
      ids: [42, 99],
    });
    expect(taskQuery.andWhere).toHaveBeenCalledWith(
      't.project_id=:projectId AND t.organization_id=:org',
      { projectId: 7, org: 'org-1' },
    );
  });

  it('uses a provider timestamp guard and skips stale artifact link writes', async () => {
    const insertBuilder = {
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({}),
    };
    const updateBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    const artifactRepository = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(insertBuilder)
        .mockReturnValueOnce(updateBuilder),
      findOneByOrFail: jest.fn().mockResolvedValue({
        id: 'artifact-1',
        last_delivery_id: 'newer-delivery',
      }),
    };
    const deliveryRepository = {
      findOneByOrFail: jest.fn().mockResolvedValue({ state: 'queued' }),
      save: jest.fn(),
    };
    const linkRepository = { createQueryBuilder: jest.fn() };
    const manager = {
      getRepository: jest.fn((entity) => {
        if ((entity as any).name === 'GithubDelivery')
          return deliveryRepository;
        if ((entity as any).name === 'GithubArtifact')
          return artifactRepository;
        return linkRepository;
      }),
    };
    connections.findOneByOrFail.mockResolvedValue({
      id: 'connection-1',
      organization_id: 'org-1',
      project_id: 7,
      repository_full_name: 'acme/repo',
    });
    const taskQuery = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ id: 42 }]),
    };
    tasks.createQueryBuilder.mockReturnValue(taskQuery);
    dataSource.transaction.mockImplementation(async (work) => work(manager));
    connections.update.mockResolvedValue({ affected: 1 });
    await (service as any).processDelivery({
      connectionId: 'connection-1',
      deliveryId: 'stale-delivery',
      artifacts: [
        {
          type: 'issue',
          providerId: '10',
          url: 'https://github.com/acme/repo/issues/1',
          updatedAt: '2026-09-16T00:00:00Z',
          taskIds: [42],
        },
      ],
    });
    expect(updateBuilder.andWhere).toHaveBeenCalledWith(
      '(provider_updated_at IS NULL OR provider_updated_at < :providerUpdatedAt)',
      { providerUpdatedAt: new Date('2026-09-16T00:00:00Z') },
    );
    expect(linkRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('lets an Owner explicitly remove a mistaken immutable artifact link', async () => {
    tasks.findOne.mockResolvedValue({ id: 42, project: { id: 7 } });
    jest.spyOn(service as any, 'owner').mockResolvedValue(undefined);
    links.update.mockResolvedValue({ affected: 1 });
    await expect(
      service.unlinkTaskArtifact(
        { userId: 4 },
        'org-1',
        42,
        '9d254074-676b-4eaf-a590-8c7138e6f401',
      ),
    ).resolves.toEqual({ success: true });
    expect(links.update).toHaveBeenCalledWith(
      {
        organization_id: 'org-1',
        task_id: 42,
        artifact_id: '9d254074-676b-4eaf-a590-8c7138e6f401',
      },
      expect.objectContaining({
        state: 'suppressed',
        source: 'manual',
        manually_overridden: true,
      }),
    );
  });

  it('notifies both the permanent creator and co-owners after repeated delivery failures', async () => {
    connections.findOneByOrFail.mockResolvedValue({
      id: 'connection-1',
      organization_id: 'org-1',
      project_id: 7,
      repository_full_name: 'acme/repo',
      created_by_user_id: 4,
      consecutive_failures: 3,
      health_alerted_at: null,
    });
    connections.update.mockResolvedValue({ affected: 1 });
    authorization.resolveProjectOwnerIds.mockResolvedValue([4, 8]);
    await (service as any).maybeAlertFailure('connection-1');
    expect(connections.update).toHaveBeenCalledWith(
      { id: 'connection-1', health_alerted_at: expect.anything() },
      { health_alerted_at: expect.any(Date) },
    );
    expect(notifications.enqueueNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'GitHub connection needs attention',
        type: 'github_connection_health',
        recipient: { id: 4 },
      }),
      'org-1',
    );
    expect(notifications.enqueueNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: { id: 8 },
      }),
      'org-1',
    );
    expect(authorization.resolveProjectOwnerIds).toHaveBeenCalledWith(
      'org-1',
      7,
    );
  });
});
