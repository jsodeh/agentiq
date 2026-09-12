import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { 
  Bot, 
  Brain, 
  Check, 
  Cpu, 
  Globe, 
  Key, 
  Lock, 
  Save, 
  Settings2, 
  ShieldCheck, 
  Sparkles, 
  Terminal, 
  User, 
  Wrench, 
  X 
} from 'lucide-react';

export interface AppConfig {
  mode: 'cloud' | 'local';
  models: {
    default_model: string;
    local_base_model: string;
    cloud_provider: string;
    cloud_model: string;
    anthropic_api_key?: string;
    openai_api_key?: string;
    gemini_api_key?: string;
    custom_endpoint?: string;
  };
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'models' | 'agents' | 'tools' | 'profile'>('models');
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Form state
  const [mode, setMode] = useState<'cloud' | 'local'>('cloud');
  const [cloudProvider, setCloudProvider] = useState<string>('anthropic');
  const [cloudModel, setCloudModel] = useState<string>('claude-3-5-sonnet-20241022');
  const [localModel, setLocalModel] = useState<string>('llama3.2:3b');
  const [anthropicKey, setAnthropicKey] = useState<string>('');
  const [openaiKey, setOpenaiKey] = useState<string>('');
  const [geminiKey, setGeminiKey] = useState<string>('');
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);

  // Agent behaviors state
  const [selectedAgent, setSelectedAgent] = useState<string>('lead-gen-maps');
  const [autonomyLevel, setAutonomyLevel] = useState<'full' | 'approval'>('approval');

  // Tools state
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);
  const [browserAutomationEnabled, setBrowserAutomationEnabled] = useState(true);
  const [mcpEnabled, setMcpEnabled] = useState(true);

  // User Profile
  const profile = (() => {
    try {
      return JSON.parse(localStorage.getItem('user_profile') || '{}');
    } catch {
      return {};
    }
  })();
  const deploymentMode = localStorage.getItem('deployment_mode') || 'cloud';
  const subTier = localStorage.getItem('subscription_tier') || 'Free';

  // Load existing config on mount
  useEffect(() => {
    if (!isOpen) return;

    const loadConfig = async () => {
      setLoading(true);
      try {
        if (typeof window !== 'undefined' && (window as any).__TAURI__) {
          const cfg = await invoke<AppConfig>('get_llm_config');
          if (cfg) {
            setMode(cfg.mode || 'cloud');
            setCloudProvider(cfg.models.cloud_provider || 'anthropic');
            setCloudModel(cfg.models.cloud_model || 'claude-3-5-sonnet-20241022');
            setLocalModel(cfg.models.local_base_model || 'llama3.2:3b');
            setAnthropicKey(cfg.models.anthropic_api_key || '');
            setOpenaiKey(cfg.models.openai_api_key || '');
            setGeminiKey(cfg.models.gemini_api_key || '');
          }
        }
      } catch (err) {
        console.warn('[Settings] Failed to fetch backend config, using defaults:', err);
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, [isOpen]);

  const handleCloudProviderChange = (provider: string) => {
    setCloudProvider(provider);
    if (provider === 'anthropic') {
      setCloudModel('claude-3-5-sonnet-20241022');
    } else if (provider === 'openai') {
      setCloudModel('gpt-4o');
    } else if (provider === 'gemini') {
      setCloudModel('gemini-3.6-flash');
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setSaveSuccess(false);
    setSaveError(null);

    const payload = {
      mode,
      models: {
        default_model: mode === 'cloud' ? cloudModel : localModel,
        local_base_model: localModel,
        cloud_provider: cloudProvider,
        cloud_model: cloudModel,
        anthropic_api_key: anthropicKey || null,
        openai_api_key: openaiKey || null,
        gemini_api_key: geminiKey || null,
        custom_endpoint: null,
      }
    };

    console.log('[Settings] Saving payload:', JSON.stringify(payload, (k, v) =>
      k.includes('key') && v ? '***' : v
    ));

    try {
      if (typeof window !== 'undefined' && (window as any).__TAURI__) {
        const result = await invoke('update_llm_config', payload);
        console.log('[Settings] Save result:', result);
      }

      // Persist in localStorage as well
      localStorage.setItem('deployment_mode', mode);
      localStorage.setItem('selected_model', mode === 'cloud' ? cloudModel : localModel);

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      const errMsg = String(err);
      console.error('[Settings] Failed to save settings:', errMsg);
      setSaveError(errMsg);
      setTimeout(() => setSaveError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative flex h-[82vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-[#12131e] text-white shadow-2xl"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 z-20 rounded-lg p-1.5 text-midGray transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="size-5" />
          </button>

          {/* Left Navigation Sidebar */}
          <aside className="w-60 border-r border-white/10 bg-[#0c0d16] p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 px-2 py-3 mb-4">
                <div className="grid size-8 place-items-center rounded-xl bg-brand/20 text-brand">
                  <Settings2 className="size-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold tracking-tight text-white">Settings</h2>
                  <p className="text-[10px] text-midGray">Workspace &amp; Agent Core</p>
                </div>
              </div>

              <nav className="space-y-1">
                <button
                  onClick={() => setActiveTab('models')}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors ${
                    activeTab === 'models' ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'text-midGray hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Cpu className="size-4" /> AI Models &amp; Provider
                </button>

                <button
                  onClick={() => setActiveTab('agents')}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors ${
                    activeTab === 'agents' ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'text-midGray hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Bot className="size-4" /> Agent Behaviors
                </button>

                <button
                  onClick={() => setActiveTab('tools')}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors ${
                    activeTab === 'tools' ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'text-midGray hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Wrench className="size-4" /> Tools &amp; MCP
                </button>

                <button
                  onClick={() => setActiveTab('profile')}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors ${
                    activeTab === 'profile' ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'text-midGray hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <User className="size-4" /> Profile &amp; Plan
                </button>
              </nav>
            </div>

            {/* Save Status Footer */}
            <div className="pt-4 border-t border-white/10 space-y-2">
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-dark transition-all hover:bg-accent/90 disabled:opacity-50"
              >
                {saveSuccess ? (
                  <>
                    <Check className="size-4 text-dark" /> Saved!
                  </>
                ) : (
                  <>
                    <Save className="size-4" /> {loading ? 'Saving…' : 'Save Settings'}
                  </>
                )}
              </button>
              {saveError && (
                <p className="rounded-lg bg-red-900/40 border border-red-500/40 px-3 py-2 text-[10px] text-red-300 leading-relaxed">
                  ⚠️ {saveError}
                </p>
              )}
            </div>
          </aside>

          {/* Right Tab Content Area */}
          <main className="flex-1 overflow-y-auto p-6">
            {/* TAB 1: AI MODELS & PROVIDERS */}
            {activeTab === 'models' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Cpu className="size-5 text-brand" /> AI Model Configuration
                  </h3>
                  <p className="text-xs text-midGray mt-1">
                    Select your primary execution mode and configure API keys or local base models.
                  </p>
                </div>

                {/* Mode Selector Toggle */}
                <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-black/40 p-1.5">
                  <button
                    type="button"
                    onClick={() => setMode('cloud')}
                    className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all ${
                      mode === 'cloud' ? 'bg-brand text-white shadow-md' : 'text-midGray hover:text-white'
                    }`}
                  >
                    <Globe className="size-4" /> Cloud Mode (Anthropic / OpenAI / Gemini)
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode('local')}
                    className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all ${
                      mode === 'local' ? 'bg-brand text-white shadow-md' : 'text-midGray hover:text-white'
                    }`}
                  >
                    <Terminal className="size-4" /> Local Mode (Ollama)
                  </button>
                </div>

                {/* Cloud Mode Settings */}
                {mode === 'cloud' && (
                  <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-brand">Cloud Model Settings</h4>
                    
                    {/* Cloud Provider Select */}
                    <div>
                      <label className="block text-xs font-semibold text-midGray mb-1.5">Cloud Provider</label>
                      <select
                        value={cloudProvider}
                        onChange={(e) => handleCloudProviderChange(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-xs text-white outline-none focus:border-brand"
                      >
                        <option value="anthropic">Anthropic (Claude)</option>
                        <option value="openai">OpenAI (ChatGPT)</option>
                        <option value="gemini">Google (Gemini)</option>
                      </select>
                    </div>

                    {/* Model Choice */}
                    <div>
                      <label className="block text-xs font-semibold text-midGray mb-1.5">Selected Cloud Model</label>
                      <select
                        value={cloudModel}
                        onChange={(e) => setCloudModel(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-xs text-white outline-none focus:border-brand"
                      >
                        {cloudProvider === 'anthropic' && (
                          <>
                            <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet (Recommended)</option>
                            <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku (Fast)</option>
                            <option value="claude-3-opus-20240229">Claude 3 Opus (Complex reasoning)</option>
                          </>
                        )}
                        {cloudProvider === 'openai' && (
                          <>
                            <option value="gpt-4o">GPT-4o (Omni)</option>
                            <option value="gpt-4o-mini">GPT-4o Mini (Fast)</option>
                            <option value="o1-preview">o1 Preview (Reasoning)</option>
                          </>
                        )}
                        {cloudProvider === 'gemini' && (
                          <>
                            <option value="gemini-3.6-flash">Gemini 3.6 Flash (Recommended)</option>
                            <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
                            <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                            <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                          </>
                        )}
                      </select>
                    </div>

                    {/* Anthropic Key */}
                    {cloudProvider === 'anthropic' && (
                      <div>
                        <label className="block text-xs font-semibold text-midGray mb-1.5 flex items-center justify-between">
                          <span>Anthropic API Key</span>
                          <span className="text-[10px] text-accent">Stored securely in config</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showAnthropicKey ? 'text' : 'password'}
                            value={anthropicKey}
                            onChange={(e) => setAnthropicKey(e.target.value)}
                            placeholder="sk-ant-api03-..."
                            className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 pr-10 text-xs text-white outline-none focus:border-brand font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                            className="absolute right-3 top-2.5 text-midGray hover:text-white"
                          >
                            <Key className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* OpenAI Key */}
                    {cloudProvider === 'openai' && (
                      <div>
                        <label className="block text-xs font-semibold text-midGray mb-1.5 flex items-center justify-between">
                          <span>OpenAI API Key</span>
                          <span className="text-[10px] text-accent">Stored securely in config</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showOpenaiKey ? 'text' : 'password'}
                            value={openaiKey}
                            onChange={(e) => setOpenaiKey(e.target.value)}
                            placeholder="sk-..."
                            className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 pr-10 text-xs text-white outline-none focus:border-brand font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                            className="absolute right-3 top-2.5 text-midGray hover:text-white"
                          >
                            <Key className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Gemini Key */}
                    {cloudProvider === 'gemini' && (
                      <div>
                        <label className="block text-xs font-semibold text-midGray mb-1.5 flex items-center justify-between">
                          <span>Google Gemini API Key</span>
                          <span className="text-[10px] text-accent">Stored securely in config</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showGeminiKey ? 'text' : 'password'}
                            value={geminiKey}
                            onChange={(e) => setGeminiKey(e.target.value)}
                            placeholder="AIzaSy..."
                            className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 pr-10 text-xs text-white outline-none focus:border-brand font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => setShowGeminiKey(!showGeminiKey)}
                            className="absolute right-3 top-2.5 text-midGray hover:text-white"
                          >
                            <Key className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Local Mode Settings */}
                {mode === 'local' && (
                  <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-accent">Local Model Settings (Ollama)</h4>
                    <div>
                      <label className="block text-xs font-semibold text-midGray mb-1.5">Ollama Model Target</label>
                      <select
                        value={localModel}
                        onChange={(e) => setLocalModel(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-xs text-white outline-none focus:border-accent"
                      >
                        <option value="llama3.2:3b">llama3.2:3b (Default - 2.0 GB)</option>
                        <option value="llama3.1:8b">llama3.1:8b (Higher quality - 4.7 GB)</option>
                        <option value="mistral">mistral:7b (7 GB)</option>
                        <option value="codellama">codellama:7b (Coding specialist)</option>
                        <option value="deepseek-r1:8b">deepseek-r1:8b (Reasoning)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: AGENT BEHAVIORS */}
            {activeTab === 'agents' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Bot className="size-5 text-brand" /> Agent Behaviors &amp; Prompts
                  </h3>
                  <p className="text-xs text-midGray mt-1">
                    Manage agent routing rules, system prompts, and human approval safeguards.
                  </p>
                </div>

                {/* Agent selector */}
                <div>
                  <label className="block text-xs font-semibold text-midGray mb-1.5">Select Agent Plugin</label>
                  <select
                    value={selectedAgent}
                    onChange={(e) => setSelectedAgent(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-xs text-white outline-none focus:border-brand"
                  >
                    <option value="lead-gen-maps">Maps Lead Generator</option>
                    <option value="coder">Code Master</option>
                    <option value="invoice-generator">Smart Invoice Generator</option>
                    <option value="social-media-manager">Social Media Buzzmaker</option>
                    <option value="customer-support-whatsapp">WhatsApp Support Hero</option>
                    <option value="assistant">Executive Assistant (Default)</option>
                  </select>
                </div>

                {/* Safeguard Level */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-brand">Autonomy Safeguards</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setAutonomyLevel('approval')}
                      className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                        autonomyLevel === 'approval' ? 'border-accent bg-accent/10 text-white' : 'border-white/10 bg-black/30 text-midGray'
                      }`}
                    >
                      <span className="text-xs font-bold flex items-center gap-1.5"><ShieldCheck className="size-3.5 text-accent" /> Require Approval</span>
                      <span className="text-[10px] mt-1 opacity-70">Ask before executing financial or filesystem actions</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAutonomyLevel('full')}
                      className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                        autonomyLevel === 'full' ? 'border-brand bg-brand/10 text-white' : 'border-white/10 bg-black/30 text-midGray'
                      }`}
                    >
                      <span className="text-xs font-bold flex items-center gap-1.5"><Sparkles className="size-3.5 text-brand" /> Autonomous</span>
                      <span className="text-[10px] mt-1 opacity-70">Execute all tools automatically without pausing</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: TOOLS & MCP */}
            {activeTab === 'tools' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Wrench className="size-5 text-brand" /> Tools &amp; Model Context Protocol
                  </h3>
                  <p className="text-xs text-midGray mt-1">
                    Toggle active capability integrations and subprocess tools.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/10 bg-white/[0.02]">
                    <div>
                      <h4 className="text-xs font-bold text-white">Model Context Protocol (MCP)</h4>
                      <p className="text-[10px] text-midGray">Connect standard MCP tool servers for Supabase, Slack, GitHub, etc.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={mcpEnabled}
                      onChange={(e) => setMcpEnabled(e.target.checked)}
                      className="size-4 rounded accent-brand"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/10 bg-white/[0.02]">
                    <div>
                      <h4 className="text-xs font-bold text-white">Web Search Tool</h4>
                      <p className="text-[10px] text-midGray">Enable real-time DuckDuckGo web research capability</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={webSearchEnabled}
                      onChange={(e) => setWebSearchEnabled(e.target.checked)}
                      className="size-4 rounded accent-brand"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/10 bg-white/[0.02]">
                    <div>
                      <h4 className="text-xs font-bold text-white">Playwright Browser Automation</h4>
                      <p className="text-[10px] text-midGray">Headless browser CLI runner for page navigation &amp; screenshots</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={browserAutomationEnabled}
                      onChange={(e) => setBrowserAutomationEnabled(e.target.checked)}
                      className="size-4 rounded accent-brand"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: PROFILE & PLAN */}
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <User className="size-5 text-brand" /> Account &amp; Workspace Profile
                  </h3>
                  <p className="text-xs text-midGray mt-1">
                    Your current workspace status and subscription plan.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="grid size-10 place-items-center rounded-xl bg-accent/20 text-sm font-bold text-accent">
                      {profile.username?.slice(0, 2).toUpperCase() || 'AI'}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{profile.username || 'Workspace User'}</h4>
                      <p className="text-xs text-midGray">{profile.email || 'local@agentiq.app'}</p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                    <span className="text-midGray">Deployment Mode</span>
                    <span className="font-bold text-brand uppercase">{deploymentMode}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-midGray">Subscription Tier</span>
                    <span className="font-bold text-accent">{subTier}</span>
                  </div>
                </div>
              </div>
            )}
          </main>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
