import { IsEnum } from 'class-validator';
import { OrganizationRole } from 'src/utils/constants/org_roles';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateOrganizationMemberDto {
  @ApiProperty({ enum: OrganizationRole })
  @IsEnum(OrganizationRole)
  role: OrganizationRole;
}
