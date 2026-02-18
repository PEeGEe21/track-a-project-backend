import { Injectable } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { SubscriptionStatus } from 'src/utils/constants/subscriptionStatusEnums';
import { Invoice } from 'src/typeorm/entities/Invoice';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Subscription } from 'src/typeorm/entities/Subscription';
import { InvoiceStatus } from 'src/utils/constants/invoiceStatusEnums';
@Injectable()
export class BillingService {
  constructor(
    private readonly subscriptionService: SubscriptionService,

    @InjectRepository(Invoice)
    private invoiceRepo: Repository<Invoice>,

    @InjectRepository(Subscription)
    private subscriptionRepo: Repository<Subscription>,
    // private readonly stripeService: StripeService, // later
  ) {}

  // Example high-level method
  async onboardNewOrganization(orgId: string, initialTier: string = 'free') {
    return this.subscriptionService.createInitialFreeSubscription(orgId);
  }

  async changePlan(
    orgId: string,
    newPlanCode: string,
    options?: { prorate?: boolean },
  ) {
    // Later: check current usage vs new limits
    // Later: if Stripe → stripeService.updateSubscription(...)
    return this.subscriptionService.switchToNewPlan(orgId, newPlanCode);
  }

  async getCurrentSubscription(orgId: string) {
    return this.subscriptionService.getActiveSubscription(orgId);
  }

  async cancelCurrentSubscription(orgId: string, immediate = false) {
    return this.subscriptionService.cancelSubscription(orgId, immediate);
  }

  // async previewInvoice(orgId: string, newPlanCode: string) { ... }  // future

  /**
   * Called from webhook on 'customer.subscription.updated'
   */
  async handleSubscriptionUpdated(
    stripeSubscription: any /* Stripe.Subscription */,
  ) {
    const sub = await this.subscriptionRepo.findOne({
      where: { stripe_subscription_id: stripeSubscription.id },
      relations: ['organization'],
    });

    if (!sub) {
      console.warn(
        `No matching subscription found for stripe id: ${stripeSubscription.id}`,
      );
      return;
    }

    const orgId = sub.organization_id;

    // Map Stripe status to your enum
    const statusMap: Record<string, SubscriptionStatus> = {
      incomplete: SubscriptionStatus.INCOMPLETE,
      incomplete_expired: SubscriptionStatus.INCOMPLETE_EXPIRED,
      trialing: SubscriptionStatus.TRIALING,
      active: SubscriptionStatus.ACTIVE,
      past_due: SubscriptionStatus.PAST_DUE,
      canceled: SubscriptionStatus.CANCELED,
      unpaid: SubscriptionStatus.UNPAID,
      paused: SubscriptionStatus.PAUSED,
    };

    const newStatus =
      statusMap[stripeSubscription.status] || SubscriptionStatus.INCOMPLETE;

    // Update core fields
    await this.subscriptionRepo.update(sub.id, {
      status: newStatus,
      current_period_start: new Date(
        stripeSubscription.current_period_start * 1000,
      ),
      current_period_end: new Date(
        stripeSubscription.current_period_end * 1000,
      ),
      trial_end: stripeSubscription.trial_end
        ? new Date(stripeSubscription.trial_end * 1000)
        : null,
      cancel_at_period_end: stripeSubscription.cancel_at_period_end,
      canceled_at: stripeSubscription.canceled_at
        ? new Date(stripeSubscription.canceled_at * 1000)
        : null,
      quantity: stripeSubscription.quantity,
      // You might want to update max_users / max_projects if they can change
      // or fetch from price/plan again
    });

    // If subscription was just canceled or expired → potentially downgrade to free
    /* some grace period logic */
    if (
      newStatus === SubscriptionStatus.CANCELED ||
      newStatus === SubscriptionStatus.PAST_DUE
    ) {
      await this.downgradeToFreeAfterCancellation(orgId);
    }

    console.log(`Updated subscription ${sub.id} to status: ${newStatus}`);
  }

  /**
   * Called from webhook on 'invoice.paid', 'invoice.payment_failed', etc.
   */
  async handleInvoicePaid(stripeInvoice: any /* Stripe.Invoice */) {
    const sub = await this.subscriptionRepo.findOne({
      where: { stripe_subscription_id: stripeInvoice.subscription },
    });

    if (!sub) {
      console.warn(`No subscription found for invoice ${stripeInvoice.id}`);
      return;
    }

    const invoice = this.invoiceRepo.create({
      organization_id: sub.organization_id,
      subscription_id: sub.id,
      stripe_invoice_id: stripeInvoice.id,
      status:
        stripeInvoice.status === 'paid'
          ? InvoiceStatus.PAID
          : InvoiceStatus.OPEN,
      amount_due: stripeInvoice.amount_due / 100, // Stripe uses cents
      amount_paid: stripeInvoice.amount_paid / 100,
      currency: stripeInvoice.currency.toUpperCase(),
      period_start: new Date(stripeInvoice.period_start * 1000),
      period_end: new Date(stripeInvoice.period_end * 1000),
      paid_at: stripeInvoice.status === 'paid' ? new Date() : null,
      pdf_url: stripeInvoice.hosted_invoice_url || stripeInvoice.invoice_pdf,
      lines: stripeInvoice.lines.data.map((line: any) => ({
        description: line.description,
        amount: line.amount / 100,
        quantity: line.quantity,
      })),
      metadata: stripeInvoice.metadata || {},
    });

    await this.invoiceRepo.save(invoice);

    // If this payment brought subscription out of past_due → update status
    if (
      stripeInvoice.status === 'paid' &&
      sub.status === SubscriptionStatus.PAST_DUE
    ) {
      await this.subscriptionRepo.update(sub.id, {
        status: SubscriptionStatus.ACTIVE,
      });
    }

    console.log(
      `Processed paid invoice ${stripeInvoice.id} for org ${sub.organization_id}`,
    );
  }

  /**
   * Downgrade organization to free plan after cancellation or trial expiration
   * - Creates new free subscription
   * - Updates active_subscription_id
   * - Optionally logs / notifies
   */
  async downgradeToFreeAfterCancellation(orgId: string): Promise<Subscription> {
    // Prevent infinite loop / double downgrade
    const current = await this.subscriptionService
      .getActiveSubscription(orgId)
      .catch(() => null);
    if (current?.price?.plan?.code === 'free') {
      console.log(`Org ${orgId} already on free — skipping downgrade`);
      return current;
    }

    // Create new free subscription
    const freeSub =
      await this.subscriptionService.createInitialFreeSubscription(orgId);

    // Optional: mark old subscription as fully canceled if not already
    if (current) {
      await this.subscriptionRepo.update(current.id, {
        status: SubscriptionStatus.CANCELED,
        canceled_at: new Date(),
      });
    }

    // Optional: notify admin/user (email, in-app notification)
    // await this.notificationService.sendDowngradeNotice(orgId);

    console.log(
      `Downgraded org ${orgId} to free plan. New subscription: ${freeSub.id}`,
    );

    return freeSub;
  }
}
