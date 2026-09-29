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

// Automatically import all icon assets from the root "tool icons" folder
const globIcons = import.meta.glob('../../../../tool icons/*', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

// Map of normalized icon keys to asset URLs
const localToolIconsMap: Record<string, string> = {};

Object.entries(globIcons).forEach(([filePath, assetUrl]) => {
  if (!assetUrl) return;
  // Get filename without path and extension (e.g., "Google_Forms.png" -> "Google_Forms")
  const fileNameWithExt = filePath.split('/').pop() || '';
  const baseName = fileNameWithExt.split('.')[0] || '';
  if (baseName) {
    const rawLower = baseName.toLowerCase();
    localToolIconsMap[rawLower] = assetUrl;
    // Normalized key without underscores, hyphens, or spaces (e.g. "googleforms")
    const cleanLower = rawLower.replace(/[^a-z0-9]/g, '');
    if (cleanLower) {
      localToolIconsMap[cleanLower] = assetUrl;
    }
  }
});

/** Helper to find a matching local icon URL by tool name or category */
export function findLocalToolIconUrl(
  toolName?: string,
  category?: string,
): string | undefined {
  const candidates: string[] = [];

  if (toolName) {
    const normTool = toolName.toLowerCase();
    candidates.push(normTool);
    candidates.push(normTool.replace(/[^a-z0-9]/g, ''));

    // If tool name is like "slack_list_channels", "google_docs_write", "gmail_send"
    const parts = normTool.split(/[_-\s]+/);
    if (parts.length > 1) {
      candidates.push(`${parts[0]}_${parts[1]}`);
      candidates.push(`${parts[0]}${parts[1]}`);
      candidates.push(parts[0]);
    }
  }

  if (category) {
    const normCat = category.toLowerCase();
    candidates.push(normCat);
    candidates.push(normCat.replace(/[^a-z0-9]/g, ''));
  }

  for (const key of candidates) {
    if (localToolIconsMap[key]) {
      return localToolIconsMap[key];
    }
  }

  return undefined;
}

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
  toolName?: string,
): React.ReactNode {
  // 1. Check explicitly passed iconUrl
  let resolvedUrl = iconUrl;

  // 2. Check local "tool icons" folder
  if (!resolvedUrl) {
    resolvedUrl = findLocalToolIconUrl(toolName, category);
  }

  if (resolvedUrl) {
    return (
      <img
        src={resolvedUrl}
        alt={toolName || category}
        className="w-7 h-7 max-w-7 max-h-7 rounded-lg object-contain shrink-0"
        style={{ width: Math.min(props.width, 28), height: Math.min(props.height, 28) }}
      />
    );
  }

  // 3. Fallback to Lucide category icon
  const IconComponent =
    categoryIconMap[category.toLowerCase()] ||
    (toolName ? categoryIconMap[toolName.toLowerCase()] : undefined);

  if (IconComponent) {
    return (
      <div className="p-1 w-7 h-7 max-w-7 max-h-7 shrink-0 bg-zinc-200 dark:bg-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-400 backdrop-blur flex items-center justify-center">
        <IconComponent size={Math.min(props.width - 8, 18)} className="w-4 h-4 shrink-0" />
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
