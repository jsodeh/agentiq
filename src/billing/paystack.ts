import Paystack from 'paystack';
import crypto from 'crypto';

export interface PaystackConfig {
  secretKey: string;
  publicKey: string;
  webhookSecret: string;
}

export interface PaystackCustomer {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
}

export interface PaystackSubscription {
  customer: string; // customer code
  plan: string; // plan code
  authorization: string; // authorization code
}

export class PaystackService {
  private paystack: any;
  private webhookSecret: string;

  constructor(config: PaystackConfig) {
    this.paystack = Paystack(config.secretKey);
    this.webhookSecret = config.webhookSecret;
  }

  // Create a subscription plan
  async createPlan(planData: {
    name: string;
    amount: number; // in kobo (₦1 = 100 kobo)
    interval: 'monthly' | 'annually';
    description?: string;
  }): Promise<any> {
    try {
      const response = await this.paystack.plan.create({
        name: planData.name,
        amount: planData.amount * 100, // Convert to kobo
        interval: planData.interval,
        description: planData.description,
        currency: 'NGN',
      });

      return response.data;
    } catch (error) {
      console.error('Paystack create plan error:', error);
      throw error;
    }
  }

  // Create a customer
  async createCustomer(customer: PaystackCustomer): Promise<any> {
    try {
      const response = await this.paystack.customer.create(customer);
      return response.data;
    } catch (error) {
      console.error('Paystack create customer error:', error);
      throw error;
    }
  }

  // Initialize a transaction
  async initializeTransaction(data: {
    email: string;
    amount: number; // in Naira
    plan?: string;
    callback_url?: string;
    metadata?: Record<string, any>;
  }): Promise<{ authorization_url: string; access_code: string; reference: string }> {
    try {
      const response = await this.paystack.transaction.initialize({
        email: data.email,
        amount: data.amount * 100, // Convert to kobo
        plan: data.plan,
        callback_url: data.callback_url,
        metadata: data.metadata,
        currency: 'NGN',
      });

      return response.data;
    } catch (error) {
      console.error('Paystack initialize transaction error:', error);
      throw error;
    }
  }

  // Verify a transaction
  async verifyTransaction(reference: string): Promise<any> {
    try {
      const response = await this.paystack.transaction.verify(reference);
      return response.data;
    } catch (error) {
      console.error('Paystack verify transaction error:', error);
      throw error;
    }
  }

  // Create a subscription
  async createSubscription(data: PaystackSubscription): Promise<any> {
    try {
      const response = await this.paystack.subscription.create(data);
      return response.data;
    } catch (error) {
      console.error('Paystack create subscription error:', error);
      throw error;
    }
  }

  // Cancel a subscription
  async cancelSubscription(code: string, token: string): Promise<any> {
    try {
      const response = await this.paystack.subscription.disable({
        code,
        token,
      });
      return response.data;
    } catch (error) {
      console.error('Paystack cancel subscription error:', error);
      throw error;
    }
  }

  // Get subscription details
  async getSubscription(idOrCode: string): Promise<any> {
    try {
      const response = await this.paystack.subscription.get(idOrCode);
      return response.data;
    } catch (error) {
      console.error('Paystack get subscription error:', error);
      throw error;
    }
  }

  // List transactions
  async listTransactions(params?: {
    perPage?: number;
    page?: number;
    customer?: string;
    status?: 'success' | 'failed' | 'abandoned';
    from?: string;
    to?: string;
  }): Promise<any[]> {
    try {
      const response = await this.paystack.transaction.list(params);
      return response.data;
    } catch (error) {
      console.error('Paystack list transactions error:', error);
      throw error;
    }
  }

  // Verify webhook signature
  verifyWebhookSignature(payload: string, signature: string): boolean {
    const hash = crypto
      .createHmac('sha512', this.webhookSecret)
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

  // Charge authorization (for recurring payments)
  async chargeAuthorization(data: {
    authorization_code: string;
    email: string;
    amount: number; // in Naira
    metadata?: Record<string, any>;
  }): Promise<any> {
    try {
      const response = await this.paystack.transaction.charge({
        authorization_code: data.authorization_code,
        email: data.email,
        amount: data.amount * 100, // Convert to kobo
        metadata: data.metadata,
        currency: 'NGN',
      });

      return response.data;
    } catch (error) {
      console.error('Paystack charge authorization error:', error);
      throw error;
    }
  }
}
