import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from '../services/admin.service';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from 'src/common/guards/super-admin.guard';
import { FindUsersQueryDto } from 'src/users/dtos/FindUsersQuery.dto';
import { UpdateGlobalMenuDto } from 'src/menus/dto/update-global-menu.dto';
import { ReorderMenusDto } from 'src/menus/dto/reorder-menu.dto';
import { MenusService } from 'src/menus/services/menus.service';
import { CreateGlobalMenuDto } from 'src/menus/dto/create-global-menu.dto';
import { UpdateProjectStatusTemplatesDto } from '../dto/project-status-template.dto';
import { ValidationPipe } from '@nestjs/common';
import { EntitlementsService } from 'src/entitlements/entitlements.service';
import { UpdateEntitlementOverrideDto } from 'src/entitlements/dto/update-entitlement-override.dto';
import { CapabilityKey } from 'src/entitlements/capability-catalog';

@Controller('admin')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly menusService: MenusService,
    private readonly entitlementsService: EntitlementsService,
  ) {}

  @Get('organizations/:id/entitlements')
  getOrganizationEntitlements(@Param('id') organizationId: string) {
    return this.entitlementsService.resolveOrganization(organizationId);
  }

  @Patch('organizations/:id/entitlements')
  updateOrganizationEntitlement(
    @Param('id') organizationId: string,
    @Body(ValidationPipe) dto: UpdateEntitlementOverrideDto,
    @Req() req: any,
  ) {
    return this.entitlementsService.setOrganizationOverride(
      req.user,
      organizationId,
      dto.capability,
      dto.enabled,
    );
  }

  @Delete('organizations/:id/entitlements/:capability')
  clearOrganizationEntitlement(
    @Param('id') organizationId: string,
    @Param('capability', new ParseEnumPipe(CapabilityKey))
    capability: CapabilityKey,
    @Req() req: any,
  ) {
    return this.entitlementsService.clearOrganizationOverride(
      req.user,
      organizationId,
      capability,
    );
  }

  // ============================================
  // Super Admin Routes
  // ============================================
  @Roles('super_admin')
  @Get('/users')
  findAllUsers(@Query() query: FindUsersQueryDto, @Req() req: any) {
    return this.adminService.findAllUsers(req.user, query);
  }

  @Roles('super_admin')
  @Post('menus/global')
  async createGlobalMenu(@Body() dto: CreateGlobalMenuDto) {
    return this.menusService.createGlobalMenu(dto);
  }

  @Get('menus/global')
  @Roles('super_admin')
  async getAllGlobalMenus() {
    return this.menusService.findAllGlobalMenus();
  }

  @Get('menus/global/:id')
  @Roles('super_admin')
  async getGlobalMenuById(@Param('id') id: string) {
    return this.menusService.findGlobalMenuById(id);
  }

  @Put('menus/global/:id')
  @Roles('super_admin')
  async updateGlobalMenu(
    @Param('id') id: string,
    @Body() dto: UpdateGlobalMenuDto,
  ) {
    return this.menusService.updateGlobalMenu(id, dto);
  }

  @Delete('menus/global/:id')
  async deleteGlobalMenu(@Param('id') id: string) {
    await this.menusService.deleteGlobalMenu(id);
    return { message: 'Menu deleted successfully' };
  }

  @Post('menus/global/reorder')
  async reorderMenus(@Body() dto: ReorderMenusDto) {
    await this.menusService.reorderMenus(dto);
    return { message: 'Menus reordered successfully' };
  }

  @Get('dashboard/stats')
  async getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('project-status-templates')
  async getProjectStatusTemplates() {
    return this.adminService.getProjectStatusTemplates();
  }

  @Put('project-status-templates')
  async updateProjectStatusTemplates(
    @Body(ValidationPipe) dto: UpdateProjectStatusTemplatesDto,
  ) {
    return this.adminService.updateProjectStatusTemplates(dto.statuses);
  }

  @Patch('users/:id/suspend')
  async suspendUser(@Param('id') userId: number) {
    return this.adminService.suspendUser(userId);
  }

  @Patch('users/:id/activate')
  async activateUser(@Param('id') userId: number) {
    return this.adminService.activateUser(userId);
  }
}
