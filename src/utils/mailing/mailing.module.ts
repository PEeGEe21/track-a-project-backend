import { Module } from '@nestjs/common';
import { MailingService } from './mailing.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ProjectsModule } from 'src/projects/projects.module';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [ConfigModule],
  providers: [MailingService, ConfigService],
  exports: [MailingService],
})
export class MailingModule {}
