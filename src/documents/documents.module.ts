import { Module } from '@nestjs/common';
import { DocumentsService } from './services/documents.service';
import { DocumentsController } from './controllers/documents.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentFile } from 'src/typeorm/entities/DocumentFile';
import { Document } from 'src/typeorm/entities/Document';
import { MulterModule } from '@nestjs/platform-express';
import { Folder } from 'src/typeorm/entities/Folder';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document, DocumentFile, Folder]),
    MulterModule.register({
      dest: './uploads',
    }),

    UsersModule
  ],

  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
