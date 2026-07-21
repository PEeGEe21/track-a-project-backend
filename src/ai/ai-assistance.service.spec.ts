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
      expect.objectContaining({
        input: '[REDACTED]',
        instructions: expect.stringContaining('never exceed 150 words'),
      }),
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

  it('summarizes task context assembled on the server', async () => {
    const provider: any = {
      name: 'test',
      generate: jest
        .fn()
        .mockResolvedValue({ text: 'Summary', model: 'test-model' }),
    };
    const governance: any = {
      start: jest.fn().mockResolvedValue({ correlation_id: 'summary-1' }),
      finish: jest.fn(),
    };
    const taskContext: any = {
      assembleDiscussion: jest.fn().mockResolvedValue('Trusted transcript'),
    };
    const service = new AiAssistanceService(
      provider,
      { redact: jest.fn((value) => value) } as any,
      governance,
      taskContext,
    );

    const result = await service.summarizeTaskThread(
      actor,
      'org-1',
      42,
    );

    expect(taskContext.assembleDiscussion).toHaveBeenCalledWith(
      actor,
      'org-1',
      42,
    );
    expect(provider.generate).toHaveBeenCalledWith(
      expect.objectContaining({ input: 'Trusted transcript' }),
    );
    expect(result).toMatchObject({ draft: 'Summary', requiresReview: true });
  });

  it('uses the bounded checklist prompt for checklist drafts', async () => {
    const provider: any = {
      name: 'test',
      generate: jest
        .fn()
        .mockResolvedValue({ text: '- Verify release', model: 'test-model' }),
    };
    const governance: any = {
      start: jest.fn().mockResolvedValue({ correlation_id: 'checklist-1' }),
      finish: jest.fn(),
    };
    const service = new AiAssistanceService(
      provider,
      { redact: jest.fn((value) => value) } as any,
      governance,
    );

    await service.assist(actor, 'org-1', {
      featureId: 'generate_checklist',
      input: 'Prepare the release',
    });

    expect(provider.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        instructions: expect.stringContaining('no more than 10 items'),
      }),
    );
  });

  it('returns a structured, review-gated project update draft', async () => {
    const provider: any = {
      name: 'test',
      generate: jest.fn().mockResolvedValue({
        text: JSON.stringify({
          health: 'at_risk',
          accomplishments: 'Beta shipped',
          blockers: 'QA capacity',
          next_steps: 'Finish testing',
        }),
        model: 'test-model',
      }),
    };
    const governance: any = {
      start: jest.fn().mockResolvedValue({ correlation_id: 'update-1' }),
      finish: jest.fn(),
    };
    const projectContext: any = {
      assembleUpdateContext: jest.fn().mockResolvedValue('Project context'),
    };
    const service = new AiAssistanceService(
      provider,
      { redact: jest.fn((value) => value) } as any,
      governance,
      undefined,
      projectContext,
    );

    const result = await service.draftProjectUpdate(actor, 'org-1', 5);

    expect(projectContext.assembleUpdateContext).toHaveBeenCalledWith(
      actor,
      'org-1',
      5,
    );
    expect(result).toMatchObject({
      requiresReview: true,
      structuredDraft: {
        health: 'at_risk',
        accomplishments: 'Beta shipped',
        blockers: 'QA capacity',
        next_steps: 'Finish testing',
      },
    });
  });

  it('returns the audit correlation ID when generation fails', async () => {
    const provider: any = {
      name: 'test',
      generate: jest
        .fn()
        .mockRejectedValue(new Error('provider secret detail')),
    };
    const governance: any = {
      start: jest
        .fn()
        .mockResolvedValue({ correlation_id: 'correlation-failed' }),
      finish: jest.fn(),
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
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        correlationId: 'correlation-failed',
      }),
      status: 503,
    });
    expect(governance.finish).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Number),
      expect.objectContaining({ status: 'failed' }),
    );
  });
});
