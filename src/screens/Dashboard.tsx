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
          <div className="flex gap-4">
            <button
              onClick={() => setShowTimeline(!showTimeline)}
              className="px-6 py-3 bg-midGray hover:bg-gray-600 text-white rounded-md transition-colors"
            >
              {showTimeline ? 'Hide Timeline' : 'Show Timeline'}
            </button>
            <button
              onClick={() => navigate('/wizard')}
              className="px-6 py-3 bg-brand hover:bg-opacity-80 text-white rounded-md transition-colors"
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
          <div className="text-center py-12">
            <p className="text-midGray text-lg">No agents configured yet.</p>
            <button
              onClick={() => navigate('/wizard')}
              className="mt-4 px-6 py-3 bg-brand hover:bg-opacity-80 text-white rounded-md transition-colors"
            >
              Create Your First Agent
            </button>
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
