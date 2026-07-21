import {
  Body,
  Controller,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import { RequireCapability } from 'src/entitlements/decorators/require-capability.decorator';
import { CapabilityGuard } from 'src/entitlements/guards/capability.guard';
import { CapabilityKey } from 'src/entitlements/capability-catalog';
import { AiAssistanceService } from './ai-assistance.service';
import { CreateAiAssistanceDto } from './dto/create-ai-assistance.dto';
@Controller('ai')
@UseGuards(JwtAuthGuard, OrganizationAccessGuard, CapabilityGuard)
@RequireCapability(CapabilityKey.AI_ASSISTANCE)
export class AiController {
  constructor(private ai: AiAssistanceService) {}

  @Post('projects/:projectId/draft-update') draftProjectUpdate(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Param('projectId', ParseIntPipe) projectId: number,
  ) {
    return this.ai.draftProjectUpdate(req.user, organizationId, projectId);
  }

  @Post('tasks/:taskId/summarize-thread') summarizeTaskThread(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Param('taskId', ParseIntPipe) taskId: number,
  ) {
    return this.ai.summarizeTaskThread(req.user, organizationId, taskId);
  }

  @Post('assist') assist(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Body() dto: CreateAiAssistanceDto,
  ) {
    return this.ai.assist(req.user, organizationId, dto);
  }
}
