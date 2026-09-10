import React from 'react';
import {
  Mail,
  Calendar,
  MessageSquare,
  Database,
  Search,
  Code,
  FileText,
  Users,
  Brain,
  Zap,
  Globe,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  BarChart,
  type LucideProps,
} from 'lucide-react';

const categoryIconMap: Record<string, React.ComponentType<LucideProps>> = {
  gmail: Mail,
  google_calendar: Calendar,
  slack: MessageSquare,
  database: Database,
  search: Search,
  executor: Code,
  memory: Brain,
  handoff: Users,
  file: FileText,
  web: Globe,
  billing: DollarSign,
  commerce: ShoppingCart,
  analytics: BarChart,
  automation: Zap,
  marketing: TrendingUp,
};

export function getToolCategoryIcon(
  category: string,
  props: { width: number; height: number },
  iconUrl?: string,
): React.ReactNode {
  if (iconUrl) {
    return (
      <img
        src={iconUrl}
        alt={category}
        className="min-w-8 min-h-8 rounded-lg object-cover"
        style={{ width: props.width, height: props.height }}
      />
    );
  }

  const IconComponent = categoryIconMap[category.toLowerCase()];
  if (IconComponent) {
    return (
      <div className="p-1 min-w-8 min-h-8 bg-zinc-200 dark:bg-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-400 backdrop-blur">
        <IconComponent size={props.width - 8} className="w-full h-full" />
      </div>
    );
  }

  return null;
}

export function formatToolName(toolName: string): string {
  return toolName
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
