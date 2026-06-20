import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IngestionKeyService } from 'src/ingestion/services/ingestion-key.service';
import { IngestApiKey } from 'src/typeorm/entities/IngestApiKey';
import { Repository } from 'typeorm';

export interface IngestionRequestContext {
  ingestKeyId: number;
  isTestKey: boolean;
  projectId: number;
  organizationId: string;
}

@Injectable()
export class IngestionApiKeyGuard implements CanActivate {
  constructor(
    private readonly ingestionKeyService: IngestionKeyService,
    @InjectRepository(IngestApiKey)
    private readonly ingestApiKeyRepository: Repository<IngestApiKey>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = String(request.headers.authorization ?? '');

    if (!authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing ingestion API key');
    }

    const rawKey = authHeader.slice(7).trim();
    if (
      !rawKey ||
      (!rawKey.startsWith('trk_live_') && !rawKey.startsWith('trk_test_'))
    ) {
      throw new UnauthorizedException('Invalid ingestion API key');
    }

    const keyHash = this.ingestionKeyService.hashKey(rawKey);
    const key = await this.ingestApiKeyRepository.findOne({
      where: { keyHash },
    });

    if (!key || key.revoked_at) {
      throw new UnauthorizedException('Invalid ingestion API key');
    }

    await this.ingestionKeyService.touchLastUsed(key.id);

    request.ingestionContext = {
      ingestKeyId: key.id,
      isTestKey: this.ingestionKeyService.isTestKey(rawKey),
      projectId: key.projectId,
      organizationId: key.organization_id,
    } satisfies IngestionRequestContext;

    return true;
  }
}
