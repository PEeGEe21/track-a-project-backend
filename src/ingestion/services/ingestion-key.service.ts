import { Injectable } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { IngestApiKey } from 'src/typeorm/entities/IngestApiKey';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

type IngestKeyMode = 'live' | 'test';

@Injectable()
export class IngestionKeyService {
  constructor(
    @InjectRepository(IngestApiKey)
    private readonly ingestApiKeyRepository: Repository<IngestApiKey>,
  ) {}

  generateRawKey(mode: IngestKeyMode): string {
    const token = randomBytes(24).toString('hex');
    return `trk_${mode}_${token}`;
  }

  hashKey(rawKey: string): string {
    return createHash('sha256').update(rawKey).digest('hex');
  }

  getKeyPrefix(rawKey: string): string {
    return rawKey.slice(0, 16);
  }

  isTestKey(rawKeyOrPrefix: string): boolean {
    return rawKeyOrPrefix.startsWith('trk_test_');
  }

  buildLabel(label: string | undefined, mode: IngestKeyMode): string {
    const trimmed = label?.trim();
    if (trimmed) {
      return trimmed;
    }

    return mode === 'test' ? 'Test ingestion key' : 'Live ingestion key';
  }

  async touchLastUsed(id: number): Promise<void> {
    await this.ingestApiKeyRepository.update(
      { id },
      { last_used_at: new Date() },
    );
  }
}
