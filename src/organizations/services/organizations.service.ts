import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
import { CreateInvitationDto } from '../dto/create-invitation.dto';
import { OrganizationInvitation } from 'src/typeorm/entities/OrganizationInvitation';
import { FindOrganizationsInvitesQuery } from '../dto/FindOrganizationsInvitesQuery.dto';
import { InviteStatusEnums } from 'src/utils/constants/InviteStatusEnums';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(UserOrganization)
    private userOrganizationRepository: Repository<UserOrganization>,
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
    @InjectRepository(OrganizationInvitation)
    private invitationRepository: Repository<OrganizationInvitation>,
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

  /**
   * Create a new invitation
   * Only ORG_ADMIN can invite users
   */
  async createInvitation(dto: CreateInvitationDto) {
    try {
      const foundUser = await this.userService.getUserAccountById(
        dto.invited_by,
      );
      if (!foundUser) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      // Verify inviter has ORG_ADMIN role
      const inviterRelation = await this.userOrganizationRepository.findOne({
        where: {
          user_id: dto.invited_by,
          organization_id: dto.organization_id,
        },
      });

      if (
        !inviterRelation ||
        inviterRelation.role !== OrganizationRole.ORG_ADMIN
      ) {
        throw new ForbiddenException(
          'Only organization admins can send invitations',
        );
      }

      // Check organization exists and is active
      const organization = await this.organizationRepository.findOne({
        where: { id: dto.organization_id },
        relations: ['user_organizations'],
      });

      if (!organization) {
        throw new NotFoundException('Organization not found');
      }

      if (!organization.is_active) {
        throw new BadRequestException('Organization is not active');
      }

      // Check if organization has reached max users
      const currentMemberCount = organization.user_organizations.length;
      if (currentMemberCount >= organization.max_users) {
        throw new BadRequestException(
          `Organization has reached maximum capacity of ${organization.max_users} users`,
        );
      }

      // Check if email already has a pending invitation
      const existingInvitation = await this.invitationRepository.findOne({
        where: {
          email: dto.email.toLowerCase(),
          organization_id: dto.organization_id,
          accepted: false,
        },
      });

      if (existingInvitation) {
        // If expired, delete and create new one
        if (
          existingInvitation.expires_at &&
          new Date() > existingInvitation.expires_at
        ) {
          await this.invitationRepository.remove(existingInvitation);
        } else {
          throw new BadRequestException(
            'An invitation already exists for this email',
          );
        }
      }

      // Check if user already belongs to organization
      const existingMember = await this.userOrganizationRepository
        .createQueryBuilder('uo')
        .innerJoin('uo.user', 'user')
        .where('user.email = :email', { email: dto.email.toLowerCase() })
        .andWhere('uo.organization_id = :orgId', { orgId: dto.organization_id })
        .getOne();

      if (existingMember) {
        throw new BadRequestException(
          'User is already a member of this organization',
        );
      }

      // Create invitation
      const invitation = this.invitationRepository.create({
        email: dto.email.toLowerCase(),
        organization_id: dto.organization_id,
        invited_role: dto.invited_role,
        invited_by_id: dto.invited_by,
        invited_by: foundUser,
      });

      await this.invitationRepository.save(invitation);

      const inviteLink = `${process.env.FRONTEND_URL}/signup/join-org?invite=${invitation.token}`;
      invitation.invite_link = inviteLink;

      await this.invitationRepository.save(invitation);

      // In production, you'd send an email here with the invitation link

      return {
        invitation: {
          id: invitation.id,
          email: invitation.email,
          invited_role: invitation.invited_role,
          expires_at: invitation.expires_at,
          invite_link: inviteLink,
        },
        message: 'Invitation created successfully',
        success: true,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to save ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get all pending invitations for an organization
   */
  async getOrganizationInvitations(
    organizationId: string,
    query: FindOrganizationsInvitesQuery,
    userId: number,
  ) {
    const { page = 1, limit = 10, search, orderBy, status } = query;

    // Verify user has ORG_ADMIN role
    const userRelation = await this.userOrganizationRepository.findOne({
      where: {
        user_id: userId,
        organization_id: organizationId,
      },
    });

    if (!userRelation || userRelation.role !== OrganizationRole.ORG_ADMIN) {
      throw new ForbiddenException(
        'Only organization admins can view invitations',
      );
    }

    const qb = this.invitationRepository
      .createQueryBuilder('invitations')
      .leftJoinAndSelect('invitations.invited_by', 'user')
      .where('invitations.organization_id = :organizationId', {
        organizationId,
      });

    if (search) {
      qb.andWhere(
        `(LOWER(invitations.email) LIKE :search
        OR LOWER(user.last_name) LIKE :search
        OR LOWER(user.first_name) LIKE :search
        OR LOWER(user.email) LIKE :search
        OR LOWER(user.username) LIKE :search)`,
        { search: `%${search.toLowerCase()}%` },
      );
    }

    if (status && status !== InviteStatusEnums.ALL) {
      qb.andWhere('invitations.accepted = :active', {
        active: status === InviteStatusEnums.ACCEPTED,
      });
    }

    qb.orderBy('invitations.created_at', orderBy);
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

  /**
   * Resend an invitation
   */
  async resendInvitation(invitationId: string, userId: number) {
    const invitation = await this.invitationRepository.findOne({
      where: { id: invitationId },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    // Verify user has ORG_ADMIN role
    const userRelation = await this.userOrganizationRepository.findOne({
      where: {
        user_id: userId,
        organization_id: invitation.organization_id,
      },
    });

    if (!userRelation || userRelation.role !== OrganizationRole.ORG_ADMIN) {
      throw new ForbiddenException(
        'Only organization admins can resend invitations',
      );
    }

    if (invitation.accepted) {
      throw new BadRequestException('Invitation has already been accepted');
    }

    // Extend expiration
    const newExpiryDate = new Date();
    newExpiryDate.setDate(newExpiryDate.getDate() + 7);
    invitation.expires_at = newExpiryDate;

    const inviteLink = `${process.env.FRONTEND_URL}/signup?invite=${invitation.token}`;

    invitation.invite_link = inviteLink;
    await this.invitationRepository.save(invitation);

    return {
      message: 'Invitation resent successfully',
      invite_link: inviteLink,
      success: true,
    };
  }

  /**
   * Revoke/delete an invitation
   */
  async revokeInvitation(invitationId: string, userId: number) {
    const invitation = await this.invitationRepository.findOne({
      where: { id: invitationId },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    // Verify user has ORG_ADMIN role
    const userRelation = await this.userOrganizationRepository.findOne({
      where: {
        user_id: userId,
        organization_id: invitation.organization_id,
      },
    });

    if (!userRelation || userRelation.role !== OrganizationRole.ORG_ADMIN) {
      throw new ForbiddenException(
        'Only organization admins can revoke invitations',
      );
    }

    await this.invitationRepository.remove(invitation);

    return {
      message: 'Invitation revoked successfully',
      success: true,
    };
  }
}
