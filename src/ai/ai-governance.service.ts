import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, MoreThanOrEqual, Repository } from 'typeorm';
import { EntitlementsService } from 'src/entitlements/entitlements.service';
import { CapabilityKey } from 'src/entitlements/capability-catalog';
import { AiRequestAudit } from 'src/typeorm/entities/AiRequestAudit';
import { AuthUser } from 'src/types/users';
import { Organization } from 'src/typeorm/entities/Organization';

@Injectable()
export class AiGovernanceService {
  constructor(
    @InjectRepository(AiRequestAudit)
    private audits: Repository<AiRequestAudit>,
    private entitlements: EntitlementsService,
    private dataSource: DataSource,
  ) {}

  async assertAvailable(actor: AuthUser, organizationId: string) {
    await this.entitlements.assertCapability(
      actor,
      organizationId,
      CapabilityKey.AI_ASSISTANCE,
    );
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const [organizationUsage, userUsage] = await Promise.all([
      this.audits.countBy({
        organization_id: organizationId,
        created_at: MoreThanOrEqual(since),
      }),
      this.audits.countBy({
        organization_id: organizationId,
        user_id: actor.userId,
        created_at: MoreThanOrEqual(since),
      }),
    ]);
    if (
      organizationUsage >=
        Number(process.env.AI_ORGANIZATION_HOURLY_LIMIT ?? 500) ||
      userUsage >= Number(process.env.AI_USER_HOURLY_LIMIT ?? 50)
    )
      throw new HttpException(
        'AI usage limit reached',
        HttpStatus.TOO_MANY_REQUESTS,
      );
  }

  async start(params: {
    actor: AuthUser;
    organizationId: string;
    featureId: string;
    templateId: string;
    templateVersion: number;
    provider: string;
    model: string;
    inputSize: number;
  }) {
    await this.entitlements.assertCapability(
      params.actor,
      params.organizationId,
      CapabilityKey.AI_ASSISTANCE,
    );
    return this.dataSource.transaction(async (manager) => {
      // Serialize reservations per organization so parallel requests cannot race
      // past either the organization or user quota.
      await manager.getRepository(Organization).findOneOrFail({
        where: { id: params.organizationId },
        lock: { mode: 'pessimistic_write' },
      });
      const repository = manager.getRepository(AiRequestAudit);
      const since = new Date(Date.now() - 60 * 60 * 1000);
      const [organizationUsage, userUsage] = await Promise.all([
        repository.countBy({
          organization_id: params.organizationId,
          created_at: MoreThanOrEqual(since),
        }),
        repository.countBy({
          organization_id: params.organizationId,
          user_id: params.actor.userId,
          created_at: MoreThanOrEqual(since),
        }),
      ]);
      if (
        organizationUsage >=
          Number(process.env.AI_ORGANIZATION_HOURLY_LIMIT ?? 500) ||
        userUsage >= Number(process.env.AI_USER_HOURLY_LIMIT ?? 50)
      )
        throw new HttpException(
          'AI usage limit reached',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      return repository.save(
        repository.create({
          correlation_id: randomUUID(),
          organization_id: params.organizationId,
          user_id: params.actor.userId,
          feature_id: params.featureId,
          template_id: params.templateId,
          template_version: params.templateVersion,
          provider: params.provider,
          model: params.model,
          input_size: params.inputSize,
          output_size: 0,
          latency_ms: 0,
          status: 'started',
          error_code: null,
          estimated_cost: null,
        }),
      );
    });
  }

  async finish(
    audit: AiRequestAudit,
    startedAt: number,
    outcome: {
      status: 'succeeded' | 'failed';
      outputSize?: number;
      model?: string;
      errorCode?: string;
      estimatedCost?: number;
    },
  ) {
    Object.assign(audit, {
      status: outcome.status,
      output_size: outcome.outputSize ?? 0,
      model: outcome.model ?? audit.model,
      error_code: outcome.errorCode ?? null,
      estimated_cost: outcome.estimatedCost ?? null,
      latency_ms: Date.now() - startedAt,
    });
    await this.audits.save(audit);
  }
}
