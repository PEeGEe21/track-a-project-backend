import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  TextGenerationProvider,
  TextGenerationProviderError,
  TextGenerationRequest,
  TextGenerationResponse,
} from './text-generation.provider';

function extractGeneratedText(value: any): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const text = extractGeneratedText(item);
      if (text) return text;
    }
    return undefined;
  }
  if (!value || typeof value !== 'object') return undefined;
  for (const key of ['output_text', 'generated_text']) {
    if (typeof value[key] === 'string' && value[key].trim())
      return value[key].trim();
  }
  if (
    (value.type === 'output_text' || value.type === 'text') &&
    typeof value.text === 'string' &&
    value.text.trim()
  )
    return value.text.trim();
  if (value.text && typeof value.text === 'object') {
    const nested = extractGeneratedText(value.text.value ?? value.text);
    if (nested) return nested;
  }
  for (const key of ['output', 'choices', 'message', 'content', 'delta']) {
    const text = extractGeneratedText(value[key]);
    if (text) return text;
  }
  return undefined;
}

@Injectable()
export class HuggingFaceTextGenerationProvider
  implements TextGenerationProvider
{
  readonly name = 'huggingface';
  get model() {
    return process.env.HUGGINGFACE_AI_MODEL ?? 'google/gemma-3-4b-it';
  }
  isConfigured() {
    return Boolean(process.env.HF_TOKEN);
  }

  async generate(
    request: TextGenerationRequest,
  ): Promise<TextGenerationResponse> {
    const token = process.env.HF_TOKEN;
    if (!token)
      throw new ServiceUnavailableException('AI provider is not configured');
    const startedAt = Date.now();
    let response: Response | undefined;
    let lastError: unknown;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const remainingMs = request.timeoutMs - (Date.now() - startedAt);
      if (remainingMs <= 0) break;
      try {
        response = await fetch('https://router.huggingface.co/v1/responses', {
          method: 'POST',
          signal: AbortSignal.timeout(remainingMs),
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: request.model,
            instructions: request.instructions,
            input: request.input,
          }),
        });
        break;
      } catch (error: any) {
        lastError = error;
        const code = error?.cause?.code;
        const transient =
          code === 'UND_ERR_CONNECT_TIMEOUT' || code === 'ETIMEDOUT';
        if (!transient || attempt === 2) break;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    if (!response) {
      const code = (lastError as any)?.cause?.code;
      throw new TextGenerationProviderError(
        503,
        code === 'UND_ERR_CONNECT_TIMEOUT'
          ? 'provider_connect_timeout'
          : 'provider_network_error',
      );
    }
    if (!response.ok) {
      const body: any = await response.json().catch(() => ({}));
      const upstreamCode = String(
        body?.error?.code ?? body?.error?.type ?? 'provider_error',
      );
      const errorCode =
        response.status === 429
          ? upstreamCode === 'insufficient_quota' ||
            upstreamCode === 'payment_required'
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
    if (body?.error)
      throw new TextGenerationProviderError(502, 'provider_embedded_error');
    const text = extractGeneratedText(body);
    if (!text) {
      console.error('Hugging Face response contained no extractable text', {
        topLevelType: Array.isArray(body) ? 'array' : typeof body,
        topLevelKeys: body && typeof body === 'object' ? Object.keys(body) : [],
        outputTypes: Array.isArray(body?.output)
          ? body.output.map((item: any) => item?.type ?? typeof item)
          : [],
        contentTypes: Array.isArray(body?.output)
          ? body.output.flatMap((item: any) =>
              Array.isArray(item?.content)
                ? item.content.map(
                    (content: any) => content?.type ?? typeof content,
                  )
                : [typeof item?.content],
            )
          : [],
        choicesCount: Array.isArray(body?.choices) ? body.choices.length : 0,
      });
      throw new ServiceUnavailableException('AI provider returned no text');
    }
    return {
      text,
      model: body.model ?? request.model,
      usage: body.usage
        ? {
            inputTokens: Number(
              body.usage.input_tokens ?? body.usage.prompt_tokens ?? 0,
            ),
            outputTokens: Number(
              body.usage.output_tokens ?? body.usage.completion_tokens ?? 0,
            ),
          }
        : undefined,
    };
  }
}
