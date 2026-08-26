import Flutterwave from 'flutterwave-node-v3';
import crypto from 'crypto';

export interface FlutterwaveConfig {
  publicKey: string;
  secretKey: string;
  encryptionKey: string;
  webhookSecret: string;
}

export interface FlutterwaveCustomer {
  email: string;
  name: string;
  phonenumber?: string;
}

export class FlutterwaveService {
  private flw: any;
  private webhookSecret: string;

  constructor(config: FlutterwaveConfig) {
    this.flw = new Flutterwave(config.publicKey, config.secretKey);
    this.webhookSecret = config.webhookSecret;
  }

  // Create a payment plan
  async createPlan(planData: {
    name: string;
    amount: number; // in Naira
    interval: 'daily' | 'weekly' | 'monthly' | 'yearly';
    duration?: number;
  }): Promise<any> {
    try {
      const payload = {
        amount: planData.amount,
        name: planData.name,
        interval: planData.interval,
        duration: planData.duration,
        currency: 'NGN',
      };

      const response = await this.flw.PaymentPlan.create(payload);
      return response;
    } catch (error) {
      console.error('Flutterwave create plan error:', error);
      throw error;
    }
  }

  // Initialize a payment
  async initializePayment(data: {
    tx_ref: string;
    amount: number; // in Naira
    currency: string;
    redirect_url: string;
    customer: FlutterwaveCustomer;
    payment_plan?: string;
    customizations?: {
      title?: string;
      description?: string;
      logo?: string;
    };
    meta?: Record<string, any>;
  }): Promise<{ link: string }> {
    try {
      const payload = {
        ...data,
        currency: 'NGN',
      };

      const response = await this.flw.Charge.card(payload);
      return response;
    } catch (error) {
      console.error('Flutterwave initialize payment error:', error);
      throw error;
    }
  }

  // Verify a transaction
  async verifyTransaction(transactionId: string): Promise<any> {
    try {
      const response = await this.flw.Transaction.verify({ id: transactionId });
      return response;
    } catch (error) {
      console.error('Flutterwave verify transaction error:', error);
      throw error;
    }
  }

  // Create a subscription
  async createSubscription(data: {
    tx_ref: string;
    amount: number;
    customer: FlutterwaveCustomer;
    payment_plan: string;
    redirect_url: string;
  }): Promise<any> {
    try {
      const payload = {
        ...data,
        currency: 'NGN',
      };

      const response = await this.flw.Subscription.create(payload);
      return response;
    } catch (error) {
      console.error('Flutterwave create subscription error:', error);
      throw error;
    }
  }

  // Cancel a subscription
  async cancelSubscription(subscriptionId: string): Promise<any> {
    try {
      const response = await this.flw.Subscription.cancel({ id: subscriptionId });
      return response;
    } catch (error) {
      console.error('Flutterwave cancel subscription error:', error);
      throw error;
    }
  }

  // Get subscription details
  async getSubscription(subscriptionId: string): Promise<any> {
    try {
      const response = await this.flw.Subscription.get({ id: subscriptionId });
      return response;
    } catch (error) {
      console.error('Flutterwave get subscription error:', error);
      throw error;
    }
  }

  // List transactions
  async listTransactions(params?: {
    from?: string;
    to?: string;
    page?: number;
    customer_email?: string;
  }): Promise<any[]> {
    try {
      const response = await this.flw.Transaction.list(params);
      return response.data;
    } catch (error) {
      console.error('Flutterwave list transactions error:', error);
      throw error;
    }
  }

  // Verify webhook signature
  verifyWebhookSignature(payload: string, signature: string): boolean {
    const hash = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex');

    return hash === signature;
  }

  // Handle webhook event
  async handleWebhook(payload: any, signature: string): Promise<{
    event: string;
    data: any;
    verified: boolean;
  }> {
    const payloadString = JSON.stringify(payload);
    const verified = this.verifyWebhookSignature(payloadString, signature);

    if (!verified) {
      throw new Error('Invalid webhook signature');
    }

    return {
      event: payload.event,
      data: payload.data,
      verified,
    };
  }

  // Initiate bank transfer
  async initiateBankTransfer(data: {
    tx_ref: string;
    amount: number;
    email: string;
    phone_number: string;
    currency: string;
  }): Promise<any> {
    try {
      const payload = {
        ...data,
        currency: 'NGN',
      };

      const response = await this.flw.Charge.ng(payload);
      return response;
    } catch (error) {
      console.error('Flutterwave bank transfer error:', error);
      throw error;
    }
  }

  // Get banks list
  async getBanks(country: string = 'NG'): Promise<any[]> {
    try {
      const response = await this.flw.Bank.country({ country });
      return response.data;
    } catch (error) {
      console.error('Flutterwave get banks error:', error);
      throw error;
    }
  }
}
