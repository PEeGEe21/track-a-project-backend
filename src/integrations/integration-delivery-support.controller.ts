import {
  Controller,
  Get,
  NotFoundException,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from 'src/common/guards/super-admin.guard';
import { IntegrationDeliveryService } from './integration-delivery.service';

@Controller('admin/integration-delivery')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class IntegrationDeliverySupportController {
  constructor(private readonly service: IntegrationDeliveryService) {}

  @Get('health')
  health(@Query('organizationId') organizationId: string) {
    if (!organizationId)
      throw new NotFoundException('Integration delivery not found');
    return this.service.supportHealth(organizationId);
  }
}
