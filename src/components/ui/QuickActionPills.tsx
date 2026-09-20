import { motion } from 'framer-motion';
import {
  Camera,
  MessageSquare,
  Calendar,
  Video,
  Mail,
  Search,
  Send,
  FileText,
  MapPin,
  TrendingUp,
} from 'lucide-react';

export interface QuickActionItem {
  id: string;
  label: string;
  prompt: string;
  icon: any;
  color: string;
}

const QUICK_ACTIONS: QuickActionItem[] = [
  {
    id: 'instagram',
    label: 'Manage Instagram',
    prompt: 'Create a 7-day Instagram content strategy with carousel ideas, post captions, and reel hook scripts for my brand.',
    icon: Camera,
    color: 'text-[#00a8a8] bg-[#008080]/10 border-[#008080]/20 hover:border-[#008080]/50',
  },
  {
    id: 'twitter',
    label: 'Automate Twitter (X)',
    prompt: 'Draft a viral 5-tweet thread explaining how our business solves major industry pain points, complete with call-to-action.',
    icon: MessageSquare,
    color: 'text-sky-400 bg-sky-500/10 border-sky-500/20 hover:border-sky-500/50',
  },
  {
    id: 'calendar',
    label: 'Manage Calendar',
    prompt: 'Review my weekly calendar availability, draft meeting scheduling templates, and organize priority time-blocks.',
    icon: Calendar,
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 hover:border-emerald-500/50',
  },
  {
    id: 'youtube',
    label: 'Faceless YouTube Studio',
    prompt: 'Generate 3 high-converting faceless YouTube video concepts, complete with engaging narration scripts and thumbnail titles.',
    icon: Video,
    color: 'text-red-400 bg-red-500/10 border-red-500/20 hover:border-red-500/50',
  },
  {
    id: 'inbox',
    label: 'Summarize Inbox',
    prompt: 'Summarize key incoming client inquiries, extract action items, and draft professional reply templates.',
    icon: Mail,
    color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20 hover:border-cyan-500/50',
  },
  {
    id: 'audit',
    label: 'Competitor Audit',
    prompt: 'Perform a competitive analysis comparing our product offerings, pricing tiers, and positioning against top 3 competitors.',
    icon: Search,
    color: 'text-[#00a8a8] bg-[#008080]/10 border-[#008080]/20 hover:border-[#008080]/50',
  },
  {
    id: 'outreach',
    label: 'Draft Cold Outreach',
    prompt: 'Write a 3-step high-converting B2B cold email sequence targeting marketing directors and business founders.',
    icon: Send,
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/20 hover:border-amber-500/50',
  },
  {
    id: 'invoice',
    label: 'Generate Client Invoice',
    prompt: 'Generate a professional client invoice line item breakdown for monthly digital consulting services.',
    icon: FileText,
    color: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/20 hover:border-emerald-400/50',
  },
  {
    id: 'maps',
    label: 'B2B Lead Discovery (Maps)',
    prompt: 'Use Google Maps search to discover 15 high-rated local businesses in Lagos, extract contact details and reviews.',
    icon: MapPin,
    color: 'text-rose-400 bg-rose-500/10 border-rose-500/20 hover:border-rose-500/50',
  },
  {
    id: 'ads',
    label: 'Optimize Ad Campaigns',
    prompt: 'Audit our ad copy and audience targeting strategy for Facebook and Google Ads to improve ROAS and lower CPC.',
    icon: TrendingUp,
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/20 hover:border-blue-500/50',
  },
];

export function QuickActionPills({ onSelect }: { onSelect: (prompt: string) => void }) {
  return (
    <div className="w-full overflow-hidden py-2">
      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto px-1 pb-1">
        {QUICK_ACTIONS.map((action, index) => {
          const Icon = action.icon;
          return (
            <motion.button
              key={action.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              onClick={() => onSelect(action.prompt)}
              className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all ${action.color}`}
            >
              <Icon className="size-3.5" />
              <span>{action.label}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
