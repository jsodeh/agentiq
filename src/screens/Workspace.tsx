import { Component, type ErrorInfo, type ReactNode, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { BoltStyleChat, type WorkspaceMessage } from '../components/ui/bolt-style-chat';

type TaskPreparation = { agent_id: string; agent_name: string; activated_tools: string[]; task_id: string; };

class WorkspaceBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Workspace failed to render', error, info);
  }

  render() {
    if (this.state.failed) {
      return <main className="grid min-h-screen place-items-center bg-dark p-6 text-center text-white"><div className="max-w-md rounded-2xl border border-midGray/50 bg-white/[0.03] p-8"><h1 className="text-xl font-bold">Your workspace needs a refresh</h1><p className="mt-2 text-sm text-midGray">The workspace UI could not load in this window. Refresh the app to continue.</p><button onClick={() => window.location.assign('/workspace')} className="mt-5 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold">Open workspace</button></div></main>;
    }
    return this.props.children;
  }
}

function WorkspaceContent() {
  const profile = useMemo(() => { try { return JSON.parse(localStorage.getItem('user_profile') || '{}') as { username?: string }; } catch { return {}; } }, []);
  const [messages, setMessages] = useState<WorkspaceMessage[]>([]);
  const [isWorking, setIsWorking] = useState(false);

  const submitTask = async (description: string) => {
    setMessages((current) => [...current, { id: `user-${Date.now()}`, role: 'user', content: description }]);
    setIsWorking(true);
    try {
      const task = await invoke<TaskPreparation>('prepare_task', { description });
      setMessages((current) => [...current, { id: task.task_id, role: 'assistant', content: `I’ve routed this to ${task.agent_name}. Its workspace is prepared and it can begin this task now.`, meta: `${task.activated_tools.join(' · ')} ready` }]);
    } catch (error) {
      setMessages((current) => [...current, { id: `error-${Date.now()}`, role: 'assistant', content: `I couldn’t prepare that task yet. Please try again.`, meta: String(error) }]);
    } finally { setIsWorking(false); }
  };

  return <BoltStyleChat username={profile.username} messages={messages} isWorking={isWorking} onSend={submitTask} />;
}

export default function Workspace() {
  return <WorkspaceBoundary><WorkspaceContent /></WorkspaceBoundary>;
}
