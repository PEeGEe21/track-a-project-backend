import { captureError, init } from '@peegee/projecttrakr-sdk';
import { config } from 'src/config';
import { AppLogger } from '../logging/app-logger';

let sdkReady = false;

function ensureProjectTrakrSdk(): boolean {
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
      AppLogger.error(
        'ProjectTrakrIngestion',
        'Failed to report backend error',
        {
          error: error instanceof Error ? error.message : String(error),
        },
      );
    },
  });

  sdkReady = true;
  return true;
}

export function bootProjectTrakrMonitoring(): void {
  ensureProjectTrakrSdk();
}

export async function captureBackendError(
  error: unknown,
  context: {
    title?: string;
    metadata?: Record<string, unknown>;
    dedupeKey?: string;
  } = {},
): Promise<void> {
  if (!ensureProjectTrakrSdk()) {
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
    AppLogger.error('ProjectTrakrIngestion', 'SDK capture failed', {
      error:
        captureFailure instanceof Error
          ? captureFailure.message
          : String(captureFailure),
    });
  }
}
