import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { billingService, PLANS, formatPrice, formatTokens, type Usage, type Invoice } from '../billing';

interface BillingPanelProps {
  userId: number;
}

export const BillingPanel: React.FC<BillingPanelProps> = ({ userId }) => {
  const [currentPlan, setCurrentPlan] = useState<string>('local');
  const [usage, setUsage] = useState<Usage | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  useEffect(() => {
    loadBillingData();
  }, [userId]);

  const loadBillingData = async () => {
    try {
      setLoading(true);

      // Load current subscription and usage
      const usageCheck = await billingService.checkUsage(userId);
      setUsage(usageCheck.usage);
      setCurrentPlan(usageCheck.usage.planId);

      // Load invoices
      const invoiceList = await billingService.getInvoices(userId);
      setInvoices(invoiceList);
    } catch (error) {
      console.error('Failed to load billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (planId: string) => {
    try {
      setSelectedPlan(planId);

      // This would redirect to payment page
      const result = await billingService.createSubscription(
        userId,
        planId,
        'paystack', // or 'flutterwave'
        {
          email: 'user@example.com', // Get from user data
          name: 'User Name',
        }
      );

      // Redirect to payment URL
      window.open(result.authorization_url, '_blank');
    } catch (error) {
      console.error('Failed to upgrade:', error);
      alert('Failed to upgrade plan. Please try again.');
    } finally {
      setSelectedPlan(null);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription?')) return;

    try {
      await billingService.cancelSubscription(userId, false);
      alert('Subscription will be cancelled at the end of the billing period.');
      loadBillingData();
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
      alert('Failed to cancel subscription. Please try again.');
    }
  };

  const handleDownloadInvoice = async (invoiceId: string) => {
    try {
      const pdfPath = await billingService.generateInvoicePDF(invoiceId);
      // Open PDF
      window.open(`file://${pdfPath}`, '_blank');
    } catch (error) {
      console.error('Failed to download invoice:', error);
      alert('Failed to download invoice. Please try again.');
    }
  };

  const getUsagePercentage = (): number => {
    if (!usage || usage.tokensLimit === -1) return 0;
    return (usage.tokensUsed / usage.tokensLimit) * 100;
  };

  const getUsageColor = (): string => {
    const percentage = getUsagePercentage();
    if (percentage >= 95) return '#FF4444';
    if (percentage >= 80) return '#FFB800';
    return '#00D4AA';
  };

  if (loading) {
    return (
      <div className="bg-dark rounded-lg p-6 flex items-center justify-center">
        <div className="text-white">Loading billing information...</div>
      </div>
    );
  }

  const plan = PLANS[currentPlan];

  return (
    <div className="bg-dark rounded-lg p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Billing & Usage</h2>
        <div className="flex items-center gap-2">
          <span className="text-gray-400">Current Plan:</span>
          <span className="px-4 py-2 bg-brand text-white rounded-lg font-medium">
            {plan?.name || 'Unknown'}
          </span>
        </div>
      </div>

      {/* Usage Meter */}
      {usage && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-white font-medium mb-4">Token Usage This Month</h3>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">
                {formatTokens(usage.tokensUsed)} / {usage.tokensLimit === -1 ? 'Unlimited' : formatTokens(usage.tokensLimit)}
              </span>
              <span className="text-gray-400">
                {usage.tokensLimit === -1 ? '∞' : `${getUsagePercentage().toFixed(1)}%`}
              </span>
            </div>

            {usage.tokensLimit !== -1 && (
              <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: getUsageColor() }}
                  initial={{ width: 0 }}
                  animate={{ width: `${getUsagePercentage()}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-gray-400 text-sm">Active Agents</p>
              <p className="text-white text-2xl font-bold">
                {usage.agentsActive} / {usage.agentsLimit}
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Period Ends</p>
              <p className="text-white text-lg">
                {new Date(usage.periodEnd).toLocaleDateString('en-NG')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Available Plans */}
      <div>
        <h3 className="text-white font-medium mb-4">Available Plans</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.values(PLANS).map((planOption) => (
            <div
              key={planOption.id}
              className={`bg-gray-800 rounded-lg p-6 border-2 transition-all ${
                currentPlan === planOption.id
                  ? 'border-brand'
                  : 'border-transparent hover:border-gray-600'
              }`}
            >
              <h4 className="text-white font-bold text-xl mb-2">{planOption.name}</h4>
              <p className="text-brand text-3xl font-bold mb-4">
                {planOption.price === 0 ? 'Free' : formatPrice(planOption.price)}
                {planOption.price > 0 && <span className="text-sm text-gray-400">/mo</span>}
              </p>

              <ul className="space-y-2 mb-6">
                <li className="text-gray-300 text-sm">
                  ✓ {planOption.features.maxAgents} agents
                </li>
                <li className="text-gray-300 text-sm">
                  ✓ {planOption.features.tokensPerMonth === -1
                    ? 'Unlimited'
                    : formatTokens(planOption.features.tokensPerMonth)}{' '}
                  tokens/mo
                </li>
                {planOption.features.cloudMode && (
                  <li className="text-gray-300 text-sm">✓ Cloud mode</li>
                )}
                {planOption.features.voiceEnabled && (
                  <li className="text-gray-300 text-sm">✓ Voice enabled</li>
                )}
                {planOption.features.prioritySupport && (
                  <li className="text-gray-300 text-sm">✓ Priority support</li>
                )}
              </ul>

              {currentPlan === planOption.id ? (
                <button
                  disabled
                  className="w-full px-4 py-2 bg-gray-600 text-gray-400 rounded-lg cursor-not-allowed"
                >
                  Current Plan
                </button>
              ) : (
                <button
                  onClick={() => handleUpgrade(planOption.id)}
                  disabled={selectedPlan === planOption.id}
                  className="w-full px-4 py-2 bg-brand text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50"
                >
                  {selectedPlan === planOption.id ? 'Processing...' : 'Upgrade'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Payment Method */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-white font-medium mb-4">Payment Method</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-300">Paystack / Flutterwave</p>
            <p className="text-gray-400 text-sm">Card or Bank Transfer</p>
          </div>
          <button className="px-4 py-2 bg-midGray text-white rounded-lg hover:bg-gray-600 transition-colors">
            Update
          </button>
        </div>
      </div>

      {/* Invoice History */}
      <div>
        <h3 className="text-white font-medium mb-4">Invoice History</h3>
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          {invoices.length === 0 ? (
            <div className="p-6 text-center text-gray-400">No invoices yet</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="px-6 py-4 text-sm text-gray-300">
                      {new Date(invoice.createdAt).toLocaleDateString('en-NG')}
                    </td>
                    <td className="px-6 py-4 text-sm text-white font-medium">
                      {formatPrice(invoice.amount)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          invoice.status === 'paid'
                            ? 'bg-green-500 text-white'
                            : invoice.status === 'pending'
                            ? 'bg-yellow-500 text-white'
                            : 'bg-red-500 text-white'
                        }`}
                      >
                        {invoice.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-right">
                      <button
                        onClick={() => handleDownloadInvoice(invoice.id)}
                        className="text-brand hover:text-purple-400 transition-colors"
                      >
                        Download PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Cancel Subscription */}
      {currentPlan !== 'local' && (
        <div className="bg-gray-800 rounded-lg p-6 border-l-4 border-red-500">
          <h3 className="text-white font-medium mb-2">Cancel Subscription</h3>
          <p className="text-gray-400 text-sm mb-4">
            Your subscription will remain active until the end of the current billing period.
          </p>
          <button
            onClick={handleCancelSubscription}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            Cancel Subscription
          </button>
        </div>
      )}
    </div>
  );
};
