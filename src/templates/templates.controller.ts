import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import { CapabilityKey } from 'src/entitlements/capability-catalog';
import { RequireCapability } from 'src/entitlements/decorators/require-capability.decorator';
import { CapabilityGuard } from 'src/entitlements/guards/capability.guard';
import {
  CreateTemplateDto,
  CreateTemplateVersionDto,
  InstantiateTemplateDto,
} from './dto/template.dto';
import { TemplatesService } from './templates.service';
@Controller('templates')
@UseGuards(JwtAuthGuard, OrganizationAccessGuard, CapabilityGuard)
@RequireCapability(CapabilityKey.REUSABLE_TEMPLATES)
export class TemplatesController {
  constructor(private s: TemplatesService) {}
  @Get() list(@Req() r: any, @Headers('x-organization-id') o: string) {
    return this.s.list(r.user, o);
  }
  @Get(':id') get(
    @Req() r: any,
    @Headers('x-organization-id') o: string,
    @Param('id', ParseUUIDPipe) i: string,
  ) {
    return this.s.get(r.user, o, i);
  }
  @Post('projects/:projectId') create(
    @Req() r: any,
    @Headers('x-organization-id') o: string,
    @Param('projectId', ParseIntPipe) p: number,
    @Body() d: CreateTemplateDto,
  ) {
    return this.s.create(r.user, o, p, d);
  }
  @Post(':id/versions') version(
    @Req() r: any,
    @Headers('x-organization-id') o: string,
    @Param('id', ParseUUIDPipe) i: string,
    @Body() d: CreateTemplateVersionDto,
  ) {
    return this.s.version(r.user, o, i, d);
  }
  @Post(':id/preview') preview(
    @Req() r: any,
    @Headers('x-organization-id') o: string,
    @Param('id', ParseUUIDPipe) i: string,
    @Body() d: InstantiateTemplateDto,
  ) {
    return this.s.preview(r.user, o, i, d);
  }
  @Post(':id/instantiate') instantiate(
    @Req() r: any,
    @Headers('x-organization-id') o: string,
    @Param('id', ParseUUIDPipe) i: string,
    @Body() d: InstantiateTemplateDto,
  ) {
    return this.s.instantiate(r.user, o, i, d);
  }
}
