import { HttpException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { IntakeChannel, IntakeEvent } from 'src/typeorm/entities/IntakeEvent';
import { IntakeEventAttempt } from 'src/typeorm/entities/IntakeEventAttempt';
import { IntakeAttemptTrigger } from 'src/typeorm/entities/IntakeEventAttempt';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { FindOptionsWhere } from 'typeorm';

export type ReceiveIntakeEventInput = {
  organizationId: string;
  projectId: number;
  channel: IntakeChannel;
  sourceKey: string;
  idempotencyKey?: string;
  taskDedupeKey?: string | null;
  normalizedPayload: Record<string, unknown>;
  receivedAt?: Date;
};

export type ProcessedIntakeOutcome = {
  taskId: number;
  status: string;
  occurrenceCount?: number;
  [key: string]: unknown;
};

@Injectable()
export class NormalizedIntakeService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(IntakeEvent)
    private readonly intakeEventRepository: Repository<IntakeEvent>,
  ) {}

  findScoped(organizationId: string, projectId: number, eventId: string) {
    return this.intakeEventRepository.findOne({
      where: {
        id: eventId,
        organization_id: organizationId,
        project_id: projectId,
      },
      relations: ['attempts', 'task'],
      order: { attempts: { attempt_number: 'ASC' } },
    });
  }

  async listScoped(
    organizationId: string,
    projectId: number,
    page = 1,
    limit = 25,
    state?: IntakeEvent['state'],
    channel?: IntakeEvent['channel'],
  ) {
    const validStates = new Set([
      'received',
      'validated',
      'accepted',
      'rejected',
      'quarantined',
      'failed',
    ]);
    const validChannels = new Set([
      'api',
      'sdk',
      'csv',
      'excel',
      'webhook',
      'email',
      'form',
    ]);
    if (state && !validStates.has(state))
      throw new HttpException('Invalid intake event state', 400);
    if (channel && !validChannels.has(channel))
      throw new HttpException('Invalid intake channel', 400);
    const where: FindOptionsWhere<IntakeEvent> = {
      organization_id: organizationId,
      project_id: projectId,
      ...(state ? { state } : {}),
      ...(channel ? { channel } : {}),
    };
    const [data, total] = await this.intakeEventRepository.findAndCount({
      where,
      relations: ['attempts', 'task'],
      order: { created_at: 'DESC', attempts: { attempt_number: 'ASC' } },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data,
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async retainDisposition(
    event: IntakeEvent,
    state: 'rejected' | 'quarantined',
    code: string,
    message: string,
  ) {
    if (event.state === 'accepted') return event;
    event.state = state;
    event.validation_snapshot = { valid: false, code };
    event.failure_code = code.slice(0, 80);
    event.failure_message = message.slice(0, 2000);
    event.retryable = false;
    event.processed_at = new Date();
    return this.intakeEventRepository.save(event);
  }

  async receive(input: ReceiveIntakeEventInput): Promise<{
    event: IntakeEvent;
    idempotent: boolean;
  }> {
    const identity = {
      organization_id: input.organizationId,
      channel: input.channel,
      source_key: input.sourceKey.trim(),
      idempotency_key: input.idempotencyKey?.trim() || randomUUID(),
    } as const;

    const existing = await this.intakeEventRepository.findOne({
      where: identity,
    });
    if (existing) return { event: existing, idempotent: true };

    const event = this.intakeEventRepository.create({
      ...identity,
      project_id: input.projectId,
      task_id: null,
      state: 'received',
      normalized_payload: input.normalizedPayload,
      validation_snapshot: null,
      task_dedupe_key: input.taskDedupeKey?.trim() || null,
      failure_code: null,
      failure_message: null,
      retryable: false,
      received_at: input.receivedAt ?? new Date(),
      processed_at: null,
    });

    try {
      return {
        event: await this.intakeEventRepository.save(event),
        idempotent: false,
      };
    } catch (error) {
      if (!this.isUniqueViolation(error)) throw error;
      const concurrent = await this.intakeEventRepository.findOne({
        where: identity,
      });
      if (!concurrent) throw error;
      return { event: concurrent, idempotent: true };
    }
  }

  async process<T extends ProcessedIntakeOutcome>(
    event: IntakeEvent,
    processor: (manager: EntityManager) => Promise<T>,
    trigger?: IntakeAttemptTrigger,
  ): Promise<{ event: IntakeEvent; outcome: T; idempotent: boolean }> {
    if (event.state === 'accepted' && event.task_id) {
      const outcome = this.readStoredOutcome<T>(event);
      return { event, outcome, idempotent: true };
    }

    if (event.state !== 'received' && event.state !== 'failed') {
      throw new HttpException(
        `Intake event cannot be processed from ${event.state}`,
        409,
      );
    }

    try {
      const processed = await this.dataSource.transaction(async (manager) => {
        const events = manager.getRepository(IntakeEvent);
        const attempts = manager.getRepository(IntakeEventAttempt);
        const locked = await events.findOne({
          where: { id: event.id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!locked) throw new HttpException('Intake event not found', 404);

        if (locked.state === 'accepted' && locked.task_id) {
          return {
            event: locked,
            outcome: this.readStoredOutcome<T>(locked),
            idempotent: true,
          };
        }

        const attemptNumber =
          (await attempts.count({
            where: { event_id: locked.id },
          })) + 1;
        const startedAt = new Date();
        const attempt = attempts.create({
          event_id: locked.id,
          attempt_number: attemptNumber,
          trigger:
            trigger ?? (attemptNumber === 1 ? 'initial' : 'automatic_retry'),
          state: 'processing',
          diagnostic_snapshot: null,
          started_at: startedAt,
          completed_at: null,
        });
        await attempts.save(attempt);

        locked.state = 'validated';
        locked.validation_snapshot = { valid: true };
        await events.save(locked);

        const outcome = await processor(manager);
        const completedAt = new Date();
        locked.state = 'accepted';
        locked.task_id = outcome.taskId;
        locked.validation_snapshot = { valid: true, outcome };
        locked.failure_code = null;
        locked.failure_message = null;
        locked.retryable = false;
        locked.processed_at = completedAt;
        attempt.state = 'succeeded';
        attempt.completed_at = completedAt;
        attempt.diagnostic_snapshot = { outcome: 'accepted' };
        await events.save(locked);
        await attempts.save(attempt);

        return { event: locked, outcome, idempotent: false };
      });
      return processed;
    } catch (error) {
      await this.retainFailure(event.id, error, trigger);
      throw error;
    }
  }

  private async retainFailure(
    eventId: string,
    error: unknown,
    trigger?: IntakeAttemptTrigger,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const events = manager.getRepository(IntakeEvent);
      const attempts = manager.getRepository(IntakeEventAttempt);
      const event = await events.findOne({
        where: { id: eventId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!event || event.state === 'accepted') return;

      const attemptNumber =
        (await attempts.count({
          where: { event_id: event.id },
        })) + 1;
      const failure = this.describeFailure(error);
      const completedAt = new Date();
      await attempts.save(
        attempts.create({
          event_id: event.id,
          attempt_number: attemptNumber,
          trigger:
            trigger ?? (attemptNumber === 1 ? 'initial' : 'automatic_retry'),
          state: 'failed',
          diagnostic_snapshot: {
            code: failure.code,
            message: failure.message,
            retryable: failure.retryable,
          },
          started_at: completedAt,
          completed_at: completedAt,
        }),
      );
      event.state = failure.retryable ? 'failed' : 'rejected';
      event.validation_snapshot = failure.retryable
        ? event.validation_snapshot
        : { valid: false, code: failure.code };
      event.failure_code = failure.code;
      event.failure_message = failure.message;
      event.retryable = failure.retryable;
      event.processed_at = completedAt;
      await events.save(event);
    });
  }

  private readStoredOutcome<T extends ProcessedIntakeOutcome>(
    event: IntakeEvent,
  ): T {
    const outcome = event.validation_snapshot?.outcome;
    if (outcome && typeof outcome === 'object') return outcome as T;
    return {
      status: 'created',
      taskId: event.task_id as number,
      occurrenceCount: 1,
    } as T;
  }

  private describeFailure(error: unknown) {
    const status = error instanceof HttpException ? error.getStatus() : 500;
    const message =
      error instanceof Error ? error.message : 'Intake processing failed';
    return {
      code: status >= 500 ? 'processing_failed' : 'validation_failed',
      message: message.slice(0, 2000),
      retryable: status >= 500,
    };
  }

  private isUniqueViolation(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const candidate = error as { code?: string; errno?: number };
    return candidate.code === 'ER_DUP_ENTRY' || candidate.errno === 1062;
  }
}
