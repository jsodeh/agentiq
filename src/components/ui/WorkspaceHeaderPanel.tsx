import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ChevronDown, Inbox, Users } from 'lucide-react';
import { ProfileItem } from './ProfileManagerModal';

interface WorkspaceHeaderPanelProps {
  onOpenInbox: () => void;
  onOpenTeam: () => void;
  onOpenProfileManager: () => void;
  unreadInboxCount?: number;
}

export function WorkspaceHeaderPanel({
  onOpenInbox,
  onOpenTeam,
  onOpenProfileManager,
  unreadInboxCount = 0,
}: WorkspaceHeaderPanelProps) {
  const [activeProfile, setActiveProfile] = useState<ProfileItem | null>(null);

  const fetchActiveProfile = async () => {
    try {
      const res = await invoke<string>('get_all_profiles');
      const parsed: ProfileItem[] = JSON.parse(res) || [];
      const active = parsed.find((p) => p.is_active) || parsed[0];
      if (active) setActiveProfile(active);
    } catch (err) {
      console.error('Failed to fetch active profile in header:', err);
    }
  };

  useEffect(() => {
    fetchActiveProfile();
  }, []);

  // ── Shared icon-button base classes ─────────────────────────────────────
  const iconBtn =
    'grid size-8 place-items-center rounded-xl border transition-colors ' +
    'border-black/10 bg-black/[0.04] text-gray-600 ' +
    'hover:border-brand/40 hover:bg-black/[0.08] hover:text-[#0a0a0f] ' +
    'dark:border-white/10 dark:bg-[#161620] dark:text-gray-300 ' +
    'dark:hover:border-brand/40 dark:hover:bg-[#1d1d2b] dark:hover:text-white';

  return (
    <div className="flex items-center gap-2">

      {/* ── Profile Switcher ── */}
      <button
        onClick={onOpenProfileManager}
        title="Switch Business Profile / Tier"
        className={
          'flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs transition-colors ' +
          'border-black/10 bg-black/[0.04] text-gray-700 ' +
          'hover:border-brand/40 hover:bg-black/[0.08] hover:text-[#0a0a0f] ' +
          'dark:border-white/10 dark:bg-[#161620] dark:text-gray-200 ' +
          'dark:hover:border-brand/40 dark:hover:bg-[#1d1d2b] dark:hover:text-white'
        }
      >
        <span className="grid size-5 place-items-center rounded bg-brand/20 text-[10px] font-bold text-brand">
          {activeProfile ? activeProfile.name.slice(0, 2).toUpperCase() : 'AI'}
        </span>
        <span className="max-w-[130px] truncate font-semibold">
          {activeProfile?.name || 'Default Profile'}
        </span>
        <span className="rounded bg-brand/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-brand">
          {activeProfile?.tier || 'Base'}
        </span>
        <ChevronDown className="size-3.5 text-gray-400" />
      </button>

      {/* ── Team Button ── */}
      <button
        onClick={onOpenTeam}
        title="Team Members & Collaboration"
        className={iconBtn}
      >
        <Users className="size-4" />
      </button>

      {/* ── Inbox Button + Badge ── */}
      <button
        onClick={onOpenInbox}
        title="Inbox & Task Alerts"
        className={`relative ${iconBtn}`}
      >
        <Inbox className="size-4" />
        {unreadInboxCount > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[9px] font-bold text-white shadow-md">
            {unreadInboxCount}
          </span>
        )}
      </button>

    </div>
  );
}
