import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import { Brain, ChevronDown, Lightbulb, Paperclip, Plus, SendHorizontal, Sparkles, Zap } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { WorkspaceBottomMenu, WorkspaceSidebar } from './workspace-navigation';

export type WorkspaceMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  meta?: string;
};

const models = [
  { id: 'balanced', name: 'Balanced',       icon: Sparkles, color: 'text-brand'      },
  { id: 'fast',     name: 'Fast',            icon: Zap,      color: 'text-amber-300'  },
  { id: 'deep',     name: 'Deep reasoning',  icon: Brain,    color: 'text-cyan-300'   },
];

export function BoltStyleChat({
  username,
  messages,
  isWorking,
  onSend,
}: {
  username?: string;
  messages: WorkspaceMessage[];
  isWorking: boolean;
  onSend: (message: string) => void;
}) {
  const [input, setInput]               = useState('');
  const [model, setModel]               = useState(models[0]);
  const [modelOpen, setModelOpen]       = useState(false);
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [bottomMenuOpen, setBottomMenuOpen] = useState(false);
  const [notice, setNotice]             = useState<string | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const end      = useRef<HTMLDivElement>(null);
  const hasMessages = messages.length > 0;
  const ModelIcon   = model.icon;

  // Auto-scroll to latest message
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isWorking]);

  // Auto-resize textarea
  useEffect(() => {
    if (textarea.current) {
      textarea.current.style.height = 'auto';
      textarea.current.style.height = `${Math.min(textarea.current.scrollHeight, 140)}px`;
    }
  }, [input]);

  const submit = () => {
    if (!input.trim() || isWorking) return;
    onSend(input.trim());
    setInput('');
  };

  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const toggleSidebar = () => { setSidebarOpen(o => !o); setBottomMenuOpen(false); };
  const toggleBottom  = () => { setBottomMenuOpen(o => !o); setSidebarOpen(false); };

  const handleNavigation = (label: string) => {
    if (label === 'New task') {
      setInput(''); textarea.current?.focus(); setNotice('Ready for a new task.');
    } else if (label === 'Workspace') {
      setNotice('You are already in your workspace.');
    } else {
      setNotice(`${label} is coming soon.`);
    }
    window.setTimeout(() => setNotice(null), 2600);
  };

  // Sidebar offset classes
  const sidebarOffset = sidebarOpen ? 'md:ml-56' : 'md:ml-14';

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#0f0f12] text-white">
      <WorkspaceSidebar open={sidebarOpen} onToggle={toggleSidebar} onAction={handleNavigation} username={username} />

      {/* ── Background arc — an oversized circle placed below the viewport ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* The circle is deliberately several viewport widths wide, so only its top arc is visible. */}
        <div className="absolute left-1/2 top-[51%] size-[220vmax] -translate-x-1/2 rounded-full border-[7px] border-[#0876ff] shadow-[0_0_12px_4px_rgba(8,118,255,0.85),0_0_48px_18px_rgba(8,118,255,0.55)]">
          <div className="absolute inset-[9px] rounded-full border-[7px] border-[#75b4ff]" />
          <div className="absolute inset-[20px] rounded-full border-[14px] border-[#f6f8ff] shadow-[0_0_10px_rgba(255,255,255,0.7)]" />
        </div>
        {/* A subtle blue bloom makes the upper workspace feel connected to the arc. */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_75%_42%_at_50%_48%,rgba(10,96,180,0.28),transparent_74%)]" />
      </div>

      {/* ── Header — badge only, no logo ── */}
      <header
        className={`${hasMessages ? 'relative' : 'absolute inset-x-0 top-0'} z-10 flex items-center justify-end border-b border-white/[0.07] px-5 py-3 transition-[margin] sm:px-8 ${sidebarOffset}`}
      >
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-[#a0a0a8]">
          Autonomous workspace
        </span>
      </header>

      {/* ── Main area ── */}
      {hasMessages ? (
        /* ── Conversation view ── */
        <main className={`relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 pt-6 pb-36 transition-[margin] ${sidebarOffset}`}>
          <div className="space-y-4">
            {messages.map((message) => (
              <motion.article
                key={message.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  message.role === 'user'
                    ? 'bg-brand text-white'
                    : 'border border-white/[0.08] bg-white/[0.045] text-[#e8e8ec]'
                }`}>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  {message.meta && (
                    <p className="mt-2 border-t border-white/10 pt-2 text-[11px] font-medium text-accent">
                      {message.meta}
                    </p>
                  )}
                </div>
              </motion.article>
            ))}

            {isWorking && (
              <div className="flex items-center gap-2 text-sm text-[#a0a0a8]">
                <span className="size-2 animate-pulse rounded-full bg-accent" />
                Preparing the right agent and tools…
              </div>
            )}
            <div ref={end} />
          </div>
        </main>
      ) : (
        /* ── Empty / hero state — true centre of viewport ── */
        <main
          className="absolute inset-0 z-0 flex items-center justify-center px-5"
        >
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex w-full max-w-xl flex-col items-center gap-4 text-center"
          >
            {/* Sparkle icon */}
            <div className="grid size-9 place-items-center rounded-xl border border-brand/30 bg-brand/10 text-brand">
              <Sparkles className="size-4" />
            </div>

            {/* Headline */}
            <h1 className="text-[1.6rem] font-bold leading-tight tracking-tight sm:text-[2.1rem]">
              What would you like to{' '}
              <span className="bg-gradient-to-r from-brand via-[#a989ff] to-accent bg-clip-text text-transparent">
                get done?
              </span>
            </h1>

            {/* Sub-copy */}
            <p className="max-w-sm text-[13px] leading-relaxed text-[#a0a0a8]">
              Describe the outcome. agēntīq selects the right specialist, prepares its capabilities, and begins the work.
            </p>

            {username && (
              <p className="text-[11px] font-medium text-brand">Ready when you are, @{username}</p>
            )}

            {/* ── Inline input box (empty state only) ── */}
            <div className="mt-1 w-full rounded-2xl border border-white/[0.1] bg-[#1a1a20] shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
              <textarea
                ref={textarea}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={keyDown}
                placeholder="Describe a task, goal, or problem…"
                className="min-h-[58px] w-full resize-none bg-transparent px-4 pb-2.5 pt-3 text-[13px] text-white outline-none placeholder:text-[#686870]"
              />
              <div className="flex items-center justify-between px-2.5 pb-2.5">
                <div className="flex items-center gap-0.5">
                  <button type="button" title="Attachments coming soon" className="grid size-7 place-items-center rounded-full bg-white/[0.07] text-[#9898a1] hover:bg-white/10 hover:text-white">
                    <Plus className="size-3.5" />
                  </button>
                  <button type="button" title="Attachments coming soon" className="grid size-7 place-items-center rounded-full text-[#9898a1] hover:bg-white/[0.07] hover:text-white">
                    <Paperclip className="size-3.5" />
                  </button>
                  {/* Model selector */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setModelOpen(!modelOpen)}
                      className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] text-[#aaaab2] hover:bg-white/[0.07] hover:text-white"
                    >
                      <ModelIcon className={`size-3 ${model.color}`} />
                      {model.name}
                      <ChevronDown className="size-2.5" />
                    </button>
                    {modelOpen && (
                      <div className="absolute bottom-full left-0 mb-2 w-40 rounded-xl border border-white/10 bg-[#222229] p-1 shadow-2xl">
                        {models.map((item) => {
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => { setModel(item); setModelOpen(false); }}
                              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] text-[#b7b7bf] hover:bg-white/[0.07] hover:text-white"
                            >
                              <Icon className={`size-3 ${item.color}`} />
                              {item.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="hidden text-[11px] text-[#777780] sm:inline">
                    <Lightbulb className="mr-1 inline size-3" />Agent selected automatically
                  </span>
                  <button
                    onClick={submit}
                    disabled={!input.trim() || isWorking}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-[12px] font-semibold hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Send <SendHorizontal className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </main>
      )}

      {/* ── Pinned input bar (conversation mode only) ── */}
      {hasMessages && (
        <div className={`fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-[#0f0f12] via-[#0f0f12] to-transparent px-5 pb-4 pt-10 transition-[left] md:left-14 ${sidebarOpen ? 'md:left-56' : ''}`}>
          <div className="mx-auto w-full max-w-3xl">
            <AnimatePresence>
              {notice && (
                <motion.div
                  role="status"
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
                  className="mb-2 w-fit rounded-lg border border-white/10 bg-[#222229] px-3 py-1.5 text-[11px] text-[#c7c7cf] shadow-xl"
                >
                  {notice}
                </motion.div>
              )}
            </AnimatePresence>
            <div className="rounded-2xl border border-white/[0.1] bg-[#1a1a20] shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
              <textarea
                ref={textarea}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={keyDown}
                placeholder="Describe a task, goal, or problem…"
                className="min-h-[58px] w-full resize-none bg-transparent px-4 pb-2.5 pt-3 text-[13px] text-white outline-none placeholder:text-[#686870]"
              />
              <div className="flex items-center justify-between px-2.5 pb-2.5">
                <div className="flex items-center gap-0.5">
                  <button type="button" title="Attachments coming soon" className="grid size-7 place-items-center rounded-full bg-white/[0.07] text-[#9898a1] hover:bg-white/10 hover:text-white">
                    <Plus className="size-3.5" />
                  </button>
                  <button type="button" title="Attachments coming soon" className="grid size-7 place-items-center rounded-full text-[#9898a1] hover:bg-white/[0.07] hover:text-white">
                    <Paperclip className="size-3.5" />
                  </button>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setModelOpen(!modelOpen)}
                      className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] text-[#aaaab2] hover:bg-white/[0.07] hover:text-white"
                    >
                      <ModelIcon className={`size-3 ${model.color}`} />
                      {model.name}
                      <ChevronDown className="size-2.5" />
                    </button>
                    {modelOpen && (
                      <div className="absolute bottom-full left-0 mb-2 w-40 rounded-xl border border-white/10 bg-[#222229] p-1 shadow-2xl">
                        {models.map((item) => {
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => { setModel(item); setModelOpen(false); }}
                              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] text-[#b7b7bf] hover:bg-white/[0.07] hover:text-white"
                            >
                              <Icon className={`size-3 ${item.color}`} />
                              {item.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="hidden text-[11px] text-[#777780] sm:inline">
                    <Lightbulb className="mr-1 inline size-3" />Agent selected automatically
                  </span>
                  <button
                    onClick={submit}
                    disabled={!input.trim() || isWorking}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-[12px] font-semibold hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Send <SendHorizontal className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notice toast (empty state) */}
      {!hasMessages && (
        <div className="fixed bottom-5 left-1/2 z-20 -translate-x-1/2">
          <AnimatePresence>
            {notice && (
              <motion.div
                role="status"
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
                className="w-fit rounded-lg border border-white/10 bg-[#222229] px-3 py-1.5 text-[11px] text-[#c7c7cf] shadow-xl"
              >
                {notice}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <WorkspaceBottomMenu open={bottomMenuOpen} onToggle={toggleBottom} onAction={handleNavigation} />
    </div>
  );
}
