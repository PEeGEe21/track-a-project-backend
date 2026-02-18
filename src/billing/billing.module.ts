import { Module } from '@nestjs/common';
import { BillingService } from './services/billing.service';
import { BillingController } from './controllers/billing.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from 'src/typeorm/entities/Organization';
import { Plan } from 'src/typeorm/entities/Plan';
import { Price } from 'src/typeorm/entities/Price';
import { Subscription } from 'src/typeorm/entities/Subscription';
import { Invoice } from 'src/typeorm/entities/Invoice';
import { SubscriptionService } from './services/subscription.service';
import { User } from 'src/typeorm/entities/User';
import { Project } from 'src/typeorm/entities/Project';
import { BillingTasksService } from './tasks/billing-tasks.service';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Organization,
      Plan,
      Price,
      Subscription,
      Invoice,
      Project,
      User,
      UserOrganization
    ]),
  ],
  controllers: [BillingController],
  providers: [BillingService, SubscriptionService, BillingTasksService],
  exports: [
    BillingService,
    SubscriptionService,
    // StripeService,
  ],
})
export class BillingModule {}
