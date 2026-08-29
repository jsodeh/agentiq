import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAgents } from '../hooks/useAgents';
import EscalationPanel from '../components/EscalationPanel';
import { TimelineView } from '../components/TimelineView';
import { AgentStatusGrid } from '../components/AgentStatusCard';
import { AgentDetailPanel } from '../components/AgentDetailPanel';

export default function Dashboard() {
  const navigate = useNavigate();
  const { agents, startAgent, stopAgent } = useAgents();
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);

  const handleResolveEscalation = (id: number) => {
    // TODO: Resolve escalation in database
    console.log('Resolving escalation:', id);
  };

  const handleDismissEscalation = (id: number) => {
    // TODO: Dismiss escalation in database
    console.log('Dismissing escalation:', id);
  };

  const handleAgentStatusChange = (agentId: number, newStatus: string) => {
    if (newStatus === 'running') {
      startAgent(agentId);
    } else {
      stopAgent(agentId);
    }
  };

  const handleAgentClick = (agentId: number) => {
    setSelectedAgentId(agentId);
  };

  const handleCloseDetailPanel = () => {
    setSelectedAgentId(null);
  };

  // Transform agents to match AgentStatusCard interface
  const statusAgents = agents.map(agent => ({
    id: agent.id,
    name: agent.name,
    type: agent.type,
    status: agent.status as 'idle' | 'running' | 'paused' | 'error',
    lastAction: (agent as any).lastAction,
    tasksToday: (agent as any).tasksToday || 0,
    lastRunTime: (agent as any).lastRunTime,
  }));

  // Find selected agent for detail panel
  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  return (
    <div className="min-h-screen bg-dark p-8">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-7xl mx-auto"
      >
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white">
            agēntīq Dashboard
          </h1>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/setup')}
              className="px-4 py-3 bg-dark border border-midGray hover:border-brand text-midGray hover:text-white rounded-md transition-colors text-sm"
              title="Re-run hardware check, AI model download, or system setup"
            >
              ⚙️ Setup & Hardware
            </button>
            <button
              onClick={() => setShowTimeline(!showTimeline)}
              className="px-5 py-3 bg-midGray hover:bg-gray-600 text-white rounded-md transition-colors"
            >
              {showTimeline ? 'Hide Timeline' : 'Show Timeline'}
            </button>
            <button
              onClick={() => navigate('/wizard')}
              className="px-6 py-3 bg-brand hover:bg-opacity-80 text-white font-semibold rounded-md transition-colors shadow-lg shadow-brand/20"
            >
              + New Agent
            </button>
          </div>
        </div>

        <EscalationPanel
          escalations={[]}
          onResolve={handleResolveEscalation}
          onDismiss={handleDismissEscalation}
        />

        {/* Timeline View */}
        {showTimeline && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-8"
          >
            <TimelineView height={600} />
          </motion.div>
        )}
        
        {/* Agent Status Grid */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-4">Active Agents</h2>
          <AgentStatusGrid
            agents={statusAgents}
            onStatusChange={handleAgentStatusChange}
            onAgentClick={handleAgentClick}
          />
        </div>

        {agents.length === 0 && (
          <div className="text-center py-16 bg-dark/40 border border-midGray/40 rounded-2xl p-8 max-w-xl mx-auto">
            <div className="text-5xl mb-4">🤖</div>
            <h3 className="text-xl font-bold text-white mb-2">No agents configured yet</h3>
            <p className="text-midGray text-sm mb-6 max-w-md mx-auto">
              Select from our 55+ pre-configured AI specialist templates across Sales, Support, Marketing, and Operations, or build a custom agent.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => navigate('/wizard')}
                className="px-6 py-3 bg-brand hover:bg-opacity-80 text-white font-semibold rounded-lg transition-colors shadow-lg shadow-brand/20"
              >
                + Choose from 55+ Templates
              </button>
              <button
                onClick={() => navigate('/setup')}
                className="px-5 py-3 bg-dark border border-midGray hover:border-brand text-white rounded-lg transition-colors text-sm"
              >
                Run Hardware Setup
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Agent Detail Panel */}
      {selectedAgentId && selectedAgent && (
        <AgentDetailPanel
          agentId={selectedAgentId}
          agentName={selectedAgent.name}
          onClose={handleCloseDetailPanel}
        />
      )}
    </div>
  );
}
