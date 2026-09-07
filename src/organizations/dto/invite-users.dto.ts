import { IsEmail, IsEnum, IsUUID } from 'class-validator';
import { OrganizationRole } from 'src/utils/constants/org_roles';
import { ApiProperty } from '@nestjs/swagger';

export class InviteUserDto {
  @ApiProperty({ format: 'email' })
  @IsEmail()
  email: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  organization_id: string;

  @ApiProperty({ enum: OrganizationRole })
  @IsEnum(OrganizationRole)
  invited_role: OrganizationRole;
}
