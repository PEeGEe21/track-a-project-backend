import { IsOptional, IsEnum, IsInt, Min, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { UserOrderBy, UserStatus } from 'src/utils/types';
import { InviteStatusEnums } from 'src/utils/constants/InviteStatusEnums';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FindOrganizationsInvitesQuery {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit: number = 10;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: UserOrderBy, default: UserOrderBy.DESC })
  @IsOptional()
  @IsEnum(UserOrderBy)
  orderBy?: UserOrderBy = UserOrderBy.DESC;

  @ApiPropertyOptional({ enum: InviteStatusEnums })
  @IsOptional()
  @IsEnum(InviteStatusEnums)
  status?: InviteStatusEnums;
}
