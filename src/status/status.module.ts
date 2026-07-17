import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from '../typeorm/entities/Post';
import { Profile } from '../typeorm/entities/Profile';
import { User } from '../typeorm/entities/User';
import { Project } from 'src/typeorm/entities/Project';
import { StatusController } from './controllers/status.controller';
import { Task } from 'src/typeorm/entities/Task';
import { Status } from 'src/typeorm/entities/Status';
import { StatusService } from './services/status.service';
import { AuthorizationModule } from 'src/common/authorization/authorization.module';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Profile,
      Post,
      Project,
      Task,
      Status,
      UserOrganization,
    ]),
    AuthorizationModule,
  ],
  controllers: [StatusController],
  providers: [StatusService, OrganizationAccessGuard],
  exports: [StatusService],
})
export class StatusModule {}
