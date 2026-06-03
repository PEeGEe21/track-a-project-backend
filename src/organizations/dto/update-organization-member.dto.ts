import { IsEnum } from 'class-validator';
import { OrganizationRole } from 'src/utils/constants/org_roles';

export class UpdateOrganizationMemberDto {
  @IsEnum(OrganizationRole)
  role: OrganizationRole;
}
