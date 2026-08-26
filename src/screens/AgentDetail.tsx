import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import TaskList from '../components/TaskList';
import LogViewer from '../components/LogViewer';
import type { Agent, Task, Log } from '../types';

export default function AgentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [activeTab, setActiveTab] = useState<'tasks' | 'logs'>('tasks');

  useEffect(() => {
    if (id) {
      setAgent({
        id: Number(id),
        user_id: 1,
        name: `Agent #${id}`,
        type: 'General',
        status: 'active',
        config: '{}',
        created_at: new Date().toISOString(),
      });
      setTasks([]);
      setLogs([]);
    }
  }, [id]);

  if (!agent) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <p className="text-midGray">Loading agent...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark p-8">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-5xl mx-auto"
      >
        <button
          onClick={() => navigate('/')}
          className="text-midGray hover:text-white mb-6 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </button>

        <div className="bg-dark border border-midGray rounded-lg p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">{agent.name}</h1>
              <p className="text-midGray">{agent.type}</p>
            </div>
            <div className={`px-4 py-2 rounded-full text-sm font-medium ${
              agent.status === 'active' ? 'bg-accent text-dark' : 'bg-midGray text-white'
            }`}>
              {agent.status}
            </div>
          </div>

          <div className="flex gap-3">
            <button className="px-4 py-2 bg-brand hover:bg-opacity-80 text-white rounded-md transition-colors">
              {agent.status === 'active' ? 'Stop Agent' : 'Start Agent'}
            </button>
            <button className="px-4 py-2 border border-midGray hover:border-brand text-white rounded-md transition-colors">
              Configure
            </button>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex gap-4 border-b border-midGray">
            <button
              onClick={() => setActiveTab('tasks')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'tasks'
                  ? 'text-brand border-b-2 border-brand'
                  : 'text-midGray hover:text-white'
              }`}
            >
              Tasks
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'logs'
                  ? 'text-brand border-b-2 border-brand'
                  : 'text-midGray hover:text-white'
              }`}
            >
              Logs
            </button>
          </div>
        </div>

        {activeTab === 'tasks' && <TaskList tasks={tasks} />}
        {activeTab === 'logs' && <LogViewer logs={logs} />}
      </motion.div>
    </div>
  );
}
