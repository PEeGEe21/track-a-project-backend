import { IntakeEmailService } from './intake-email.service';

describe('IntakeEmailService', () => {
  const authorization = { assertProjectPermission: jest.fn() };
  const entitlements = {
    resolveOrganization: jest.fn(async () => [
      { key: 'universal_intake', enabled: true },
    ]),
  };
  const event = {
    id: 'event-1',
    organization_id: 'org-1',
    project_id: 7,
    state: 'received',
    task_id: null,
  };
  const normalized = {
    receive: jest.fn(async () => ({ event: { ...event }, idempotent: false })),
    retainDisposition: jest.fn(async (value) => value),
  };
  const ingestion = {
    processReceivedEmailEvent: jest.fn(async (value) => ({
      event: { ...value, state: 'accepted' },
      outcome: { taskId: 42 },
      idempotent: false,
    })),
  };
  const addresses = {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({ id: 'address-1', ...value })),
    find: jest.fn(),
    findOne: jest.fn(),
  };
  const attachments = {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
  };
  const storage = { uploadFile: jest.fn(async () => 'quarantine/key') };
  let service: IntakeEmailService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SENDGRID_INBOUND_ACCESS_TOKEN = 'provider-token';
    process.env.INBOUND_EMAIL_DOMAIN = 'inbound.example.test';
    service = new IntakeEmailService(
      authorization as any,
      entitlements as any,
      normalized as any,
      ingestion as any,
      addresses as any,
      attachments as any,
      storage as any,
    );
    addresses.findOne.mockResolvedValue({
      id: 'address-1',
      organization_id: 'org-1',
      project_id: 7,
      token: 'opaque',
      active: true,
      spam_threshold: 5,
    });
  });

  it('creates an opaque, rotatable project address', async () => {
    const result = await service.create({ userId: 9 } as any, 'org-1', 7, {
      name: 'Requests',
    });
    expect(result.address).toMatch(/@inbound\.example\.test$/);
    expect(addresses.save).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: 'org-1',
        project_id: 7,
        token: expect.any(String),
      }),
    );
  });

  it('authenticates, sanitizes, attributes, and creates one task', async () => {
    await expect(
      service.receive(
        'Bearer provider-token',
        {
          envelope: JSON.stringify({ to: ['opaque@inbound.example.test'] }),
          headers:
            'From: sender@example.test\r\nMessage-ID: <message-1@example.test>',
          from: 'Outside Sender <sender@example.test>',
          subject: 'Production failed',
          text: 'Safe fallback',
          html: '<p>Hello</p><script>alert(1)</script><img src="https://tracker.test/pixel">',
          spam_score: '0.4',
        },
        [],
      ),
    ).resolves.toEqual({
      accepted: true,
      eventId: 'event-1',
      taskId: 42,
      idempotent: false,
    });
    expect(normalized.receive).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'email',
        idempotencyKey: '<message-1@example.test>',
        normalizedPayload: expect.objectContaining({
          sender: 'Outside Sender <sender@example.test>',
        }),
      }),
    );
    expect(ingestion.processReceivedEmailEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        title: 'Production failed',
        description_html: expect.not.stringContaining('<script'),
      }),
    );
  });

  it('returns a neutral result for an unknown recipient', async () => {
    addresses.findOne.mockResolvedValue(null);
    await expect(
      service.receive(
        'Bearer provider-token',
        { envelope: JSON.stringify({ to: ['unknown@inbound.example.test'] }) },
        [],
      ),
    ).resolves.toEqual({ accepted: false });
    expect(normalized.receive).not.toHaveBeenCalled();
  });

  it('durably quarantines messages over the spam threshold', async () => {
    await expect(
      service.receive(
        'Bearer provider-token',
        {
          envelope: JSON.stringify({ to: ['opaque@inbound.example.test'] }),
          headers: 'Message-ID: <spam@example.test>',
          subject: 'Offer',
          spam_score: '8.5',
        },
        [],
      ),
    ).resolves.toEqual({
      accepted: false,
      eventId: 'event-1',
      quarantined: true,
    });
    expect(normalized.retainDisposition).toHaveBeenCalledWith(
      expect.anything(),
      'quarantined',
      'spam_threshold',
      expect.any(String),
    );
    expect(ingestion.processReceivedEmailEvent).not.toHaveBeenCalled();
  });

  it('quarantines supported attachments and rejects unsafe types', async () => {
    const files = [
      {
        originalname: 'report.pdf',
        mimetype: 'application/pdf',
        size: 4,
        buffer: Buffer.from('safe'),
      },
      {
        originalname: 'payload.exe',
        mimetype: 'application/x-msdownload',
        size: 3,
        buffer: Buffer.from('bad'),
      },
    ] as any;
    await service.receive(
      'Bearer provider-token',
      {
        envelope: JSON.stringify({ to: ['opaque@inbound.example.test'] }),
        headers: 'Message-ID: <files@example.test>',
        subject: 'Files',
      },
      files,
    );
    expect(storage.uploadFile).toHaveBeenCalledTimes(1);
    expect(attachments.save).toHaveBeenCalledWith(
      expect.objectContaining({
        original_name: 'report.pdf',
        status: 'quarantined',
      }),
    );
    expect(attachments.save).toHaveBeenCalledWith(
      expect.objectContaining({
        original_name: 'payload.exe',
        status: 'rejected',
      }),
    );
  });

  it('rejects an invalid provider credential without resolving recipients', async () => {
    await expect(service.receive('Bearer wrong-token', {}, [])).rejects.toThrow(
      'Email provider authentication failed',
    );
    expect(addresses.findOne).not.toHaveBeenCalled();
  });
});
