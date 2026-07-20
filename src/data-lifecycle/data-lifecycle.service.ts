import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  DataLifecycleEvent,
  LifecycleRecordType,
} from 'src/typeorm/entities/DataLifecycleEvent';

@Injectable()
export class DataLifecycleService {
  constructor(
    @InjectRepository(DataLifecycleEvent)
    private readonly events: Repository<DataLifecycleEvent>,
  ) {}

  record(params: {
    organizationId: string;
    actorId: number;
    recordType: LifecycleRecordType;
    recordId: string | number;
    action: DataLifecycleEvent['action'];
    metadata?: DataLifecycleEvent['metadata'];
    manager?: EntityManager;
  }) {
    const forbiddenMetadata =
      /content|context|title|transcript|prompt|output|input|audio_url|audio_path/i;
    if (
      params.metadata &&
      Object.keys(params.metadata).some((key) => forbiddenMetadata.test(key))
    ) {
      throw new Error('Lifecycle metadata must not contain source content');
    }
    const repository =
      params.manager?.getRepository(DataLifecycleEvent) ?? this.events;
    return repository.save(
      repository.create({
        organization_id: params.organizationId,
        actor_id: params.actorId,
        record_type: params.recordType,
        record_id: String(params.recordId),
        action: params.action,
        metadata: params.metadata ?? null,
      }),
    );
  }

  history(
    organizationId: string,
    recordType: LifecycleRecordType,
    recordId: string | number,
  ) {
    return this.events.find({
      where: {
        organization_id: organizationId,
        record_type: recordType,
        record_id: String(recordId),
      },
      order: { created_at: 'DESC' },
    });
  }
}
