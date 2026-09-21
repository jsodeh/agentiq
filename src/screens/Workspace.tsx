import { Component, type ErrorInfo, type ReactNode, useMemo, useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { BoltStyleChat, type WorkspaceMessage } from '../components/ui/bolt-style-chat';
import { getOrchestratorClient } from '../lib/orchestrator-client';

type TaskPreparation = { agent_id: string; agent_name: string; activated_tools: string[]; task_id: string; };
type ChatResponse = { message_id: number; content: string; };

/** Agile intent classifier — returns true if the prompt is simple conversational (no tools needed) */
function isDirectChat(prompt: string): boolean {
  const p = prompt.trim().toLowerCase();
  // Very short prompts (≤5 words) without task keywords are treated as conversational
  const wordCount = p.split(/\s+/).length;
  const taskKeywords = [
    'search', 'find', 'look up', 'browse', 'scrape', 'fetch', 'get me',
    'generate', 'create', 'write', 'build', 'make', 'code', 'debug', 'fix',
    'invoice', 'email', 'schedule', 'book', 'calendar', 'lead', 'prospect',
    'post', 'publish', 'send', 'automate', 'run', 'execute', 'deploy',
    'analyze', 'analyse', 'research', 'market', 'competitor', 'inventory',
    'download', 'upload', 'file', 'read file', 'write file',
  ];
  const hasTaskKeyword = taskKeywords.some(kw => p.includes(kw));
  // Simple greetings & short questions are always direct
  const simplePatterns = [
    /^(hi|hello|hey|sup|yo|howdy)[!?.]*$/,
    /^(good\s?(morning|afternoon|evening|night))[!?.]*$/,
    /^(how are you|what('s| is) up|what can you do)[?!.]*$/,
    /^thank(s| you)[!.]*$/,
    /^(yes|no|ok|okay|sure|got it|sounds good|great|perfect|nice)[!.]*$/,
  ];
  const isSimplePattern = simplePatterns.some(re => re.test(p));
  return isSimplePattern || (wordCount <= 8 && !hasTaskKeyword);
}


interface AgentEvent {
  taskId: number;
  agentId: number;
  reasoning?: string;
  expectedOutcome?: string;
  tool?: string;
  params?: any;
  description?: string;
  result?: any;
  error?: string;
  success?: boolean;
}

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
  const profile = useMemo(() => { try { return JSON.parse(localStorage.getItem('user_profile') || '{}') as { username?: string; id?: number }; } catch { return {}; } }, []);
  const [messages, setMessages] = useState<WorkspaceMessage[]>([]);
  const [isWorking, setIsWorking] = useState(false);
  const [workingText, setWorkingText] = useState('Thinking…');
  const [currentConversationId, setCurrentConversationId] = useState<number | null>(null);
  const [currentTaskId, setCurrentTaskId] = useState<number | null>(null);

  // Initialize orchestrator on mount
  useEffect(() => {
    const initOrchestrator = async () => {
      try {
        const orchestratorClient = getOrchestratorClient();
        await orchestratorClient.start();
        console.log('[Workspace] Orchestrator started');
      } catch (error) {
        console.error('[Workspace] Failed to start orchestrator:', error);
      }
    };

    initOrchestrator();
  }, []);

  // Set up event listeners for agent responses
  useEffect(() => {
    const unlistenPromises: Promise<UnlistenFn>[] = [];

    // Listen for agent thinking
    unlistenPromises.push(
      listen<AgentEvent>('agent_thinking', (event) => {
        const { reasoning } = event.payload;
        console.log('[Workspace] Agent thinking:', reasoning);
        if (reasoning) {
          setWorkingText(reasoning);
        }
      })
    );

    // Listen for action started
    unlistenPromises.push(
      listen<AgentEvent>('action_started', (event) => {
        const { taskId, tool, description, params } = event.payload;
        console.log('[Workspace] Action started:', tool);
        setWorkingText(description || `Executing ${tool}…`);
        
        setMessages((current) => {
          const activeMsgId = `task-run-${taskId}`;
          const existing = current.find((m) => m.id === activeMsgId);
          const newToolCall = {
            tool_name: tool || 'unknown_tool',
            tool_category: tool?.split('_')[0] || 'general',
            message: description || `Executing ${tool}...`,
            inputs: params,
          };

          if (existing) {
            return current.map((m) =>
              m.id === activeMsgId
                ? { ...m, toolCalls: [...(m.toolCalls || []), newToolCall] }
                : m
            );
          } else {
            return [
              ...current,
              {
                id: activeMsgId,
                role: 'assistant',
                content: '',
                toolCalls: [newToolCall],
              },
            ];
          }
        });
      })
    );

    // Listen for action completed
    unlistenPromises.push(
      listen<AgentEvent>('action_completed', (event) => {
        const { taskId, tool, result } = event.payload;
        console.log('[Workspace] Action completed:', tool);
        setMessages((current) => {
          const activeMsgId = `task-run-${taskId}`;
          const resultStr = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
          return current.map((m) => {
            if (m.id === activeMsgId && m.toolCalls) {
              const updatedCalls = m.toolCalls.map((tc) =>
                tc.tool_name === tool ? { ...tc, output: resultStr } : tc
              );
              return { ...m, toolCalls: updatedCalls };
            }
            return m;
          });
        });
      })
    );

    // Listen for action failed
    unlistenPromises.push(
      listen<AgentEvent>('action_failed', (event) => {
        const { taskId, tool, error } = event.payload;
        console.error('[Workspace] Action failed:', tool, error);
        setMessages((current) => {
          const activeMsgId = `task-run-${taskId}`;
          return current.map((m) => {
            if (m.id === activeMsgId && m.toolCalls) {
              const updatedCalls = m.toolCalls.map((tc) =>
                tc.tool_name === tool ? { ...tc, output: `Error: ${error}` } : tc
              );
              return { ...m, toolCalls: updatedCalls };
            }
            return m;
          });
        });
      })
    );

    // Listen for task completed
    unlistenPromises.push(
      listen<AgentEvent>('task_completed', (event) => {
        const { taskId, result } = event.payload;
        console.log('[Workspace] Task completed:', taskId);
        setMessages((current) => {
          const activeMsgId = `task-run-${taskId}`;
          const resultText = result?.plan?.reasoning || result?.output || '';
          const existing = current.find((m) => m.id === activeMsgId);

          if (existing && resultText) {
            return current.map((m) =>
              m.id === activeMsgId
                ? { ...m, content: resultText }
                : m
            );
          }
          return current;
        });
        setIsWorking(false);
      })
    );

    // Listen for task failed
    unlistenPromises.push(
      listen<AgentEvent>('task_failed', (event) => {
        const { taskId, error } = event.payload;
        console.log('[Workspace] Task failed:', taskId, error);
        setMessages((current) => [
          ...current,
          {
            id: `task-failed-${taskId}`,
            role: 'assistant',
            content: `Task execution encountered an error: ${error || 'Unknown error'}`,
            meta: 'Task Error'
          }
        ]);
        setIsWorking(false);
      })
    );

    // Cleanup listeners on unmount
    return () => {
      Promise.all(unlistenPromises).then((unlisteners) => {
        unlisteners.forEach((unlisten) => unlisten());
      });
    };
  }, []);

  const submitTask = async (description: string) => {
    const msgId = `user-${Date.now()}`;
    setMessages((current) => [...current, { id: msgId, role: 'user', content: description }]);
    setWorkingText('Thinking…');
    setIsWorking(true);

    try {
      const userId = profile.id || 1;

      let conversationId = currentConversationId;
      if (!conversationId) {
        const agentId = await invoke<number>('get_or_create_agent', {
          agentType: 'assistant',
          userId,
        });
        conversationId = await invoke<number>('create_conversation', {
          agentId,
          title: description.substring(0, 50),
        });
        setCurrentConversationId(conversationId);
      }

      const response = await invoke<ChatResponse>('send_chat_message', {
        conversationId,
        message: description,
      });

      setMessages((current) => {
        const activeMsgId = `task-run-${conversationId}`;
        const existing = current.find((m) => m.id === activeMsgId);
        if (existing) {
          return current.map((m) =>
            m.id === activeMsgId
              ? { ...m, content: response.content }
              : m
          );
        } else {
          return [
            ...current,
            {
              id: `reply-${response.message_id}`,
              role: 'assistant',
              content: response.content,
            },
          ];
        }
      });
    } catch (error) {
      console.error('[Workspace] Chat error:', error);
      setMessages((current) => [
        ...current,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: "I'm sorry, I couldn't respond right now. Please try again.",
          meta: String(error),
        },
      ]);
    } finally {
      setIsWorking(false);
    }
  };

  return <BoltStyleChat username={profile.username} messages={messages} isWorking={isWorking} workingText={workingText} onSend={submitTask} />;
}

export default function Workspace() {
  return <WorkspaceBoundary><WorkspaceContent /></WorkspaceBoundary>;
}
