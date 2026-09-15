import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AnimatePresence, motion } from 'framer-motion';
import { Briefcase, Check, Plus, ShieldAlert, Sparkles, X, Zap, Crown } from 'lucide-react';

export interface ProfileItem {
  id: number;
  user_id: number;
  name: string;
  avatar_url?: string;
  tier: 'base' | 'pro' | 'agency';
  max_accounts_per_platform: number;
  is_active: bool;
  created_at: string;
}

interface ProfileManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileSwitched?: (profile: ProfileItem) => void;
}

export function ProfileManagerModal({ isOpen, onClose, onProfileSwitched }: ProfileManagerModalProps) {
  const [profiles, setProfiles] = useState<ProfileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [selectedTier, setSelectedTier] = useState<'base' | 'pro' | 'agency'>('base');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
    if (isOpen) {
      fetchProfiles();
    }
  }, [isOpen]);

  const handleSwitch = async (profile: ProfileItem) => {
    try {
      await invoke('switch_profile', { profileId: profile.id });
      setProfiles((prev) =>
        prev.map((p) => ({ ...p, is_active: p.id === profile.id }))
      );
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
      await invoke('create_profile', {
        name: newProfileName.trim(),
        tier: selectedTier,
      });

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
          className="relative z-10 flex h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#121218] text-white shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 bg-[#181822] px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-xl bg-brand/20 text-brand">
                <Briefcase className="size-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Systemwide Profile & Workspace Switcher</h2>
                <p className="text-xs text-gray-400">
                  Switch context between personal, client agency, and business accounts
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

          {/* Error / Tier Alert */}
          {errorMsg && (
            <div className="flex items-center gap-2 border-b border-red-500/30 bg-red-500/10 px-6 py-2.5 text-xs font-semibold text-red-300">
              <ShieldAlert className="size-4 text-red-400" />
              {errorMsg}
            </div>
          )}

          {/* Body */}
          <div className="flex flex-1 overflow-hidden p-6 gap-6">
            {/* Left: Profiles List */}
            <div className="flex w-1/2 flex-col space-y-3 overflow-y-auto pr-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-gray-400">Your Profiles ({profiles.length})</span>
                <button
                  onClick={() => { setIsCreating(true); setErrorMsg(null); }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                >
                  <Plus className="size-3.5" /> Create Profile
                </button>
              </div>

              {loading ? (
                <p className="py-8 text-center text-xs text-gray-500">Loading profiles...</p>
              ) : (
                profiles.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => handleSwitch(p)}
                    className={`group relative flex cursor-pointer items-center justify-between rounded-xl border p-3.5 transition-all ${
                      p.is_active
                        ? 'border-brand bg-brand/10 shadow-lg shadow-brand/10'
                        : 'border-white/5 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="grid size-9 place-items-center rounded-lg bg-accent/15 text-xs font-bold text-accent">
                        {p.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white flex items-center gap-2">
                          {p.name}
                          {p.tier === 'pro' && (
                            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">PRO</span>
                          )}
                          {p.tier === 'agency' && (
                            <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[9px] font-bold text-purple-300">AGENCY</span>
                          )}
                        </h4>
                        <p className="text-[10px] text-gray-400">
                          {p.max_accounts_per_platform} account/platform limit
                        </p>
                      </div>
                    </div>
                    {p.is_active && <Check className="size-4 text-brand" />}
                  </div>
                ))
              )}
            </div>

            {/* Right: Profile Details or Creation Form */}
            <div className="flex flex-1 flex-col rounded-xl border border-white/10 bg-[#161620] p-5 justify-between">
              {isCreating ? (
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-white border-b border-white/10 pb-2">
                    Create New Business Profile
                  </h3>

                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">Profile / Business Name</label>
                    <input
                      type="text"
                      value={newProfileName}
                      onChange={(e) => setNewProfileName(e.target.value)}
                      placeholder="e.g. Apex E-Commerce Brand"
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-brand"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">Profile Tier</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedTier('base')}
                        className={`rounded-lg border p-2 text-center text-xs ${
                          selectedTier === 'base' ? 'border-brand bg-brand/20 font-bold' : 'border-white/10 bg-white/5'
                        }`}
                      >
                        Base
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedTier('pro')}
                        className={`rounded-lg border p-2 text-center text-xs ${
                          selectedTier === 'pro' ? 'border-amber-400 bg-amber-400/20 font-bold text-amber-300' : 'border-white/10 bg-white/5'
                        }`}
                      >
                        Pro
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedTier('agency')}
                        className={`rounded-lg border p-2 text-center text-xs ${
                          selectedTier === 'agency' ? 'border-purple-400 bg-purple-400/20 font-bold text-purple-300' : 'border-white/10 bg-white/5'
                        }`}
                      >
                        Agency
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setIsCreating(false)}
                      className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-400"
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
                      <h3 className="text-sm font-bold text-white">{activeProfile?.name}</h3>
                      <span className="rounded bg-brand/15 px-2 py-0.5 text-[10px] font-bold text-brand uppercase">
                        {activeProfile?.tier || 'Base'} Tier
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-b border-white/10 py-3 text-xs text-gray-300">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Max Social Accounts / Platform:</span>
                      <span className="font-bold text-white">{activeProfile?.max_accounts_per_platform || 1}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Isolated Knowledge Base:</span>
                      <span className="font-bold text-emerald-400">Enabled</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Isolated Task History:</span>
                      <span className="font-bold text-emerald-400">Enabled</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-gray-400 leading-relaxed">
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
