import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Req,
} from '@nestjs/common';
import { OrganizationsService } from '../services/organizations.service';
import { CreateOrganizationDto } from '../dto/create-organization.dto';
import { UpdateOrganizationDto } from '../dto/update-organization.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { FindOrganizationsQueryDto } from '../dto/FindOrganizationsQuery.dto';

@UseGuards(JwtAuthGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  // ============================================
  // Super Admin Routes
  // ============================================

  @UseGuards(RolesGuard)
  @Roles('super_admin')
  @Get('/')
  findAll(@Query() query: FindOrganizationsQueryDto, @Req() req: any) {
    return this.organizationsService.findAll(req.user, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.organizationsService.findOne(req.user, id);
  }

  @Get(':id/menus')
  getOrganizationMenus(@Param('id') id: string, @Req() req: any) {
    return this.organizationsService.getOrganizationMenus(req.user, id);
  }

  @Get(':id/team')
  findOneTeam(@Param('id') id: string, @Req() req: any) {
    return this.organizationsService.findOneTeam(req.user, id);
  }

  @Post()
  create(@Body() createOrganizationDto: CreateOrganizationDto) {
    return this.organizationsService.create(createOrganizationDto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateOrganizationDto: UpdateOrganizationDto,
  ) {
    return this.organizationsService.update(+id, updateOrganizationDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.organizationsService.remove(+id);
  }
}
