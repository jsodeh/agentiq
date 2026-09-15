import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Bell, CheckCheck, CheckCircle, Inbox, Info, X } from 'lucide-react';

export interface InboxMessage {
  id: number;
  profile_id: number;
  title: string;
  body: string;
  type: 'info' | 'approval' | 'alert' | 'task_done';
  read: boolean;
  action_url?: string;
  created_at: string;
}

interface InboxDrawerModalProps {
  isOpen: boolean;
  profileId: number;
  onClose: () => void;
  onUpdateUnread?: (count: number) => void;
}

export function InboxDrawerModal({ isOpen, profileId, onClose, onUpdateUnread }: InboxDrawerModalProps) {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading]   = useState(false);

  const fetchInbox = async () => {
    setLoading(true);
    try {
      const res = await invoke<string>('get_inbox_messages', { profileId });
      const parsed: InboxMessage[] = JSON.parse(res) || [];
      setMessages(parsed);
      const unreadCount = parsed.filter((m) => !m.read).length;
      if (onUpdateUnread) onUpdateUnread(unreadCount);
    } catch (err) {
      console.error('Failed to fetch inbox messages:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchInbox();
  }, [isOpen, profileId]);

  const handleMarkRead = async (id: number) => {
    try {
      await invoke('mark_inbox_read', { messageId: id });
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, read: true } : m)));
      const remainingUnread = messages.filter((m) => m.id !== id && !m.read).length;
      if (onUpdateUnread) onUpdateUnread(remainingUnread);
    } catch (err) {
      console.error('Failed to mark message read:', err);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'alert':    return <AlertTriangle className="size-4 text-amber-500 dark:text-amber-400" />;
      case 'task_done':return <CheckCircle   className="size-4 text-emerald-600 dark:text-emerald-400" />;
      case 'approval': return <Bell          className="size-4 text-cyan-600 dark:text-cyan-400" />;
      default:         return <Info          className="size-4 text-brand" />;
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm dark:bg-black/60"
        />

        {/* Drawer */}
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 250 }}
          className={
            'relative z-10 flex h-full w-full max-w-md flex-col shadow-2xl ' +
            'border-l border-black/10 bg-white text-[#0a0a0f] ' +
            'dark:border-white/10 dark:bg-[#121217] dark:text-white'
          }
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-black/10 bg-[#f5f5f7] px-5 py-4 dark:border-white/10 dark:bg-[#181820]">
            <div className="flex items-center gap-2.5">
              <div className="grid size-8 place-items-center rounded-lg bg-brand/20 text-brand">
                <Inbox className="size-4" />
              </div>
              <h2 className="text-sm font-bold text-[#0a0a0f] dark:text-white">Inbox &amp; Activity Alerts</h2>
            </div>
            <button
              onClick={onClose}
              className="grid size-7 place-items-center rounded-lg text-gray-500 hover:bg-black/[0.06] hover:text-[#0a0a0f] dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading ? (
              <p className="py-12 text-center text-xs text-gray-400">Loading inbox...</p>
            ) : messages.length === 0 ? (
              <div className="py-20 text-center text-xs text-gray-400 dark:text-gray-500">
                <Inbox className="mx-auto mb-2 size-8 opacity-30" />
                No notification messages in this profile.
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`group relative flex flex-col rounded-xl border p-3.5 transition-colors ${
                    msg.read
                      ? 'border-black/[0.06] bg-black/[0.02] text-gray-500 dark:border-white/5 dark:bg-white/[0.02] dark:text-gray-400'
                      : 'border-brand/40 bg-brand/10 text-[#0a0a0f] dark:text-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      {getTypeIcon(msg.type)}
                      <h4 className="text-xs font-bold">{msg.title}</h4>
                    </div>
                    {!msg.read && (
                      <button
                        onClick={() => handleMarkRead(msg.id)}
                        title="Mark as read"
                        className="text-gray-400 hover:text-brand"
                      >
                        <CheckCheck className="size-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-300">{msg.body}</p>
                  <span className="mt-2 text-[10px] text-gray-400 dark:text-gray-500">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
