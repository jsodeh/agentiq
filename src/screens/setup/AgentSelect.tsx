import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useStore } from '../../store';
import { getAllAgents } from '../../agents/registry';

export default function AgentSelect() {
  const navigate = useNavigate();
  const { addAgent } = useStore();
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');

  const AGENT_TYPES = useMemo(() => {
    return getAllAgents().map(agent => ({
      id: agent.id,
      name: agent.name,
      category: agent.category,
      icon: agent.icon || '🤖',
      description: agent.description,
      whatItDoes: agent.whatItDoes || agent.description,
    }));
  }, []);


  const categories = ['All', ...Array.from(new Set(AGENT_TYPES.map(a => a.category)))];

  const filteredAgents = AGENT_TYPES.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(filter.toLowerCase()) ||
                         agent.description.toLowerCase().includes(filter.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || agent.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const toggleAgent = (agentId: string) => {
    const newSelected = new Set(selectedAgents);
    if (newSelected.has(agentId)) {
      newSelected.delete(agentId);
    } else {
      newSelected.add(agentId);
    }
    setSelectedAgents(newSelected);
  };

  const handleComplete = async () => {
    if (selectedAgents.size === 0) {
      alert('Please select at least one agent');
      return;
    }

    // Save to Zustand and persistent storage
    const selectedAgentData = AGENT_TYPES.filter(a => selectedAgents.has(a.id));
    const newAgents: any[] = [];
    
    for (const agent of selectedAgentData) {
      const newAgent = {
        id: Date.now() + Math.floor(Math.random() * 10000),
        user_id: 1,
        name: agent.name,
        type: agent.category,
        status: 'stopped' as const,
        config: JSON.stringify({
          agentType: agent.id,
          icon: agent.icon,
          description: agent.description,
          whatItDoes: agent.whatItDoes,
        }),
        created_at: new Date().toISOString(),
      };
      addAgent(newAgent);
      newAgents.push(newAgent);
    }

    // Save to localStorage
    const existing = JSON.parse(localStorage.getItem('agentiq_agents') || '[]');
    localStorage.setItem('agentiq_agents', JSON.stringify([...existing, ...newAgents]));
    localStorage.setItem('selected_agents', JSON.stringify(Array.from(selectedAgents)));

    navigate('/setup/integrations');
  };

  return (
    <div className="min-h-screen bg-dark p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto"
      >
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">Select Your Agents</h1>
          <p className="text-xl text-midGray">Choose the AI agents you want to activate</p>
          <p className="text-sm text-midGray mt-2">
            {selectedAgents.size} agent{selectedAgents.size !== 1 ? 's' : ''} selected
          </p>
        </div>

        {/* Filters */}
        <div className="mb-8 space-y-4">
          <input
            type="text"
            placeholder="Search agents..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full px-4 py-3 bg-dark border border-midGray rounded-lg text-white focus:border-brand outline-none"
          />

          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setCategoryFilter(category)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  categoryFilter === category
                    ? 'bg-brand text-white'
                    : 'bg-dark border border-midGray text-midGray hover:border-brand'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Agent Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
          {filteredAgents.map((agent, index) => (
            <motion.button
              key={agent.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.02 }}
              onClick={() => toggleAgent(agent.id)}
              className={`bg-dark border-2 rounded-xl p-4 text-left transition-all hover:scale-105 ${
                selectedAgents.has(agent.id)
                  ? 'border-brand shadow-lg shadow-brand/20'
                  : 'border-midGray hover:border-brand'
              }`}
              title={agent.whatItDoes}
            >
              <div className="flex items-start gap-3 mb-3">
                <span className="text-3xl">{agent.icon}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-semibold text-sm mb-1 truncate">
                    {agent.name}
                  </h3>
                  <p className="text-xs text-midGray line-clamp-2">
                    {agent.description}
                  </p>
                </div>
              </div>

              {selectedAgents.has(agent.id) && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="flex items-center justify-center"
                >
                  <svg className="w-5 h-5 text-brand" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </motion.div>
              )}
            </motion.button>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center">
          <button
            onClick={() => navigate('/setup/model-select')}
            className="px-6 py-3 border border-midGray hover:border-brand text-white rounded-lg transition-colors"
          >
            ← Back
          </button>

          <button
            onClick={handleComplete}
            disabled={selectedAgents.size === 0}
            className="px-8 py-3 bg-brand hover:bg-opacity-80 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-semibold"
          >
            Continue to Integrations →
          </button>
        </div>
      </motion.div>
    </div>
  );
}
