import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Put,
  Headers,
} from '@nestjs/common';
import { MenusService } from '../services/menus.service';
import { CreateMenuDto } from '../dto/create-menu.dto';
import { UpdateMenuDto } from '../dto/update-menu.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CreateGlobalMenuDto } from '../dto/create-global-menu.dto';
import { UpdateGlobalMenuDto } from '../dto/update-global-menu.dto';
import { UpdateOrgMenuDto } from '../dto/update-org-menu.dto';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import { SubscriptionGuard } from 'src/common/guards/subscription.guard';
import { ReorderMenusDto } from '../dto/reorder-menu.dto';

@Controller('menus')
@UseGuards(JwtAuthGuard)
export class MenusController {
  constructor(private readonly menusService: MenusService) {}
  // ============================================
  // Organization Routes
  // ============================================

  @Get('organization')
  @UseGuards(OrganizationAccessGuard, RolesGuard, SubscriptionGuard)
  async getOrganizationMenus(
    @Request() req,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.menusService.getMenusForOrganization(organizationId, req.user);
  }

  @Put('organization/:menuId')
  @UseGuards(OrganizationAccessGuard, RolesGuard, SubscriptionGuard)
  @Roles('org_admin')
  async updateOrgMenu(
    @Param('menuId') menuId: string,
    @Body() dto: UpdateOrgMenuDto,
    @Request() req,
    @Headers('x-organization-id') organizationId: string,
  ) {
    await this.menusService.updateOrgMenu(organizationId, menuId, dto);
    return { message: 'Menu updated successfully' };
  }
}
