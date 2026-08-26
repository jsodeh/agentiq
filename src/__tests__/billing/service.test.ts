import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BillingService } from '../../billing/service';
import { PaystackService } from '../../billing/paystack';
import crypto from 'crypto';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core');

describe('BillingService', () => {
  let billingService: BillingService;

  beforeEach(() => {
    billingService = new BillingService();
    vi.clearAllMocks();
  });

  describe('Paystack Webhook Verification', () => {
    it('should pass verification with valid HMAC signature', async () => {
      const payload = {
        event: 'charge.success',
        data: {
          reference: 'test_ref_123',
          amount: 490000, // ₦4,900 in kobo
          metadata: {
            userId: 1,
            planId: 'starter',
          },
        },
      };

      const payloadString = JSON.stringify(payload);
      const secret = process.env.PAYSTACK_WEBHOOK_SECRET || '';
      
      const validSignature = crypto
        .createHmac('sha512', secret)
        .update(payloadString)
        .digest('hex');

      vi.mocked(invoke).mockResolvedValue('{}');

      await expect(
        billingService.handleWebhook('paystack', payload, validSignature)
      ).resolves.not.toThrow();
    });

    it('should throw error with invalid HMAC signature', async () => {
      const payload = {
        event: 'charge.success',
        data: {
          reference: 'test_ref_123',
          amount: 490000,
          metadata: {
            userId: 1,
            planId: 'starter',
          },
        },
      };

      const invalidSignature = 'invalid_signature_12345';

      await expect(
        billingService.handleWebhook('paystack', payload, invalidSignature)
      ).rejects.toThrow();
    });

    it('should handle subscription.create event', async () => {
      const payload = {
        event: 'subscription.create',
        data: {
          subscription_code: 'SUB_test123',
          customer: {
            email: 'test@example.com',
          },
          metadata: {
            userId: 1,
            planId: 'starter',
          },
        },
      };

      const payloadString = JSON.stringify(payload);
      const secret = process.env.PAYSTACK_WEBHOOK_SECRET || '';
      
      const validSignature = crypto
        .createHmac('sha512', secret)
        .update(payloadString)
        .digest('hex');

      const mockInvoke = vi.mocked(invoke);
      mockInvoke.mockResolvedValue('{}');

      await billingService.handleWebhook('paystack', payload, validSignature);

      expect(mockInvoke).toHaveBeenCalledWith(
        'save_subscription',
        expect.objectContaining({
          subscription: expect.stringContaining('SUB_test123'),
        })
      );
    });

    it('should handle subscription.cancelled event', async () => {
      const payload = {
        event: 'subscription.disable',
        data: {
          subscription_code: 'SUB_test123',
        },
      };

      const payloadString = JSON.stringify(payload);
      const secret = process.env.PAYSTACK_WEBHOOK_SECRET || '';
      
      const validSignature = crypto
        .createHmac('sha512', secret)
        .update(payloadString)
        .digest('hex');

      const mockInvoke = vi.mocked(invoke);
      mockInvoke.mockResolvedValue('{}');

      await billingService.handleWebhook('paystack', payload, validSignature);

      expect(mockInvoke).toHaveBeenCalledWith(
        'update_subscription_status',
        expect.objectContaining({
          providerSubscriptionId: 'SUB_test123',
          status: 'cancelled',
        })
      );
    });
  });

  describe('Usage Counter', () => {
    it('should increment usage counter after LLM call log', async () => {
      const mockUsage = {
        userId: 1,
        planId: 'starter',
        tokensUsed: 1000,
        tokensLimit: 500000,
        agentsActive: 2,
        agentsLimit: 3,
        periodStart: Date.now(),
        periodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
      };

      const mockSubscription = {
        id: 'sub_123',
        userId: 1,
        planId: 'starter',
        status: 'active',
      };

      vi.mocked(invoke)
        .mockResolvedValueOnce(JSON.stringify(mockSubscription))
        .mockResolvedValueOnce(JSON.stringify(mockUsage));

      const result = await billingService.checkUsage(1);

      expect(result.withinLimits).toBe(true);
      expect(result.usage.tokensUsed).toBe(1000);
    });

    it('should detect when usage exceeds limit', async () => {
      const mockUsage = {
        userId: 1,
        planId: 'starter',
        tokensUsed: 550000, // Exceeds 500K limit
        tokensLimit: 500000,
        agentsActive: 2,
        agentsLimit: 3,
        periodStart: Date.now(),
        periodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
      };

      const mockSubscription = {
        id: 'sub_123',
        userId: 1,
        planId: 'starter',
        status: 'active',
      };

      vi.mocked(invoke)
        .mockResolvedValueOnce(JSON.stringify(mockSubscription))
        .mockResolvedValueOnce(JSON.stringify(mockUsage));

      const result = await billingService.checkUsage(1);

      expect(result.withinLimits).toBe(false);
      expect(result.warnings).toContain('Token limit exceeded');
    });

    it('should warn at 80% usage', async () => {
      const mockUsage = {
        userId: 1,
        planId: 'starter',
        tokensUsed: 400000, // 80% of 500K
        tokensLimit: 500000,
        agentsActive: 2,
        agentsLimit: 3,
        periodStart: Date.now(),
        periodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
      };

      const mockSubscription = {
        id: 'sub_123',
        userId: 1,
        planId: 'starter',
        status: 'active',
      };

      vi.mocked(invoke)
        .mockResolvedValueOnce(JSON.stringify(mockSubscription))
        .mockResolvedValueOnce(JSON.stringify(mockUsage));

      const result = await billingService.checkUsage(1);

      expect(result.withinLimits).toBe(true);
      expect(result.warnings).toContain('You have used 80% of your token limit');
    });

    it('should warn at 95% usage', async () => {
      const mockUsage = {
        userId: 1,
        planId: 'starter',
        tokensUsed: 475000, // 95% of 500K
        tokensLimit: 500000,
        agentsActive: 2,
        agentsLimit: 3,
        periodStart: Date.now(),
        periodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
      };

      const mockSubscription = {
        id: 'sub_123',
        userId: 1,
        planId: 'starter',
        status: 'active',
      };

      vi.mocked(invoke)
        .mockResolvedValueOnce(JSON.stringify(mockSubscription))
        .mockResolvedValueOnce(JSON.stringify(mockUsage));

      const result = await billingService.checkUsage(1);

      expect(result.withinLimits).toBe(true);
      expect(result.warnings).toContain('You have used 95% of your token limit');
    });
  });

  describe('Pause Agents on Limit', () => {
    it('should call pauseAgents when usage reaches 100%', async () => {
      const mockInvoke = vi.mocked(invoke);
      mockInvoke.mockResolvedValue('{}');

      await billingService.pauseAgents(1, 'Token limit exceeded');

      expect(mockInvoke).toHaveBeenCalledWith(
        'pause_all_agents',
        expect.objectContaining({
          userId: 1,
          reason: 'Token limit exceeded',
        })
      );

      expect(mockInvoke).toHaveBeenCalledWith(
        'send_agents_paused_notification',
        expect.objectContaining({
          userId: 1,
          reason: 'Token limit exceeded',
        })
      );
    });

    it('should pause agents when agent limit exceeded', async () => {
      const mockUsage = {
        userId: 1,
        planId: 'starter',
        tokensUsed: 100000,
        tokensLimit: 500000,
        agentsActive: 5, // Exceeds limit of 3
        agentsLimit: 3,
        periodStart: Date.now(),
        periodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
      };

      const mockSubscription = {
        id: 'sub_123',
        userId: 1,
        planId: 'starter',
        status: 'active',
      };

      vi.mocked(invoke)
        .mockResolvedValueOnce(JSON.stringify(mockSubscription))
        .mockResolvedValueOnce(JSON.stringify(mockUsage));

      const result = await billingService.checkUsage(1);

      expect(result.withinLimits).toBe(false);
      expect(result.warnings).toContain('Agent limit exceeded');
    });
  });

  describe('Subscription Management', () => {
    it('should create subscription with Paystack', async () => {
      const mockInvoke = vi.mocked(invoke);
      mockInvoke.mockResolvedValue('{}');

      // Mock Paystack service
      const mockPaystack = {
        initializeTransaction: vi.fn(async () => ({
          authorization_url: 'https://paystack.com/pay/test123',
          access_code: 'test_access',
          reference: 'test_ref_123',
        })),
      };

      (billingService as any).paystack = mockPaystack;

      const result = await billingService.createSubscription(
        1,
        'starter',
        'paystack',
        {
          email: 'test@example.com',
          name: 'Test User',
        }
      );

      expect(result.authorization_url).toBe('https://paystack.com/pay/test123');
      expect(result.reference).toBe('test_ref_123');
      expect(mockPaystack.initializeTransaction).toHaveBeenCalled();
    });

    it('should throw error for free plan subscription', async () => {
      await expect(
        billingService.createSubscription(1, 'local', 'paystack', {
          email: 'test@example.com',
          name: 'Test User',
        })
      ).rejects.toThrow('Cannot create subscription for free plan');
    });

    it('should cancel subscription', async () => {
      const mockSubscription = {
        id: 'sub_123',
        userId: 1,
        planId: 'starter',
        provider: 'paystack',
        providerSubscriptionId: 'SUB_test123',
        status: 'active',
      };

      const mockPaystack = {
        cancelSubscription: vi.fn(async () => ({})),
      };

      (billingService as any).paystack = mockPaystack;

      vi.mocked(invoke)
        .mockResolvedValueOnce(JSON.stringify(mockSubscription))
        .mockResolvedValueOnce('{}');

      await billingService.cancelSubscription(1, false);

      expect(mockPaystack.cancelSubscription).toHaveBeenCalledWith(
        'SUB_test123',
        ''
      );
    });
  });

  describe('Invoice Generation', () => {
    it('should get invoices for user', async () => {
      const mockInvoices = [
        {
          id: 'inv_123',
          userId: 1,
          subscriptionId: 'sub_123',
          amount: 4900,
          currency: 'NGN',
          status: 'paid',
          createdAt: Date.now(),
        },
      ];

      vi.mocked(invoke).mockResolvedValue(JSON.stringify(mockInvoices));

      const invoices = await billingService.getInvoices(1);

      expect(invoices).toHaveLength(1);
      expect(invoices[0].amount).toBe(4900);
      expect(invoices[0].currency).toBe('NGN');
    });

    it('should generate invoice PDF', async () => {
      const mockPath = '/path/to/invoice.pdf';

      vi.mocked(invoke).mockResolvedValue(mockPath);

      const path = await billingService.generateInvoicePDF('inv_123');

      expect(path).toBe(mockPath);
      expect(invoke).toHaveBeenCalledWith('generate_invoice_pdf', {
        invoiceId: 'inv_123',
      });
    });
  });
});
