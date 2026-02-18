import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuditLog } from 'src/typeorm/entities/AuditLog';
import { Organization } from 'src/typeorm/entities/Organization';
import { Project } from 'src/typeorm/entities/Project';
import { User } from 'src/typeorm/entities/User';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';
import { PaginatedResponse } from 'src/types/pagination';
import { AuthUser } from 'src/types/users';
import { FindUsersQueryDto } from 'src/users/dtos/FindUsersQuery.dto';
import { UsersService } from 'src/users/services/users.service';
import { ProjectStatus } from 'src/utils/constants/project';
import { UserStatus } from 'src/utils/types';
import { Between, Repository } from 'typeorm';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Organization)
    private orgRepository: Repository<Organization>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserOrganization)
    private userOrgRepository: Repository<UserOrganization>,
    @InjectRepository(Project)
    private projectRepository: Repository<Project>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    // private jwtService: JwtService,
    private usersService: UsersService,
  ) {}

  // ── Dashboard Stats ───────────────────────────────────────────────────────
  async getDashboardStats() {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Total counts
    const [totalOrgs, activeOrgs] = await Promise.all([
      this.orgRepository.count(),
      this.orgRepository.count({ where: { is_active: true } }),
    ]);

    const [totalUsers, activeUsers] = await Promise.all([
      this.userRepository.count(),
      this.userRepository.count({ where: { is_active: true } }),
    ]);

    const [totalProjects, activeProjects] = await Promise.all([
      this.projectRepository.count(),
      this.projectRepository.count({ where: { status: ProjectStatus.ACTIVE } }),
    ]);

    // Growth calculations (compare to last month)
    const orgsLastMonth = await this.orgRepository.count({
      where: { created_at: Between(lastMonth, now) },
    });
    const usersLastMonth = await this.userRepository.count({
      where: { created_at: Between(lastMonth, now) },
    });

    const orgGrowth =
      totalOrgs > 0 ? ((orgsLastMonth / totalOrgs) * 100).toFixed(1) : 0;
    const userGrowth =
      totalUsers > 0 ? ((usersLastMonth / totalUsers) * 100).toFixed(1) : 0;

    // Revenue calculation (simplified — customize based on your pricing)
    const orgsWithPlans = await this.orgRepository
      .createQueryBuilder('org')
      .select('org.subscription_tier', 'tier')
      .addSelect('COUNT(*)', 'count')
      .groupBy('org.subscription_tier')
      .getRawMany();

    const pricing = { free: 0, basic: 12, pro: 29, enterprise: 199 };
    const mrr = orgsWithPlans.reduce((sum, { tier, count }) => {
      return sum + (pricing[tier] || 0) * parseInt(count);
    }, 0);

    // Mock charts data (replace with real queries)
    const growthChart = Array.from({ length: 30 }, (_, i) => {
      const date = new Date(now);
      date.setDate(date.getDate() - (29 - i));
      return {
        date: date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        organizations: totalOrgs - Math.floor(Math.random() * 100),
        users: totalUsers - Math.floor(Math.random() * 500),
      };
    });

    const revenueChart = Array.from({ length: 6 }, (_, i) => {
      const month = new Date(now);
      month.setMonth(month.getMonth() - (5 - i));
      return {
        month: month.toLocaleDateString('en-US', { month: 'short' }),
        revenue: mrr + Math.floor(Math.random() * 5000),
        churn: Math.floor(Math.random() * 500),
      };
    });

    const planDistribution = [
      {
        name: 'Free',
        value: orgsWithPlans.find((o) => o.tier === 'free')?.count || 0,
        color: '#9ca3af',
      },
      {
        name: 'Basic',
        value: orgsWithPlans.find((o) => o.tier === 'basic')?.count || 0,
        color: '#3b82f6',
      },
      {
        name: 'Pro',
        value: orgsWithPlans.find((o) => o.tier === 'pro')?.count || 0,
        color: '#6366f1',
      },
      {
        name: 'Enterprise',
        value: orgsWithPlans.find((o) => o.tier === 'enterprise')?.count || 0,
        color: '#8b5cf6',
      },
    ];

    return {
      stats: {
        organizations: {
          total: totalOrgs,
          active: activeOrgs,
          growth: parseFloat(orgGrowth as string),
        },
        users: {
          total: totalUsers,
          active: activeUsers,
          growth: parseFloat(userGrowth as string),
        },
        projects: { total: totalProjects, active: activeProjects },
        revenue: { mrr, arr: mrr * 12, growth: 15 }, // mock growth
        storage: { used: 847, total: 2000, percentage: 42 }, // mock
        performance: { uptime: 99.8, avgResponseTime: 125, errorRate: 0.2 },
      },
      charts: {
        growthChart,
        revenueChart,
        planDistribution,
      },
    };
  }

  // ── User Impersonation ────────────────────────────────────────────────────
  //   async impersonateUser(targetUserId: number, adminUserId: number) {
  //     const user = await this.userRepository.findOne({
  //       where: { id: targetUserId },
  //       relations: ['user_organizations', 'user_organizations.organization'],
  //     });

  //     if (!user) throw new ForbiddenException('User not found');

  //     // Log the impersonation
  //     await this.auditLogRepository.save({
  //       action: 'IMPERSONATE_USER',
  //       admin_id: adminUserId,
  //       target_user_id: targetUserId,
  //       metadata: { user_email: user.email },
  //     });

  //     // Generate token for impersonated user
  //     const firstOrg = user.user_organizations[0];
  //     const payload = {
  //       userId: user.id,
  //       email: user.email,
  //       currentOrganizationId: firstOrg?.organization_id,
  //       role: user.role,
  //       organizationRole: firstOrg?.role,
  //       impersonating: true, // Flag so frontend knows
  //     };

  //     const token = this.jwtService.sign(payload);

  //     return { user, token };
  //   }

  // ── Subscription Management ───────────────────────────────────────────────
  async getOrganizationSubscriptions() {
    const orgs = await this.orgRepository
      .createQueryBuilder('org')
      .leftJoinAndSelect('org.user_organizations', 'uo')
      .leftJoinAndSelect('org.projects', 'projects')
      .select([
        'org.id',
        'org.name',
        'org.slug',
        'org.subscription_tier',
        'org.max_users',
        'org.max_projects',
        'org.created_at',
      ])
      .getMany();

    const organizations = orgs.map((org) => {
      const pricing = { free: 0, basic: 12, pro: 29, enterprise: 199 };
      return {
        ...org,
        current_users: org.user_organizations?.length || 0,
        current_projects: org.projects?.length || 0,
        mrr: pricing[org.subscription_tier] || 0,
        billing_status: 'active', // mock — integrate with Stripe
        next_billing_date: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      };
    });

    return { organizations };
  }

  async updateSubscription(orgId: string, tier: string, notes?: string) {
    const org = await this.orgRepository.findOne({ where: { id: orgId } });
    if (!org) throw new ForbiddenException('Organization not found');

    const oldTier = org.subscription_tier;
    org.subscription_tier = tier as any;

    // Update limits based on tier
    const limits = {
      free: { users: 5, projects: 10 },
      basic: { users: 20, projects: 50 },
      pro: { users: 100, projects: 999 },
      enterprise: { users: 9999, projects: 9999 },
    };
    org.max_users = limits[tier]?.users || 5;
    org.max_projects = limits[tier]?.projects || 10;

    await this.orgRepository.save(org);

    // Log the change
    await this.auditLogRepository.save({
      action: 'SUBSCRIPTION_CHANGE',
      organization_id: orgId,
      metadata: { old_tier: oldTier, new_tier: tier, notes },
    });

    return { message: 'Subscription updated', organization: org };
  }

  async getBillingHistory(orgId: string) {
    const history = await this.auditLogRepository.find({
      where: { organization_id: orgId, action: 'SUBSCRIPTION_CHANGE' },
      order: { created_at: 'DESC' },
    });

    return {
      history: history.map((log) => ({
        id: log.id,
        date: log.created_at,
        action: 'Plan Change',
        old_plan: log.metadata.old_tier,
        new_plan: log.metadata.new_tier,
        amount: 0, // calculate based on pricing
        admin: log.admin_id ? `Admin #${log.admin_id}` : 'System',
      })),
    };
  }

  async findAllUsers(
    authUser: AuthUser,
    query: FindUsersQueryDto,
  ): Promise<PaginatedResponse<User>> {
    const { page = 1, limit = 10, search, orderBy, status } = query;

    const foundUser = await this.usersService.getUserAccountById(
      authUser.userId,
    );
    if (!foundUser) {
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
    }

    const qb = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.user_organizations', 'userOrganizations')
      .leftJoinAndSelect('userOrganizations.organization', 'organization');

    if (search) {
      qb.andWhere(
        `(LOWER(user.first_name) LIKE :search
          OR LOWER(user.last_name) LIKE :search
          OR LOWER(user.email) LIKE :search
          OR LOWER(user.username) LIKE :search)`,
        { search: `%${search.toLowerCase()}%` },
      );
    }

    if (status) {
      qb.andWhere('user.is_active = :active', {
        active: status === UserStatus.ACTIVE,
      });
    }

    qb.orderBy('user.created_at', orderBy);
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

  async suspendUser(userId: number) {
    await this.userRepository.update(userId, { is_active: false });
    return { message: 'User suspended' };
  }

  async activateUser(userId: number) {
    await this.userRepository.update(userId, { is_active: true });
    return { message: 'User activated' };
  }
}
