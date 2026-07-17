import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EntitlementsModule } from 'src/entitlements/entitlements.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { Document } from 'src/typeorm/entities/Document';
import { Project } from 'src/typeorm/entities/Project';
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeer';
import { ProjectUpdate } from 'src/typeorm/entities/ProjectUpdate';
import { ProjectUpdateReference } from 'src/typeorm/entities/ProjectUpdateReference';
import { Task } from 'src/typeorm/entities/Task';
import { User } from 'src/typeorm/entities/User';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';
import { ProjectUpdatesController } from './project-updates.controller';
import { ProjectUpdatesService } from './project-updates.service';

@Module({ imports: [TypeOrmModule.forFeature([ProjectUpdate, ProjectUpdateReference, Project, ProjectPeer, Task, Document, User, UserOrganization]), EntitlementsModule, NotificationsModule], controllers: [ProjectUpdatesController], providers: [ProjectUpdatesService] })
export class ProjectUpdatesModule {}
