import {
  Body,
  Controller,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { IngestionApiKeyGuard } from '../guards/ingestion-api-key.guard';
import { CreateIngestedTaskDto } from '../dto/create-ingested-task.dto';
import { IngestionService } from '../services/ingestion.service';
import { Response } from 'express';
import { IngestionRateLimitGuard } from '../guards/ingestion-rate-limit.guard';
import { IngestionBodySizeGuard } from '../guards/ingestion-body-size.guard';

@Controller('v1/ingest')
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Post('tasks')
  @UseGuards(
    IngestionApiKeyGuard,
    IngestionRateLimitGuard,
    IngestionBodySizeGuard,
  )
  async ingestTask(
    @Body() dto: CreateIngestedTaskDto,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.ingestionService.ingestTaskEvent(
      dto,
      req.ingestionContext,
    );

    res.status(
      result.status === 'created' ? HttpStatus.CREATED : HttpStatus.OK,
    );

    return result;
  }
}
