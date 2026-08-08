import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MulterFile } from 'src/types/multer.types';
import { SubmitRequestFormDto } from './dto/request-form.dto';
import { RequestFormsService } from './request-forms.service';

@Controller('public/request-forms')
export class PublicRequestFormsController {
  constructor(private readonly forms: RequestFormsService) {}

  @Get(':publicKey')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  published(@Param('publicKey') publicKey: string) {
    return this.forms.publicPublished(publicKey);
  }

  @Post(':publicKey/submissions')
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  submit(
    @Param('publicKey') publicKey: string,
    @Body() dto: SubmitRequestFormDto,
    @Req() req: any,
  ) {
    return this.forms.publicSubmit(
      publicKey,
      dto,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Post(':publicKey/submissions/:submissionId/attachments')
  @Throttle({ default: { limit: 12, ttl: 60000 } })
  @UseInterceptors(
    FilesInterceptor('files', 5, {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024, files: 5 },
    }),
  )
  attachments(
    @Param('publicKey') publicKey: string,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @UploadedFiles() files: MulterFile[] = [],
  ) {
    return this.forms.addPublicAttachments(publicKey, submissionId, files);
  }
}
