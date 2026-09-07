import {
  Controller,
  Get,
  Headers,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import { GlobalSearchService } from './global-search.service';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  ApiContractOperation,
  ApiOrganizationHeader,
  ApiStandardErrors,
} from 'src/common/openapi/api-contract.dto';
import { GlobalSearchResponseDto } from './search-contract.dto';

@Controller('search')
@UseGuards(JwtAuthGuard, OrganizationAccessGuard)
@ApiTags('Search')
@ApiBearerAuth()
@ApiOrganizationHeader()
@ApiStandardErrors({ forbidden: true })
export class GlobalSearchController {
  constructor(private searchService: GlobalSearchService) {}

  @Get()
  @ApiContractOperation(
    'Search the active organization',
    GlobalSearchResponseDto,
  )
  @ApiQuery({
    name: 'q',
    required: false,
    schema: { type: 'string', minLength: 2, maxLength: 100 },
  })
  search(
    @Req() request: any,
    @Headers('x-organization-id') organizationId: string,
    @Query('q') query?: string,
  ) {
    return this.searchService.search(request.user, organizationId, query);
  }
}
