import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import {
  CreateIntegrationEndpointDto,
  ListIntegrationDeliveriesDto,
  ReplayIntegrationDeliveryDto,
  RotateIntegrationSecretDto,
  UpdateIntegrationEndpointDto,
} from './dto/integration-delivery.dto';
import { IntegrationDeliveryService } from './integration-delivery.service';

@Controller('integration-delivery')
@UseGuards(JwtAuthGuard, OrganizationAccessGuard)
export class IntegrationDeliveryController {
  constructor(private readonly service: IntegrationDeliveryService) {}
  @Get('endpoints') list(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
  ) {
    return this.service.listEndpoints(req.user, org);
  }
  @Post('endpoints') create(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Body(ValidationPipe) dto: CreateIntegrationEndpointDto,
  ) {
    return this.service.createEndpoint(req.user, org, dto);
  }
  @Patch('endpoints/:id') update(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) dto: UpdateIntegrationEndpointDto,
  ) {
    return this.service.updateEndpoint(req.user, org, id, dto);
  }
  @Post('endpoints/:id/rotate-secret') rotate(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) dto: RotateIntegrationSecretDto,
  ) {
    return this.service.rotate(req.user, org, id, dto);
  }
  @Post('endpoints/:id/test') test(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.testEndpoint(req.user, org, id);
  }
  @Get('deliveries') deliveries(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Query() query: ListIntegrationDeliveriesDto,
  ) {
    return this.service.listDeliveries(req.user, org, query);
  }
  @Get('deliveries/:id') delivery(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.service.delivery(
      req.user,
      org,
      id,
      projectId ? Number(projectId) : undefined,
    );
  }
  @Post('deliveries/:id/replay') replay(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) dto: ReplayIntegrationDeliveryDto,
  ) {
    return this.service.replay(req.user, org, id, dto);
  }
}
