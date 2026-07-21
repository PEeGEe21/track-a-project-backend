import { OpenAiTextGenerationProvider } from './openai-ai.provider';

describe('OpenAiTextGenerationProvider', () => {
  const originalKey = process.env.OPENAI_API_KEY;

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalKey;
    jest.restoreAllMocks();
  });

  it('disables provider storage and returns usage metadata', async () => {
    process.env.OPENAI_API_KEY = 'server-only-key';
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: 'Draft',
        model: 'test-model',
        usage: { input_tokens: 12, output_tokens: 3 },
      }),
    } as Response);

    const result = await new OpenAiTextGenerationProvider().generate({
      model: 'test-model',
      instructions: 'instructions',
      input: 'workspace content',
      timeoutMs: 1000,
    });

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(request.body as string)).toMatchObject({ store: false });
    expect(request.headers).toMatchObject({
      Authorization: 'Bearer server-only-key',
    });
    expect(result.usage).toEqual({ inputTokens: 12, outputTokens: 3 });
  });

  it('preserves quota diagnostics without exposing the provider message', async () => {
    process.env.OPENAI_API_KEY = 'server-only-key';
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({ 'x-request-id': 'req_123', 'retry-after': '2' }),
      json: async () => ({
        error: { code: 'insufficient_quota', message: 'raw provider detail' },
      }),
    } as Response);

    await expect(
      new OpenAiTextGenerationProvider().generate({
        model: 'test-model',
        instructions: 'instructions',
        input: 'text',
        timeoutMs: 1000,
      }),
    ).rejects.toMatchObject({
      status: 429,
      errorCode: 'provider_quota_exceeded',
      providerRequestId: 'req_123',
      retryAfterSeconds: 2,
    });
  });
});
