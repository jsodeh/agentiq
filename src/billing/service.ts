import { invoke } from '@tauri-apps/api/core';
import { PaystackService } from './paystack';
import { FlutterwaveService } from './flutterwave';
import { PLANS, getPlan, isUnlimitedTokens } from './plans';
import type { Plan } from './plans';

export type PaymentProvider = 'paystack' | 'flutterwave';

export interface Subscription {
  id: string;
  userId: number;
  planId: string;
  provider: PaymentProvider;
  providerSubscriptionId: string;
  status: 'active' | 'cancelled' | 'expired' | 'past_due';
  currentPeriodStart: number;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Usage {
  userId: number;
  planId: string;
  tokensUsed: number;
  tokensLimit: number;
  agentsActive: number;
  agentsLimit: number;
  periodStart: number;
  periodEnd: number;
}

export interface Invoice {
  id: string;
  userId: number;
  subscriptionId: string;
  amount: number;
  currency: 'NGN';
  status: 'paid' | 'pending' | 'failed';
  paidAt?: number;
  invoiceUrl?: string;
  createdAt: number;
}

export class BillingService {
  private paystack: PaystackService | null = null;
  private flutterwave: FlutterwaveService | null = null;

  constructor() {
    this.initializeProviders();
  }

  private async initializeProviders() {
    // Load API keys from environment or config
    const paystackConfig = {
      secretKey: process.env.PAYSTACK_SECRET_KEY || '',
      publicKey: process.env.PAYSTACK_PUBLIC_KEY || '',
      webhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET || '',
    };

    const flutterwaveConfig = {
      publicKey: process.env.FLUTTERWAVE_PUBLIC_KEY || '',
      secretKey: process.env.FLUTTERWAVE_SECRET_KEY || '',
      encryptionKey: process.env.FLUTTERWAVE_ENCRYPTION_KEY || '',
      webhookSecret: process.env.FLUTTERWAVE_WEBHOOK_SECRET || '',
    };

    if (paystackConfig.secretKey) {
      this.paystack = new PaystackService(paystackConfig);
    }

    if (flutterwaveConfig.secretKey) {
      this.flutterwave = new FlutterwaveService(flutterwaveConfig);
    }
  }

  // Create a subscription
  async createSubscription(
    userId: number,
    planId: string,
    paymentMethod: PaymentProvider,
    customerData: {
      email: string;
      name: string;
      phone?: string;
    }
  ): Promise<{ authorization_url: string; reference: string }> {
    const plan = getPlan(planId);
    if (!plan) {
      throw new Error(`Plan ${planId} not found`);
    }

    if (plan.price === 0) {
      throw new Error('Cannot create subscription for free plan');
    }

    try {
      let authUrl: string;
      let reference: string;

      if (paymentMethod === 'paystack' && this.paystack) {
        const response = await this.paystack.initializeTransaction({
          email: customerData.email,
          amount: plan.price,
          callback_url: `${process.env.APP_URL}/billing/callback`,
          metadata: {
            userId,
            planId,
            customerName: customerData.name,
          },
        });

        authUrl = response.authorization_url;
        reference = response.reference;
      } else if (paymentMethod === 'flutterwave' && this.flutterwave) {
        const response = await this.flutterwave.initializePayment({
          tx_ref: `sub_${Date.now()}_${userId}`,
          amount: plan.price,
          currency: 'NGN',
          redirect_url: `${process.env.APP_URL}/billing/callback`,
          customer: {
            email: customerData.email,
            name: customerData.name,
            phonenumber: customerData.phone,
          },
          customizations: {
            title: 'agēntīq Subscription',
            description: `${plan.name} Plan - ${plan.price} NGN/month`,
          },
          meta: {
            userId,
            planId,
          },
        });

        authUrl = response.link;
        reference = response.link.split('/').pop() || '';
      } else {
        throw new Error(`Payment provider ${paymentMethod} not configured`);
      }

      // Save pending subscription to database
      await invoke('create_pending_subscription', {
        userId,
        planId,
        provider: paymentMethod,
        reference,
      });

      return { authorization_url: authUrl, reference };
    } catch (error) {
      console.error('Create subscription error:', error);
      throw error;
    }
  }

  // Handle webhook from payment provider
  async handleWebhook(
    provider: PaymentProvider,
    payload: any,
    signature: string
  ): Promise<void> {
    try {
      let event: { event: string; data: any; verified: boolean };

      if (provider === 'paystack' && this.paystack) {
        event = await this.paystack.handleWebhook(payload, signature);
      } else if (provider === 'flutterwave' && this.flutterwave) {
        event = await this.flutterwave.handleWebhook(payload, signature);
      } else {
        throw new Error(`Provider ${provider} not configured`);
      }

      if (!event.verified) {
        throw new Error('Webhook signature verification failed');
      }

      // Handle different event types
      switch (event.event) {
        case 'charge.success':
        case 'subscription.create':
          await this.handleSubscriptionCreated(event.data, provider);
          break;

        case 'subscription.disable':
        case 'subscription.cancelled':
          await this.handleSubscriptionCancelled(event.data);
          break;

        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data);
          break;

        default:
          console.log(`Unhandled webhook event: ${event.event}`);
      }
    } catch (error) {
      console.error('Webhook handling error:', error);
      throw error;
    }
  }

  private async handleSubscriptionCreated(data: any, provider: PaymentProvider): Promise<void> {
    const subscription: Subscription = {
      id: `sub_${Date.now()}`,
      userId: data.metadata?.userId || data.meta?.userId,
      planId: data.metadata?.planId || data.meta?.planId,
      provider,
      providerSubscriptionId: data.subscription_code || data.id,
      status: 'active',
      currentPeriodStart: Date.now(),
      currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
      cancelAtPeriodEnd: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await invoke('save_subscription', {
      subscription: JSON.stringify(subscription),
    });

    console.log(`Subscription created: ${subscription.id}`);
  }

  private async handleSubscriptionCancelled(data: any): Promise<void> {
    await invoke('update_subscription_status', {
      providerSubscriptionId: data.subscription_code || data.id,
      status: 'cancelled',
    });

    console.log(`Subscription cancelled: ${data.subscription_code || data.id}`);
  }

  private async handlePaymentFailed(data: any): Promise<void> {
    await invoke('update_subscription_status', {
      providerSubscriptionId: data.subscription_code || data.id,
      status: 'past_due',
    });

    // Notify user
    await invoke('send_payment_failed_notification', {
      userId: data.customer?.id,
    });

    console.log(`Payment failed: ${data.subscription_code || data.id}`);
  }

  // Check usage against plan limits
  async checkUsage(userId: number): Promise<{
    withinLimits: boolean;
    usage: Usage;
    warnings: string[];
  }> {
    const subscription = await this.getActiveSubscription(userId);
    if (!subscription) {
      return {
        withinLimits: false,
        usage: {
          userId,
          planId: 'local',
          tokensUsed: 0,
          tokensLimit: 0,
          agentsActive: 0,
          agentsLimit: 0,
          periodStart: Date.now(),
          periodEnd: Date.now(),
        },
        warnings: ['No active subscription'],
      };
    }

    const plan = getPlan(subscription.planId);
    if (!plan) {
      throw new Error(`Plan ${subscription.planId} not found`);
    }

    const usage = await this.getCurrentUsage(userId);
    const warnings: string[] = [];

    // Check token usage
    if (!isUnlimitedTokens(subscription.planId)) {
      const tokenPercentage = (usage.tokensUsed / plan.features.tokensPerMonth) * 100;

      if (tokenPercentage >= 95) {
        warnings.push('You have used 95% of your token limit');
      } else if (tokenPercentage >= 80) {
        warnings.push('You have used 80% of your token limit');
      }

      if (usage.tokensUsed >= plan.features.tokensPerMonth) {
        return {
          withinLimits: false,
          usage,
          warnings: ['Token limit exceeded'],
        };
      }
    }

    // Check agent count
    if (usage.agentsActive > plan.features.maxAgents) {
      return {
        withinLimits: false,
        usage,
        warnings: ['Agent limit exceeded'],
      };
    }

    return {
      withinLimits: true,
      usage,
      warnings,
    };
  }

  // Notify user when approaching limit
  async notifyApproachingLimit(userId: number, percentage: number): Promise<void> {
    const subscription = await this.getActiveSubscription(userId);
    if (!subscription) return;

    const plan = getPlan(subscription.planId);
    if (!plan) return;

    await invoke('send_usage_notification', {
      userId,
      percentage,
      planName: plan.name,
      tokensLimit: plan.features.tokensPerMonth,
    });

    console.log(`Sent usage notification to user ${userId}: ${percentage}%`);
  }

  // Pause all agents when limit is hit
  async pauseAgents(userId: number, reason: string): Promise<void> {
    await invoke('pause_all_agents', {
      userId,
      reason,
    });

    await invoke('send_agents_paused_notification', {
      userId,
      reason,
    });

    console.log(`Paused all agents for user ${userId}: ${reason}`);
  }

  // Get current usage
  private async getCurrentUsage(userId: number): Promise<Usage> {
    const result = await invoke<string>('get_current_usage', { userId });
    return JSON.parse(result);
  }

  // Get active subscription
  private async getActiveSubscription(userId: number): Promise<Subscription | null> {
    try {
      const result = await invoke<string>('get_active_subscription', { userId });
      return JSON.parse(result);
    } catch (error) {
      return null;
    }
  }

  // Cancel subscription
  async cancelSubscription(userId: number, immediate: boolean = false): Promise<void> {
    const subscription = await this.getActiveSubscription(userId);
    if (!subscription) {
      throw new Error('No active subscription found');
    }

    if (subscription.provider === 'paystack' && this.paystack) {
      await this.paystack.cancelSubscription(
        subscription.providerSubscriptionId,
        '' // token
      );
    } else if (subscription.provider === 'flutterwave' && this.flutterwave) {
      await this.flutterwave.cancelSubscription(subscription.providerSubscriptionId);
    }

    await invoke('update_subscription_status', {
      subscriptionId: subscription.id,
      status: immediate ? 'cancelled' : 'active',
      cancelAtPeriodEnd: !immediate,
    });

    console.log(`Subscription cancelled: ${subscription.id}`);
  }

  // Upgrade/downgrade subscription
  async changeSubscription(userId: number, newPlanId: string): Promise<void> {
    const currentSubscription = await this.getActiveSubscription(userId);
    if (!currentSubscription) {
      throw new Error('No active subscription found');
    }

    const newPlan = getPlan(newPlanId);
    if (!newPlan) {
      throw new Error(`Plan ${newPlanId} not found`);
    }

    // Cancel current subscription
    await this.cancelSubscription(userId, true);

    // Create new subscription
    // This would typically redirect user to payment page
    console.log(`Changed subscription for user ${userId} to ${newPlanId}`);
  }

  // Get invoices
  async getInvoices(userId: number): Promise<Invoice[]> {
    const result = await invoke<string>('get_invoices', { userId });
    return JSON.parse(result);
  }

  // Generate invoice PDF
  async generateInvoicePDF(invoiceId: string): Promise<string> {
    const pdfPath = await invoke<string>('generate_invoice_pdf', { invoiceId });
    return pdfPath;
  }
}

export const billingService = new BillingService();
