import { Injectable } from '@nestjs/common';
import {
  AudioTranscriptionInput,
  AudioTranscriptionProvider,
  AudioTranscriptionResult,
} from './audio-transcription.provider';

@Injectable()
export class NoopAudioTranscriptionProvider
  implements AudioTranscriptionProvider
{
  isConfigured(): boolean {
    return false;
  }

  async transcribeAudio(
    _input: AudioTranscriptionInput,
  ): Promise<AudioTranscriptionResult> {
    return {
      transcript: '',
    };
  }
}
