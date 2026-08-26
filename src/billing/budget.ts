import { invoke } from '@tauri-apps/api/core';
import { CronJob } from 'cron';

export interface AgentBudget {
  agentId: number;
  dailyTokenLimit: number;
  tokensUsedToday: number;
  lastResetAt: number;
  budgetExhausted: boolean;
}

export class BudgetService {
  private resetJob: CronJob | null = null;

  constructor() {
    this.setupDailyReset();
  }

  // Setup daily reset cron job (midnight Lagos time)
  private setupDailyReset() {
    // Cron: 0 0 * * * (midnight every day)
    // Timezone: Africa/Lagos (WAT, UTC+1)
    this.resetJob = new CronJob(
      '0 0 * * *',
      async () => {
        await this.resetAllBudgets();
      },
      null,
      true,
      'Africa/Lagos'
    );

    console.log('Budget reset cron job started (midnight WAT)');
  }

  // Set daily token budget for an agent
  async setAgentBudget(agentId: number, dailyTokenLimit: number): Promise<void> {
    const budget: AgentBudget = {
      agentId,
      dailyTokenLimit,
      tokensUsedToday: 0,
      lastResetAt: Date.now(),
      budgetExhausted: false,
    };

    await invoke('save_agent_budget', {
      budget: JSON.stringify(budget),
    });

    console.log(`Set budget for agent ${agentId}: ${dailyTokenLimit} tokens/day`);
  }

  // Get agent budget
  async getAgentBudget(agentId: number): Promise<AgentBudget | null> {
    try {
      const result = await invoke<string>('get_agent_budget', { agentId });
      return JSON.parse(result);
    } catch (error) {
      return null;
    }
  }

  // Check if agent can make LLM call
  async canMakeLLMCall(agentId: number, estimatedTokens: number): Promise<{
    allowed: boolean;
    reason?: string;
    remainingTokens?: number;
  }> {
    const budget = await this.getAgentBudget(agentId);

    if (!budget) {
      // No budget set, allow call
      return { allowed: true };
    }

    if (budget.budgetExhausted) {
      return {
        allowed: false,
        reason: 'Daily budget exhausted',
        remainingTokens: 0,
      };
    }

    const remainingTokens = budget.dailyTokenLimit - budget.tokensUsedToday;

    if (remainingTokens < estimatedTokens) {
      // Mark budget as exhausted
      await this.markBudgetExhausted(agentId);

      return {
        allowed: false,
        reason: 'Insufficient tokens remaining',
        remainingTokens,
      };
    }

    return {
      allowed: true,
      remainingTokens,
    };
  }

  // Record token usage
  async recordTokenUsage(agentId: number, tokensUsed: number): Promise<void> {
    const budget = await this.getAgentBudget(agentId);

    if (!budget) {
      // No budget set, just record usage
      await invoke('record_token_usage', {
        agentId,
        tokensUsed,
        timestamp: Date.now(),
      });
      return;
    }

    // Update budget
    budget.tokensUsedToday += tokensUsed;

    // Check if budget exhausted
    if (budget.tokensUsedToday >= budget.dailyTokenLimit) {
      budget.budgetExhausted = true;
      await this.notifyBudgetExhausted(agentId);
    }

    await invoke('save_agent_budget', {
      budget: JSON.stringify(budget),
    });

    // Also record in usage log
    await invoke('record_token_usage', {
      agentId,
      tokensUsed,
      timestamp: Date.now(),
    });

    console.log(`Recorded ${tokensUsed} tokens for agent ${agentId}`);
  }

  // Mark budget as exhausted
  private async markBudgetExhausted(agentId: number): Promise<void> {
    await invoke('mark_budget_exhausted', { agentId });
    await this.notifyBudgetExhausted(agentId);
  }

  // Notify when budget is exhausted
  private async notifyBudgetExhausted(agentId: number): Promise<void> {
    await invoke('send_budget_exhausted_notification', { agentId });
    console.log(`Budget exhausted for agent ${agentId}`);
  }

  // Reset all budgets (called at midnight)
  async resetAllBudgets(): Promise<void> {
    try {
      await invoke('reset_all_agent_budgets');
      console.log('All agent budgets reset');
    } catch (error) {
      console.error('Failed to reset budgets:', error);
    }
  }

  // Reset specific agent budget
  async resetAgentBudget(agentId: number): Promise<void> {
    const budget = await this.getAgentBudget(agentId);

    if (!budget) return;

    budget.tokensUsedToday = 0;
    budget.lastResetAt = Date.now();
    budget.budgetExhausted = false;

    await invoke('save_agent_budget', {
      budget: JSON.stringify(budget),
    });

    console.log(`Reset budget for agent ${agentId}`);
  }

  // Get budget usage percentage
  async getBudgetUsagePercentage(agentId: number): Promise<number> {
    const budget = await this.getAgentBudget(agentId);

    if (!budget || budget.dailyTokenLimit === 0) {
      return 0;
    }

    return (budget.tokensUsedToday / budget.dailyTokenLimit) * 100;
  }

  // Get all agent budgets
  async getAllAgentBudgets(): Promise<AgentBudget[]> {
    const result = await invoke<string>('get_all_agent_budgets');
    return JSON.parse(result);
  }

  // Update daily token limit
  async updateDailyLimit(agentId: number, newLimit: number): Promise<void> {
    const budget = await this.getAgentBudget(agentId);

    if (!budget) {
      await this.setAgentBudget(agentId, newLimit);
      return;
    }

    budget.dailyTokenLimit = newLimit;

    // If new limit is higher than current usage, unmark as exhausted
    if (newLimit > budget.tokensUsedToday) {
      budget.budgetExhausted = false;
    }

    await invoke('save_agent_budget', {
      budget: JSON.stringify(budget),
    });

    console.log(`Updated daily limit for agent ${agentId}: ${newLimit} tokens`);
  }

  // Get token usage history
  async getTokenUsageHistory(
    agentId: number,
    startDate: number,
    endDate: number
  ): Promise<Array<{ date: number; tokensUsed: number }>> {
    const result = await invoke<string>('get_token_usage_history', {
      agentId,
      startDate,
      endDate,
    });
    return JSON.parse(result);
  }

  // Stop cron job
  stop() {
    if (this.resetJob) {
      this.resetJob.stop();
      console.log('Budget reset cron job stopped');
    }
  }
}

export const budgetService = new BudgetService();
