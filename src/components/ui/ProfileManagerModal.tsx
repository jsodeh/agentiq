import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AnimatePresence, motion } from 'framer-motion';
import { Briefcase, Check, Crown, Plus, ShieldAlert, X } from 'lucide-react';

export interface ProfileItem {
  id: number;
  user_id: number;
  name: string;
  avatar_url?: string;
  tier: 'base' | 'pro' | 'agency';
  max_accounts_per_platform: number;
  is_active: boolean;           // fixed: was `bool` (Rust/Python syntax)
  created_at: string;
}

interface ProfileManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileSwitched?: (profile: ProfileItem) => void;
}

export function ProfileManagerModal({ isOpen, onClose, onProfileSwitched }: ProfileManagerModalProps) {
  const [profiles, setProfiles]         = useState<ProfileItem[]>([]);
  const [loading, setLoading]           = useState(false);
  const [isCreating, setIsCreating]     = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [selectedTier, setSelectedTier] = useState<'base' | 'pro' | 'agency'>('base');
  const [errorMsg, setErrorMsg]         = useState<string | null>(null);

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const res = await invoke<string>('get_all_profiles');
      const parsed: ProfileItem[] = JSON.parse(res) || [];
      setProfiles(parsed);
    } catch (err) {
      console.error('Failed to fetch profiles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchProfiles();
  }, [isOpen]);

  const handleSwitch = async (profile: ProfileItem) => {
    try {
      await invoke('switch_profile', { profileId: profile.id });
      setProfiles((prev) => prev.map((p) => ({ ...p, is_active: p.id === profile.id })));
      if (onProfileSwitched) onProfileSwitched(profile);
      onClose();
    } catch (err) {
      console.error('Failed to switch profile:', err);
    }
  };

  const handleCreate = async () => {
    if (!newProfileName.trim()) {
      setErrorMsg('Please enter a profile name.');
      return;
    }
    try {
      await invoke('create_profile', { name: newProfileName.trim(), tier: selectedTier });
      setNewProfileName('');
      setIsCreating(false);
      setErrorMsg(null);
      fetchProfiles();
    } catch (err) {
      console.error('Error creating profile:', err);
      setErrorMsg(String(err));
    }
  };

  if (!isOpen) return null;

  const activeProfile = profiles.find((p) => p.is_active) || profiles[0];

  // ── Shared style tokens ─────────────────────────────────────────────────
  const modalBg   = 'bg-white dark:bg-[#121218]';
  const headerBg  = 'bg-[#f5f5f7] dark:bg-[#181822]';
  const border    = 'border-black/10 dark:border-white/10';
  const textMain  = 'text-[#0a0a0f] dark:text-white';
  const textDim   = 'text-gray-500 dark:text-gray-400';
  const textXS    = 'text-gray-400 dark:text-gray-500';
  const surfaceBg = 'bg-[#f0f0f5] dark:bg-[#161620]';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-md dark:bg-black/70"
        />

        {/* Modal panel */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className={`relative z-10 flex h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border shadow-2xl ${border} ${modalBg} ${textMain}`}
        >
          {/* Header */}
          <div className={`flex items-center justify-between border-b px-6 py-4 ${border} ${headerBg}`}>
            <div className="flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-xl bg-brand/20 text-brand">
                <Briefcase className="size-5" />
              </div>
              <div>
                <h2 className={`text-base font-bold ${textMain}`}>Systemwide Profile &amp; Workspace Switcher</h2>
                <p className={`text-xs ${textDim}`}>Switch context between personal, client agency, and business accounts</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className={`grid size-8 place-items-center rounded-lg ${textDim} hover:bg-black/[0.06] hover:text-[#0a0a0f] dark:hover:bg-white/10 dark:hover:text-white`}
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Error banner */}
          {errorMsg && (
            <div className="flex items-center gap-2 border-b border-red-500/30 bg-red-500/10 px-6 py-2.5 text-xs font-semibold text-red-600 dark:text-red-300">
              <ShieldAlert className="size-4" />
              {errorMsg}
            </div>
          )}

          {/* Body */}
          <div className="flex flex-1 overflow-hidden gap-6 p-6">

            {/* Left: Profiles list */}
            <div className="flex w-1/2 flex-col space-y-3 overflow-y-auto pr-1">
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-semibold ${textDim}`}>Your Profiles ({profiles.length})</span>
                <button
                  onClick={() => { setIsCreating(true); setErrorMsg(null); }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                >
                  <Plus className="size-3.5" /> Create Profile
                </button>
              </div>

              {loading ? (
                <p className={`py-8 text-center text-xs ${textXS}`}>Loading profiles...</p>
              ) : (
                profiles.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => handleSwitch(p)}
                    className={`group relative flex cursor-pointer items-center justify-between rounded-xl border p-3.5 transition-all ${
                      p.is_active
                        ? 'border-brand bg-brand/10 shadow-lg shadow-brand/10'
                        : `hover:border-brand/30 hover:bg-brand/5 ${border} bg-black/[0.02] dark:bg-white/[0.02]`
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="grid size-9 place-items-center rounded-lg bg-accent/15 text-xs font-bold text-accent">
                        {p.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className={`text-xs font-bold flex items-center gap-2 ${textMain}`}>
                          {p.name}
                          {p.tier === 'pro' && (
                            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-300">PRO</span>
                          )}
                          {p.tier === 'agency' && (
                            <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[9px] font-bold text-purple-600 dark:text-purple-300">AGENCY</span>
                          )}
                        </h4>
                        <p className={`text-[10px] ${textDim}`}>{p.max_accounts_per_platform} account/platform limit</p>
                      </div>
                    </div>
                    {p.is_active && <Check className="size-4 text-brand" />}
                  </div>
                ))
              )}
            </div>

            {/* Right: Details or creation form */}
            <div className={`flex flex-1 flex-col rounded-xl border p-5 justify-between ${border} ${surfaceBg}`}>
              {isCreating ? (
                <div className="space-y-4">
                  <h3 className={`text-xs font-bold border-b pb-2 ${border} ${textMain}`}>Create New Business Profile</h3>

                  <div>
                    <label className={`block text-xs font-medium mb-1 ${textDim}`}>Profile / Business Name</label>
                    <input
                      type="text"
                      value={newProfileName}
                      onChange={(e) => setNewProfileName(e.target.value)}
                      placeholder="e.g. Apex E-Commerce Brand"
                      className={`w-full rounded-lg border px-3 py-2 text-xs outline-none focus:border-brand ${border} bg-white/50 dark:bg-white/5 ${textMain}`}
                    />
                  </div>

                  <div>
                    <label className={`block text-xs font-medium mb-1 ${textDim}`}>Profile Tier</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['base', 'pro', 'agency'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setSelectedTier(t)}
                          className={`rounded-lg border p-2 text-center text-xs capitalize transition-colors ${
                            selectedTier === t
                              ? t === 'base'   ? 'border-brand bg-brand/20 font-bold text-brand'
                              : t === 'pro'    ? 'border-amber-400 bg-amber-400/20 font-bold text-amber-600 dark:text-amber-300'
                              :                  'border-purple-400 bg-purple-400/20 font-bold text-purple-600 dark:text-purple-300'
                              : `${border} bg-black/[0.03] dark:bg-white/5 ${textDim}`
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setIsCreating(false)}
                      className={`rounded-lg border px-3 py-1.5 text-xs ${border} ${textDim}`}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreate}
                      className="rounded-lg bg-brand px-4 py-1.5 text-xs font-bold text-white hover:opacity-90"
                    >
                      Save Profile
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="grid size-12 place-items-center rounded-xl bg-brand/20 text-brand">
                      <Crown className="size-6" />
                    </div>
                    <div>
                      <h3 className={`text-sm font-bold ${textMain}`}>{activeProfile?.name}</h3>
                      <span className="rounded bg-brand/15 px-2 py-0.5 text-[10px] font-bold text-brand uppercase">
                        {activeProfile?.tier || 'Base'} Tier
                      </span>
                    </div>
                  </div>

                  <div className={`space-y-2 border-t border-b py-3 text-xs ${border} ${textDim}`}>
                    <div className="flex justify-between">
                      <span className={textXS}>Max Social Accounts / Platform:</span>
                      <span className={`font-bold ${textMain}`}>{activeProfile?.max_accounts_per_platform || 1}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={textXS}>Isolated Knowledge Base:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">Enabled</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={textXS}>Isolated Task History:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">Enabled</span>
                    </div>
                  </div>

                  <p className={`text-[11px] leading-relaxed ${textXS}`}>
                    Base users can operate 1 profile. Upgrade to Pro or Agency tier to manage unlimited client profiles and multi-account integrations.
                  </p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
