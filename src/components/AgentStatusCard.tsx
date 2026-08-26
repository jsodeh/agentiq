import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';

interface Agent {
  id: number;
  name: string;
  type: string;
  status: 'idle' | 'running' | 'paused' | 'error';
  lastAction?: string;
  tasksToday: number;
  lastRunTime?: number;
}

interface AgentStatusCardProps {
  agent: Agent;
  onStatusChange?: (agentId: number, newStatus: string) => void;
  onClick?: (agentId: number) => void;
}

const STATUS_COLORS = {
  idle: '#6B7280',
  running: '#10B981',
  paused: '#F59E0B',
  error: '#EF4444',
};

const STATUS_ICONS = {
  idle: '⏸️',
  running: '▶️',
  paused: '⏸️',
  error: '⚠️',
};

const TYPE_ICONS: Record<string, string> = {
  'lead-gen-maps': '🗺️',
  'cold-outreach': '📧',
  'customer-support-whatsapp': '💬',
  'order-handler': '📦',
  'invoice-generator': '🧾',
  'appointment-booker': '📅',
  'social-media-manager': '📱',
  'default': '🤖',
};

export const AgentStatusCard: React.FC<AgentStatusCardProps> = ({
  agent,
  onStatusChange,
  onClick,
}) => {
  const [isToggling, setIsToggling] = useState(false);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click

    if (isToggling) return;

    setIsToggling(true);

    try {
      const newStatus = agent.status === 'running' ? 'paused' : 'running';

      if (newStatus === 'running') {
        await invoke('start_agent', { agentId: agent.id });
      } else {
        await invoke('stop_agent', { agentId: agent.id });
      }

      if (onStatusChange) {
        onStatusChange(agent.id, newStatus);
      }
    } catch (error) {
      console.error('Failed to toggle agent:', error);
    } finally {
      setIsToggling(false);
    }
  };

  const handleCardClick = () => {
    if (onClick) {
      onClick(agent.id);
    }
  };

  const truncateText = (text: string, maxLength: number = 80): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const getTypeIcon = (type: string): string => {
    return TYPE_ICONS[type] || TYPE_ICONS.default;
  };

  const formatLastRunTime = (timestamp?: number): string => {
    if (!timestamp) return 'Never';

    const now = Date.now();
    const diff = now - timestamp;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
      onClick={handleCardClick}
      className="bg-gray-800 rounded-lg p-6 cursor-pointer hover:bg-gray-750 transition-colors border-2 border-transparent hover:border-brand"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {/* Type Icon */}
          <div className="text-4xl">{getTypeIcon(agent.type)}</div>

          {/* Agent Info */}
          <div>
            <h3 className="text-white font-bold text-lg">{agent.name}</h3>
            <p className="text-gray-400 text-sm capitalize">{agent.type.replace(/-/g, ' ')}</p>
          </div>
        </div>

        {/* Status Indicator */}
        <motion.div
          animate={{
            scale: agent.status === 'running' ? [1, 1.1, 1] : 1,
          }}
          transition={{
            duration: 2,
            repeat: agent.status === 'running' ? Infinity : 0,
          }}
          className="flex items-center gap-2 px-3 py-1 rounded-full"
          style={{ backgroundColor: STATUS_COLORS[agent.status] + '20' }}
        >
          <span className="text-xl">{STATUS_ICONS[agent.status]}</span>
          <span
            className="text-sm font-medium capitalize"
            style={{ color: STATUS_COLORS[agent.status] }}
          >
            {agent.status}
          </span>
        </motion.div>
      </div>

      {/* Last Action */}
      {agent.lastAction && (
        <div className="mb-4">
          <p className="text-gray-400 text-xs mb-1">Last Action:</p>
          <p className="text-white text-sm">{truncateText(agent.lastAction)}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-gray-900 rounded-lg p-3">
          <p className="text-gray-400 text-xs mb-1">Tasks Today</p>
          <p className="text-white text-2xl font-bold">{agent.tasksToday}</p>
        </div>
        <div className="bg-gray-900 rounded-lg p-3">
          <p className="text-gray-400 text-xs mb-1">Last Run</p>
          <p className="text-white text-lg font-medium">
            {formatLastRunTime(agent.lastRunTime)}
          </p>
        </div>
      </div>

      {/* Toggle Switch */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-700">
        <span className="text-gray-400 text-sm">
          {agent.status === 'running' ? 'Pause Agent' : 'Resume Agent'}
        </span>

        <button
          onClick={handleToggle}
          disabled={isToggling || agent.status === 'error'}
          className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
            agent.status === 'running'
              ? 'bg-green-500'
              : agent.status === 'error'
              ? 'bg-red-500 opacity-50 cursor-not-allowed'
              : 'bg-gray-600'
          }`}
        >
          <motion.span
            animate={{
              x: agent.status === 'running' ? 28 : 4,
            }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="inline-block h-6 w-6 transform rounded-full bg-white shadow-lg"
          />
        </button>
      </div>

      {/* Error Message */}
      {agent.status === 'error' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-4 p-3 bg-red-500 bg-opacity-20 border border-red-500 rounded-lg"
        >
          <p className="text-red-400 text-sm">
            ⚠️ Agent encountered an error. Check logs for details.
          </p>
        </motion.div>
      )}
    </motion.div>
  );
};

// Grid container for multiple agent cards
export const AgentStatusGrid: React.FC<{
  agents: Agent[];
  onStatusChange?: (agentId: number, newStatus: string) => void;
  onAgentClick?: (agentId: number) => void;
}> = ({ agents, onStatusChange, onAgentClick }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {agents.map(agent => (
        <AgentStatusCard
          key={agent.id}
          agent={agent}
          onStatusChange={onStatusChange}
          onClick={onAgentClick}
        />
      ))}
    </div>
  );
};
