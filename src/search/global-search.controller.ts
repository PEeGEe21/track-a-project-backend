import { Controller, Get, Headers, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import { GlobalSearchService } from './global-search.service';

@Controller('search')
@UseGuards(JwtAuthGuard, OrganizationAccessGuard)
export class GlobalSearchController {
  constructor(private searchService: GlobalSearchService) {}

  @Get()
  search(
    @Req() request: any,
    @Headers('x-organization-id') organizationId: string,
    @Query('q') query?: string,
  ) {
    return this.searchService.search(request.user, organizationId, query);
  }
}
