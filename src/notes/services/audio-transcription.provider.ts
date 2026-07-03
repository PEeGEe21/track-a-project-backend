export type AudioTranscriptionInput = {
  audioBuffer: Buffer;
  filename: string;
  mimeType: string;
};

export type AudioTranscriptionResult = {
  transcript: string;
};

export interface AudioTranscriptionProvider {
  isConfigured(): boolean;
  transcribeAudio(
    input: AudioTranscriptionInput,
  ): Promise<AudioTranscriptionResult>;
}
