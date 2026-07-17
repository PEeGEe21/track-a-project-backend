import { ProjectRole } from 'src/utils/constants/projectRole';
import { ProjectRolePolicy } from './project-role.policy';

describe('ProjectRolePolicy', () => {
  it.each([
    [ProjectRole.VIEWER, false, false, false],
    [ProjectRole.CONTRIBUTOR, true, false, false],
    [ProjectRole.EDITOR, true, true, false],
    [ProjectRole.OWNER, true, true, true],
  ])('applies the capability matrix for %s', (role, contributes, edits, managesRoles) => {
    expect(ProjectRolePolicy.canView(role)).toBe(true);
    expect(ProjectRolePolicy.canContribute(role)).toBe(contributes);
    expect(ProjectRolePolicy.canEdit(role)).toBe(edits);
    expect(ProjectRolePolicy.canInvite(role)).toBe(edits);
    expect(ProjectRolePolicy.canManageRoles(role)).toBe(managesRoles);
  });
});
