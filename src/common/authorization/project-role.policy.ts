import { ProjectRole } from 'src/utils/constants/projectRole';

const rank: Record<ProjectRole, number> = {
  [ProjectRole.VIEWER]: 0,
  [ProjectRole.CONTRIBUTOR]: 1,
  [ProjectRole.EDITOR]: 2,
  [ProjectRole.OWNER]: 3,
};

export const ProjectRolePolicy = {
  canView: (role: ProjectRole) => rank[role] >= rank.viewer,
  canContribute: (role: ProjectRole) => rank[role] >= rank.contributor,
  canEdit: (role: ProjectRole) => rank[role] >= rank.editor,
  canInvite: (role: ProjectRole) => rank[role] >= rank.editor,
  canManageRoles: (role: ProjectRole) => role === ProjectRole.OWNER,
};
