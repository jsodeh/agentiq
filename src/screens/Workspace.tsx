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

    // Listen for task started
    unlistenPromises.push(
      listen<AgentEvent>('task_started', (event) => {
        const { taskId, description } = event.payload;
        console.log('[Workspace] Task started:', taskId);
        setMessages((current) => [
          ...current,
          {
            id: `task-start-${taskId}`,
            role: 'assistant',
            content: `Starting task...`,
            meta: 'Initializing'
          }
        ]);
      })
    );

    // Listen for agent thinking
    unlistenPromises.push(
      listen<AgentEvent>('agent_thinking', (event) => {
        const { taskId, reasoning, expectedOutcome } = event.payload;
        console.log('[Workspace] Agent thinking:', reasoning);
        setMessages((current) => {
          const filtered = current.filter(m => m.id !== `task-start-${taskId}`);
          return [
            ...filtered,
            {
              id: `thinking-${taskId}`,
              role: 'assistant',
              content: reasoning || 'Analyzing your request...',
              meta: expectedOutcome ? `Expected: ${expectedOutcome}` : undefined
            }
          ];
        });
      })
    );

    // Listen for action started
    unlistenPromises.push(
      listen<AgentEvent>('action_started', (event) => {
        const { taskId, tool, description } = event.payload;
        console.log('[Workspace] Action started:', tool);
        setMessages((current) => [
          ...current,
          {
            id: `action-${taskId}-${tool}`,
            role: 'assistant',
            content: description || `Executing ${tool}...`,
            meta: `Tool: ${tool}`
          }
        ]);
      })
    );

    // Listen for action completed
    unlistenPromises.push(
      listen<AgentEvent>('action_completed', (event) => {
        const { taskId, tool, result } = event.payload;
        console.log('[Workspace] Action completed:', tool);
        setMessages((current) => {
          const filtered = current.filter(m => m.id !== `action-${taskId}-${tool}`);
          const resultStr = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
          return [
            ...filtered,
            {
              id: `action-result-${taskId}-${tool}`,
              role: 'assistant',
              content: `Completed ${tool}`,
              meta: resultStr.length > 100 ? resultStr.substring(0, 100) + '...' : resultStr
            }
          ];
        });
      })
    );

    // Listen for action failed
    unlistenPromises.push(
      listen<AgentEvent>('action_failed', (event) => {
        const { taskId, tool, error } = event.payload;
        console.error('[Workspace] Action failed:', tool, error);
        setMessages((current) => {
          const filtered = current.filter(m => m.id !== `action-${taskId}-${tool}`);
          return [
            ...filtered,
            {
              id: `action-error-${taskId}-${tool}`,
              role: 'assistant',
              content: `Failed to execute ${tool}: ${error}`,
              meta: 'Error'
            }
          ];
        });
      })
    );

    // Listen for task completed
    unlistenPromises.push(
      listen<AgentEvent>('task_completed', (event) => {
        const { taskId, result } = event.payload;
        console.log('[Workspace] Task completed:', taskId);
        setMessages((current) => {
          // Remove intermediate messages
          const filtered = current.filter(m => 
            !m.id.startsWith(`thinking-${taskId}`) && 
            !m.id.startsWith(`action-${taskId}`) &&
            !m.id.startsWith(`action-result-${taskId}`)
          );
          
          const resultText = result?.plan?.reasoning || 'Task completed successfully';
          return [
            ...filtered,
            {
              id: `task-complete-${taskId}`,
              role: 'assistant',
              content: resultText,
              meta: `${result?.actions?.length || 0} actions executed`
            }
          ];
        });
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
    setIsWorking(true);

    // ─── FAST DIRECT CHAT PATH ──────────────────────────────────────────────────
    if (isDirectChat(description)) {
      try {
        const userId = profile.id || 1;

        // Ensure we have a conversation & agent record
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

        setMessages((current) => [
          ...current,
          {
            id: `reply-${response.message_id}`,
            role: 'assistant',
            content: response.content,
          },
        ]);
      } catch (error) {
        console.error('[Workspace] Direct chat error:', error);
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
      return;
    }

    // ─── FULL AGENTIC WORKFLOW PATH ──────────────────────────────────────────────
    try {
      // 1. Prepare task (route to appropriate agent)
      const prep = await invoke<TaskPreparation>('prepare_task', { description });
      console.log('[Workspace] Task prepared:', prep);

      // 2. Get or create agent in database
      const userId = profile.id || 1;
      const agentId = await invoke<number>('get_or_create_agent', { 
        agentType: prep.agent_id, 
        userId 
      });
      console.log('[Workspace] Agent ID:', agentId);

      // 3. Create conversation if this is the first message
      let conversationId = currentConversationId;
      if (!conversationId) {
        conversationId = await invoke<number>('create_conversation', {
          agentId,
          title: description.substring(0, 50)
        });
        setCurrentConversationId(conversationId);
        console.log('[Workspace] Conversation created:', conversationId);
      }

      // 4. Add user message to database
      await invoke('add_message', {
        conversationId,
        role: 'user',
        content: description
      });

      // 5. Create task in database
      const taskId = await invoke<number>('create_task', {
        agentId,
        description
      });
      setCurrentTaskId(taskId);
      console.log('[Workspace] Task created:', taskId);

      // 6. Show agent routing banner
      setMessages((current) => [
        ...current,
        {
          id: prep.task_id,
          role: 'assistant',
          content: `Routing to ${prep.agent_name} · Working on it…`,
          meta: prep.activated_tools.join(' · ')
        }
      ]);

      // 7. Start the agent
      try {
        const orchestratorClient = getOrchestratorClient();
        await orchestratorClient.runAgent(agentId);
      } catch (error) {
        console.error('[Workspace] Failed to start agent:', error);
      }

    } catch (error) {
      console.error('[Workspace] Task submission error:', error);
      setMessages((current) => [
        ...current,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `I couldn't prepare that task yet. Please try again.`,
          meta: String(error)
        }
      ]);
      setIsWorking(false);
    }
  };

  return <BoltStyleChat username={profile.username} messages={messages} isWorking={isWorking} onSend={submitTask} />;
}

export default function Workspace() {
  return <WorkspaceBoundary><WorkspaceContent /></WorkspaceBoundary>;
}
