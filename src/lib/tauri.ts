import { invoke } from '@tauri-apps/api/core';

export async function startAgent(agentId: number): Promise<string> {
  return await invoke<string>('start_agent', { agentId });
}

export async function stopAgent(agentId: number): Promise<string> {
  return await invoke<string>('stop_agent', { agentId });
}

export async function stopAllAgents(): Promise<string> {
  return await invoke<string>('stop_all_agents');
}
