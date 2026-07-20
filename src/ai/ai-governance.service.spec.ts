import { AiGovernanceService } from './ai-governance.service';
describe('AiGovernanceService', () => {
  const actor = { userId: 3, email: 'a@b.com', role: 'member' } as any;
  it('enforces entitlement before counting usage', async () => {
    const audits: any = { countBy: jest.fn() };
    const entitlements: any = {
      assertCapability: jest.fn().mockRejectedValue(new Error('disabled')),
    };
    const service = new AiGovernanceService(audits, entitlements, {} as any);
    await expect(service.assertAvailable(actor, 'org-1')).rejects.toThrow(
      'disabled',
    );
    expect(audits.countBy).not.toHaveBeenCalled();
  });
  it('stores operational metadata without raw input or output', async () => {
    const audits: any = {
      countBy: jest.fn().mockResolvedValue(0),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
    };
    const manager: any = {
      getRepository: jest.fn((entity) =>
        entity.name === 'Organization'
          ? { findOneOrFail: jest.fn().mockResolvedValue({ id: 'org-1' }) }
          : audits,
      ),
    };
    const dataSource: any = {
      transaction: jest.fn((callback) => callback(manager)),
    };
    const entitlements: any = { assertCapability: jest.fn() };
    const service = new AiGovernanceService(
      {} as any,
      entitlements,
      dataSource,
    );
    await service.start({
      actor,
      organizationId: 'org-1',
      featureId: 'note_audio_transcription',
      templateId: 'audio_transcription',
      templateVersion: 1,
      provider: 'openai',
      model: 'whisper-1',
      inputSize: 100,
    });
    expect(audits.create.mock.calls[0][0]).not.toHaveProperty('input');
    expect(audits.create.mock.calls[0][0]).not.toHaveProperty('output');
  });

  it('reserves quota while holding an organization write lock', async () => {
    const organizationRepository = {
      findOneOrFail: jest.fn().mockResolvedValue({ id: 'org-1' }),
    };
    const audits: any = {
      countBy: jest.fn().mockResolvedValue(0),
      create: jest.fn((v) => v),
      save: jest.fn((v) => v),
    };
    const manager: any = {
      getRepository: jest.fn((entity) =>
        entity.name === 'Organization' ? organizationRepository : audits,
      ),
    };
    const service = new AiGovernanceService(
      {} as any,
      { assertCapability: jest.fn() } as any,
      { transaction: (cb) => cb(manager) } as any,
    );
    await service.start({
      actor,
      organizationId: 'org-1',
      featureId: 'rewrite_text',
      templateId: 'rewrite_text',
      templateVersion: 1,
      provider: 'test',
      model: 'test',
      inputSize: 4,
    });
    expect(organizationRepository.findOneOrFail).toHaveBeenCalledWith(
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    );
    expect(audits.save).toHaveBeenCalled();
  });
});
