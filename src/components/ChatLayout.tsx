import React from 'react';
import { Moon, Sun, Sparkles } from 'lucide-react';

interface ChatLayoutProps {
  children: React.ReactNode;
  theme?: 'light' | 'dark';
  onThemeToggle?: () => void;
  status?: string;
  onReconnect?: () => void;
}

export function ChatLayout({ 
  children, 
  theme = 'dark', 
  onThemeToggle,
  status,
  onReconnect 
}: ChatLayoutProps) {
  return (
    <div className="flex flex-col h-screen bg-background text-foreground transition-colors duration-300">
      {/* Header */}
      <header className="flex-none border-b border-border bg-card px-3 py-2 z-10 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="font-bold text-lg bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
                agēntīq
              </span>
            </div>
            {status && (
              <span className="text-[10px] text-muted-foreground ml-2">
                {status}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {onThemeToggle && (
              <button
                onClick={onThemeToggle}
                className="p-1.5 rounded-xl hover:bg-muted text-foreground transition-all active:scale-95"
                title="Toggle Theme"
              >
                {theme === 'dark' ? <Moon size={16} strokeWidth={2} /> : <Sun size={16} strokeWidth={2} />}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Scrollable Content Area */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden relative scroll-smooth bg-background">
        {children}
      </main>
    </div>
  );
}
