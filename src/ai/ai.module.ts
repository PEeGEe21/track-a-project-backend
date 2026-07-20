import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiRequestAudit } from 'src/typeorm/entities/AiRequestAudit';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import { EntitlementsModule } from 'src/entitlements/entitlements.module';
import { AiController } from './ai.controller';
import { AiAssistanceService } from './ai-assistance.service';
import { OpenAiTextGenerationProvider } from './openai-ai.provider';
import { RedactionService } from './redaction.service';
import { AiGovernanceService } from './ai-governance.service';
import { NoopTextGenerationProvider } from './noop-text-generation.provider';
import { TEXT_GENERATION_PROVIDER } from './provider.tokens';
@Module({
  imports: [
    TypeOrmModule.forFeature([AiRequestAudit, UserOrganization]),
    EntitlementsModule,
  ],
  controllers: [AiController],
  providers: [
    AiAssistanceService,
    AiGovernanceService,
    OpenAiTextGenerationProvider,
    NoopTextGenerationProvider,
    RedactionService,
    OrganizationAccessGuard,
    {
      provide: TEXT_GENERATION_PROVIDER,
      useFactory: (
        openai: OpenAiTextGenerationProvider,
        noop: NoopTextGenerationProvider,
      ) =>
        (process.env.AI_TEXT_PROVIDER ?? 'none') === 'openai' ? openai : noop,
      inject: [OpenAiTextGenerationProvider, NoopTextGenerationProvider],
    },
  ],
  exports: [AiGovernanceService],
})
export class AiModule {}
