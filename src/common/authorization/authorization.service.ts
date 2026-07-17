import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Project } from 'src/typeorm/entities/Project';
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeer';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';
import { AuthUser } from 'src/types/users';
import { OrganizationRole } from 'src/utils/constants/org_roles';
import { ProjectPeerStatus } from 'src/utils/constants/projectPeerEnums';
import { Repository } from 'typeorm';
import { ProjectRole } from 'src/utils/constants/projectRole';
import { ProjectRolePolicy } from './project-role.policy';

export type ProjectAction = 'read' | 'write';
export enum ProjectPermission {
  VIEW = 'view',
  CONTRIBUTE = 'contribute',
  EDIT = 'edit',
  INVITE = 'invite',
  MANAGE_SETTINGS = 'manage_settings',
  MANAGE_ROLES = 'manage_roles',
}

export type ProjectAccessScope = {
  canAccessAllProjects: boolean;
  userId: number;
};

@Injectable()
export class AuthorizationService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(ProjectPeer)
    private readonly projectPeerRepository: Repository<ProjectPeer>,
    @InjectRepository(UserOrganization)
    private readonly userOrganizationRepository: Repository<UserOrganization>,
  ) {}

  async getProjectAccessScope(
    actor: AuthUser,
    organizationId: string,
  ): Promise<ProjectAccessScope> {
    if (actor.role === 'super_admin') {
      return { canAccessAllProjects: true, userId: actor.userId };
    }

    const membership = await this.userOrganizationRepository.findOne({
      where: {
        user_id: actor.userId,
        organization_id: organizationId,
        is_active: true,
      },
    });

    if (!membership) {
      throw new ForbiddenException('Organization access denied');
    }

    return {
      canAccessAllProjects: membership.role === OrganizationRole.ORG_ADMIN,
      userId: actor.userId,
    };
  }

  async assertProjectAccess(params: {
    actor: AuthUser;
    organizationId: string;
    projectId: number;
    action: ProjectAction;
  }): Promise<Project> {
    const { actor, organizationId, projectId } = params;
    const project = await this.projectRepository.findOne({
      where: { id: projectId, organization_id: organizationId },
      relations: ['user'],
    });

    // Do not reveal whether a project exists in another organization.
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const scope = await this.getProjectAccessScope(actor, organizationId);

    if (
      scope.canAccessAllProjects ||
      Number(project.user?.id) === Number(actor.userId)
    ) {
      return project;
    }

    const isConnectedPeer = await this.projectPeerRepository.exists({
      where: {
        project: { id: projectId },
        user: { id: actor.userId },
        organization_id: organizationId,
        status: ProjectPeerStatus.CONNECTED,
        is_confirmed: true,
      },
    });

    if (!isConnectedPeer) {
      throw new ForbiddenException('Project access denied');
    }

    return project;
  }

  async resolveProjectRole(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
  ) {
    const project = await this.projectRepository.findOne({
      where: { id: projectId, organization_id: organizationId },
      relations: ['user'],
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    const scope = await this.getProjectAccessScope(actor, organizationId);
    const isCreator = Number(project.user?.id) === Number(actor.userId);
    if (scope.canAccessAllProjects || isCreator) {
      return { project, role: ProjectRole.OWNER, isCreator };
    }
    const membership = await this.projectPeerRepository.findOne({
      where: {
        project: { id: projectId },
        user: { id: actor.userId },
        organization_id: organizationId,
        status: ProjectPeerStatus.CONNECTED,
        is_confirmed: true,
      },
    });
    if (!membership) {
      throw new ForbiddenException('Project access denied');
    }
    return {
      project,
      role: membership.role ?? ProjectRole.EDITOR,
      isCreator: false,
    };
  }

  async assertProjectPermission(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    permission: ProjectPermission,
  ) {
    const context = await this.resolveProjectRole(
      actor,
      organizationId,
      projectId,
    );
    const allowed =
      permission === ProjectPermission.VIEW
        ? ProjectRolePolicy.canView(context.role)
        : permission === ProjectPermission.CONTRIBUTE
          ? ProjectRolePolicy.canContribute(context.role)
          : permission === ProjectPermission.EDIT
            ? ProjectRolePolicy.canEdit(context.role)
            : permission === ProjectPermission.INVITE
              ? ProjectRolePolicy.canInvite(context.role)
              : ProjectRolePolicy.canManageRoles(context.role);
    if (!allowed) {
      throw new ForbiddenException(`Project permission denied: ${permission}`);
    }
    return context;
  }
}
