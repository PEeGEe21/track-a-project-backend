import { Module } from '@nestjs/common';
import { DocumentsService } from './services/documents.service';
import { DocumentsController } from './controllers/documents.controller';

@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}
