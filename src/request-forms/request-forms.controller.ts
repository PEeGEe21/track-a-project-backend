import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import { CapabilityKey } from 'src/entitlements/capability-catalog';
import { RequireCapability } from 'src/entitlements/decorators/require-capability.decorator';
import { CapabilityGuard } from 'src/entitlements/guards/capability.guard';
import {
  RequestFormDefinitionDto,
  ReviewRequestFormSubmissionDto,
  SubmitRequestFormDto,
} from './dto/request-form.dto';
import { RequestFormsService } from './request-forms.service';

@Controller('projects/:projectId/request-forms')
@UseGuards(JwtAuthGuard, OrganizationAccessGuard, CapabilityGuard)
@RequireCapability(CapabilityKey.REQUEST_FORMS)
export class RequestFormsController {
  constructor(private readonly forms: RequestFormsService) {}

  @Get()
  list(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('projectId', ParseIntPipe) projectId: number,
  ) {
    return this.forms.list(req.user, org, projectId);
  }

  @Post()
  create(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: RequestFormDefinitionDto,
  ) {
    return this.forms.create(req.user, org, projectId, dto);
  }

  @Get(':formId')
  get(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('formId', ParseUUIDPipe) formId: string,
  ) {
    return this.forms.get(req.user, org, projectId, formId);
  }

  @Post(':formId/draft')
  createDraft(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('formId', ParseUUIDPipe) formId: string,
  ) {
    return this.forms.createDraft(req.user, org, projectId, formId);
  }

  @Put(':formId/draft')
  updateDraft(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('formId', ParseUUIDPipe) formId: string,
    @Body() dto: RequestFormDefinitionDto,
  ) {
    return this.forms.updateDraft(req.user, org, projectId, formId, dto);
  }

  @Post(':formId/preview')
  preview(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('formId', ParseUUIDPipe) formId: string,
    @Body() dto: RequestFormDefinitionDto,
  ) {
    return this.forms.preview(req.user, org, projectId, formId, dto);
  }

  @Post(':formId/publish')
  publish(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('formId', ParseUUIDPipe) formId: string,
  ) {
    return this.forms.publish(req.user, org, projectId, formId);
  }

  @Get(':formId/published')
  published(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('formId', ParseUUIDPipe) formId: string,
  ) {
    return this.forms.published(req.user, org, projectId, formId);
  }

  @Post(':formId/submissions')
  submit(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('formId', ParseUUIDPipe) formId: string,
    @Body() dto: SubmitRequestFormDto,
  ) {
    return this.forms.submit(req.user, org, projectId, formId, dto);
  }

  @Get(':formId/submissions')
  submissions(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('formId', ParseUUIDPipe) formId: string,
  ) {
    return this.forms.submissions(req.user, org, projectId, formId);
  }

  @Post(':formId/submissions/:submissionId/approve')
  approveSubmission(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('formId', ParseUUIDPipe) formId: string,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Body() dto: ReviewRequestFormSubmissionDto,
  ) {
    return this.forms.approveSubmission(
      req.user,
      org,
      projectId,
      formId,
      submissionId,
      dto.note,
    );
  }

  @Post(':formId/submissions/:submissionId/reject')
  rejectSubmission(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('formId', ParseUUIDPipe) formId: string,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Body() dto: ReviewRequestFormSubmissionDto,
  ) {
    return this.forms.rejectSubmission(
      req.user,
      org,
      projectId,
      formId,
      submissionId,
      dto.note,
    );
  }

  @Post(':formId/archive')
  archive(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('formId', ParseUUIDPipe) formId: string,
  ) {
    return this.forms.archive(req.user, org, projectId, formId);
  }
}
