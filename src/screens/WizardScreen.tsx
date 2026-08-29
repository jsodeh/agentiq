import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { getAllAgents, getAgentById } from '../agents/registry';
import { AgentDefinition } from '../agents/types';
import { useStore } from '../store';
import { invoke } from '@tauri-apps/api/core';

export default function WizardScreen() {
  const navigate = useNavigate();
  const { addAgent } = useStore();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  // Selected template (null means custom agent)
  const [selectedTemplate, setSelectedTemplate] = useState<AgentDefinition | null>(null);
  const [isCustomMode, setIsCustomMode] = useState(false);

  // Form configuration state
  const [agentName, setAgentName] = useState('');
  const [agentCategory, setAgentCategory] = useState('General');
  const [agentIcon, setAgentIcon] = useState('🤖');
  const [agentDescription, setAgentDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [enableBrowser, setEnableBrowser] = useState(false);
  const [enableVoice, setEnableVoice] = useState(false);
  const [autonomyLevel, setAutonomyLevel] = useState<'low' | 'medium' | 'high'>('medium');
  const [escalationThreshold, setEscalationThreshold] = useState<number>(75);
  const [isSaving, setIsSaving] = useState(false);

  const allTemplates = useMemo(() => getAllAgents(), []);
  const categories = useMemo(() => ['All', ...Array.from(new Set(allTemplates.map(a => a.category)))], [allTemplates]);

  const filteredTemplates = useMemo(() => {
    return allTemplates.filter(t => {
      const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            t.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat = selectedCategory === 'All' || t.category === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [allTemplates, searchQuery, selectedCategory]);

  const handleSelectTemplate = (template: AgentDefinition) => {
    setSelectedTemplate(template);
    setIsCustomMode(false);
    setAgentName(template.name);
    setAgentCategory(template.category);
    setAgentIcon(template.icon || '🤖');
    setAgentDescription(template.description);
    setSystemPrompt(template.systemPrompt);
    setSelectedTools(template.composioTools || template.tools || []);
    setEnableBrowser(template.category === 'Research' || template.category === 'Sales');
    setStep(2);
  };

  const handleSelectCustom = () => {
    setSelectedTemplate(null);
    setIsCustomMode(true);
    setAgentName('My Custom Assistant');
    setAgentCategory('Custom');
    setAgentIcon('⚡');
    setAgentDescription('Custom autonomous assistant configured with specialized instructions.');
    setSystemPrompt('You are a helpful, precise, and proactive AI specialist. Follow instructions carefully and execute assigned tasks efficiently.');
    setSelectedTools([]);
    setEnableBrowser(false);
    setStep(2);
  };

  const handleCreateAgent = async (startImmediately: boolean = false) => {
    setIsSaving(true);
    try {
      const newAgentId = Date.now() + Math.floor(Math.random() * 1000);
      const agentConfig = {
        templateId: selectedTemplate?.id || 'custom',
        icon: agentIcon,
        description: agentDescription,
        systemPrompt,
        tools: selectedTools,
        enableBrowser,
        enableVoice,
        autonomyLevel,
        escalationThreshold,
      };

      const newAgent = {
        id: newAgentId,
        user_id: 1,
        name: agentName || 'Unnamed Agent',
        type: agentCategory,
        status: (startImmediately ? 'active' : 'stopped') as 'active' | 'stopped',
        config: JSON.stringify(agentConfig),
        created_at: new Date().toISOString(),
      };

      // 1. Add to Zustand store
      addAgent(newAgent);

      // 2. Persist in localStorage
      const existing = JSON.parse(localStorage.getItem('agentiq_agents') || '[]');
      localStorage.setItem('agentiq_agents', JSON.stringify([...existing, newAgent]));
      
      // Update selected_agents list
      const selectedIds = JSON.parse(localStorage.getItem('selected_agents') || '[]');
      if (selectedTemplate?.id && !selectedIds.includes(selectedTemplate.id)) {
        localStorage.setItem('selected_agents', JSON.stringify([...selectedIds, selectedTemplate.id]));
      }

      // 3. Invoke Tauri backend if available
      try {
        await invoke('save_agent_configs', { configs: { [newAgentId.toString()]: agentConfig } });
        if (startImmediately) {
          await invoke('start_agent', { agentId: newAgentId });
        }
      } catch (err) {
        console.warn('Tauri save command skipped (running in web context or fallback):', err);
      }

      navigate('/');
    } catch (error) {
      console.error('Failed to create agent:', error);
      alert('Failed to save agent configuration.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark text-white p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        {/* Header with Navigation & Progress */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-midGray/40">
          <div>
            <button
              onClick={() => navigate('/')}
              className="text-midGray hover:text-white transition-colors text-sm mb-2 flex items-center gap-1"
            >
              ← Back to Dashboard
            </button>
            <h1 className="text-3xl font-bold">
              {step === 1 && 'Choose Agent Template'}
              {step === 2 && `Configure ${agentName || 'Agent'}`}
              {step === 3 && 'Review & Activate'}
            </h1>
            <p className="text-midGray text-sm mt-1">
              {step === 1 && 'Select from 55+ pre-configured AI specialists or create a custom agent'}
              {step === 2 && 'Fine-tune prompts, capabilities, tool integrations, and safety rules'}
              {step === 3 && 'Review specifications before launching'}
            </p>
          </div>

          {/* Stepper pills */}
          <div className="flex items-center gap-2">
            {[
              { num: 1, label: 'Template' },
              { num: 2, label: 'Configure' },
              { num: 3, label: 'Review' },
            ].map(({ num, label }) => (
              <div
                key={num}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  step === num
                    ? 'bg-brand text-white shadow-md shadow-brand/30'
                    : step > num
                    ? 'bg-accent/20 text-accent border border-accent/40'
                    : 'bg-midGray/20 text-midGray'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-dark/40 flex items-center justify-center text-[10px]">
                  {num}
                </span>
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: Template Selection */}
        {step === 1 && (
          <div>
            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search 55+ agent templates (e.g. Sales, WhatsApp, Invoice, SEO, Coder)..."
                  className="w-full pl-11 pr-4 py-3 bg-dark border border-midGray rounded-xl text-white placeholder-midGray focus:border-brand outline-none transition-colors"
                />
                <span className="absolute left-4 top-3.5 text-midGray text-lg">🔍</span>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                      selectedCategory === cat
                        ? 'bg-brand text-white'
                        : 'bg-dark border border-midGray text-midGray hover:border-brand hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Template Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {/* Create Custom Card */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSelectCustom}
                className="p-6 bg-gradient-to-br from-brand/20 via-dark to-dark border-2 border-dashed border-brand/60 hover:border-brand rounded-2xl text-left transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">✨</div>
                  <h3 className="text-lg font-bold text-white mb-1">Create Custom Agent</h3>
                  <p className="text-xs text-midGray mb-4">
                    Build an agent from scratch with custom instructions, prompt templates, and integrations.
                  </p>
                </div>
                <div className="text-xs font-semibold text-brand flex items-center gap-1">
                  Build Custom →
                </div>
              </motion.button>

              {/* 55 Registered Templates */}
              {filteredTemplates.map((template) => {
                const toolCount = (template.composioTools || template.tools || []).length;
                return (
                  <motion.button
                    key={template.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSelectTemplate(template)}
                    className="p-5 bg-dark border border-midGray hover:border-brand rounded-2xl text-left transition-all flex flex-col justify-between hover:shadow-lg hover:shadow-brand/10 group"
                  >
                    <div>
                      <div className="flex items-start justify-between mb-3">
                        <span className="text-3xl p-2 bg-dark/60 border border-midGray/40 rounded-xl group-hover:border-brand transition-colors">
                          {template.icon || '🤖'}
                        </span>
                        <span className="px-2.5 py-1 bg-midGray/20 text-midGray group-hover:text-white rounded-lg text-[11px] font-medium transition-colors">
                          {template.category}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-white mb-1 group-hover:text-brand transition-colors">
                        {template.name}
                      </h3>
                      <p className="text-xs text-midGray line-clamp-2 mb-4 leading-relaxed">
                        {template.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-midGray/30 text-[11px] text-midGray">
                      <span>{toolCount > 0 ? `⚡ ${toolCount} tools wired` : '💡 Reasoning Agent'}</span>
                      <span className="font-semibold text-brand group-hover:translate-x-1 transition-transform">
                        Select →
                      </span>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2: Configuration */}
        {step === 2 && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Prompt & Details (2 columns) */}
              <div className="lg:col-span-2 space-y-6 bg-dark border border-midGray rounded-2xl p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-midGray uppercase mb-2">Agent Name</label>
                    <input
                      type="text"
                      value={agentName}
                      onChange={(e) => setAgentName(e.target.value)}
                      placeholder="e.g. Lead Generation Specialist"
                      className="w-full px-4 py-2.5 bg-dark border border-midGray rounded-xl text-white focus:border-brand outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-midGray uppercase mb-2">Icon</label>
                    <input
                      type="text"
                      value={agentIcon}
                      onChange={(e) => setAgentIcon(e.target.value)}
                      className="w-full px-4 py-2.5 bg-dark border border-midGray rounded-xl text-white text-center text-xl focus:border-brand outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-midGray uppercase mb-2">Description</label>
                  <input
                    type="text"
                    value={agentDescription}
                    onChange={(e) => setAgentDescription(e.target.value)}
                    placeholder="Short summary of what this agent does"
                    className="w-full px-4 py-2.5 bg-dark border border-midGray rounded-xl text-white focus:border-brand outline-none text-sm"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-midGray uppercase">System Instructions / Prompt</label>
                    <span className="text-[11px] text-midGray">Defines reasoning & behavior</span>
                  </div>
                  <textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    rows={10}
                    className="w-full p-4 bg-dark border border-midGray rounded-xl text-white font-mono text-xs focus:border-brand outline-none leading-relaxed resize-y"
                    placeholder="Provide detailed instructions on how the agent should analyze tasks, execute steps, and format answers..."
                  />
                </div>
              </div>

              {/* Capabilities, Autonomy & Safety (1 column) */}
              <div className="space-y-6">
                {/* Autonomy Level */}
                <div className="bg-dark border border-midGray rounded-2xl p-6 space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-midGray">Autonomy Level</h3>
                  <div className="space-y-2">
                    {[
                      { level: 'low', title: 'Low Autonomy', desc: 'Always request user confirmation before actions' },
                      { level: 'medium', title: 'Medium Autonomy', desc: 'Execute safe actions, confirm for sensitive tasks' },
                      { level: 'high', title: 'High Autonomy', desc: 'Execute end-to-end task loops automatically' },
                    ].map(({ level, title, desc }) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setAutonomyLevel(level as any)}
                        className={`w-full p-3 rounded-xl text-left border transition-all ${
                          autonomyLevel === level
                            ? 'bg-brand/20 border-brand text-white shadow-md shadow-brand/10'
                            : 'border-midGray/60 hover:border-brand/60 text-midGray'
                        }`}
                      >
                        <div className="text-xs font-bold text-white">{title}</div>
                        <div className="text-[11px] opacity-80 mt-0.5">{desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Capabilities & Tools */}
                <div className="bg-dark border border-midGray rounded-2xl p-6 space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-midGray">Capabilities & Tools</h3>
                  
                  {/* Browser Use Toggle */}
                  <div className="flex items-center justify-between p-3 bg-dark/60 border border-midGray/60 rounded-xl">
                    <div>
                      <div className="text-xs font-bold text-white">🌐 Computer Use & Browser</div>
                      <div className="text-[11px] text-midGray">Automate web navigation & screen capture</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEnableBrowser(!enableBrowser)}
                      className={`w-11 h-6 rounded-full transition-colors relative ${
                        enableBrowser ? 'bg-brand' : 'bg-midGray'
                      }`}
                    >
                      <span
                        className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                          enableBrowser ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Voice Capability Toggle */}
                  <div className="flex items-center justify-between p-3 bg-dark/60 border border-midGray/60 rounded-xl">
                    <div>
                      <div className="text-xs font-bold text-white">🎙️ Voice STT / TTS</div>
                      <div className="text-[11px] text-midGray">Audio transcription & voice synthesis</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEnableVoice(!enableVoice)}
                      className={`w-11 h-6 rounded-full transition-colors relative ${
                        enableVoice ? 'bg-brand' : 'bg-midGray'
                      }`}
                    >
                      <span
                        className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                          enableVoice ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Pre-configured Tools List */}
                  {selectedTools.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-midGray mb-2">Composio Integrations ({selectedTools.length})</div>
                      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                        {selectedTools.map((tool) => (
                          <span
                            key={tool}
                            className="px-2 py-1 bg-brand/10 border border-brand/30 text-brand rounded-lg text-[10px] font-mono"
                          >
                            {tool}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center pt-4">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-2.5 border border-midGray hover:border-brand text-white rounded-xl transition-colors text-sm font-medium"
              >
                ← Back to Templates
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!agentName.trim()}
                className="px-8 py-2.5 bg-brand hover:bg-opacity-80 disabled:opacity-50 text-white rounded-xl transition-colors text-sm font-semibold shadow-lg shadow-brand/20"
              >
                Proceed to Review →
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Review & Launch */}
        {step === 3 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-2xl mx-auto space-y-6"
          >
            <div className="bg-dark border border-midGray rounded-2xl p-8 shadow-xl space-y-6">
              <div className="flex items-center gap-4 pb-6 border-b border-midGray/40">
                <span className="text-5xl p-3 bg-dark/60 border border-brand/40 rounded-2xl shadow-inner">
                  {agentIcon}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold text-white">{agentName}</h2>
                    <span className="px-2.5 py-0.5 bg-brand/20 border border-brand/40 text-brand rounded-full text-xs font-semibold">
                      {agentCategory}
                    </span>
                  </div>
                  <p className="text-sm text-midGray mt-1">{agentDescription}</p>
                </div>
              </div>

              {/* Summary specifications */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="p-3 bg-dark/40 border border-midGray/40 rounded-xl">
                  <div className="text-midGray mb-1 uppercase font-semibold">Autonomy Mode</div>
                  <div className="text-white font-bold capitalize">{autonomyLevel} Autonomy</div>
                </div>
                <div className="p-3 bg-dark/40 border border-midGray/40 rounded-xl">
                  <div className="text-midGray mb-1 uppercase font-semibold">Browser & Computer Use</div>
                  <div className="text-white font-bold">{enableBrowser ? '✅ Enabled' : '❌ Disabled'}</div>
                </div>
                <div className="p-3 bg-dark/40 border border-midGray/40 rounded-xl">
                  <div className="text-midGray mb-1 uppercase font-semibold">Voice Processing</div>
                  <div className="text-white font-bold">{enableVoice ? '🎙️ Active' : '❌ Disabled'}</div>
                </div>
                <div className="p-3 bg-dark/40 border border-midGray/40 rounded-xl">
                  <div className="text-midGray mb-1 uppercase font-semibold">Tool Integrations</div>
                  <div className="text-white font-bold">{selectedTools.length} tools configured</div>
                </div>
              </div>

              {/* Prompt snippet */}
              <div className="p-4 bg-dark/60 border border-midGray/40 rounded-xl space-y-2">
                <div className="text-xs font-semibold text-midGray uppercase">Instructions Snapshot</div>
                <p className="text-xs font-mono text-midGray line-clamp-3 leading-relaxed">
                  {systemPrompt}
                </p>
              </div>
            </div>

            {/* Launch Buttons */}
            <div className="flex flex-col sm:flex-row justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-6 py-3 border border-midGray hover:border-brand text-white rounded-xl transition-colors text-sm font-medium"
              >
                ← Back to Edit
              </button>
              
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleCreateAgent(false)}
                  className="px-6 py-3 bg-dark border border-midGray hover:border-brand text-white rounded-xl transition-colors text-sm font-semibold"
                >
                  Save as Idle
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleCreateAgent(true)}
                  className="px-8 py-3 bg-gradient-to-r from-brand to-accent hover:opacity-90 text-white rounded-xl transition-all text-sm font-bold shadow-lg shadow-brand/30"
                >
                  {isSaving ? 'Creating Agent...' : '🚀 Create & Activate Now'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
