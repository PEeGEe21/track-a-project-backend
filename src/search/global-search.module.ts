import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthorizationModule } from 'src/common/authorization/authorization.module';
import { MessagesModule } from 'src/messages/messages.module';
import { Document } from 'src/typeorm/entities/Document';
import { DocumentFile } from 'src/typeorm/entities/DocumentFile';
import { Note } from 'src/typeorm/entities/Note';
import { Project } from 'src/typeorm/entities/Project';
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeer';
import { Resource } from 'src/typeorm/entities/Resource';
import { Task } from 'src/typeorm/entities/Task';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';
import { GlobalSearchController } from './global-search.controller';
import { GlobalSearchService } from './global-search.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Project,
      ProjectPeer,
      Task,
      Document,
      Note,
      Resource,
      DocumentFile,
      UserOrganization,
    ]),
    AuthorizationModule,
    MessagesModule,
  ],
  controllers: [GlobalSearchController],
  providers: [GlobalSearchService],
})
export class GlobalSearchModule {}
