import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Inbox, Users, ChevronDown, Sparkles } from 'lucide-react';
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

  return (
    <div className="flex items-center gap-2">
      {/* Profile Switcher Button */}
      <button
        onClick={onOpenProfileManager}
        title="Switch Business Profile / Tier"
        className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#161620] px-3 py-1.5 text-xs text-gray-200 transition-colors hover:border-brand/40 hover:bg-[#1d1d2b] hover:text-white"
      >
        <span className="grid size-5 place-items-center rounded bg-brand/20 text-[10px] font-bold text-brand">
          {activeProfile ? activeProfile.name.slice(0, 2).toUpperCase() : 'AI'}
        </span>
        <span className="font-semibold max-w-[130px] truncate">
          {activeProfile?.name || 'Default Profile'}
        </span>
        <span className="rounded bg-brand/15 px-1.5 py-0.5 text-[9px] font-bold text-brand uppercase">
          {activeProfile?.tier || 'Base'}
        </span>
        <ChevronDown className="size-3.5 text-gray-400" />
      </button>

      {/* Team Button */}
      <button
        onClick={onOpenTeam}
        title="Team Members & Collaboration"
        className="grid size-8 place-items-center rounded-xl border border-white/10 bg-[#161620] text-gray-300 transition-colors hover:border-brand/40 hover:bg-[#1d1d2b] hover:text-white"
      >
        <Users className="size-4" />
      </button>

      {/* Inbox Button + Badge */}
      <button
        onClick={onOpenInbox}
        title="Inbox & Task Alerts"
        className="relative grid size-8 place-items-center rounded-xl border border-white/10 bg-[#161620] text-gray-300 transition-colors hover:border-brand/40 hover:bg-[#1d1d2b] hover:text-white"
      >
        <Inbox className="size-4" />
        {unreadInboxCount > 0 && (
          <span className="absolute -right-1 -top-1 grid min-w-4 h-4 place-items-center rounded-full bg-brand px-1 text-[9px] font-bold text-white shadow-md">
            {unreadInboxCount}
          </span>
        )}
      </button>
    </div>
  );
}
