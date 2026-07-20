import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue, Worker } from 'bullmq';
import { AppLogger } from 'src/common/logging/app-logger';
import { config } from 'src/config';
import { RedisService } from 'src/redis/redis.service';
import { Note } from 'src/typeorm/entities/Note';
import { Repository } from 'typeorm';
import { StorageService } from 'src/types/storage.interface';
import { AudioTranscriptionProvider } from './audio-transcription.provider';
import { AiGovernanceService } from 'src/ai/ai-governance.service';
import { AuthUser } from 'src/types/users';

type NoteTranscriptionJobPayload = {
  noteId: number;
  organizationId: string;
  actor: AuthUser;
};
import { AUDIO_TRANSCRIPTION_PROVIDER } from 'src/ai/provider.tokens';

@Injectable()
export class NoteTranscriptionService implements OnModuleInit, OnModuleDestroy {
  private queue: Queue<NoteTranscriptionJobPayload> | null = null;
  private worker: Worker<NoteTranscriptionJobPayload> | null = null;

  constructor(
    private readonly redisService: RedisService,
    @InjectRepository(Note)
    private readonly noteRepository: Repository<Note>,
    @Inject('STORAGE_SERVICE')
    private readonly storageService: StorageService,
    @Inject(AUDIO_TRANSCRIPTION_PROVIDER)
    private readonly transcriptionProvider: AudioTranscriptionProvider,
    private readonly governance: AiGovernanceService,
  ) {}

  async onModuleInit() {
    if (config.queue.driver !== 'redis') {
      return;
    }

    const connection = this.redisService.getBullConnection();
    if (!connection) {
      AppLogger.warn(
        'NoteTranscriptionService',
        'QUEUE_DRIVER=redis is configured but Redis is unavailable. Falling back to inline note transcription.',
      );
      return;
    }

    this.queue = new Queue<NoteTranscriptionJobPayload>('note-transcriptions', {
      connection,
      prefix: config.redis.prefix,
    });

    this.worker = new Worker<NoteTranscriptionJobPayload>(
      'note-transcriptions',
      async (job) =>
        this.processNoteTranscription(job.data.noteId, job.data.organizationId, job.data.actor),
      {
        connection,
        prefix: config.redis.prefix,
        concurrency: 2,
      },
    );
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }

  async requestTranscription(noteId: number, organizationId: string, actor: AuthUser, enforceEntitlement = true) {
    try {
      await this.governance.assertAvailable(actor, organizationId);
    } catch (error) {
      if (enforceEntitlement) throw error;
      await this.noteRepository.update({ id: noteId, organization_id: organizationId }, { audio_transcript_status: 'skipped' });
      return { queued: false, status: 'skipped' };
    }
    if (!this.transcriptionProvider.isConfigured()) {
      await this.noteRepository.update(
        { id: noteId, organization_id: organizationId },
        { audio_transcript_status: 'skipped' },
      );
      return {
        queued: false,
        status: 'skipped',
      };
    }

    await this.noteRepository.update(
      { id: noteId, organization_id: organizationId },
      { audio_transcript_status: 'pending' },
    );

    if (config.queue.driver === 'redis' && this.queue) {
      await this.queue.add(
        'transcribe-note-audio',
        { noteId, organizationId, actor },
        {
          attempts: 3,
          removeOnComplete: 50,
          removeOnFail: 100,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        },
      );

      return {
        queued: true,
        status: 'pending',
      };
    }

    void this.processNoteTranscription(noteId, organizationId, actor);
    return {
      queued: false,
      status: 'pending',
    };
  }

  async processNoteTranscription(noteId: number, organizationId: string, actor: AuthUser) {
    const note = await this.noteRepository.findOne({
      where: {
        id: noteId,
        organization_id: organizationId,
      },
    });

    if (!note || !note.audio_path) {
      return;
    }

    if (!this.transcriptionProvider.isConfigured()) {
      await this.noteRepository.update(
        { id: noteId, organization_id: organizationId },
        { audio_transcript_status: 'skipped' },
      );
      return;
    }

    try {
      await this.governance.assertAvailable(actor, organizationId);
      await this.noteRepository.update(
        { id: noteId, organization_id: organizationId },
        { audio_transcript_status: 'processing' },
      );

      const audioBuffer = await this.storageService.downloadFile(
        note.audio_path,
      );
      const filename =
        note.audio_path.split('/').pop() || `note-${noteId}-audio.webm`;
      const audit = await this.governance.start({
        actor, organizationId, featureId: 'note_audio_transcription',
        templateId: 'audio_transcription', templateVersion: 1,
        provider: this.transcriptionProvider.name,
        model: this.transcriptionProvider.model,
        inputSize: audioBuffer.length,
      });
      const started = Date.now();
      let transcription;
      try {
        transcription = await this.transcriptionProvider.transcribeAudio({
        audioBuffer,
        filename,
        mimeType: note.audio_mime_type || 'audio/webm',
        });
        await this.governance.finish(audit, started, { status: 'succeeded', outputSize: transcription.transcript.length });
      } catch (error: any) {
        await this.governance.finish(audit, started, { status: 'failed', errorCode: error?.name ?? 'transcription_error' });
        throw error;
      }

      await this.noteRepository.update(
        { id: noteId, organization_id: organizationId },
        {
          audio_transcript: transcription.transcript || null,
          audio_transcript_status: transcription.transcript
            ? 'completed'
            : 'failed',
        },
      );
    } catch (error: any) {
      AppLogger.error(
        'NoteTranscriptionService',
        `Failed to transcribe note ${noteId}: ${
          error?.message || 'Unknown error'
        }`,
      );
      await this.noteRepository.update(
        { id: noteId, organization_id: organizationId },
        { audio_transcript_status: 'failed' },
      );
    }
  }
}
