import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class RefreshTokenRequestDto {
  @ApiProperty({
    description:
      'One-time refresh token. A successful refresh rotates it; replay invalidates the session family.',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class SwitchOrganizationRequestDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  organizationId: string;
}

export class TokenPairDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;
}

export class RefreshTokenResponseDto extends TokenPairDto {
  @ApiProperty({ example: 'success' })
  success: string;
}

export class OrganizationSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiPropertyOptional({ nullable: true })
  subscription_tier?: string | null;

  @ApiPropertyOptional({ nullable: true })
  role?: string | null;

  @ApiPropertyOptional()
  onboarding_complete?: boolean;

  @ApiPropertyOptional({ nullable: true })
  description?: string | null;

  @ApiPropertyOptional({ nullable: true })
  logo?: string | null;
}

export class OrganizationSelectionResponseDto {
  @ApiProperty({ example: true })
  requiresOrganizationSelection: true;

  @ApiProperty({ type: [OrganizationSummaryDto] })
  organizations: OrganizationSummaryDto[];
}

export class AuthenticatedSessionResponseDto {
  @ApiProperty({ type: 'object', additionalProperties: true })
  user: Record<string, unknown>;

  @ApiProperty({ type: OrganizationSummaryDto })
  organization: OrganizationSummaryDto;

  @ApiPropertyOptional()
  organizationRole?: string;

  @ApiPropertyOptional({ type: [OrganizationSummaryDto] })
  allOrganizations?: OrganizationSummaryDto[];

  @ApiProperty({ type: TokenPairDto })
  token: TokenPairDto;

  @ApiPropertyOptional()
  message?: string;
}

export class SignupSessionResponseDto {
  @ApiProperty({ type: 'object', additionalProperties: true })
  user: Record<string, unknown>;

  @ApiProperty({ type: OrganizationSummaryDto })
  organization: OrganizationSummaryDto;

  @ApiProperty({ type: TokenPairDto })
  token: TokenPairDto;

  @ApiProperty()
  message: string;
}

export class SwitchOrganizationResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: TokenPairDto })
  token: TokenPairDto;

  @ApiProperty({ type: OrganizationSummaryDto })
  organization: OrganizationSummaryDto;
}

export class InvitationValidationResponseDto {
  @ApiProperty({ format: 'email' })
  email: string;

  @ApiProperty({ type: OrganizationSummaryDto })
  organization: OrganizationSummaryDto;

  @ApiProperty()
  invited_role: string;
}
