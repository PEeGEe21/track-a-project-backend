import {
  ConflictException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  AuthorizationService,
  ProjectPermission,
} from 'src/common/authorization/authorization.service';
import { UserProjectSidebarPin } from 'src/typeorm/entities/UserProjectSidebarPin';
import { Organization } from 'src/typeorm/entities/Organization';
import { AuthUser } from 'src/types/users';
import { DataSource, Repository } from 'typeorm';
import { AppLogger } from 'src/common/logging/app-logger';

const PRODUCT_MAX_PINS = 10;

@Injectable()
export class SidebarProjectsService {
  constructor(
    @InjectRepository(UserProjectSidebarPin)
    private readonly pins: Repository<UserProjectSidebarPin>,
    @InjectRepository(Organization)
    private readonly organizations: Repository<Organization>,
    private readonly authorization: AuthorizationService,
    private readonly dataSource: DataSource,
  ) {}

  private async effectiveLimit(organizationId: string): Promise<number> {
    const organization = await this.organizations.findOne({
      where: { id: organizationId },
      relations: ['activeSubscription', 'activeSubscription.price', 'activeSubscription.price.plan'],
    });
    const configured =
      organization?.activeSubscription?.price?.plan?.sidebar_project_pin_limit;
    if (configured === null || configured === undefined) {
      return PRODUCT_MAX_PINS;
    }
    return Math.max(0, Math.min(PRODUCT_MAX_PINS, Number(configured)));
  }

  async list(actor: AuthUser, organizationId: string) {
    const scope = await this.authorization.getProjectAccessScope(
      actor,
      organizationId,
    );
    const query = this.pins
      .createQueryBuilder('pin')
      .innerJoin('pin.project', 'project', 'project.organization_id = :orgId')
      .leftJoin(
        'project.projectPeers',
        'peer',
        'peer.user_id = :userId AND peer.organization_id = :orgId AND peer.status = :connected AND peer.is_confirmed = 1',
      )
      .leftJoin('project.user', 'owner')
      .where('pin.organization_id = :orgId')
      .andWhere('pin.user_id = :userId')
      .setParameters({
        orgId: organizationId,
        userId: actor.userId,
        connected: 'connected',
      });

    if (!scope.canAccessAllProjects) {
      query.andWhere('(owner.id = :userId OR peer.id IS NOT NULL)');
    }

    const rows = await query
      .select([
        'pin.id AS id',
        'pin.project_id AS projectId',
        'pin.position AS position',
        'pin.created_at AS createdAt',
        'project.title AS title',
        'project.icon AS icon',
        'project.color AS color',
        `CASE WHEN owner.id = :userId OR :isAdmin = 1 THEN 'owner' ELSE peer.role END AS role`,
      ])
      .setParameter('isAdmin', scope.canAccessAllProjects ? 1 : 0)
      .orderBy('pin.position', 'ASC')
      .addOrderBy('pin.created_at', 'ASC')
      .limit(PRODUCT_MAX_PINS)
      .getRawMany();

    const accessibleIds = rows.map((row) => Number(row.projectId));
    const staleQuery = this.pins
      .createQueryBuilder()
      .delete()
      .where('organization_id = :organizationId', { organizationId })
      .andWhere('user_id = :userId', { userId: actor.userId });
    if (accessibleIds.length) {
      staleQuery.andWhere('project_id NOT IN (:...accessibleIds)', {
        accessibleIds,
      });
    }
    await staleQuery.execute();

    return { data: rows, limit: await this.effectiveLimit(organizationId) };
  }

  async pin(actor: AuthUser, organizationId: string, projectId: number) {
    const { project, role } = await this.authorization.assertProjectPermission(
      actor,
      organizationId,
      projectId,
      ProjectPermission.VIEW,
    );
    const existing = await this.pins.findOneBy({
      organization_id: organizationId,
      user_id: actor.userId,
      project_id: projectId,
    });
    if (existing) return { pin: existing, role, created: false };

    const count = await this.pins.countBy({
      organization_id: organizationId,
      user_id: actor.userId,
    });
    const limit = await this.effectiveLimit(organizationId);
    if (count >= limit) {
      AppLogger.warn(
        'SidebarProjectsService',
        'project_sidebar_pin_limit_reached',
        {
          organizationId,
          projectId,
          userId: actor.userId,
          limit,
          currentPinCount: count,
        },
      );
      throw new ConflictException({
        message: `You can pin up to ${limit} projects`,
        limit,
      });
    }

    const max = await this.pins.maximum('position', {
      organization_id: organizationId,
      user_id: actor.userId,
    });
    const pin = this.pins.create({
      organization_id: organizationId,
      user_id: actor.userId,
      project_id: project.id,
      position: (max ?? -1) + 1,
    });
    try {
      const saved = await this.pins.save(pin);
      AppLogger.log('SidebarProjectsService', 'project_sidebar_pin_created', {
        organizationId,
        projectId,
        userId: actor.userId,
        role,
        currentPinCount: count + 1,
      });
      return { pin: saved, role, created: true };
    } catch (error: any) {
      if (error?.code === 'ER_DUP_ENTRY') {
        const duplicate = await this.pins.findOneByOrFail({
          organization_id: organizationId,
          user_id: actor.userId,
          project_id: projectId,
        });
        return { pin: duplicate, role, created: false };
      }
      AppLogger.error('SidebarProjectsService', 'sidebar pin database failure', {
        organizationId,
        projectId,
        userId: actor.userId,
        databaseCode: error?.code,
      });
      throw error;
    }
  }

  async unpin(actor: AuthUser, organizationId: string, projectId: number) {
    const result = await this.pins.delete({
      organization_id: organizationId,
      user_id: actor.userId,
      project_id: projectId,
    });
    if (result.affected) {
      AppLogger.log('SidebarProjectsService', 'project_sidebar_pin_removed', {
        organizationId,
        projectId,
        userId: actor.userId,
      });
    }
    return { success: true };
  }

  async reorder(
    actor: AuthUser,
    organizationId: string,
    projectIds: number[],
  ) {
    const current = await this.pins.find({
      where: { organization_id: organizationId, user_id: actor.userId },
      select: { project_id: true },
    });
    const currentIds = current.map((pin) => Number(pin.project_id)).sort();
    const requestedIds = [...projectIds].map(Number).sort();
    if (
      currentIds.length !== requestedIds.length ||
      currentIds.some((id, index) => id !== requestedIds[index])
    ) {
      throw new UnprocessableEntityException(
        'projectIds must contain the complete current pin set',
      );
    }

    await this.dataSource.transaction(async (manager) => {
      await Promise.all(
        projectIds.map((projectId, position) =>
          manager.update(
            UserProjectSidebarPin,
            {
              organization_id: organizationId,
              user_id: actor.userId,
              project_id: projectId,
            },
            { position },
          ),
        ),
      );
    });
    AppLogger.log('SidebarProjectsService', 'project_sidebar_pins_reordered', {
      organizationId,
      userId: actor.userId,
      projectIds,
    });
    return this.list(actor, organizationId);
  }
}
