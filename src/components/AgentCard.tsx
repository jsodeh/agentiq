import { motion } from 'framer-motion';
import type { Agent } from '../types';
import { useNavigate } from 'react-router-dom';

interface AgentCardProps {
  agent: Agent;
  onStart: () => void;
  onStop: () => void;
}

export default function AgentCard({ agent, onStart, onStop }: AgentCardProps) {
  const navigate = useNavigate();
  const isActive = agent.status === 'active';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-dark border border-midGray rounded-lg p-6 hover:border-brand transition-colors cursor-pointer"
      onClick={() => navigate(`/agent/${agent.id}`)}
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-semibold text-white">{agent.name}</h3>
          <p className="text-midGray text-sm">{agent.type}</p>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-medium ${
          isActive ? 'bg-accent text-dark' : 'bg-midGray text-white'
        }`}>
          {agent.status}
        </div>
      </div>
      
      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
        {isActive ? (
          <button
            onClick={onStop}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
          >
            Stop
          </button>
        ) : (
          <button
            onClick={onStart}
            className="px-4 py-2 bg-brand hover:bg-opacity-80 text-white rounded-md transition-colors"
          >
            Start
          </button>
        )}
      </div>
    </motion.div>
  );
}
