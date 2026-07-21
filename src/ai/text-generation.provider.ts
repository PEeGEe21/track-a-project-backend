export type TextGenerationRequest = {
  model: string;
  instructions: string;
  input: string;
  timeoutMs: number;
};
export type TextGenerationResponse = {
  text: string;
  model: string;
  usage?: { inputTokens: number; outputTokens: number };
};
export class TextGenerationProviderError extends Error {
  constructor(
    readonly status: number,
    readonly errorCode: string,
    readonly providerRequestId?: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(errorCode);
    this.name = 'TextGenerationProviderError';
  }
}
export interface TextGenerationProvider {
  readonly name: string;
  readonly model: string;
  isConfigured(): boolean;
  generate(request: TextGenerationRequest): Promise<TextGenerationResponse>;
}
