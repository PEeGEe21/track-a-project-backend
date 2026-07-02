import { captureError, init } from '@peegee/tailpoint-sdk';
import { config } from 'src/config';
import { AppLogger } from '../logging/app-logger';

let sdkReady = false;

function ensureTailpointSdk(): boolean {
  if (sdkReady) {
    return true;
  }

  if (!config.ingestion.sdk.enabled) {
    return false;
  }

  init({
    apiKey: config.ingestion.sdk.apiKey!,
    endpoint: config.ingestion.sdk.endpoint!,
    source: config.ingestion.sdk.source as 'api' | 'sdk' | 'sentry' | 'manual',
    captureUnhandledRejections: true,
    captureUncaughtExceptions: true,
    onError: (error) => {
      AppLogger.error('TailpointIngestion', 'Failed to report backend error', {
        error: error instanceof Error ? error.message : String(error),
      });
    },
  });

  sdkReady = true;
  return true;
}

export function bootTailpointMonitoring(): void {
  ensureTailpointSdk();
}

export async function captureBackendError(
  error: unknown,
  context: {
    title?: string;
    metadata?: Record<string, unknown>;
    dedupeKey?: string;
  } = {},
): Promise<void> {
  if (!ensureTailpointSdk()) {
    return;
  }

  try {
    await captureError(error, {
      title: context.title,
      severity: 'high',
      dedupeKey: context.dedupeKey,
      metadata: {
        app: 'track-a-project-backend',
        environment: config.env,
        ...context.metadata,
      },
    });
  } catch (captureFailure) {
    AppLogger.error('TailpointIngestion', 'SDK capture failed', {
      error:
        captureFailure instanceof Error
          ? captureFailure.message
          : String(captureFailure),
    });
  }
}
