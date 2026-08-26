import { useEffect } from 'react';
import { useStore } from '../store';
import { startAgent as tauriStartAgent, stopAgent as tauriStopAgent } from '../lib/tauri';

export function useAgents() {
  const { agents, setAgents, updateAgent } = useStore();

  useEffect(() => {
    // TODO: Load agents from database on mount
    loadAgents();
  }, []);

  const loadAgents = async () => {
    // TODO: Implement database loading
    console.log('Loading agents...');
  };

  const startAgent = async (agentId: number) => {
    try {
      await tauriStartAgent(agentId);
      updateAgent(agentId, { status: 'active' });
    } catch (error) {
      console.error('Failed to start agent:', error);
    }
  };

  const stopAgent = async (agentId: number) => {
    try {
      await tauriStopAgent(agentId);
      updateAgent(agentId, { status: 'stopped' });
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
