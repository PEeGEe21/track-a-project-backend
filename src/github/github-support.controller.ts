import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from 'src/common/guards/super-admin.guard';
import { GithubService } from './github.service';

@Controller('admin/github')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class GithubSupportController {
  constructor(private readonly service: GithubService) {}
  @Get('health') health(@Query('organizationId') organizationId?: string) {
    return this.service.supportHealth(organizationId);
  }
}
