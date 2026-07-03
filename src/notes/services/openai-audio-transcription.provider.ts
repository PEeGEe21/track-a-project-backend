import { Injectable } from '@nestjs/common';
import { config } from 'src/config';
import {
  AudioTranscriptionInput,
  AudioTranscriptionProvider,
  AudioTranscriptionResult,
} from './audio-transcription.provider';

@Injectable()
export class OpenAiAudioTranscriptionProvider
  implements AudioTranscriptionProvider
{
  isConfigured(): boolean {
    return Boolean(
      config.transcription.providerEnabled &&
        config.transcription.provider === 'openai' &&
        config.transcription.openAiApiKey,
    );
  }

  async transcribeAudio(
    input: AudioTranscriptionInput,
  ): Promise<AudioTranscriptionResult> {
    if (!this.isConfigured()) {
      throw new Error('OpenAI transcription provider is not configured');
    }

    const formData = new FormData();
    const file = new File([input.audioBuffer], input.filename, {
      type: input.mimeType || 'audio/webm',
    });

    formData.append('file', file);
    formData.append('model', config.transcription.openAiModel);

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.transcription.openAiApiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `OpenAI transcription failed with status ${response.status}: ${errorText}`,
      );
    }

    const data = (await response.json()) as { text?: string };
    return {
      transcript: data.text?.trim() || '',
    };
  }
}
