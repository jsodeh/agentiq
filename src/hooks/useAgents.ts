import { useEffect, useCallback } from 'react';
import { useStore } from '../store';
import { startAgent as tauriStartAgent, stopAgent as tauriStopAgent } from '../lib/tauri';
import { getAgentById } from '../agents/registry';
import { Agent } from '../types';

export function useAgents() {
  const { agents, setAgents, updateAgent } = useStore();

  const loadAgents = useCallback(() => {
    try {
      // 1. Check primary persistent storage in localStorage
      const storedAgents = localStorage.getItem('agentiq_agents');
      if (storedAgents) {
        const parsed = JSON.parse(storedAgents);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAgents(parsed);
          return;
        }
      }

      // 2. Fallback: Check if selected_agents from setup flow exists
      const selectedIds = JSON.parse(localStorage.getItem('selected_agents') || '[]');
      if (Array.isArray(selectedIds) && selectedIds.length > 0) {
        const hydratedAgents: Agent[] = selectedIds.map((id: string, index: number) => {
          const template = getAgentById(id);
          return {
            id: Date.now() + index,
            user_id: 1,
            name: template?.name || id,
            type: template?.category || 'General',
            status: 'stopped',
            config: JSON.stringify({
              templateId: id,
              icon: template?.icon || '🤖',
              description: template?.description || '',
              systemPrompt: template?.systemPrompt || '',
              tools: template?.composioTools || template?.tools || [],
            }),
            created_at: new Date().toISOString(),
          };
        });

        if (hydratedAgents.length > 0) {
          setAgents(hydratedAgents);
          localStorage.setItem('agentiq_agents', JSON.stringify(hydratedAgents));
          return;
        }
      }
    } catch (error) {
      console.error('Failed to load agents:', error);
    }
  }, [setAgents]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const startAgent = async (agentId: number) => {
    try {
      updateAgent(agentId, { status: 'active' });
      const current = useStore.getState().agents;
      const updated = current.map(a => a.id === agentId ? { ...a, status: 'active' as const } : a);
      localStorage.setItem('agentiq_agents', JSON.stringify(updated));

      try {
        await tauriStartAgent(agentId);
      } catch (err) {
        console.warn('Tauri startAgent fallback:', err);
      }
    } catch (error) {
      console.error('Failed to start agent:', error);
    }
  };

  const stopAgent = async (agentId: number) => {
    try {
      updateAgent(agentId, { status: 'stopped' });
      const current = useStore.getState().agents;
      const updated = current.map(a => a.id === agentId ? { ...a, status: 'stopped' as const } : a);
      localStorage.setItem('agentiq_agents', JSON.stringify(updated));

      try {
        await tauriStopAgent(agentId);
      } catch (err) {
        console.warn('Tauri stopAgent fallback:', err);
      }
    } catch (error) {
      console.error('Failed to stop agent:', error);
    }
  };

  return {
    agents,
    startAgent,
    stopAgent,
    loadAgents,
  };
}
