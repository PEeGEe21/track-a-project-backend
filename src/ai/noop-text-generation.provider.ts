import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  TextGenerationProvider,
  TextGenerationRequest,
} from './text-generation.provider';
@Injectable()
export class NoopTextGenerationProvider implements TextGenerationProvider {
  readonly name = 'none';
  readonly model = 'none';
  isConfigured() {
    return false;
  }
  async generate(_request: TextGenerationRequest): Promise<never> {
    throw new ServiceUnavailableException(
      'Text generation provider is not configured',
    );
  }
}
