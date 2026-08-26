import { useState, useEffect, useCallback } from 'react';
import { getOrchestratorClient, type OrchestratorStatus, type EscalationEvent } from '../lib/orchestrator-client';

export function useOrchestrator() {
  const [status, setStatus] = useState<OrchestratorStatus>({
    running: false,
    activeAgents: 0,
    queueSize: 0,
    queuePending: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const client = getOrchestratorClient();

  // Fetch status periodically
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const newStatus = await client.getStatus();
        setStatus(newStatus);
      } catch (err) {
        console.error('Failed to fetch orchestrator status:', err);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);

    return () => clearInterval(interval);
  }, []);

  const start = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await client.start();
      const newStatus = await client.getStatus();
      setStatus(newStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start orchestrator');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const stop = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await client.stop();
      const newStatus = await client.getStatus();
      setStatus(newStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop orchestrator');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const runAgent = useCallback(async (agentId: number) => {
    setLoading(true);
    setError(null);
    try {
      await client.runAgent(agentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to run agent ${agentId}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const pauseAgent = useCallback(async (agentId: number) => {
    setLoading(true);
    setError(null);
    try {
      await client.pauseAgent(agentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to pause agent ${agentId}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    status,
    loading,
    error,
    start,
    stop,
    runAgent,
    pauseAgent,
  };
}

export function useEscalations() {
  const [escalations, setEscalations] = useState<EscalationEvent[]>([]);
  const client = getOrchestratorClient();

  useEffect(() => {
    // Subscribe to escalation events
    const unsubscribe = client.onEscalation((event) => {
      setEscalations(prev => [event, ...prev]);
    });

    // Load existing escalations
    client.getEscalations('pending').then(setEscalations).catch(console.error);

    return unsubscribe;
  }, []);

  const clearEscalation = useCallback((escalationId: number) => {
    setEscalations(prev => prev.filter(e => e.escalationId !== escalationId));
  }, []);

  return {
    escalations,
    clearEscalation,
  };
}
