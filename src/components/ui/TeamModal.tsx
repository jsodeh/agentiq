import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Mail, UserPlus, Users, X } from 'lucide-react';

export interface TeamMember {
  id: number;
  profile_id: number;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  status: string;
  created_at: string;
}

interface TeamModalProps {
  isOpen: boolean;
  profileId: number;
  onClose: () => void;
}

export function TeamModal({ isOpen, profileId, onClose }: TeamModalProps) {
  const [members, setMembers]     = useState<TeamMember[]>([]);
  const [loading, setLoading]     = useState(false);
  const [isAdding, setIsAdding]   = useState(false);
  const [name, setName]           = useState('');
  const [email, setEmail]         = useState('');
  const [role, setRole]           = useState<'admin' | 'member' | 'viewer'>('member');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const res = await invoke<string>('get_team_members', { profileId });
      const parsed: TeamMember[] = JSON.parse(res) || [];
      setMembers(parsed);
    } catch (err) {
      console.error('Failed to fetch team members:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchMembers();
  }, [isOpen, profileId]);

  const handleAdd = async () => {
    if (!name.trim() || !email.trim()) {
      setStatusMsg('Please enter Name and Email.');
      return;
    }
    try {
      await invoke('add_team_member', { profileId, name: name.trim(), email: email.trim(), role });
      setName('');
      setEmail('');
      setIsAdding(false);
      setStatusMsg('Team member invited successfully!');
      fetchMembers();
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err) {
      console.error('Error adding team member:', err);
      setStatusMsg('Failed to add member.');
    }
  };

  if (!isOpen) return null;

  // ── Shared style tokens ─────────────────────────────────────────────────
  const modalBg  = 'bg-white dark:bg-[#121218]';
  const headerBg = 'bg-[#f5f5f7] dark:bg-[#181822]';
  const border   = 'border-black/10 dark:border-white/10';
  const textMain = 'text-[#0a0a0f] dark:text-white';
  const textDim  = 'text-gray-500 dark:text-gray-400';
  const inputCls = `w-full rounded-lg border px-3 py-2 text-xs outline-none focus:border-brand ${border} bg-white/70 dark:bg-white/5 ${textMain}`;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/50 backdrop-blur-md dark:bg-black/70"
        />

        {/* Panel */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className={`relative z-10 flex h-[75vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border shadow-2xl ${border} ${modalBg} ${textMain}`}
        >
          {/* Header */}
          <div className={`flex items-center justify-between border-b px-6 py-4 ${border} ${headerBg}`}>
            <div className="flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-xl bg-brand/20 text-brand">
                <Users className="size-5" />
              </div>
              <div>
                <h2 className={`text-base font-bold ${textMain}`}>Team Collaboration &amp; Seats</h2>
                <p className={`text-xs ${textDim}`}>
                  Invite team members, assign role permissions, and share sub-agent workflows
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className={`grid size-8 place-items-center rounded-lg ${textDim} hover:bg-black/[0.06] hover:text-[#0a0a0f] dark:hover:bg-white/10 dark:hover:text-white`}
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Status banner */}
          {statusMsg && (
            <div className="flex items-center gap-2 border-b border-emerald-500/30 bg-emerald-500/10 px-6 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <Check className="size-4" />
              {statusMsg}
            </div>
          )}

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold ${textDim}`}>Team Members ({members.length})</span>
              <button
                onClick={() => setIsAdding(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
              >
                <UserPlus className="size-3.5" /> Invite Member
              </button>
            </div>

            {/* Invite form */}
            {isAdding && (
              <div className={`rounded-xl border p-4 space-y-3 ${border} bg-[#f0f0f5] dark:bg-[#171722]`}>
                <h4 className={`text-xs font-bold ${textMain}`}>Invite New Team Member</h4>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full Name"
                    className={inputCls}
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email Address"
                    className={inputCls}
                  />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${textDim}`}>Role:</span>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as 'admin' | 'member' | 'viewer')}
                      className={`rounded-lg border px-2 py-1 text-xs outline-none focus:border-brand ${border} bg-white dark:bg-[#1a1a24] ${textMain}`}
                    >
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsAdding(false)}
                      className={`rounded-lg border px-3 py-1 text-xs ${border} ${textDim}`}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAdd}
                      className="rounded-lg bg-brand px-4 py-1 text-xs font-bold text-white hover:opacity-90"
                    >
                      Send Invite
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Members list */}
            <div className="space-y-2">
              {loading ? (
                <p className={`py-8 text-center text-xs ${textDim}`}>Loading team members...</p>
              ) : members.length === 0 ? (
                <div className={`py-16 text-center text-xs ${textDim}`}>
                  <Users className="mx-auto mb-2 size-8 opacity-30" />
                  No team members yet. Invite someone to collaborate.
                </div>
              ) : (
                members.map((m) => (
                  <div
                    key={m.id}
                    className={`flex items-center justify-between rounded-xl border p-3.5 ${border} bg-black/[0.02] dark:bg-white/[0.02]`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`grid size-8 place-items-center rounded-lg text-xs font-bold bg-black/[0.06] dark:bg-white/10 ${textMain}`}>
                        {m.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className={`text-xs font-bold ${textMain}`}>{m.name}</h4>
                        <p className={`text-[11px] flex items-center gap-1 ${textDim}`}>
                          <Mail className="size-3" /> {m.email}
                        </p>
                      </div>
                    </div>
                    <span className={`rounded px-2 py-0.5 text-[10px] font-semibold capitalize bg-black/[0.06] dark:bg-white/10 ${textDim}`}>
                      {m.role}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
