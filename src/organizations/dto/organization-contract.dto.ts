import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationMetaDto } from 'src/common/openapi/api-contract.dto';

export class OrganizationContractDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiPropertyOptional({ nullable: true })
  logo: string | null;

  @ApiProperty()
  subscription_tier: string;

  @ApiProperty()
  max_users: number;

  @ApiProperty()
  max_projects: number;

  @ApiProperty()
  is_active: boolean;

  @ApiProperty()
  onboarding_complete: boolean;

  @ApiProperty({ format: 'date-time' })
  created_at: string;

  @ApiProperty({ format: 'date-time' })
  updated_at: string;
}

export class OrganizationListResponseDto {
  @ApiProperty({ example: true })
  success: true;

  @ApiProperty({ type: [OrganizationContractDto] })
  data: OrganizationContractDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}

export class OrganizationResponseDto {
  @ApiProperty({ example: true })
  success: true;

  @ApiProperty({ type: OrganizationContractDto })
  data: OrganizationContractDto;
}

export class OrganizationMutationResponseDto {
  @ApiProperty({ example: true })
  success: true;

  @ApiProperty()
  message: string;

  @ApiProperty({ type: OrganizationContractDto })
  organization: OrganizationContractDto;
}

export class OrganizationTeamMemberDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  organization_id: string;

  @ApiProperty()
  user_id: number;

  @ApiProperty()
  role: string;

  @ApiProperty()
  is_active: boolean;

  @ApiProperty({ type: 'object', additionalProperties: true })
  user: Record<string, unknown>;
}

export class OrganizationTeamResponseDto {
  @ApiProperty({ example: true })
  success: true;

  @ApiProperty({ type: [OrganizationTeamMemberDto] })
  data: OrganizationTeamMemberDto[];
}

export class OrganizationTeamMutationResponseDto {
  @ApiProperty({ example: true })
  success: true;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional({ type: OrganizationTeamMemberDto })
  data?: OrganizationTeamMemberDto;
}

export class OrganizationInvitationDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'email' })
  email: string;

  @ApiProperty()
  invited_role: string;

  @ApiProperty({ format: 'date-time', nullable: true })
  expires_at: string | null;

  @ApiPropertyOptional({ nullable: true })
  invite_link?: string | null;

  @ApiPropertyOptional()
  accepted?: boolean;
}

export class OrganizationInvitationResponseDto {
  @ApiProperty({ example: true })
  success: true;

  @ApiProperty()
  message: string;

  @ApiProperty({ type: OrganizationInvitationDto })
  invitation: OrganizationInvitationDto;
}

export class OrganizationInvitationListResponseDto {
  @ApiProperty({ example: true })
  success: true;

  @ApiProperty({ type: [OrganizationInvitationDto] })
  data: OrganizationInvitationDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}

export class InvitationActionResponseDto {
  @ApiProperty({ example: true })
  success: true;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  invite_link?: string;
}

export class OrganizationPlanResponseDto {
  @ApiProperty({ example: true })
  success: true;

  @ApiProperty({
    type: 'object',
    properties: {
      plan: { type: 'object', additionalProperties: true },
      limits: {
        type: 'object',
        properties: {
          maxUsers: { type: 'number' },
          maxProjects: { type: 'number' },
        },
      },
    },
  })
  data: Record<string, unknown>;
}

export class OrganizationMenusResponseDto {
  @ApiProperty({ example: true })
  success: true;

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  data: Record<string, unknown>[];
}
