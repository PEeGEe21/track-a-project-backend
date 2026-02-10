import { IsEmail, IsEnum, IsUUID } from 'class-validator';
import { OrganizationRole } from 'src/utils/constants/org_roles';

export class InviteUserDto {
  @IsEmail()
  email: string;

  @IsUUID()
  organization_id: string;

  @IsEnum(OrganizationRole)
  invited_role: OrganizationRole;
}