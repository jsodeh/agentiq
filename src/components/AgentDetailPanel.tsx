import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

interface Task {
  id: string;
  agentId: number;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  createdAt: number;
  completedAt?: number;
  result?: string;
  error?: string;
}

interface LogEntry {
  id: string;
  agentId: number;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  timestamp: number;
  actionType?: string;
}

interface AgentDetailPanelProps {
  agentId: number;
  agentName: string;
  onClose: () => void;
}

const STATUS_COLORS = {
  pending: '#6B7280',
  in_progress: '#3B82F6',
  completed: '#10B981',
  failed: '#EF4444',
};

const LEVEL_COLORS = {
  info: '#3B82F6',
  warning: '#F59E0B',
  error: '#EF4444',
  success: '#10B981',
};

export const AgentDetailPanel: React.FC<AgentDetailPanelProps> = ({
  agentId,
  agentName,
  onClose,
}) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'tasks' | 'logs'>('tasks');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAgentData();

    // Listen for real-time updates
    const unlistenLog = listen<LogEntry>('new_log', (event) => {
      if (event.payload.agentId === agentId) {
        setLogs(prev => [event.payload, ...prev]);
      }
    });

    const unlistenTask = listen<Task>('task_updated', (event) => {
      if (event.payload.agentId === agentId) {
        setTasks(prev => {
          const index = prev.findIndex(t => t.id === event.payload.id);
          if (index >= 0) {
            const newTasks = [...prev];
            newTasks[index] = event.payload;
            return newTasks;
          }
          return [event.payload, ...prev];
        });
      }
    });

    return () => {
      unlistenLog.then(fn => fn());
      unlistenTask.then(fn => fn());
    };
  }, [agentId]);

  const loadAgentData = async () => {
    setLoading(true);
    try {
      // Load tasks
      const tasksResult = await invoke<string>('get_agent_tasks', {
        agentId,
        limit: 100,
      });
      setTasks(JSON.parse(tasksResult));

      // Load logs
      const logsResult = await invoke<string>('get_logs', {
        agentId,
        limit: 100,
      });
      const allLogs = JSON.parse(logsResult);
      setLogs(allLogs.filter((log: LogEntry) => log.agentId === agentId));
    } catch (error) {
      console.error('Failed to load agent data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  const formatDuration = (start: number, end?: number): string => {
    if (!end) return 'In progress';
    const duration = end - start;
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
          className="bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gray-900 px-6 py-4 flex items-center justify-between border-b border-gray-700">
            <div>
              <h2 className="text-2xl font-bold text-white">{agentName}</h2>
              <p className="text-gray-400 text-sm">Agent ID: {agentId}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="bg-gray-900 px-6 flex gap-4 border-b border-gray-700">
            <button
              onClick={() => setActiveTab('tasks')}
              className={`px-4 py-3 font-medium transition-colors border-b-2 ${
                activeTab === 'tasks'
                  ? 'text-brand border-brand'
                  : 'text-gray-400 border-transparent hover:text-white'
              }`}
            >
              Tasks ({tasks.length})
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-3 font-medium transition-colors border-b-2 ${
                activeTab === 'logs'
                  ? 'text-brand border-brand'
                  : 'text-gray-400 border-transparent hover:text-white'
              }`}
            >
              Logs ({logs.length})
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full"
                />
              </div>
            ) : (
              <>
                {/* Tasks Tab */}
                {activeTab === 'tasks' && (
                  <div className="space-y-3">
                    {tasks.length === 0 ? (
                      <p className="text-gray-400 text-center py-8">No tasks yet</p>
                    ) : (
                      tasks.map((task) => (
                        <motion.div
                          key={task.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-gray-900 rounded-lg p-4 border border-gray-700"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <p className="text-white font-medium">{task.description}</p>
                              <p className="text-gray-400 text-sm mt-1">
                                {formatTimestamp(task.createdAt)}
                                {task.completedAt && ` • ${formatDuration(task.createdAt, task.completedAt)}`}
                              </p>
                            </div>
                            <span
                              className="px-3 py-1 rounded-full text-xs font-medium"
                              style={{
                                backgroundColor: STATUS_COLORS[task.status] + '20',
                                color: STATUS_COLORS[task.status],
                              }}
                            >
                              {task.status.replace('_', ' ')}
                            </span>
                          </div>

                          {task.result && (
                            <div className="mt-3 p-3 bg-gray-800 rounded text-sm text-gray-300">
                              <p className="text-gray-400 text-xs mb-1">Result:</p>
                              {task.result}
                            </div>
                          )}

                          {task.error && (
                            <div className="mt-3 p-3 bg-red-500 bg-opacity-10 border border-red-500 rounded text-sm text-red-400">
                              <p className="text-red-300 text-xs mb-1">Error:</p>
                              {task.error}
                            </div>
                          )}
                        </motion.div>
                      ))
                    )}
                  </div>
                )}

                {/* Logs Tab */}
                {activeTab === 'logs' && (
                  <div className="space-y-2">
                    {logs.length === 0 ? (
                      <p className="text-gray-400 text-center py-8">No logs yet</p>
                    ) : (
                      logs.map((log) => (
                        <motion.div
                          key={log.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="bg-gray-900 rounded-lg p-3 border-l-4"
                          style={{ borderColor: LEVEL_COLORS[log.level] }}
                        >
                          <div className="flex items-start gap-3">
                            <div className="text-xs text-gray-400 whitespace-nowrap">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </div>
                            {log.actionType && (
                              <span className="px-2 py-0.5 bg-gray-800 rounded text-xs text-gray-300">
                                {log.actionType}
                              </span>
                            )}
                            <p className="text-white text-sm flex-1">{log.message}</p>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
