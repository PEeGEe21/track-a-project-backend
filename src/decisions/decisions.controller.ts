import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import { CapabilityKey } from 'src/entitlements/capability-catalog';
import { RequireCapability } from 'src/entitlements/decorators/require-capability.decorator';
import { CapabilityGuard } from 'src/entitlements/guards/capability.guard';
import { SaveDecisionDto, TransitionDecisionDto } from './dto/decision.dto';
import { DecisionsService } from './decisions.service';
import { DecisionLinkType } from 'src/typeorm/entities/DecisionLink';
@Controller('projects/:projectId/decisions')
@UseGuards(JwtAuthGuard, OrganizationAccessGuard, CapabilityGuard)
@RequireCapability(CapabilityKey.DECISION_REGISTER)
export class DecisionsController {
  constructor(private readonly service: DecisionsService) {}
  @Get() list(
    @Req() r: any,
    @Headers('x-organization-id') o: string,
    @Param('projectId', ParseIntPipe) p: number,
    @Query('status') s?: string,
    @Query('ownerId') owner?: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.service.list(
      r.user,
      o,
      p,
      { status: s, ownerId: owner, from, to },
      page,
      limit,
    );
  }
  @Get('reference-options') referenceOptions(
    @Req() r: any,
    @Headers('x-organization-id') o: string,
    @Param('projectId', ParseIntPipe) p: number,
    @Query('type') type: DecisionLinkType,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.service.referenceOptions(
      r.user,
      o,
      p,
      type,
      search,
      page,
      limit,
    );
  }
  @Get(':id/history') history(
    @Req() r: any,
    @Headers('x-organization-id') o: string,
    @Param('projectId', ParseIntPipe) p: number,
    @Param('id', ParseIntPipe) i: number,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.service.history(r.user, o, p, i, page, limit);
  }
  @Post() create(
    @Req() r: any,
    @Headers('x-organization-id') o: string,
    @Param('projectId', ParseIntPipe) p: number,
    @Body() d: SaveDecisionDto,
  ) {
    return this.service.create(r.user, o, p, d);
  }
  @Patch(':id') update(
    @Req() r: any,
    @Headers('x-organization-id') o: string,
    @Param('projectId', ParseIntPipe) p: number,
    @Param('id', ParseIntPipe) i: number,
    @Body() d: SaveDecisionDto,
  ) {
    return this.service.update(r.user, o, p, i, d);
  }
  @Post(':id/status') transition(
    @Req() r: any,
    @Headers('x-organization-id') o: string,
    @Param('projectId', ParseIntPipe) p: number,
    @Param('id', ParseIntPipe) i: number,
    @Body() d: TransitionDecisionDto,
  ) {
    return this.service.transition(r.user, o, p, i, d.status);
  }
  @Post(':id/supersede') supersede(
    @Req() r: any,
    @Headers('x-organization-id') o: string,
    @Param('projectId', ParseIntPipe) p: number,
    @Param('id', ParseIntPipe) i: number,
    @Body() d: SaveDecisionDto,
  ) {
    return this.service.supersede(r.user, o, p, i, d);
  }
  @Delete(':id') remove(
    @Req() r: any,
    @Headers('x-organization-id') o: string,
    @Param('projectId', ParseIntPipe) p: number,
    @Param('id', ParseIntPipe) i: number,
  ) {
    return this.service.removeProposal(r.user, o, p, i);
  }
}
