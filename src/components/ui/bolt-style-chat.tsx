import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import { Brain, ChevronDown, Lightbulb, Paperclip, Plus, SendHorizontal, Sparkles, Zap } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { WorkspaceBottomMenu, WorkspaceSidebar } from './workspace-navigation';
import { SettingsModal } from './SettingsModal';
import { KnowledgeBaseModal } from './KnowledgeBaseModal';
import { CustomSkillModal } from './CustomSkillModal';
import { WorkspaceHeaderPanel } from './WorkspaceHeaderPanel';
import { InboxDrawerModal } from './InboxDrawerModal';
import { TeamModal } from './TeamModal';
import { ProfileManagerModal } from './ProfileManagerModal';
import { QuickActionPills } from './QuickActionPills';
import { ToolCallsSection, ToolCallEntry } from './tool-calls-section';

export type WorkspaceMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  meta?: string;
  toolCalls?: ToolCallEntry[];
};

const models = [
  { id: 'balanced', name: 'Balanced',       icon: Sparkles, color: 'text-brand'      },
  { id: 'fast',     name: 'Fast',            icon: Zap,      color: 'text-amber-500'  },
  { id: 'deep',     name: 'Deep reasoning',  icon: Brain,    color: 'text-cyan-600 dark:text-cyan-300'   },
];

export function BoltStyleChat({
  username,
  messages,
  isWorking,
  workingText = 'Thinking…',
  onSend,
}: {
  username?: string;
  messages: WorkspaceMessage[];
  isWorking: boolean;
  workingText?: string;
  onSend: (message: string) => void;
}) {
  const [input, setInput]                     = useState('');
  const [model, setModel]                     = useState(models[0]);
  const [modelOpen, setModelOpen]             = useState(false);
  const [sidebarOpen, setSidebarOpen]         = useState(false);
  const [bottomMenuOpen, setBottomMenuOpen]   = useState(false);
  const [settingsOpen, setSettingsOpen]       = useState(false);
  const [knowledgeModalOpen, setKnowledgeModalOpen] = useState(false);
  const [customSkillModalOpen, setCustomSkillModalOpen] = useState(false);
  const [inboxOpen, setInboxOpen]             = useState(false);
  const [teamOpen, setTeamOpen]               = useState(false);
  const [profileManagerOpen, setProfileManagerOpen] = useState(false);
  const [unreadInboxCount, setUnreadInboxCount] = useState(1);
  const [activeProfileId, setActiveProfileId] = useState(1);
  const [notice, setNotice]                   = useState<string | null>(null);

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

  const submitWithPrompt = (promptText: string) => {
    if (!promptText.trim() || isWorking) return;
    onSend(promptText.trim());
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
    if (label === 'Settings' || label === 'Profile') {
      setSettingsOpen(true);
    } else if (label === 'Knowledge Base') {
      setKnowledgeModalOpen(true);
    } else if (label === 'Custom Skills') {
      setCustomSkillModalOpen(true);
    } else if (label === 'New task') {
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
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-white text-[#0a0a0f] dark:bg-[#09090b] dark:text-white font-sans transition-colors duration-200">
      <WorkspaceSidebar open={sidebarOpen} onToggle={toggleSidebar} onAction={handleNavigation} username={username} />

      {/* ── Header ── */}
      <header
        className={`${hasMessages ? 'relative' : 'absolute inset-x-0 top-0'} z-10 flex items-center justify-between border-b border-black/[0.08] bg-[#f5f5f7] px-5 py-3 transition-[margin] sm:px-8 ${sidebarOffset} dark:border-white/[0.08] dark:bg-[#0d0d12]`}
      >
        <span className="rounded-full border border-black/10 bg-black/[0.04] px-3 py-1 text-[11px] font-semibold text-[#6b6b78] dark:border-white/10 dark:bg-white/[0.04] dark:text-[#a0a0a8]">
          AgentIQ Autonomous OS
        </span>

        {/* Top-Right Control Bar */}
        <WorkspaceHeaderPanel
          onOpenInbox={() => setInboxOpen(true)}
          onOpenTeam={() => setTeamOpen(true)}
          onOpenProfileManager={() => setProfileManagerOpen(true)}
          unreadInboxCount={unreadInboxCount}
        />
      </header>

      {/* ── Main area ── */}
      {hasMessages ? (
        /* ── Conversation view ── */
        <main className={`relative z-10 flex flex-1 flex-col transition-[margin] ${sidebarOffset}`}>
          <div className="flex-1 px-5">
            <div className="mx-auto w-full max-w-3xl pb-36 pt-6">
              {messages.map((message, index) => {
                const isThinking      = message.id.startsWith('thinking-');
                const isAction        = message.id.startsWith('action-') && !message.id.includes('result') && !message.id.includes('error');
                const isActionResult  = message.id.startsWith('action-result-');
                const isError         = message.id.includes('error');
                const isTaskComplete  = message.id.startsWith('task-complete-');

                return (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.03 }}
                    className="group w-full border-b border-black/[0.06] py-4 dark:border-white/[0.06]"
                  >
                    <div className="px-3">
                      <div className="flex items-baseline justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] uppercase font-bold tracking-widest ${
                            message.role === 'user' ? 'text-brand' : 'text-emerald-600 dark:text-emerald-400'
                          }`}>
                            {message.role === 'user' ? 'YOU' : 'AGENTIQ OS'}
                          </span>
                          {isThinking && (
                            <span className="flex items-center gap-1 text-[9px] text-cyan-600 dark:text-cyan-400">
                              <Brain className="size-3" /> Thinking
                            </span>
                          )}
                          {isAction && (
                            <span className="flex items-center gap-1 text-[9px] text-amber-600 dark:text-amber-400">
                              <Zap className="size-3 animate-pulse" /> Executing
                            </span>
                          )}
                          {isActionResult && (
                            <span className="flex items-center gap-1 text-[9px] text-emerald-600 dark:text-emerald-400">
                              <span className="size-2 rounded-full bg-emerald-500 dark:bg-emerald-400" /> Completed
                            </span>
                          )}
                          {isTaskComplete && (
                            <span className="flex items-center gap-1 text-[9px] text-emerald-700 font-bold dark:text-emerald-300">
                              <Sparkles className="size-3" /> Task Finished
                            </span>
                          )}
                          {isError && (
                            <span className="flex items-center gap-1 text-[9px] text-red-600 dark:text-red-400">
                              <span className="size-2 rounded-full bg-red-500 dark:bg-red-400" /> Error
                            </span>
                          )}
                        </div>
                        <span className="text-[9px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className={`text-[13px] leading-relaxed whitespace-pre-wrap ${
                        isError      ? 'text-red-600 dark:text-red-300' :
                        isThinking   ? 'text-cyan-700 italic dark:text-cyan-200' :
                        'text-[#1a1a1e] dark:text-[#e4e4e7]'
                      }`}>
                        {message.content}
                      </div>

                      {/* Stacked Tool Call Section UI Component */}
                      {message.toolCalls && message.toolCalls.length > 0 && (
                        <div className="mt-3">
                          <ToolCallsSection toolCalls={message.toolCalls} defaultExpanded={false} />
                        </div>
                      )}

                      {message.meta && !message.toolCalls && (
                        <div className="mt-2.5 flex items-center gap-2 border-t border-black/10 pt-2 dark:border-white/10">
                          <span className={`text-[11px] font-medium ${
                            isError        ? 'text-red-500 dark:text-red-400' :
                            isActionResult ? 'text-emerald-600 dark:text-emerald-400' :
                            'text-brand'
                          }`}>
                            {isError ? '⚠️' : isActionResult ? '✓' : '🔧'} {message.meta}
                          </span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}

              {isWorking && (
                <div className="flex items-center gap-2 border-b border-black/[0.06] px-3 py-4 text-xs text-gray-500 dark:border-white/[0.06] dark:text-gray-400">
                  <span className="size-2 animate-pulse rounded-full bg-brand" />
                  {workingText}
                </div>
              )}
              <div ref={end} />
            </div>
          </div>
        </main>
      ) : (
        /* ── Solid Idle Viewport ── */
        <main className="absolute inset-0 z-0 flex items-center justify-center px-5 pt-12">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex w-full max-w-2xl flex-col items-center gap-4 text-center"
          >
            {/* Logo / Badge */}
            <div className="grid size-12 place-items-center rounded-2xl border border-brand/40 bg-brand/10 text-brand shadow-lg">
              <Sparkles className="size-6" />
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-[#0a0a0f] dark:text-white sm:text-4xl">
              What can I{' '}
              <span className="text-brand">
                automate for you?
              </span>
            </h1>

            {/* Input box */}
            <div className="mt-1 w-full rounded-2xl border border-black/10 bg-[#f5f5f7] shadow-lg dark:border-white/10 dark:bg-[#121217] dark:shadow-2xl">
              <textarea
                ref={textarea}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={keyDown}
                placeholder="Describe a task, goal, or problem…"
                className="min-h-[80px] w-full resize-none bg-transparent px-4 pb-2.5 pt-3.5 text-sm text-[#0a0a0f] outline-none placeholder:text-gray-400 dark:text-white dark:placeholder:text-gray-500"
              />
              <div className="flex items-center justify-between px-3 pb-3">
                <div className="flex items-center gap-1">
                  <button type="button" title="Add attachments" className="grid size-8 place-items-center rounded-lg bg-black/5 text-gray-500 hover:bg-black/10 hover:text-[#0a0a0f] dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white">
                    <Plus className="size-4" />
                  </button>
                  <button type="button" title="Attach file" className="grid size-8 place-items-center rounded-lg text-gray-400 hover:bg-black/5 hover:text-[#0a0a0f] dark:hover:bg-white/5 dark:hover:text-white">
                    <Paperclip className="size-4" />
                  </button>
                  {/* Model selector */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setModelOpen(!modelOpen)}
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-black/5 dark:text-gray-300 dark:hover:bg-white/5"
                    >
                      <ModelIcon className={`size-3.5 ${model.color}`} />
                      {model.name}
                      <ChevronDown className="size-3" />
                    </button>
                    {modelOpen && (
                      <div className="absolute bottom-full left-0 mb-2 w-44 rounded-xl border border-black/10 bg-white p-1.5 shadow-xl z-30 dark:border-white/10 dark:bg-[#1c1c24] dark:shadow-2xl">
                        {models.map((item) => {
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => { setModel(item); setModelOpen(false); }}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-gray-600 hover:bg-black/5 hover:text-[#0a0a0f] dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
                            >
                              <Icon className={`size-4 ${item.color}`} />
                              {item.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={submit}
                    disabled={!input.trim() || isWorking}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 shadow-md"
                  >
                    Send <SendHorizontal className="size-4" />
                  </button>
                </div>
              </div>
            </div>

            <p className="w-full text-left text-[11px] text-gray-500">
              AgentIQ Prime coordinates tools, knowledge base context, and specialized sub-agents to deliver turn-key executions.
            </p>

            {/* Quick Action Pills — below the input area */}
            <div className="w-full">
              <QuickActionPills onSelect={submitWithPrompt} />
            </div>
          </motion.div>
        </main>
      )}

      {/* ── Pinned input bar (conversation mode) ── */}
      {hasMessages && (
        <div className={`fixed inset-x-0 bottom-0 z-20 bg-white px-5 pb-5 pt-4 transition-[left] md:left-14 dark:bg-[#09090b] ${sidebarOpen ? 'md:left-56' : ''}`}>
          <div className="mx-auto w-full max-w-3xl">
            <AnimatePresence>
              {notice && (
                <motion.div
                  role="status"
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
                  className="mb-2 w-fit rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs text-gray-600 shadow-lg dark:border-white/10 dark:bg-[#1c1c24] dark:text-gray-300 dark:shadow-xl"
                >
                  {notice}
                </motion.div>
              )}
            </AnimatePresence>
            <div className="rounded-2xl border border-black/10 bg-[#f5f5f7] shadow-lg dark:border-white/10 dark:bg-[#121217] dark:shadow-2xl">
              <textarea
                ref={textarea}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={keyDown}
                placeholder="Describe a task, goal, or problem…"
                className="min-h-[58px] w-full resize-none bg-transparent px-4 pb-2.5 pt-3 text-xs text-[#0a0a0f] outline-none placeholder:text-gray-400 dark:text-white dark:placeholder:text-gray-500"
              />
              <div className="flex items-center justify-between px-3 pb-2.5">
                <div className="flex items-center gap-1">
                  <button type="button" title="Add attachments" className="grid size-7 place-items-center rounded-lg bg-black/5 text-gray-500 hover:bg-black/10 hover:text-[#0a0a0f] dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white">
                    <Plus className="size-3.5" />
                  </button>
                  <button type="button" title="Attach file" className="grid size-7 place-items-center rounded-lg text-gray-400 hover:bg-black/5 hover:text-[#0a0a0f] dark:hover:bg-white/5 dark:hover:text-white">
                    <Paperclip className="size-3.5" />
                  </button>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setModelOpen(!modelOpen)}
                      className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] text-gray-600 hover:bg-black/5 dark:text-gray-300 dark:hover:bg-white/5"
                    >
                      <ModelIcon className={`size-3 ${model.color}`} />
                      {model.name}
                      <ChevronDown className="size-3" />
                    </button>
                    {modelOpen && (
                      <div className="absolute bottom-full left-0 mb-2 w-44 rounded-xl border border-black/10 bg-white p-1.5 shadow-xl z-30 dark:border-white/10 dark:bg-[#1c1c24] dark:shadow-2xl">
                        {models.map((item) => {
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => { setModel(item); setModelOpen(false); }}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-gray-600 hover:bg-black/5 hover:text-[#0a0a0f] dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
                            >
                              <Icon className={`size-3.5 ${item.color}`} />
                              {item.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={submit}
                    disabled={!input.trim() || isWorking}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Send <SendHorizontal className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <WorkspaceBottomMenu open={bottomMenuOpen} onToggle={toggleBottom} onAction={handleNavigation} />
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <KnowledgeBaseModal isOpen={knowledgeModalOpen} onClose={() => setKnowledgeModalOpen(false)} />
      <CustomSkillModal isOpen={customSkillModalOpen} onClose={() => setCustomSkillModalOpen(false)} />
      <InboxDrawerModal isOpen={inboxOpen} profileId={activeProfileId} onClose={() => setInboxOpen(false)} onUpdateUnread={setUnreadInboxCount} />
      <TeamModal isOpen={teamOpen} profileId={activeProfileId} onClose={() => setTeamOpen(false)} />
      <ProfileManagerModal
        isOpen={profileManagerOpen}
        onClose={() => setProfileManagerOpen(false)}
        onProfileSwitched={(p) => setActiveProfileId(p.id)}
      />
    </div>
  );
}
