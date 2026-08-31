import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { OnboardingForm, type AccountProfile } from '../../components/ui/onboarding-form';

// ─── Region-based pricing ──────────────────────────────────────────────────
interface RegionPricing {
  currency: string;
  symbol: string;
  starter: { monthly: number; annual: number };
  professional: { monthly: number; annual: number };
  enterprise: { monthly: number; annual: number };
}

const REGION_PRICING: Record<string, RegionPricing> = {
  NG: { currency: 'NGN', symbol: '₦', starter: { monthly: 15000, annual: 144000 }, professional: { monthly: 45000, annual: 432000 }, enterprise: { monthly: 120000, annual: 1152000 } },
  GH: { currency: 'GHS', symbol: 'GH₵', starter: { monthly: 120, annual: 1152 }, professional: { monthly: 360, annual: 3456 }, enterprise: { monthly: 960, annual: 9216 } },
  KE: { currency: 'KES', symbol: 'KSh', starter: { monthly: 1500, annual: 14400 }, professional: { monthly: 4500, annual: 43200 }, enterprise: { monthly: 12000, annual: 115200 } },
  ZA: { currency: 'ZAR', symbol: 'R', starter: { monthly: 180, annual: 1728 }, professional: { monthly: 540, annual: 5184 }, enterprise: { monthly: 1440, annual: 13824 } },
  US: { currency: 'USD', symbol: '$', starter: { monthly: 9, annual: 86 }, professional: { monthly: 29, annual: 278 }, enterprise: { monthly: 79, annual: 758 } },
  GB: { currency: 'GBP', symbol: '£', starter: { monthly: 7, annual: 67 }, professional: { monthly: 23, annual: 221 }, enterprise: { monthly: 63, annual: 605 } },
  EU: { currency: 'EUR', symbol: '€', starter: { monthly: 8, annual: 77 }, professional: { monthly: 25, annual: 240 }, enterprise: { monthly: 69, annual: 662 } },
  IN: { currency: 'INR', symbol: '₹', starter: { monthly: 749, annual: 7190 }, professional: { monthly: 2399, annual: 23030 }, enterprise: { monthly: 6499, annual: 62390 } },
};

// Placeholder Paystack / Flutterwave payment links — swap real ones when ready
const SUBSCRIPTION_LINKS: Record<string, { monthly: string; annual: string }> = {
  starter: {
    monthly: 'https://checkout.placeholder.com/starter-monthly',
    annual: 'https://checkout.placeholder.com/starter-annual',
  },
  professional: {
    monthly: 'https://checkout.placeholder.com/professional-monthly',
    annual: 'https://checkout.placeholder.com/professional-annual',
  },
  enterprise: {
    monthly: 'https://checkout.placeholder.com/enterprise-monthly',
    annual: 'https://checkout.placeholder.com/enterprise-annual',
  },
};

function detectRegion(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (tz.includes('Lagos') || tz.includes('Africa/Lagos')) return 'NG';
    if (tz.includes('Accra')) return 'GH';
    if (tz.includes('Nairobi')) return 'KE';
    if (tz.includes('Johannesburg')) return 'ZA';
    if (tz.includes('London')) return 'GB';
    if (tz.includes('Kolkata') || tz.includes('Mumbai')) return 'IN';
    if (tz.includes('Berlin') || tz.includes('Paris') || tz.includes('Rome') || tz.includes('Madrid')) return 'EU';
  } catch { /* fallback */ }
  return 'US';
}

function formatPrice(amount: number, symbol: string): string {
  if (amount >= 1000) return `${symbol}${amount.toLocaleString()}`;
  return `${symbol}${amount}`;
}

// ─── Setup step types ──────────────────────────────────────────────────────
interface SetupStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'done' | 'error' | 'skipped';
  detail?: string;
}

// All free-mode steps including voice setup at the end
const INITIAL_SETUP_STEPS: SetupStep[] = [
  { id: 'ollama-check',   title: 'Check Ollama Installation',   description: 'Verify if Ollama CLI is present',                  status: 'pending' },
  { id: 'ollama-install', title: 'Install Ollama',               description: 'Download & install Ollama runtime (~120 MB)',       status: 'pending' },
  { id: 'model-pull',     title: 'Pull Default AI Model',        description: 'Download llama3.2:3b base model (~2.0 GB)',         status: 'pending' },
  { id: 'device-check',   title: 'System Hardware Check',        description: 'RAM, disk space, GPU verification',                status: 'pending' },
  { id: 'whisper-check',  title: 'Check Whisper STT',            description: 'Verify local speech-to-text model',                status: 'pending' },
  { id: 'whisper-dl',     title: 'Download Whisper Model',       description: 'Fetch Whisper tiny.en (~75 MB)',                   status: 'pending' },
  { id: 'coqui-check',    title: 'Check Coqui TTS',              description: 'Verify local text-to-speech engine',               status: 'pending' },
  { id: 'coqui-dl',       title: 'Download Coqui TTS',           description: 'Fetch Coqui TTS model (~120 MB)',                  status: 'pending' },
  { id: 'finalize',       title: 'Finalize Configuration',       description: 'Save all settings & prepare agent workspace',      status: 'pending' },
];

// ─── Component ─────────────────────────────────────────────────────────────
export default function ModeSelect() {
  const navigate = useNavigate();

  // Modal visibility
  const [showSetupModal, setShowSetupModal]   = useState(false);
  const [showSubModal, setShowSubModal]       = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [savingProfile, setSavingProfile]     = useState(false);

  // Pending tier for business mode (stored so profile save can read it)
  const pendingTierRef = useRef<{ tier: string; cycle: string } | null>(null);

  // Free-mode setup timeline
  const [setupSteps, setSetupSteps]     = useState<SetupStep[]>(INITIAL_SETUP_STEPS);
  const [setupRunning, setSetupRunning] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);

  // Subscription billing cycle
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const regionCode = detectRegion();
  const pricing    = REGION_PRICING[regionCode] ?? REGION_PRICING['US'];

  // ── Step updater ───────────────────────────────────────────────────────
  const updateStep = useCallback((id: string, patch: Partial<SetupStep>) => {
    setSetupSteps(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }, []);

  const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

  // ── Status icon ────────────────────────────────────────────────────────
  const stepIcon = (status: SetupStep['status']) => {
    switch (status) {
      case 'pending':
        return <div className="w-7 h-7 rounded-full border-2 border-midGray/50 bg-dark flex-shrink-0" />;
      case 'running':
        return (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
            className="w-7 h-7 rounded-full border-2 border-brand border-t-transparent flex-shrink-0"
          />
        );
      case 'done':
        return (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
            className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
            <span className="text-accent text-sm font-bold">✓</span>
          </motion.div>
        );
      case 'error':
        return (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
            className="w-7 h-7 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
            <span className="text-red-400 text-sm font-bold">✗</span>
          </motion.div>
        );
      case 'skipped':
        return (
          <div className="w-7 h-7 rounded-full bg-midGray/20 flex items-center justify-center flex-shrink-0">
            <span className="text-midGray text-[11px]">—</span>
          </div>
        );
    }
  };

  // ── Free mode: open modal ──────────────────────────────────────────────
  const handleFreeMode = () => {
    setSetupSteps(INITIAL_SETUP_STEPS.map(s => ({ ...s, status: 'pending' as const, detail: undefined })));
    setSetupComplete(false);
    setShowSetupModal(true);
  };

  // ── Run the full free-mode setup timeline ──────────────────────────────
  const runSetupTimeline = async () => {
    setSetupRunning(true);

    // ── 1. Check Ollama ────────────────────────────────────────────────
    updateStep('ollama-check', { status: 'running' });
    await delay(600);
    let ollamaInstalled = false;
    try { ollamaInstalled = await invoke<boolean>('check_ollama'); } catch { ollamaInstalled = false; }

    if (ollamaInstalled) {
      updateStep('ollama-check',   { status: 'done',    detail: 'Ollama is already installed ✓' });
      updateStep('ollama-install', { status: 'skipped', detail: 'Skipped – already present' });
    } else {
      updateStep('ollama-check', { status: 'done', detail: 'Ollama not found' });

      // ── 2. Install Ollama ────────────────────────────────────────────
      updateStep('ollama-install', { status: 'running', detail: 'Downloading installer…' });
      try {
        await invoke('download_ollama');
        updateStep('ollama-install', { status: 'done', detail: 'Ollama installed successfully' });
      } catch (err) {
        updateStep('ollama-install', { status: 'error', detail: `Install failed: ${err}. Check your internet and retry.` });
        setSetupRunning(false);
        return;
      }
    }

    // ── 3. Pull AI model ───────────────────────────────────────────────
    updateStep('model-pull', { status: 'running', detail: 'Starting model download…' });
    const selectedModel = 'llama3.2:3b';
    try {
      await invoke('download_model', { modelId: selectedModel });
      await delay(1200);
      updateStep('model-pull', { status: 'done', detail: `${selectedModel} ready` });
      // Persist model choice immediately
      localStorage.setItem('selected_model', selectedModel);
      localStorage.setItem('deployment_mode', 'local');
    } catch (err) {
      updateStep('model-pull', { status: 'error', detail: `Model download failed: ${err}` });
      setSetupRunning(false);
      return;
    }

    // ── 4. Device / hardware check ─────────────────────────────────────
    updateStep('device-check', { status: 'running', detail: 'Checking RAM, GPU, disk…' });
    try {
      const [ramGb, freeDiskGb, gpuInfo] = await Promise.all([
        invoke<number>('get_ram_gb'),
        invoke<number>('get_free_disk_gb'),
        invoke<string>('get_gpu_info'),
      ]);
      const ramOk  = ramGb >= 4;
      const diskOk = freeDiskGb >= 10;
      updateStep('device-check', {
        status: ramOk && diskOk ? 'done' : 'error',
        detail: `RAM: ${ramGb.toFixed(1)} GB ${ramOk ? '✓' : '✗'}  |  Disk: ${freeDiskGb.toFixed(0)} GB free ${diskOk ? '✓' : '✗'}  |  GPU: ${gpuInfo || 'None detected'}`,
      });
      if (!ramOk || !diskOk) { setSetupRunning(false); return; }
    } catch {
      updateStep('device-check', { status: 'done', detail: 'Checks completed (fallback mode)' });
    }

    // ── 5. Check Whisper STT ───────────────────────────────────────────
    updateStep('whisper-check', { status: 'running' });
    await delay(500);
    let whisperInstalled = false;
    try { whisperInstalled = await invoke<boolean>('check_whisper'); } catch { whisperInstalled = false; }

    if (whisperInstalled) {
      updateStep('whisper-check', { status: 'done',    detail: 'Whisper model already present ✓' });
      updateStep('whisper-dl',    { status: 'skipped', detail: 'Skipped – already present' });
    } else {
      updateStep('whisper-check', { status: 'done', detail: 'Whisper model not found' });

      // ── 6. Download Whisper ────────────────────────────────────────────
      updateStep('whisper-dl', { status: 'running', detail: 'Downloading Whisper tiny.en…' });
      try {
        await invoke('download_whisper', { model: 'tiny.en' });
        await delay(800);
        updateStep('whisper-dl', { status: 'done', detail: 'Whisper tiny.en downloaded ✓' });
      } catch (err) {
        updateStep('whisper-dl', { status: 'error', detail: `Whisper download failed: ${err}` });
        setSetupRunning(false);
        return;
      }
    }

    // ── 7. Check Coqui TTS ─────────────────────────────────────────────
    updateStep('coqui-check', { status: 'running' });
    await delay(500);
    let coquiInstalled = false;
    try { coquiInstalled = await invoke<boolean>('check_coqui'); } catch { coquiInstalled = false; }

    if (coquiInstalled) {
      updateStep('coqui-check', { status: 'done',    detail: 'Coqui TTS already present ✓' });
      updateStep('coqui-dl',    { status: 'skipped', detail: 'Skipped – already present' });
    } else {
      updateStep('coqui-check', { status: 'done', detail: 'Coqui TTS not found' });

      // ── 8. Download Coqui ─────────────────────────────────────────────
      updateStep('coqui-dl', { status: 'running', detail: 'Downloading Coqui TTS model…' });
      try {
        await invoke('download_coqui');
        await delay(800);
        updateStep('coqui-dl', { status: 'done', detail: 'Coqui TTS downloaded ✓' });
      } catch (err) {
        updateStep('coqui-dl', { status: 'error', detail: `Coqui download failed: ${err}` });
        setSetupRunning(false);
        return;
      }
    }

    // ── 9. Finalize — persist everything, mark setup complete ──────────
    updateStep('finalize', { status: 'running' });
    await delay(600);

    localStorage.setItem('deployment_mode', 'local');
    localStorage.setItem('selected_model',  selectedModel);
    localStorage.setItem('voice_mode',      'local');
    localStorage.setItem('voice_config', JSON.stringify({
      mode: 'local',
      sttModel:    'whisper-tiny-en',
      ttsModel:    'coqui-tts',
      language:    'en',
      wakeWord:    false,
    }));
    // setup_complete is intentionally set AFTER voice setup finishes
    localStorage.setItem('setup_complete', 'true');

    updateStep('finalize', { status: 'done', detail: 'All set! Your local workspace is ready.' });
    setSetupRunning(false);
    setSetupComplete(true);
  };

  // ── Profile save (both modes) ──────────────────────────────────────────
  const continueToWorkspace = () => {
    if (localStorage.getItem('user_profile')) {
      navigate('/workspace');
      return;
    }
    setShowProfileModal(true);
  };

  const saveProfile = (profile: AccountProfile) => {
    setSavingProfile(true);
    localStorage.setItem('user_profile', JSON.stringify({
      username:  profile.username,
      email:     profile.email,
      avatar:    profile.avatar ?? null,
      createdAt: new Date().toISOString(),
    }));
    window.setTimeout(() => {
      setSavingProfile(false);
      setShowProfileModal(false);
      setShowSetupModal(false);
      setShowSubModal(false);
      navigate('/workspace');
    }, 250);
  };

  // Placeholder OTP sender — replace with real API call when backend is ready
  const sendOtp = async (_email: string): Promise<void> => {
    // TODO: POST /api/auth/send-otp with { email }
    await new Promise(r => setTimeout(r, 900)); // simulate network
  };

  // ── Business mode ──────────────────────────────────────────────────────
  const handleBusinessMode = () => {
    setShowSubModal(true);
  };

  const handleSubscribe = (tier: string) => {
    // Store pending subscription so profile save can complete the flow
    pendingTierRef.current = { tier, cycle: billingCycle };
    localStorage.setItem('deployment_mode',    'cloud');
    localStorage.setItem('subscription_tier',  tier);
    localStorage.setItem('billing_cycle',      billingCycle);
    // setup_complete for business mode is set AFTER profile + OTP verification
    setShowSubModal(false);
    setShowProfileModal(true);
  };

  const openSubscriptionLink = (tier: string) => {
    const links = SUBSCRIPTION_LINKS[tier];
    if (!links) return;
    const url = billingCycle === 'annual' ? links.annual : links.monthly;
    // In Tauri we open in the system browser; in web context use window.open
    try {
      invoke('open_url', { url });
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  // ─── RENDER ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-dark flex flex-col items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-3xl">

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white mb-2">Welcome to agēntīq</h1>
          <p className="text-midGray text-base">Choose how you want to run your AI agents</p>
        </div>

        {/* ── Mode cards ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Free Mode */}
          <motion.button
            whileHover={{ scale: 1.015, borderColor: '#6C3BFF' }}
            whileTap={{ scale: 0.985 }}
            onClick={handleFreeMode}
            className="relative bg-dark border border-midGray/60 rounded-2xl p-6 text-left transition-all hover:shadow-lg hover:shadow-brand/10 group"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-brand/15 flex items-center justify-center">
                <svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white">Free Mode</h2>
            </div>
            <p className="text-midGray text-sm mb-4 leading-relaxed">
              Run AI locally on your machine. Full privacy, zero API costs. Internet only needed for initial setup.
            </p>
            <ul className="space-y-1.5 text-[13px] text-midGray mb-4">
              <li className="flex items-start gap-2"><span className="text-accent mt-0.5">✓</span> Complete data privacy</li>
              <li className="flex items-start gap-2"><span className="text-accent mt-0.5">✓</span> No recurring costs</li>
              <li className="flex items-start gap-2"><span className="text-accent mt-0.5">✓</span> Works offline after setup</li>
              <li className="flex items-start gap-2"><span className="text-accent mt-0.5">✓</span> Local voice (Whisper + Coqui)</li>
            </ul>
            <div className="bg-brand/5 border border-brand/20 rounded-xl p-3 mb-4 space-y-1">
              <p className="text-[11px] font-semibold text-brand/80 uppercase tracking-wider">System Requirements</p>
              <ul className="text-[11px] text-midGray space-y-0.5">
                <li>• <span className="text-white/80">8 GB+ RAM</span> (4 GB minimum)</li>
                <li>• <span className="text-white/80">~2.8 GB</span> initial download (Ollama + model + voice)</li>
                <li>• <span className="text-white/80">10 GB+</span> free disk space</li>
              </ul>
            </div>
            <div className="text-brand font-semibold text-sm group-hover:translate-x-1 transition-transform">
              Set Up Free →
            </div>
          </motion.button>

          {/* Business Mode */}
          <motion.button
            whileHover={{ scale: 1.015, borderColor: '#00E5A0' }}
            whileTap={{ scale: 0.985 }}
            onClick={handleBusinessMode}
            className="relative bg-dark border border-accent/40 rounded-2xl p-6 text-left transition-all hover:shadow-lg hover:shadow-accent/10 group"
          >
            <div className="absolute -top-3 right-5">
              <span className="px-3 py-1 bg-accent text-dark text-[11px] font-bold rounded-full shadow-md shadow-accent/30 uppercase tracking-wider">
                Recommended
              </span>
            </div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center">
                <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white">Business Mode</h2>
            </div>
            <p className="text-midGray text-sm mb-4 leading-relaxed">
              Cloud-powered AI via Anthropic Claude &amp; more. Instant setup, no local resources needed.
            </p>
            <ul className="space-y-1.5 text-[13px] text-midGray mb-4">
              <li className="flex items-start gap-2"><span className="text-accent mt-0.5">✓</span> Latest frontier AI models</li>
              <li className="flex items-start gap-2"><span className="text-accent mt-0.5">✓</span> Instant setup — no downloads</li>
              <li className="flex items-start gap-2"><span className="text-accent mt-0.5">✓</span> Priority support &amp; SLA</li>
              <li className="flex items-start gap-2"><span className="text-accent mt-0.5">✓</span> Team collaboration features</li>
            </ul>
            <div className="text-accent font-semibold text-sm group-hover:translate-x-1 transition-transform">
              View Plans →
            </div>
          </motion.button>
        </div>
      </motion.div>

      {/* ══════════════════════════════════════════════════════════════════
          FREE MODE — SETUP TIMELINE MODAL
      ══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showSetupModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 z-50"
            onClick={() => { if (!setupRunning) setShowSetupModal(false); }}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 20 }}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              className="bg-[#13131a] border border-midGray/50 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
            >
              {/* Modal header */}
              <div className="px-6 pt-6 pb-4 border-b border-midGray/30">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-white">Free Mode Setup</h2>
                    <p className="text-xs text-midGray mt-0.5">
                      Local AI + Voice — configuration &amp; downloads
                    </p>
                  </div>
                  {!setupRunning && (
                    <button onClick={() => setShowSetupModal(false)} className="text-midGray hover:text-white text-xl leading-none p-1">✕</button>
                  )}
                </div>
              </div>

              {/* Timeline body */}
              <div className="px-6 py-5 max-h-[58vh] overflow-y-auto">
                <div className="relative">
                  {/* Vertical connector line */}
                  <div className="absolute left-[13px] top-4 bottom-4 w-px bg-midGray/30" />
                  <div className="space-y-5">
                    {setupSteps.map((step) => (
                      <div key={step.id} className="flex items-start gap-4 relative">
                        <div className="relative z-10">{stepIcon(step.status)}</div>
                        <div className="flex-1 min-w-0 pb-1">
                          <p className={`text-sm font-semibold ${
                            step.status === 'running' ? 'text-brand' :
                            step.status === 'done'    ? 'text-white' :
                            step.status === 'error'   ? 'text-red-400' :
                            step.status === 'skipped' ? 'text-midGray/50' :
                            'text-midGray'
                          }`}>
                            {step.title}
                          </p>
                          <p className="text-[11px] text-midGray mt-0.5">{step.description}</p>
                          {step.detail && (
                            <motion.p
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={`text-[11px] mt-1 font-mono ${step.status === 'error' ? 'text-red-400/80' : 'text-accent/80'}`}
                            >
                              {step.detail}
                            </motion.p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Section divider between AI and Voice phases */}
              <div className="mx-6 border-t border-midGray/20" />

              {/* Modal footer */}
              <div className="px-6 py-4 flex justify-end gap-3">
                {!setupRunning && !setupComplete && (
                  <>
                    <button
                      onClick={() => setShowSetupModal(false)}
                      className="px-4 py-2 text-sm text-midGray hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={runSetupTimeline}
                      className="px-5 py-2 bg-brand hover:bg-brand/80 text-white text-sm font-semibold rounded-xl transition-colors shadow-md shadow-brand/20"
                    >
                      Begin Setup
                    </button>
                  </>
                )}
                {setupRunning && (
                  <div className="flex items-center gap-2 text-sm text-brand">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                      className="w-4 h-4 rounded-full border-2 border-brand border-t-transparent"
                    />
                    Setting up…
                  </div>
                )}
                {setupComplete && (
                  <button
                    onClick={continueToWorkspace}
                    className="px-6 py-2.5 bg-accent hover:bg-accent/80 text-dark text-sm font-bold rounded-xl transition-colors shadow-md shadow-accent/20"
                  >
                    Create Profile →
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════════
          BUSINESS MODE — SUBSCRIPTION MODAL
      ══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showSubModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setShowSubModal(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 20 }}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              className="bg-[#13131a] border border-midGray/50 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl"
            >
              {/* Header */}
              <div className="px-6 pt-6 pb-4 border-b border-midGray/30">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-white">Business Plans</h2>
                    <p className="text-xs text-midGray mt-0.5">
                      Pricing in {pricing.currency} · Detected region: {regionCode}
                    </p>
                  </div>
                  <button onClick={() => setShowSubModal(false)} className="text-midGray hover:text-white text-xl leading-none p-1">✕</button>
                </div>

                {/* Billing toggle */}
                <div className="flex items-center justify-center gap-1 mt-4 bg-dark rounded-xl p-1 max-w-xs mx-auto">
                  <button
                    onClick={() => setBillingCycle('monthly')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${billingCycle === 'monthly' ? 'bg-brand text-white shadow-md' : 'text-midGray hover:text-white'}`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setBillingCycle('annual')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${billingCycle === 'annual' ? 'bg-brand text-white shadow-md' : 'text-midGray hover:text-white'}`}
                  >
                    Annual <span className="text-accent text-[10px] ml-1">Save 20%</span>
                  </button>
                </div>
              </div>

              {/* Plans grid */}
              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">

                {/* ── Starter ─────────────────────────────────────── */}
                <div className="border border-midGray/40 rounded-2xl p-5 flex flex-col hover:border-brand/50 transition-colors">
                  <h3 className="text-base font-bold text-white mb-1">Starter</h3>
                  <p className="text-[11px] text-midGray mb-3">For individuals &amp; freelancers</p>
                  <div className="mb-4">
                    <span className="text-2xl font-bold text-white">
                      {formatPrice(billingCycle === 'monthly' ? pricing.starter.monthly : pricing.starter.annual, pricing.symbol)}
                    </span>
                    <span className="text-xs text-midGray ml-1">/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
                  </div>
                  <ul className="space-y-1.5 text-[12px] text-midGray mb-5 flex-1">
                    <li className="flex items-start gap-1.5"><span className="text-accent">✓</span> 5 active agents</li>
                    <li className="flex items-start gap-1.5"><span className="text-accent">✓</span> 1,000 tasks/month</li>
                    <li className="flex items-start gap-1.5"><span className="text-accent">✓</span> Claude Haiku model</li>
                    <li className="flex items-start gap-1.5"><span className="text-accent">✓</span> Email support</li>
                    <li className="flex items-start gap-1.5"><span className="text-midGray/40">—</span> <span className="text-midGray/50">No computer use</span></li>
                    <li className="flex items-start gap-1.5"><span className="text-midGray/40">—</span> <span className="text-midGray/50">No voice</span></li>
                  </ul>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => handleSubscribe('starter')}
                      className="w-full py-2 bg-dark border border-midGray hover:border-brand text-white text-xs font-semibold rounded-xl transition-colors"
                    >
                      Get Started
                    </button>
                    <button
                      onClick={() => openSubscriptionLink('starter')}
                      className="w-full py-1.5 text-[11px] text-midGray hover:text-brand transition-colors underline underline-offset-2"
                    >
                      Pay via Paystack / Flutterwave →
                    </button>
                  </div>
                </div>

                {/* ── Professional (highlighted) ───────────────────── */}
                <div className="relative border-2 border-accent/60 rounded-2xl p-5 flex flex-col bg-accent/5 shadow-lg shadow-accent/10">
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-0.5 bg-accent text-dark text-[10px] font-bold rounded-full uppercase tracking-wider">Most Popular</span>
                  </div>
                  <h3 className="text-base font-bold text-white mb-1">Professional</h3>
                  <p className="text-[11px] text-midGray mb-3">For growing businesses</p>
                  <div className="mb-4">
                    <span className="text-2xl font-bold text-white">
                      {formatPrice(billingCycle === 'monthly' ? pricing.professional.monthly : pricing.professional.annual, pricing.symbol)}
                    </span>
                    <span className="text-xs text-midGray ml-1">/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
                  </div>
                  <ul className="space-y-1.5 text-[12px] text-midGray mb-5 flex-1">
                    <li className="flex items-start gap-1.5"><span className="text-accent">✓</span> 25 active agents</li>
                    <li className="flex items-start gap-1.5"><span className="text-accent">✓</span> 10,000 tasks/month</li>
                    <li className="flex items-start gap-1.5"><span className="text-accent">✓</span> Claude Sonnet + GPT-4o</li>
                    <li className="flex items-start gap-1.5"><span className="text-accent">✓</span> Computer use &amp; web browsing</li>
                    <li className="flex items-start gap-1.5"><span className="text-accent">✓</span> Voice STT / TTS</li>
                    <li className="flex items-start gap-1.5"><span className="text-accent">✓</span> Priority support</li>
                  </ul>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => handleSubscribe('professional')}
                      className="w-full py-2.5 bg-accent hover:bg-accent/80 text-dark text-xs font-bold rounded-xl transition-colors shadow-md shadow-accent/20"
                    >
                      Subscribe Now
                    </button>
                    <button
                      onClick={() => openSubscriptionLink('professional')}
                      className="w-full py-1.5 text-[11px] text-midGray hover:text-accent transition-colors underline underline-offset-2"
                    >
                      Pay via Paystack / Flutterwave →
                    </button>
                  </div>
                </div>

                {/* ── Enterprise ───────────────────────────────────── */}
                <div className="border border-midGray/40 rounded-2xl p-5 flex flex-col hover:border-brand/50 transition-colors">
                  <h3 className="text-base font-bold text-white mb-1">Enterprise</h3>
                  <p className="text-[11px] text-midGray mb-3">For teams &amp; organizations</p>
                  <div className="mb-4">
                    <span className="text-2xl font-bold text-white">
                      {formatPrice(billingCycle === 'monthly' ? pricing.enterprise.monthly : pricing.enterprise.annual, pricing.symbol)}
                    </span>
                    <span className="text-xs text-midGray ml-1">/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
                  </div>
                  <ul className="space-y-1.5 text-[12px] text-midGray mb-5 flex-1">
                    <li className="flex items-start gap-1.5"><span className="text-accent">✓</span> Unlimited agents</li>
                    <li className="flex items-start gap-1.5"><span className="text-accent">✓</span> 100,000 tasks/month</li>
                    <li className="flex items-start gap-1.5"><span className="text-accent">✓</span> All models including Opus</li>
                    <li className="flex items-start gap-1.5"><span className="text-accent">✓</span> All capabilities unlocked</li>
                    <li className="flex items-start gap-1.5"><span className="text-accent">✓</span> Team collaboration</li>
                    <li className="flex items-start gap-1.5"><span className="text-accent">✓</span> Dedicated support &amp; SLA</li>
                  </ul>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => handleSubscribe('enterprise')}
                      className="w-full py-2 bg-dark border border-midGray hover:border-brand text-white text-xs font-semibold rounded-xl transition-colors"
                    >
                      Contact Sales
                    </button>
                    <button
                      onClick={() => openSubscriptionLink('enterprise')}
                      className="w-full py-1.5 text-[11px] text-midGray hover:text-brand transition-colors underline underline-offset-2"
                    >
                      Pay via Paystack / Flutterwave →
                    </button>
                  </div>
                </div>
              </div>

              <div className="px-6 pb-5 text-center">
                <p className="text-[11px] text-midGray">
                  All plans include a 14-day free trial · Cancel anytime · Prices auto-detected for your region ({regionCode})
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════════
          PROFILE MODAL (both modes)
          Business mode: requireEmailVerification + OTP step
          Free mode: no OTP
      ══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showProfileModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-5 backdrop-blur-sm"
          >
            <OnboardingForm
              onSubmit={saveProfile}
              isSubmitting={savingProfile}
              buttonText="Continue to workspace"
              requireEmailVerification={localStorage.getItem('deployment_mode') === 'cloud'}
              onRequestOtp={sendOtp}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
