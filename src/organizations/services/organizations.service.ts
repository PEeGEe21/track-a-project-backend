import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CreateOrganizationDto } from '../dto/create-organization.dto';
import { UpdateOrganizationDto } from '../dto/update-organization.dto';
import { AuthUser } from 'src/types/users';
import { FindOrganizationsQueryDto } from '../dto/FindOrganizationsQuery.dto';
import { PaginatedResponse } from 'src/types/pagination';
import { UsersService } from 'src/users/services/users.service';
import { Organization } from 'src/typeorm/entities/Organization';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';
import { User } from 'src/typeorm/entities/User';
import { UserStatus } from 'src/utils/types';
import { OrganizationRole } from 'src/utils/constants/org_roles';
import { SubscriptionTier } from 'src/utils/constants/subscriptionTier';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(UserOrganization)
    private userOrganizationRepository: Repository<UserOrganization>,
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
    private userService: UsersService,
  ) {}

  create(createOrganizationDto: CreateOrganizationDto) {
    return 'This action adds a new organization';
  }

  async findAll(
    authUser: AuthUser,
    query: FindOrganizationsQueryDto,
  ): Promise<PaginatedResponse<Organization>> {
    const { page = 1, limit = 10, search, orderBy, status } = query;

    const foundUser = await this.userService.getUserAccountById(
      authUser.userId,
    );

    if (!foundUser) {
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
    }

    const qb = this.organizationRepository
      .createQueryBuilder('org')
      .leftJoinAndSelect(
        'org.user_organizations',
        'adminRelation',
        'adminRelation.role = :adminRole',
        { adminRole: OrganizationRole.ORG_ADMIN },
      )
      .leftJoinAndSelect('adminRelation.user', 'admin')
      .loadRelationCountAndMap('org.userCount', 'org.user_organizations');

    if (search) {
      qb.andWhere(
        '(LOWER(org.name) LIKE :search OR LOWER(org.slug) LIKE :search)',
        { search: `%${search.toLowerCase()}%` },
      );
    }

    if (status) {
      qb.andWhere('org.is_active = :active', {
        active: status === UserStatus.ACTIVE,
      });
    }

    qb.orderBy('org.created_at', orderBy);
    qb.skip((page - 1) * limit).take(limit);

    const [result, total] = await qb.getManyAndCount();

    return {
      data: result,
      meta: {
        current_page: page,
        from: (page - 1) * limit + 1,
        last_page: Math.ceil(total / limit),
        per_page: limit,
        to: (page - 1) * limit + result.length,
        total,
      },
      success: true,
    };
  }

  async findOne(authUser: AuthUser, id: string): Promise<any> {
    const foundUser = await this.userService.getUserAccountById(
      authUser.userId,
    );

    if (!foundUser) {
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
    }

    const qb = this.organizationRepository
      .createQueryBuilder('org')
      .loadRelationCountAndMap('org.userCount', 'org.user_organizations')
      .leftJoinAndSelect('org.user_organizations', 'userOrg')
      .leftJoinAndSelect('userOrg.user', 'user')
      .where('org.id = :id', { id });

    const organization = await qb.getOne();

    if (!organization) {
      throw new HttpException('Organization not found', HttpStatus.NOT_FOUND);
    }

    return {
      data: organization,
      success: true,
    };
  }

  async findOneTeam(authUser: AuthUser, id: string): Promise<any> {
    const foundUser = await this.userService.getUserAccountById(
      authUser.userId,
    );

    if (!foundUser) {
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
    }

    const qb = this.userOrganizationRepository
      .createQueryBuilder('userOrg')
      .leftJoinAndSelect('userOrg.organization', 'org')
      .leftJoinAndSelect('userOrg.user', 'user')
      .where('org.id = :id', { id });

    const team = await qb.getMany();

    return {
      data: team,
      success: true,
    };
  }

  async getOrganizationMenus(
    authUser: AuthUser,
    organizationId: string,
  ): Promise<any> {
    const foundUser = await this.userService.getUserAccountById(
      authUser.userId,
    );

    if (!foundUser) {
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
    }

    try {
      const organization = await this.organizationRepository.findOne({
        where: { id: organizationId },
        relations: ['organization_menus', 'organization_menus.global_menu'],
      });

      if (!organization) {
        throw new HttpException('Organization not found', HttpStatus.NOT_FOUND);
      }

      // Define tier hierarchy
      const tierHierarchy = {
        [SubscriptionTier.FREE]: 0,
        [SubscriptionTier.BASIC]: 1,
        [SubscriptionTier.PROFESSIONAL]: 2,
        [SubscriptionTier.ENTERPRISE]: 3,
      };

      const currentTierLevel = tierHierarchy[organization.subscription_tier];

      // Sort and add access control info
      const menusWithAccess = organization.organization_menus
        .map((menu) => {
          const requiredTierLevel =
            tierHierarchy[menu.global_menu.required_tier];
          const hasAccess = currentTierLevel >= requiredTierLevel;

          return {
            ...menu,
            has_tier_access: hasAccess,
            requires_upgrade: !hasAccess,
            required_tier: menu.global_menu.required_tier,
            is_available: menu.is_enabled && hasAccess, // Available only if enabled AND has tier access
            global_menu: {
              ...menu.global_menu,
              // Include the label, href, icon, etc.
            },
          };
        })
        .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

      return {
        data: menusWithAccess,
        success: true,
      };
    } catch (error) {
      throw new HttpException(
        'Failed to fetch organization menus',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  update(id: number, updateOrganizationDto: UpdateOrganizationDto) {
    return `This action updates a #${id} organization`;
  }

  remove(id: number) {
    return `This action removes a #${id} organization`;
  }
}
