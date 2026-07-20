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
import { AuthUser } from 'src/types/users';
import { DataSource, Repository } from 'typeorm';

const PRODUCT_MAX_PINS = 10;

@Injectable()
export class SidebarProjectsService {
  constructor(
    @InjectRepository(UserProjectSidebarPin)
    private readonly pins: Repository<UserProjectSidebarPin>,
    private readonly authorization: AuthorizationService,
    private readonly dataSource: DataSource,
  ) {}

  private effectiveLimit(): number {
    // Plans do not currently expose a sidebar allowance. Undefined allowances
    // deliberately use the product default from the PRD.
    return PRODUCT_MAX_PINS;
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

    return { data: rows, limit: this.effectiveLimit() };
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
    const limit = this.effectiveLimit();
    if (count >= limit) {
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
      return { pin: await this.pins.save(pin), role, created: true };
    } catch (error: any) {
      if (error?.code === 'ER_DUP_ENTRY') {
        const duplicate = await this.pins.findOneByOrFail({
          organization_id: organizationId,
          user_id: actor.userId,
          project_id: projectId,
        });
        return { pin: duplicate, role, created: false };
      }
      throw error;
    }
  }

  async unpin(actor: AuthUser, organizationId: string, projectId: number) {
    await this.pins.delete({
      organization_id: organizationId,
      user_id: actor.userId,
      project_id: projectId,
    });
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
    return this.list(actor, organizationId);
  }
}
