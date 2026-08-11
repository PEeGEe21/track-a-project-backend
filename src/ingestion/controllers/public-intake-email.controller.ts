import { AnyFilesInterceptor } from '@nestjs/platform-express';
import {
  Body,
  Controller,
  Headers,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { IntakeEmailService } from '../services/intake-email.service';
@Controller('public/intake/email')
export class PublicIntakeEmailController {
  constructor(private readonly email: IntakeEmailService) {}
  @Post('sendgrid')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @UseInterceptors(
    AnyFilesInterceptor({
      storage: memoryStorage(),
      limits: {
        files: 10,
        fileSize: 10 * 1024 * 1024,
        fields: 30,
        fieldSize: 1024 * 1024,
      },
    }),
  )
  receive(
    @Headers('authorization') authorization: string | undefined,
    @Body() fields: Record<string, unknown>,
    @UploadedFiles() files: Express.Multer.File[] = [],
  ) {
    return this.email.receive(authorization, fields, files);
  }
}
