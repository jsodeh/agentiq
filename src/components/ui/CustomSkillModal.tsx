import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, X, Plus, CheckCircle, Code, Bot, Wrench } from 'lucide-react';

interface CustomSkillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export function CustomSkillModal({ isOpen, onClose, onCreated }: CustomSkillModalProps) {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('marketing');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [tools, setTools] = useState('web_search, read_file, write_file');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim() || !description.trim() || !systemPrompt.trim()) {
      setStatusMsg('Please fill in Name, Description, and System Prompt.');
      return;
    }

    const generatedId = id.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const toolsArray = tools
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const configPayload = [
      {
        id: generatedId,
        name: name.trim(),
        category: category.trim(),
        description: description.trim(),
        systemPrompt: systemPrompt.trim(),
        tools: toolsArray,
        version: '1.0.0',
        author: 'User',
      },
    ];

    try {
      // Save config to rust backend which writes JSON to plugin dir / agent registry
      await invoke('save_agent_configs', {
        configsJson: JSON.stringify(configPayload, null, 2),
      });

      setStatusMsg(`Sub-agent '${name}' created and activated!`);
      setId('');
      setName('');
      setDescription('');
      setSystemPrompt('');

      if (onCreated) onCreated();

      setTimeout(() => {
        setStatusMsg(null);
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Failed to create custom agent/skill:', err);
      setStatusMsg('Error saving custom skill.');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/70 backdrop-blur-md"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#181818] text-white shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 bg-[#282828] px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-xl bg-accent/20 text-accent">
                <Sparkles className="size-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Create Custom Sub-Agent & Skill</h2>
                <p className="text-xs text-[#a0a0a8]">
                  Extend AgentIQ dynamically with custom business capabilities & behaviors
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="grid size-8 place-items-center rounded-lg text-gray-400 hover:bg-white/10 hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Status Message */}
          {statusMsg && (
            <div className="flex items-center gap-2 border-b border-accent/30 bg-accent/20 px-6 py-2.5 text-xs font-semibold text-accent">
              <CheckCircle className="size-4" />
              {statusMsg}
            </div>
          )}

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Agent / Skill Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Tiktok Growth Strategist"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-[#282828] px-3 py-2 text-xs text-white outline-none focus:border-accent"
                >
                  <option value="marketing">Marketing & Growth</option>
                  <option value="content">Content & Social Media</option>
                  <option value="sales">Sales & Outreach</option>
                  <option value="finance">Finance & Pricing</option>
                  <option value="strategy">Business Strategy</option>
                  <option value="technical">Engineering & Technical</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Description (When to use this agent)</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Crafts viral TikTok scripts, hooks, and trend analysis for retail brands"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Required Tools (Comma separated)
              </label>
              <div className="relative">
                <Wrench className="absolute left-2.5 top-2.5 size-3.5 text-gray-500" />
                <input
                  type="text"
                  value={tools}
                  onChange={(e) => setTools(e.target.value)}
                  placeholder="web_search, read_file, write_file, browser_open_url"
                  className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-8 pr-3 text-xs text-white placeholder-gray-500 outline-none focus:border-accent"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Specialized System Instructions & Prompt
              </label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={8}
                placeholder="You are a elite TikTok Growth Specialist. Your goal is to maximize engagement, hook retention, and brand conversions..."
                className="w-full rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-white placeholder-gray-500 outline-none focus:border-accent font-mono"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-white/10 bg-[#282828] px-6 py-4">
            <p className="text-[11px] text-gray-400">
              Saved instantly to your local plugin registry without restarting.
            </p>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-5 py-2 text-xs font-semibold text-white hover:opacity-90 shadow-lg shadow-accent/20"
              >
                <Plus className="size-3.5" /> Save Agent
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
