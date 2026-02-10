import { OrganizationRole } from 'src/utils/constants/org_roles';

export class CreateInvitationDto {
  email: string;
  organization_id: string;
  invited_role: OrganizationRole;
  invited_by: number;
}
