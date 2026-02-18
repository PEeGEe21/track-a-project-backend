import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BillingService } from '../services/billing.service';
import { Subscription } from 'src/typeorm/entities/Subscription';
import { SubscriptionStatus } from 'src/utils/constants/subscriptionStatusEnums';

@Injectable()
export class BillingTasksService {
  private readonly logger = new Logger(BillingTasksService.name);

  constructor(
    @InjectRepository(Subscription)
    private subscriptionRepo: Repository<Subscription>,
    private billingService: BillingService, // to reuse downgrade logic
  ) {}

  /**
   * Runs every day at 03:00 AM (server time)
   * Finds trialing subscriptions where trial_end is in the past
   * Downgrades them to free plan
   */
  @Cron('0 3 * * *', { timeZone: 'Africa/Lagos' }) // every day at 03:00
  // @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT) // alternative readable style
  async cleanupExpiredTrials() {
    this.logger.log('Starting expired trials cleanup...');

    const now = new Date();

    const expiredTrials = await this.subscriptionRepo
      .createQueryBuilder('sub')
      .where('sub.status = :status', { status: SubscriptionStatus.TRIALING })
      .andWhere('sub.trial_end IS NOT NULL')
      .andWhere('sub.trial_end < :now', { now })
      .getMany();

    if (expiredTrials.length === 0) {
      this.logger.log('No expired trials found.');
      return;
    }

    this.logger.log(`Found ${expiredTrials.length} expired trials to process.`);

    let successCount = 0;
    let errorCount = 0;

    for (const sub of expiredTrials) {
      try {
        // 1. Load full entity
        const currentSub = await this.subscriptionRepo.findOneByOrFail({
          id: sub.id,
        });

        // 2. Downgrade first (this may already change active_subscription_id)
        await this.billingService.downgradeToFreeAfterCancellation(
          sub.organization_id,
        );

        // 3. Update metadata on the old (now inactive) subscription
        currentSub.status = SubscriptionStatus.CANCELED;
        currentSub.canceled_at = now;
        currentSub.metadata = {
          ...currentSub.metadata,
          expired_reason: 'trial_ended',
          expired_at: now.toISOString(),
        };

        // 4. Save the modified entity → TypeORM handles merging correctly
        await this.subscriptionRepo.save(currentSub);

        successCount++;
        this.logger.log(
          `Successfully downgraded org ${sub.organization_id} from expired trial`,
        );
      } catch (err) {
        errorCount++;
        this.logger.error(
          `Failed to downgrade org ${sub.organization_id}: ${err.message}`,
          err.stack,
        );
      }
    }

    this.logger.log(
      `Expired trials cleanup finished: ${successCount} succeeded, ${errorCount} failed.`,
    );
  }

  // Optional: more frequent check (e.g. every hour) if you want faster reaction
  // @Cron(CronExpression.EVERY_HOUR)
  // async hourlyTrialCheck() { ... similar logic ... }
}
