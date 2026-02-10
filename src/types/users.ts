export type AuthUser = {
  userId: number;
  email: string;
  role: string;
  userOrganizations?: UserOrganization[];
};

type UserOrganization = {
  organization_id: string;
  subscription_tier: string;
};
