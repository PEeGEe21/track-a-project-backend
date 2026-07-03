import { Module } from '@nestjs/common';
import { DocumentsService } from './services/documents.service';
import { DocumentsController } from './controllers/documents.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentFile } from 'src/typeorm/entities/DocumentFile';
import { Document } from 'src/typeorm/entities/Document';
import { Folder } from 'src/typeorm/entities/Folder';
import { UsersModule } from 'src/users/users.module';
import { StorageModule } from 'src/storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document, DocumentFile, Folder]),
    UsersModule,
    StorageModule,
  ],

  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
