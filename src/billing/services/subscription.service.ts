// src/billing/subscription.service.ts

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Organization } from 'src/typeorm/entities/Organization';
import { Plan } from 'src/typeorm/entities/Plan';
import { Price } from 'src/typeorm/entities/Price';
import { Project } from 'src/typeorm/entities/Project';
import { Subscription } from 'src/typeorm/entities/Subscription';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';
import { PriceInterval } from 'src/utils/constants/priceIntervalEnums';
import { ProjectStatus } from 'src/utils/constants/project';
import { SubscriptionStatus } from 'src/utils/constants/subscriptionStatusEnums';
import { Repository } from 'typeorm';

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectRepository(Subscription)
    private subscriptionRepo: Repository<Subscription>,

    @InjectRepository(Plan)
    private planRepo: Repository<Plan>,

    @InjectRepository(Price)
    private priceRepo: Repository<Price>,

    @InjectRepository(Organization)
    private orgRepo: Repository<Organization>,

    @InjectRepository(UserOrganization)
    private userOrgRepo: Repository<UserOrganization>,

    @InjectRepository(Project)
    private projectRepo: Repository<Project>,
  ) {}

  async createInitialFreeSubscription(orgId: string): Promise<Subscription> {
    const freePlan = await this.planRepo.findOne({ where: { code: 'free' } });
    if (!freePlan)
      throw new NotFoundException('Free plan not found in catalog');

    const freePrice = await this.priceRepo.findOne({
      where: { plan: { id: freePlan.id }, interval: PriceInterval.ONE_TIME }, // or month with 0 amount
    });

    if (!freePrice) throw new NotFoundException('Free price not configured');

    const sub = this.subscriptionRepo.create({
      organization_id: orgId,
      price_id: freePrice.id,
      status: SubscriptionStatus.ACTIVE,
      current_period_start: new Date(),
      current_period_end: null, // never ends for free
      max_users: 5,
      max_projects: 10,
      quantity: 1,
      metadata: { source: 'onboarding' },
    });

    const saved = await this.subscriptionRepo.save(sub);

    // Link to organization
    await this.orgRepo.update(orgId, {
      active_subscription_id: saved.id,
    });

    return saved;
  }

  async createSubscriptionWithTrial(
    orgId: string,
    planCode: string,
    trialDays: number = 14,
  ): Promise<Subscription> {
    const plan = await this.planRepo.findOne({ where: { code: planCode } });
    if (!plan) throw new NotFoundException('Plan not found');

    const price = await this.priceRepo.findOne({
      where: { plan: { id: plan.id }, interval: PriceInterval.MONTH },
    });

    if (!price) throw new NotFoundException('Monthly price not found');

    const trialEnd =
      trialDays > 0
        ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000)
        : null;

    const sub = this.subscriptionRepo.create({
      organization_id: orgId,
      price_id: price.id,
      status:
        trialDays > 0 ? SubscriptionStatus.TRIALING : SubscriptionStatus.ACTIVE,
      current_period_start: new Date(),
      current_period_end:
        trialEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      trial_end: trialEnd,
      max_users: 5,
      max_projects: 10,
      quantity: 1,
      metadata: { trial_source: 'onboarding' },
    });

    const saved = await this.subscriptionRepo.save(sub);

    await this.orgRepo.update(orgId, { active_subscription_id: saved.id });

    return saved;
  }

  async getActiveSubscription(orgId: string): Promise<Subscription> {
    const org = await this.orgRepo.findOne({
      where: { id: orgId },
      relations: ['activeSubscription'], // if you defined relation helper
    });

    if (!org?.active_subscription_id) {
      throw new NotFoundException(
        'No active subscription found for organization',
      );
    }

    const sub = await this.subscriptionRepo.findOne({
      where: { id: org.active_subscription_id },
      relations: ['price', 'price.plan'],
    });

    if (!sub) throw new NotFoundException('Active subscription record missing');

    // Optional: fallback if pointer is broken
    if (sub.status !== SubscriptionStatus.ACTIVE) {
      const fallback = await this.subscriptionRepo.findOne({
        where: { organization_id: orgId, status: SubscriptionStatus.ACTIVE },
        order: { created_at: 'DESC' },
        relations: ['price', 'price.plan'],
      });

      if (fallback) {
        // Auto-fix pointer (optional – be careful in production)
        await this.orgRepo.update(orgId, {
          active_subscription_id: fallback.id,
        });
        return fallback;
      }
    }

    return sub;
  }

  async switchToNewPlan(
    orgId: string,
    newPlanCode: string,
  ): Promise<Subscription> {
    const currentSub = await this.getActiveSubscription(orgId);

    const newPlan = await this.planRepo.findOne({
      where: { code: newPlanCode },
    });
    if (!newPlan) throw new NotFoundException(`Plan ${newPlanCode} not found`);

    const newPrice = await this.priceRepo.findOne({
      where: { plan: { id: newPlan.id }, interval: PriceInterval.MONTH }, // or choose based on logic
    });

    if (!newPrice)
      throw new BadRequestException('No monthly price available for this plan');

    const [currentUsersCount, currentProjectsCount] = await Promise.all([
      this.userOrgRepo.count({ where: { organization_id: orgId } }), // adjust to your join table
      this.projectRepo.count({
        where: { organization_id: orgId, status: ProjectStatus.ACTIVE },
      }),
    ]);

    // Get new limits (you can later move this to a Price → limits mapping table)
    const newLimits = this.getLimitsForPlanCode(newPlanCode);

    if (currentUsersCount > newLimits.maxUsers) {
      throw new BadRequestException(
        `Cannot downgrade: organization has ${currentUsersCount} active members, but ${newPlanCode} allows only ${newLimits.maxUsers}. ` +
          `Remove members first or contact support.`,
      );
    }

    if (currentProjectsCount > newLimits.maxProjects) {
      throw new BadRequestException(
        `Cannot downgrade: organization has ${currentProjectsCount} active projects, but ${newPlanCode} allows only ${newLimits.maxProjects}.`,
      );
    }

    const newSub = this.subscriptionRepo.create({
      organization_id: orgId,
      price_id: newPrice.id,
      status: SubscriptionStatus.ACTIVE,
      current_period_start: new Date(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // example
      max_users:
        newPrice.plan.code === 'free'
          ? 5
          : newPrice.plan.code === 'pro'
            ? 100
            : 9999,
      max_projects: newPrice.plan.code === 'free' ? 10 : 9999,
      quantity: currentSub.quantity,
      metadata: { upgraded_from: currentSub.id },
    });

    const savedNew = await this.subscriptionRepo.save(newSub);

    // Mark old as canceled (or keep active until period end)
    await this.subscriptionRepo.update(currentSub.id, {
      cancel_at_period_end: true,
      // canceled_at: new Date(),   // only if immediate
    });

    // Switch pointer
    await this.orgRepo.update(orgId, {
      active_subscription_id: savedNew.id,
    });

    return savedNew;
  }

  // More methods later: cancelSubscription, reactivate, getLimitsForOrg, etc.

  private getLimitsForPlanCode(code: string): {
    maxUsers: number;
    maxProjects: number;
  } {
    switch (code) {
      case 'free':
        return { maxUsers: 5, maxProjects: 10 };
      case 'basic':
        return { maxUsers: 20, maxProjects: 50 };
      case 'pro':
        return { maxUsers: 100, maxProjects: 9999 };
      case 'enterprise':
        return { maxUsers: 9999, maxProjects: 9999 };
      default:
        return { maxUsers: 5, maxProjects: 10 };
    }
  }

  async getCurrentLimits(
    orgId: string,
  ): Promise<{ maxUsers: number; maxProjects: number }> {
    try {
      const activeSub = await this.getActiveSubscription(orgId);

      // Return denormalized values from subscription (most reliable for historical consistency)
      return {
        maxUsers: activeSub.max_users,
        maxProjects: activeSub.max_projects,
      };
    } catch (err) {
      // Fallback: if no active subscription (very early onboarding or broken state)
      console.warn(
        `No active subscription for org ${orgId} — using free limits`,
      );
      return {
        maxUsers: 5,
        maxProjects: 10,
      };
    }
  }

  async cancelSubscription(
    orgId: string,
    immediate = false,
  ): Promise<Subscription> {
    const activeSub = await this.getActiveSubscription(orgId);

    if (activeSub.status === SubscriptionStatus.CANCELED) {
      throw new BadRequestException('Subscription is already canceled');
    }

    const updateData: Partial<Subscription> = {
      cancel_at_period_end: true,
    };

    if (immediate) {
      updateData.status = SubscriptionStatus.CANCELED;
      updateData.canceled_at = new Date();
      // Optional: create new free subscription here
      // await this.createInitialFreeSubscription(orgId);
    }

    await this.subscriptionRepo.update(activeSub.id, updateData);

    const updated = await this.subscriptionRepo.findOneBy({ id: activeSub.id });

    if (!updated) throw new Error('Failed to update subscription');

    return updated;
  }
}
