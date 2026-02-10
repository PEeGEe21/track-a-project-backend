import { forwardRef, Module } from '@nestjs/common';
import { WhiteboardsService } from './services/whiteboards.service';
import { WhiteboardsController } from './controllers/whiteboards.controller';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/typeorm/entities/User';
import { Profile } from 'src/typeorm/entities/Profile';
import { Project } from 'src/typeorm/entities/Project';
import { Task } from 'src/typeorm/entities/Task';
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeer';
import { ProjectComment } from 'src/typeorm/entities/ProjectComment';
import { Status } from 'src/typeorm/entities/Status';
import { UserPeer } from 'src/typeorm/entities/UserPeer';
import { Note } from 'src/typeorm/entities/Note';
import { Resource } from 'src/typeorm/entities/Resource';
import { Whiteboard } from 'src/typeorm/entities/Whiteboard';
import { WhiteboardsGateway } from './whiteboards.gateway';
import { Notification } from 'src/typeorm/entities/Notification';
import { UsersModule } from 'src/users/users.module';
import { MailingModule } from 'src/utils/mailing/mailing.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';

@Module({
  imports: [
    JwtModule,
    ConfigModule,
    forwardRef(() => UsersModule),
    MailingModule,
    NotificationsModule,
    TypeOrmModule.forFeature([
      User,
      Profile,
      Project,
      Task,
      ProjectPeer,
      ProjectComment,
      Status,
      UserPeer,
      Notification,
      Note,
      Resource,
      Whiteboard,
      UserOrganization
    ]),
  ],
  controllers: [WhiteboardsController],
  providers: [WhiteboardsGateway, WhiteboardsService],
  exports: [WhiteboardsService],
})
export class WhiteboardsModule {}
