import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiRequestAudit } from 'src/typeorm/entities/AiRequestAudit';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';
import { Task } from 'src/typeorm/entities/Task';
import { TaskComment } from 'src/typeorm/entities/TaskComment';
import { Project } from 'src/typeorm/entities/Project';
import { ProjectUpdate } from 'src/typeorm/entities/ProjectUpdate';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import { AuthorizationModule } from 'src/common/authorization/authorization.module';
import { EntitlementsModule } from 'src/entitlements/entitlements.module';
import { AiController } from './ai.controller';
import { AiAssistanceService } from './ai-assistance.service';
import { OpenAiTextGenerationProvider } from './openai-ai.provider';
import { RedactionService } from './redaction.service';
import { AiGovernanceService } from './ai-governance.service';
import { NoopTextGenerationProvider } from './noop-text-generation.provider';
import { TEXT_GENERATION_PROVIDER } from './provider.tokens';
import { HuggingFaceTextGenerationProvider } from './huggingface-ai.provider';
import { AiTaskContextService } from './ai-task-context.service';
import { AiProjectContextService } from './ai-project-context.service';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      AiRequestAudit,
      UserOrganization,
      Task,
      TaskComment,
      Project,
      ProjectUpdate,
    ]),
    EntitlementsModule,
    AuthorizationModule,
  ],
  controllers: [AiController],
  providers: [
    AiAssistanceService,
    AiGovernanceService,
    OpenAiTextGenerationProvider,
    HuggingFaceTextGenerationProvider,
    NoopTextGenerationProvider,
    RedactionService,
    AiTaskContextService,
    AiProjectContextService,
    OrganizationAccessGuard,
    {
      provide: TEXT_GENERATION_PROVIDER,
      useFactory: (
        openai: OpenAiTextGenerationProvider,
        huggingface: HuggingFaceTextGenerationProvider,
        noop: NoopTextGenerationProvider,
      ) => {
        const provider = process.env.AI_TEXT_PROVIDER ?? 'none';
        if (provider === 'openai') return openai;
        if (provider === 'huggingface') return huggingface;
        return noop;
      },
      inject: [
        OpenAiTextGenerationProvider,
        HuggingFaceTextGenerationProvider,
        NoopTextGenerationProvider,
      ],
    },
  ],
  exports: [AiGovernanceService],
})
export class AiModule {}
