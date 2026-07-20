import { AiAssistanceService } from './ai-assistance.service';
describe('AiAssistanceService', () => {
  const actor = { userId: 7, email: 'u@example.com', role: 'member' } as any;
  it('returns a review-gated contract without auditing raw content', async () => {
    const provider: any = {
      name: 'test',
      generate: jest
        .fn()
        .mockResolvedValue({ text: 'Draft', model: 'test-model' }),
    };
    const redaction: any = { redact: jest.fn().mockReturnValue('[REDACTED]') };
    const governance: any = {
      start: jest.fn().mockResolvedValue({ correlation_id: 'correlation-1' }),
      finish: jest.fn(),
    };
    const service = new AiAssistanceService(provider, redaction, governance);
    const result = await service.assist(actor, 'org-1', {
      featureId: 'rewrite_text',
      input: 'secret',
    });
    expect(result).toMatchObject({
      draft: 'Draft',
      requiresReview: true,
      citations: [],
    });
    expect(provider.generate).toHaveBeenCalledWith(
      expect.objectContaining({ input: '[REDACTED]' }),
    );
    expect(governance.start).toHaveBeenCalledWith(
      expect.not.objectContaining({ input: expect.anything() }),
    );
  });
  it('enforces usage limits before provider invocation', async () => {
    const provider: any = { name: 'test', generate: jest.fn() };
    const governance: any = {
      start: jest
        .fn()
        .mockRejectedValue(Object.assign(new Error(), { status: 429 })),
    };
    const service = new AiAssistanceService(
      provider,
      { redact: jest.fn().mockReturnValue('text') } as any,
      governance,
    );
    await expect(
      service.assist(actor, 'org-1', {
        featureId: 'rewrite_text',
        input: 'text',
      }),
    ).rejects.toMatchObject({ status: 429 });
    expect(provider.generate).not.toHaveBeenCalled();
  });
});
