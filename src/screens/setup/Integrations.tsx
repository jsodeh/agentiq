import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import TaskSteps, { type TaskStep } from '../../components/ui/task-steps';
import { getAgentById } from '../../agents/registry';
import type { AgentDefinition } from '../../agents/types';
import type { AgentIntegration } from '../../agents/setup-metadata';

type SelectedAgent = AgentDefinition & { skills: string[]; integrations: AgentIntegration[] };

export default function Integrations() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const selectedAgents = useMemo<SelectedAgent[]>(() => {
    try {
      const ids = JSON.parse(localStorage.getItem('selected_agents') || '[]') as string[];
      return ids.map(getAgentById).filter((agent): agent is SelectedAgent => Boolean(agent));
    } catch { return []; }
  }, []);

  const steps = useMemo<TaskStep[]>(() => {
    const agentSteps = selectedAgents.flatMap((agent) => [
      { id: `${agent.id}-skills`, label: `Loading ${agent.name} skills`, meta: `${agent.skills.length} skills` },
      { id: `${agent.id}-prompt`, label: `Applying ${agent.name} instructions`, meta: 'prompt' },
      ...agent.integrations.map((integration) => ({ id: `${agent.id}-${integration.id}`, label: `Activating ${integration.label} for ${agent.name}`, meta: integration.kind })),
      { id: `${agent.id}-verify`, label: `Verifying ${agent.name} workspace`, meta: 'ready' },
    ]);
    return [
      { id: 'workspace', label: 'Securing your agent workspace', meta: 'encrypted' },
      ...agentSteps,
      { id: 'complete', label: 'Finalizing your business workspace', meta: 'complete' },
    ];
  }, [selectedAgents]);

  useEffect(() => {
    if (!steps.length || isRunning || isComplete) return;
    setIsRunning(true);
  }, [steps.length, isRunning, isComplete]);

  useEffect(() => {
    if (!isRunning) return;
    if (currentStep >= steps.length) {
      setIsRunning(false);
      setIsComplete(true);
      localStorage.setItem('agent_setup_ready', 'true');
      return;
    }
    const timer = window.setTimeout(() => setCurrentStep((step) => step + 1), 320);
    return () => window.clearTimeout(timer);
  }, [currentStep, isRunning, steps.length]);

  const integrationCount = selectedAgents.reduce((total, agent) => total + agent.integrations.length, 0);
  const requiredCount = selectedAgents.reduce((total, agent) => total + agent.integrations.filter((integration) => integration.kind === 'required').length, 0);

  const restartSetup = () => {
    setCurrentStep(0);
    setIsComplete(false);
    setIsRunning(true);
  };

  return (
    <div className="min-h-screen bg-dark px-6 py-10 text-white">
      <motion.main initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mx-auto w-full max-w-4xl">
        <div className="mb-8 text-center">
          <span className="inline-flex rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent">Business workspace setup</span>
          <h1 className="mt-4 text-4xl font-bold">Activating your agent team</h1>
          <p className="mx-auto mt-3 max-w-2xl text-midGray">We are preparing each agent’s skills, instructions, and connected capabilities so your team starts with a consistent, production-ready workspace.</p>
        </div>

        <section className="overflow-hidden rounded-2xl border border-midGray/60 bg-white/[0.03] shadow-2xl shadow-black/20">
          <div className="border-b border-midGray/40 px-6 py-5 sm:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">{isComplete ? 'Your workspace is ready' : 'Configuring your workspace'}</p>
                <p className="mt-1 text-xs text-midGray">{selectedAgents.length} agents · {integrationCount} capabilities · {requiredCount} essential connections</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isComplete ? 'bg-accent/15 text-accent' : 'bg-brand/15 text-brand'}`}>{isComplete ? 'Ready to continue' : `${Math.min(currentStep + 1, steps.length)} / ${steps.length}`}</span>
            </div>
          </div>

          <div className="grid gap-8 p-6 sm:p-8 md:grid-cols-[1.2fr_0.8fr]">
            <TaskSteps steps={steps} current={currentStep} label="Business workspace activation" />
            <aside className="rounded-xl border border-midGray/40 bg-dark/50 p-5">
              <h2 className="text-sm font-semibold">Team setup summary</h2>
              <div className="mt-4 space-y-3">
                {selectedAgents.map((agent) => (
                  <div key={agent.id} className="flex items-start gap-3">
                    <span className="text-xl">{agent.icon}</span>
                    <div className="min-w-0"><p className="truncate text-sm font-medium">{agent.name}</p><p className="mt-0.5 text-xs text-midGray">{agent.skills.length} skills · {agent.integrations.length} integrations</p></div>
                  </div>
                ))}
              </div>
              <p className="mt-5 border-t border-midGray/40 pt-4 text-xs leading-relaxed text-midGray">Essential capabilities are activated now. Services that require your account authorization will ask for consent only when an agent first needs them.</p>
            </aside>
          </div>
        </section>

        <div className="mt-7 flex items-center justify-between gap-4">
          <button onClick={() => navigate('/setup/agent-select')} className="rounded-xl border border-midGray px-5 py-3 text-sm font-medium transition-colors hover:border-brand">← Back to agents</button>
          <div className="flex gap-3">
            {isComplete && <button onClick={restartSetup} className="rounded-xl border border-midGray px-5 py-3 text-sm text-midGray transition-colors hover:border-brand hover:text-white">Run again</button>}
            <button onClick={() => navigate('/setup/agent-config')} disabled={!isComplete} className="rounded-xl bg-brand px-6 py-3 text-sm font-semibold shadow-lg shadow-brand/20 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">Continue to configuration →</button>
          </div>
        </div>
      </motion.main>
    </div>
  );
}
