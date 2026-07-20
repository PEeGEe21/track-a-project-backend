import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  TextGenerationProvider,
  TextGenerationRequest,
  TextGenerationResponse,
} from './text-generation.provider';
@Injectable()
export class OpenAiTextGenerationProvider implements TextGenerationProvider {
  readonly name = 'openai';
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
    if (!response.ok)
      throw new ServiceUnavailableException(
        `AI provider request failed (${response.status})`,
      );
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
