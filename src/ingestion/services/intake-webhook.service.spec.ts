import { createHmac } from 'crypto';
import { IntakeWebhookService } from './intake-webhook.service';

describe('IntakeWebhookService', () => {
  const authorization = { assertProjectPermission: jest.fn() };
  const entitlements = {
    resolveOrganization: jest.fn(async () => [
      { key: 'universal_intake', enabled: true },
    ]),
  };
  const customFields = {
    prepareImportedValues: jest.fn(async (_o, _p, values) => values),
  };
  const ingestion = {
    processWebhookEvent: jest.fn(async () => ({
      event: { id: 'event-1' },
      outcome: { taskId: 42 },
      idempotent: false,
    })),
  };
  const sources = {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({ id: 'source-1', ...value })),
    find: jest.fn(),
    findOne: jest.fn(),
  };
  let service: IntakeWebhookService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = 'test-encryption-key';
    service = new IntakeWebhookService(
      authorization as any,
      entitlements as any,
      customFields as any,
      ingestion as any,
      sources as any,
    );
  });

  it('returns a secret once and never exposes its ciphertext', async () => {
    const created = await service.create({ userId: 9 } as any, 'org-1', 7, {
      name: 'Deployments',
      mapping: { titlePath: 'event.title' },
    });
    expect(created.secret).toMatch(/^whsec_/);
    expect(created).not.toHaveProperty('secret_ciphertext');
    expect(sources.save).toHaveBeenCalledWith(
      expect.objectContaining({
        secret_ciphertext: expect.any(String),
        public_key: expect.any(String),
      }),
    );
  });

  it('verifies the exact signed body and maps it into one normalized event', async () => {
    const created = await service.create({ userId: 9 } as any, 'org-1', 7, {
      name: 'Deployments',
      mapping: {
        titlePath: 'event.title',
        severityPath: 'event.severity',
        customFields: [{ fieldId: 'field-1', path: 'event.environment' }],
      },
    });
    const persisted = (sources.save as jest.Mock).mock.calls[0][0];
    sources.findOne.mockResolvedValue(persisted);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const raw = Buffer.from(
      JSON.stringify({
        event: {
          title: 'Build failed',
          severity: 'high',
          environment: 'production',
        },
      }),
    );
    const signature = createHmac('sha256', created.secret)
      .update(timestamp)
      .update('.')
      .update(raw)
      .digest('hex');

    await expect(
      service.receive(
        persisted.public_key,
        {
          'x-tailpoint-timestamp': timestamp,
          'x-tailpoint-signature': `sha256=${signature}`,
          'x-tailpoint-delivery': 'delivery-1',
        },
        JSON.parse(raw.toString()),
        raw,
      ),
    ).resolves.toEqual({
      accepted: true,
      eventId: 'event-1',
      taskId: 42,
      idempotent: false,
    });
    expect(ingestion.processWebhookEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'delivery-1',
        dto: expect.objectContaining({
          title: 'Build failed',
          severity: 'high',
        }),
      }),
    );
  });

  it('returns the same neutral authentication failure for stale signatures', async () => {
    sources.findOne.mockResolvedValue(null);
    await expect(
      service.receive(
        'unknown',
        {
          'x-tailpoint-timestamp': String(Math.floor(Date.now() / 1000) - 600),
          'x-tailpoint-signature': 'sha256=' + '0'.repeat(64),
          'x-tailpoint-delivery': 'delivery-1',
        },
        {},
        Buffer.from('{}'),
      ),
    ).rejects.toThrow('Webhook authentication failed');
    expect(ingestion.processWebhookEvent).not.toHaveBeenCalled();
  });

  it('accepts the previous secret during an explicit rotation overlap', async () => {
    const created = await service.create({ userId: 9 } as any, 'org-1', 7, {
      name: 'Rotating',
      mapping: { titlePath: 'title' },
    });
    const persisted = (sources.save as jest.Mock).mock.calls[0][0];
    sources.findOne.mockResolvedValue(persisted);
    const rotated = await service.rotate(
      { userId: 9 } as any,
      'org-1',
      7,
      'source-1',
      { overlapMinutes: 10 },
    );
    expect(rotated.secret).not.toEqual(created.secret);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const raw = Buffer.from('{"title":"From old sender"}');
    const signature = createHmac('sha256', created.secret)
      .update(timestamp)
      .update('.')
      .update(raw)
      .digest('hex');
    await expect(
      service.receive(
        persisted.public_key,
        {
          'x-tailpoint-timestamp': timestamp,
          'x-tailpoint-signature': signature,
          'x-tailpoint-delivery': 'delivery-old-secret',
        },
        { title: 'From old sender' },
        raw,
      ),
    ).resolves.toEqual(expect.objectContaining({ accepted: true }));
  });

  it('rejects unsafe mapping paths', async () => {
    await expect(
      service.create({ userId: 9 } as any, 'org-1', 7, {
        name: 'Unsafe',
        mapping: { titlePath: '__proto__.title' },
      }),
    ).rejects.toThrow('safe dotted JSON paths');
  });
});
