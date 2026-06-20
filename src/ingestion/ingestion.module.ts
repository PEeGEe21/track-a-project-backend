import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IngestionKeyService } from './services/ingestion-key.service';
import { IngestApiKey } from 'src/typeorm/entities/IngestApiKey';
import { IngestionApiKeyGuard } from './guards/ingestion-api-key.guard';
import { IngestionController } from './controllers/ingestion.controller';
import { IngestionService } from './services/ingestion.service';
import { Project } from 'src/typeorm/entities/Project';
import { Task } from 'src/typeorm/entities/Task';
import { Status } from 'src/typeorm/entities/Status';
import { IngestedEvent } from 'src/typeorm/entities/IngestedEvent';
import { User } from 'src/typeorm/entities/User';
import { ProjectActivitiesModule } from 'src/project-activities/project-activities.module';
import { IngestionRateLimitGuard } from './guards/ingestion-rate-limit.guard';
import { IngestionBodySizeGuard } from './guards/ingestion-body-size.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      IngestApiKey,
      Project,
      Task,
      Status,
      IngestedEvent,
      User,
    ]),
    ProjectActivitiesModule,
  ],
  controllers: [IngestionController],
  providers: [
    IngestionKeyService,
    IngestionApiKeyGuard,
    IngestionRateLimitGuard,
    IngestionBodySizeGuard,
    IngestionService,
  ],
  exports: [IngestionKeyService, IngestionApiKeyGuard],
})
export class IngestionModule {}
