import { HuggingFaceTextGenerationProvider } from './huggingface-ai.provider';

describe('HuggingFaceTextGenerationProvider', () => {
  const originalToken = process.env.HF_TOKEN;
  afterEach(() => {
    process.env.HF_TOKEN = originalToken;
    jest.restoreAllMocks();
  });

  it('uses routed Responses without putting its token in the body', async () => {
    process.env.HF_TOKEN = 'hf_server_only';
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: 'Draft',
        model: 'test-model',
        usage: { input_tokens: 4, output_tokens: 2 },
      }),
    } as Response);
    const result = await new HuggingFaceTextGenerationProvider().generate({
      model: 'test-model',
      instructions: 'instructions',
      input: 'workspace text',
      timeoutMs: 1000,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://router.huggingface.co/v1/responses',
      expect.any(Object),
    );
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(String(request.body)).not.toContain('hf_server_only');
    expect(result).toMatchObject({
      text: 'Draft',
      usage: { inputTokens: 4, outputTokens: 2 },
    });
  });

  it('normalizes a routed chat-completion response', async () => {
    process.env.HF_TOKEN = 'hf_server_only';
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '  Rewritten draft  ' } }],
        model: 'routed-model',
        usage: { prompt_tokens: 7, completion_tokens: 4 },
      }),
    } as Response);
    const result = await new HuggingFaceTextGenerationProvider().generate({
      model: 'test-model',
      instructions: 'instructions',
      input: 'workspace text',
      timeoutMs: 1000,
    });
    expect(result).toEqual({
      text: 'Rewritten draft',
      model: 'routed-model',
      usage: { inputTokens: 7, outputTokens: 4 },
    });
  });

  it('retries one transient connection timeout', async () => {
    process.env.HF_TOKEN = 'hf_server_only';
    const timeout = Object.assign(new TypeError('fetch failed'), {
      cause: { code: 'UND_ERR_CONNECT_TIMEOUT' },
    });
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockRejectedValueOnce(timeout)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ output_text: 'Draft' }),
      } as Response);
    const result = await new HuggingFaceTextGenerationProvider().generate({
      model: 'test-model',
      instructions: 'instructions',
      input: 'workspace text',
      timeoutMs: 30000,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.text).toBe('Draft');
  });

  it('normalizes nested text-value content', async () => {
    process.env.HF_TOKEN = 'hf_server_only';
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        output: [
          {
            type: 'message',
            content: [{ type: 'text', text: { value: 'Nested draft' } }],
          },
        ],
      }),
    } as Response);
    const result = await new HuggingFaceTextGenerationProvider().generate({
      model: 'test-model',
      instructions: 'instructions',
      input: 'workspace text',
      timeoutMs: 1000,
    });
    expect(result.text).toBe('Nested draft');
  });
});
