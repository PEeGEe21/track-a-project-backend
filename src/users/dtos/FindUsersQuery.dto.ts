import { IsOptional, IsEnum, IsInt, Min, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { UserOrderBy, UserStatus } from 'src/utils/types';

export class FindUsersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit: number = 10;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(UserOrderBy)
  orderBy?: UserOrderBy = UserOrderBy.DESC;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}