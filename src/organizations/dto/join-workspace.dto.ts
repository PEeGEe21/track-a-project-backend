import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class JoinWorkspaceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  invite_token?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  invite_code?: string;
}
