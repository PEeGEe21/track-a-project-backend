import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { config } from 'src/config';

@Injectable()
export class IngestionBodySizeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const contentLengthHeader = request.headers['content-length'];
    const contentLength = Number(contentLengthHeader ?? 0);

    if (
      Number.isFinite(contentLength) &&
      contentLength > config.ingestion.maxBodyBytes
    ) {
      throw new HttpException(
        `Ingestion payload exceeds ${config.ingestion.maxBodyKb}KB`,
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }

    const bodySize = Buffer.byteLength(
      JSON.stringify(request.body ?? {}),
      'utf8',
    );

    if (bodySize > config.ingestion.maxBodyBytes) {
      throw new HttpException(
        `Ingestion payload exceeds ${config.ingestion.maxBodyKb}KB`,
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }

    return true;
  }
}
