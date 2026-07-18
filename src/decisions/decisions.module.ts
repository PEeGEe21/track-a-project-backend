import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EntitlementsModule } from 'src/entitlements/entitlements.module';
import { Decision } from 'src/typeorm/entities/Decision';
import { DecisionHistory } from 'src/typeorm/entities/DecisionHistory';
import { DecisionLink } from 'src/typeorm/entities/DecisionLink';
import { Document } from 'src/typeorm/entities/Document';
import { Note } from 'src/typeorm/entities/Note';
import { Project } from 'src/typeorm/entities/Project';
import { ProjectComment } from 'src/typeorm/entities/ProjectComment';
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeer';
import { Task } from 'src/typeorm/entities/Task';
import { User } from 'src/typeorm/entities/User';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';
import { DecisionsController } from './decisions.controller';
import { DecisionsService } from './decisions.service';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Decision,
      DecisionLink,
      DecisionHistory,
      Project,
      ProjectPeer,
      User,
      UserOrganization,
      Task,
      Document,
      ProjectComment,
      Note,
    ]),
    EntitlementsModule,
  ],
  controllers: [DecisionsController],
  providers: [DecisionsService],
})
export class DecisionsModule {}
