import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  TextGenerationProvider,
  TextGenerationRequest,
  TextGenerationResponse,
  TextGenerationProviderError,
} from './text-generation.provider';
@Injectable()
export class OpenAiTextGenerationProvider implements TextGenerationProvider {
  readonly name = 'openai';
  get model() {
    return process.env.OPENAI_AI_MODEL ?? 'gpt-5.6-sol';
  }
  isConfigured() {
    return Boolean(process.env.OPENAI_API_KEY);
  }
  async generate(
    request: TextGenerationRequest,
  ): Promise<TextGenerationResponse> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey)
      throw new ServiceUnavailableException('AI provider is not configured');
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal: AbortSignal.timeout(request.timeoutMs),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model,
        instructions: request.instructions,
        input: request.input,
        // AI assistance is draft-only; raw workspace content must not be retained.
        store: false,
      }),
    });
    if (!response.ok) {
      const body: any = await response.json().catch(() => ({}));
      const upstreamCode = String(
        body?.error?.code ?? body?.error?.type ?? 'provider_error',
      );
      const errorCode =
        response.status === 429
          ? upstreamCode === 'insufficient_quota'
            ? 'provider_quota_exceeded'
            : 'provider_rate_limit_exceeded'
          : 'provider_request_failed';
      const retryAfter = Number(response.headers.get('retry-after'));
      throw new TextGenerationProviderError(
        response.status === 429 ? 429 : response.status >= 500 ? 503 : 502,
        errorCode,
        response.headers.get('x-request-id') ?? undefined,
        Number.isFinite(retryAfter) ? retryAfter : undefined,
      );
    }
    const body: any = await response.json();
    const text =
      body.output_text ??
      body.output
        ?.flatMap((item: any) => item.content ?? [])
        .find((item: any) => item.type === 'output_text')?.text;
    if (!text)
      throw new ServiceUnavailableException('AI provider returned no text');
    return {
      text,
      model: body.model ?? request.model,
      usage: body.usage
        ? {
            inputTokens: Number(body.usage.input_tokens ?? 0),
            outputTokens: Number(body.usage.output_tokens ?? 0),
          }
        : undefined,
    };
  }
}
