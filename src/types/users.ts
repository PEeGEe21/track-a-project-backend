export type AuthUser = {
  userId: number;
  email: string;
  role: string;
  currentOrganizationId?: string | null;
  organization_id?: string | null;
  organizationRole?: string | null;
  sessionFamilyId?: string | null;
  userOrganizations?: UserOrganization[];
};

type UserOrganization = {
  organization_id: string;
  subscription_tier: string;
};
