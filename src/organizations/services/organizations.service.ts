import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
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
import { BillingService } from 'src/billing/services/billing.service';
import { SubscriptionService } from 'src/billing/services/subscription.service';
import { AppLogger } from 'src/common/logging/app-logger';
import { InviteLinks } from 'src/common/services/invite-links';
import { UpdateOrganizationMemberDto } from '../dto/update-organization-member.dto';
import { OrganizationSettings } from 'src/typeorm/entities/OrganizationSettings';
import { DeadlineRemindersService } from 'src/notifications/services/deadline-reminders.service';
import { hashInviteCode, hashInviteToken } from 'src/utils/invitation-crypto';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(UserOrganization)
    private userOrganizationRepository: Repository<UserOrganization>,
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
    @InjectRepository(OrganizationSettings)
    private organizationSettingsRepository: Repository<OrganizationSettings>,
    @InjectRepository(OrganizationInvitation)
    private invitationRepository: Repository<OrganizationInvitation>,
    private userService: UsersService,
    private billingService: BillingService,
    private subscriptionService: SubscriptionService,
    private deadlineRemindersService: DeadlineRemindersService,
  ) {}

  private async assertOrganizationAdmin(
    userId: number,
    organizationId: string,
  ) {
    const membership = await this.userOrganizationRepository.findOne({
      where: {
        user_id: userId,
        organization_id: organizationId,
      },
    });

    if (!membership || membership.role !== OrganizationRole.ORG_ADMIN) {
      throw new ForbiddenException(
        'Only organization admins can manage team members',
      );
    }

    return membership;
  }

  private async countOrganizationAdmins(organizationId: string) {
    return this.userOrganizationRepository.count({
      where: {
        organization_id: organizationId,
        role: OrganizationRole.ORG_ADMIN,
      },
    });
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
      .loadRelationCountAndMap('org.userCount', 'org.user_organizations')
      .loadRelationCountAndMap('org.projectCount', 'org.projects');

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
      .loadRelationCountAndMap('org.projectCount', 'org.projects')
      .leftJoinAndSelect('org.settings', 'settings')
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

  async updateTeamMember(
    authUser: AuthUser,
    organizationId: string,
    memberUserId: string,
    dto: UpdateOrganizationMemberDto,
  ) {
    const foundUser = await this.userService.getUserAccountById(
      authUser.userId,
    );

    if (!foundUser) {
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
    }

    await this.assertOrganizationAdmin(authUser.userId, organizationId);

    const member = await this.userOrganizationRepository.findOne({
      where: {
        organization_id: organizationId,
        user_id: Number(memberUserId),
      },
      relations: ['user'],
    });

    if (!member) {
      throw new NotFoundException('Organization member not found');
    }

    if (member.role === dto.role) {
      return {
        success: true,
        message: 'Member role is already up to date',
        data: member,
      };
    }

    if (member.role === OrganizationRole.ORG_ADMIN) {
      const adminCount = await this.countOrganizationAdmins(organizationId);

      if (adminCount <= 1) {
        throw new BadRequestException(
          'You cannot demote the last organization admin',
        );
      }
    }

    member.role = dto.role;
    await this.userOrganizationRepository.save(member);

    return {
      success: true,
      message: 'Member role updated successfully',
      data: member,
    };
  }

  async removeTeamMember(
    authUser: AuthUser,
    organizationId: string,
    memberUserId: string,
  ) {
    const foundUser = await this.userService.getUserAccountById(
      authUser.userId,
    );

    if (!foundUser) {
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
    }

    await this.assertOrganizationAdmin(authUser.userId, organizationId);

    const member = await this.userOrganizationRepository.findOne({
      where: {
        organization_id: organizationId,
        user_id: Number(memberUserId),
      },
      relations: ['user'],
    });

    if (!member) {
      throw new NotFoundException('Organization member not found');
    }

    if (member.user_id === authUser.userId) {
      throw new BadRequestException(
        'Organization admins cannot remove themselves from the workspace',
      );
    }

    if (member.role === OrganizationRole.ORG_ADMIN) {
      const adminCount = await this.countOrganizationAdmins(organizationId);

      if (adminCount <= 1) {
        throw new BadRequestException(
          'You cannot remove the last organization admin',
        );
      }
    }

    await this.userOrganizationRepository.remove(member);

    return {
      success: true,
      message: 'Member removed successfully',
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
      const menusWithAccess = (organization.organization_menus ?? [])
        .filter((menu) => Boolean(menu?.global_menu))
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

      const email = dto.email.toLowerCase().trim();

      // Check if email already has a pending invitation
      const existingInvitation = await this.invitationRepository.findOne({
        where: {
          email,
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
      // const invitation = this.invitationRepository.create({
      //   email: dto.email.toLowerCase(),
      //   organization_id: dto.organization_id,
      //   invited_role: dto.invited_role,
      //   invited_by_id: dto.invited_by,
      //   invited_by: foundUser,
      // });

      const inviteToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = hashInviteToken(inviteToken);

      const { code: inviteCode, hash: inviteCodeHash } =
        await this.generateUniqueInviteCode();

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const codeExpiresAt = new Date(); // code expiry — much shorter
      codeExpiresAt.setMinutes(codeExpiresAt.getMinutes() + 30);

      const inviteLink = InviteLinks.orgJoin(inviteToken);

      const invitation = this.invitationRepository.create({
        email,
        organization_id: dto.organization_id,
        invited_role: dto.invited_role,
        invited_by_id: dto.invited_by,
        invited_by: foundUser,
        token_hash: tokenHash,
        invite_code_hash: inviteCodeHash,
        expires_at: expiresAt,
        code_expires_at: codeExpiresAt,
        invite_link: inviteLink,
      });

      await this.invitationRepository.save(invitation);

      // TODO: ADD MAILING OF INVITATION


      return {
        invitation: {
          id: invitation.id,
          email: invitation.email,
          invited_role: invitation.invited_role,
          expires_at: invitation.expires_at,
          invite_link: inviteLink,
          invite_code: inviteCode, // returned once, at creation time only
        },
        message: 'Invitation created successfully',
        success: true,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);

      throw new InternalServerErrorException(
        `Failed to create invitation: ${message}`,
      );
    }
  }

  private async generateUniqueInviteCode() {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = crypto.randomInt(100000, 1000000).toString();
      const hash = hashInviteCode(code);

      const existing = await this.invitationRepository.findOne({
        where: {
          invite_code_hash: hash,
          accepted: false,
        },
      });

      if (!existing) {
        return { code, hash };
      }
    }

    throw new InternalServerErrorException(
      'Unable to generate invitation code',
    );
  }

  async update(id: string, updateOrgDetails: any, file?: Express.Multer.File) {
    try {
      const organization = await this.organizationRepository.findOne({
        where: { id },
        relations: ['settings'],
      });

      if (!organization) {
        throw new NotFoundException('Organization not found');
      }

      if (file) {
      }

      const {
        deadline_reminders_enabled,
        deadline_reminder_days_before,
        deadline_reminder_hour,
        deadline_reminder_minute,
        ...organizationFields
      } = updateOrgDetails;

      await this.organizationRepository.update({ id }, organizationFields);

      const hasSettingsUpdate =
        typeof deadline_reminders_enabled !== 'undefined' ||
        typeof deadline_reminder_days_before !== 'undefined' ||
        typeof deadline_reminder_hour !== 'undefined' ||
        typeof deadline_reminder_minute !== 'undefined';

      if (hasSettingsUpdate) {
        let settings = organization.settings ?? null;
        if (!settings) {
          settings = this.organizationSettingsRepository.create({
            organization_id: organization.id,
            organization,
          });
        }

        if (typeof deadline_reminders_enabled !== 'undefined') {
          settings.deadline_reminders_enabled =
            deadline_reminders_enabled === true ||
            deadline_reminders_enabled === 'true' ||
            deadline_reminders_enabled === '1';
        }

        if (typeof deadline_reminder_days_before !== 'undefined') {
          const parsedDays = Number(deadline_reminder_days_before);
          settings.deadline_reminder_days_before = Number.isFinite(parsedDays)
            ? Math.max(1, parsedDays)
            : settings.deadline_reminder_days_before ?? 3;
        }

        if (typeof deadline_reminder_hour !== 'undefined') {
          const parsedHour = Number(deadline_reminder_hour);
          settings.deadline_reminder_hour = Number.isFinite(parsedHour)
            ? Math.min(23, Math.max(0, parsedHour))
            : settings.deadline_reminder_hour ?? 9;
        }

        if (typeof deadline_reminder_minute !== 'undefined') {
          const parsedMinute = Number(deadline_reminder_minute);
          settings.deadline_reminder_minute = Number.isFinite(parsedMinute)
            ? Math.min(59, Math.max(0, parsedMinute))
            : settings.deadline_reminder_minute ?? 0;
        }

        await this.organizationSettingsRepository.save(settings);
      }

      const updatedOrg = await this.organizationRepository.findOne({
        where: { id },
        relations: ['settings'],
      });

      return {
        success: true,
        message: 'Updated Successfully',
        organization: updatedOrg,
      };
    } catch (err) {
      AppLogger.error('OrganizationsService', 'Failed to update organization', {
        organizationId: id,
      });
      throw err;
    }
  }

  async markOrgOnboardingComplete(orgId: string) {
    try {
      const organization = await this.organizationRepository.findOne({
        where: { id: orgId },
      });

      if (!organization) {
        throw new NotFoundException('Organization not found');
      }
      await this.organizationRepository.update(orgId, {
        onboarding_complete: true,
      });

      const updatedOrganization = await this.organizationRepository.findOne({
        where: { id: orgId },
      });

      return {
        success: true,
        message: 'Organization onboarding marked complete',
        organization: updatedOrganization,
      };
    } catch (err) {
      AppLogger.error(
        'OrganizationsService',
        'Failed to mark organization onboarding complete',
        { organizationId: orgId },
      );
      throw err;
    }
  }

  async triggerDeadlineReminderTest(
    authUser: AuthUser,
    organizationId: string,
  ) {
    const foundUser = await this.userService.getUserAccountById(
      authUser.userId,
    );

    if (!foundUser) {
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
    }

    await this.assertOrganizationAdmin(authUser.userId, organizationId);

    return this.deadlineRemindersService.runManualTestForOrganization(
      organizationId,
    );
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

    // Regenerate token — the old one's hash can't be reversed into a link.
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashInviteToken(inviteToken);
    const inviteLink = InviteLinks.orgJoin(inviteToken);

    // Regenerate the code too, since it gets its own short expiry —
    // reusing the old code would just extend a stale, already-exposed secret.
    const { code: inviteCode, hash: inviteCodeHash } =
      await this.generateUniqueInviteCode();

    const newExpiryDate = new Date();
    newExpiryDate.setDate(newExpiryDate.getDate() + 7);

    const newCodeExpiryDate = new Date();
    newCodeExpiryDate.setMinutes(newCodeExpiryDate.getMinutes() + 30);

    invitation.token_hash = tokenHash;
    invitation.invite_code_hash = inviteCodeHash;
    invitation.expires_at = newExpiryDate;
    invitation.code_expires_at = newCodeExpiryDate;
    invitation.invite_link = inviteLink;

    await this.invitationRepository.save(invitation);

    return {
      message: 'Invitation resent successfully',
      invite_link: inviteLink,
      invite_code: inviteCode, // returned once, at resend time only — same as creation
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

  async getCurrentPlanAndLimits(orgId: string) {
    const subscription =
      await this.billingService.getCurrentSubscription(orgId);
    const limits = await this.subscriptionService.getCurrentLimits(orgId);

    return {
      success: true,
      data: {
        plan: {
          code: subscription.price?.plan?.code,
          name: subscription.price?.plan?.name,
          status: subscription.status,
          currentPeriodStart: subscription.current_period_start,
          currentPeriodEnd: subscription.current_period_end,
          trialEnd: subscription.trial_end,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        },
        limits: {
          maxUsers: limits.maxUsers,
          maxProjects: limits.maxProjects,
        },
      },
    };
  }
}
