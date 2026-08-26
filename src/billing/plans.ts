export interface Plan {
  id: string;
  name: string;
  price: number; // in Naira
  currency: 'NGN';
  interval: 'monthly';
  features: {
    maxAgents: number;
    tokensPerMonth: number;
    cloudMode: boolean;
    voiceEnabled: boolean;
    prioritySupport: boolean;
    computerUse: boolean;
  };
  description: string;
}

export const PLANS: Record<string, Plan> = {
  local: {
    id: 'local',
    name: 'Local',
    price: 0,
    currency: 'NGN',
    interval: 'monthly',
    features: {
      maxAgents: 0,
      tokensPerMonth: 0,
      cloudMode: false,
      voiceEnabled: false,
      prioritySupport: false,
      computerUse: false,
    },
    description: 'Free local mode only. No cloud features, no billing required.',
  },
  
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 4900,
    currency: 'NGN',
    interval: 'monthly',
    features: {
      maxAgents: 3,
      tokensPerMonth: 500000,
      cloudMode: true,
      voiceEnabled: false,
      prioritySupport: false,
      computerUse: false,
    },
    description: 'Perfect for individuals and small businesses getting started with AI agents.',
  },
  
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 19900,
    currency: 'NGN',
    interval: 'monthly',
    features: {
      maxAgents: 15,
      tokensPerMonth: 5000000,
      cloudMode: true,
      voiceEnabled: true,
      prioritySupport: false,
      computerUse: true,
    },
    description: 'For growing businesses that need more agents and voice capabilities.',
  },
  
  business: {
    id: 'business',
    name: 'Business',
    price: 49900,
    currency: 'NGN',
    interval: 'monthly',
    features: {
      maxAgents: 50,
      tokensPerMonth: -1, // Unlimited
      cloudMode: true,
      voiceEnabled: true,
      prioritySupport: true,
      computerUse: true,
    },
    description: 'For enterprises that need unlimited usage and priority support.',
  },
};

export function getPlan(planId: string): Plan | undefined {
  return PLANS[planId];
}

export function getAllPlans(): Plan[] {
  return Object.values(PLANS);
}

export function isUnlimitedTokens(planId: string): boolean {
  const plan = getPlan(planId);
  return plan?.features.tokensPerMonth === -1;
}

export function formatPrice(price: number): string {
  return `₦${price.toLocaleString('en-NG')}`;
}

export function formatTokens(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(0)}K`;
  }
  return tokens.toString();
}
