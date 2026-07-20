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
export interface TextGenerationProvider {
  readonly name: string;
  isConfigured(): boolean;
  generate(request: TextGenerationRequest): Promise<TextGenerationResponse>;
}
