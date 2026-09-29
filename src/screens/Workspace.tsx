import { Component, type ErrorInfo, type ReactNode, useMemo, useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { BoltStyleChat, type WorkspaceMessage, type SubAgentLogEntry, type ApprovalData } from '../components/ui/bolt-style-chat';
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
  parentTaskId?: number;
  agentId?: number;
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
      return <main className="grid min-h-screen place-items-center bg-dark p-6 text-center text-white"><div className="max-w-md rounded-2xl border border-midGray/50 bg-white/[0.03] p-8"><h1 className="text-xl font-bold">Your workspace needs a refresh</h1><p className="mt-2 text-sm text-midGray">The workspace UI encountered a refresh request. Click below to reload.</p><button onClick={() => window.location.reload()} className="mt-5 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold">Reload workspace</button></div></main>;
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
  const currentConversationIdRef = useRef<number | null>(null);
  const activeTurnMsgIdRef = useRef<string | null>(null);

  const getActiveAssistantMsgId = (taskId: number) => {
    return activeTurnMsgIdRef.current || `task-run-${taskId}`;
  };

  useEffect(() => {
    currentConversationIdRef.current = currentConversationId;
  }, [currentConversationId]);

  // Helper to filter out cross-talk events from other active conversations
  const isCurrentContext = (taskId?: number) => {
    if (currentConversationIdRef.current === null) return true;
    return taskId === currentConversationIdRef.current;
  };

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
        if (!isCurrentContext(event.payload?.taskId)) return;
        const { reasoning } = event.payload;
        console.log('[Workspace] Agent thinking:', reasoning);
        if (reasoning) {
          setWorkingText(reasoning);
        }
      })
    );

    // Listen for streaming token chunks
    unlistenPromises.push(
      listen<{ taskId: number; chunk: string }>('agent_token_emitted', (event) => {
        const { taskId, chunk } = event.payload;
        if (!isCurrentContext(taskId)) return;
        setWorkingText('Generating response…');

        setMessages((current) => {
          const activeMsgId = getActiveAssistantMsgId(taskId);
          const existing = current.find((m) => m.id === activeMsgId);

          if (existing) {
            return current.map((m) =>
              m.id === activeMsgId
                ? { ...m, content: (m.content || '') + chunk }
                : m
            );
          } else {
            return [
              ...current,
              {
                id: activeMsgId,
                role: 'assistant',
                content: chunk,
              },
            ];
          }
        });
      })
    );

    // Listen for action limit warning
    unlistenPromises.push(
      listen<{ taskId: number; message: string }>('action_limit_warning', (event) => {
        if (!isCurrentContext(event.payload?.taskId)) return;
        console.warn('[Workspace] Action limit warning:', event.payload?.message);
        setWorkingText('Wrapping up final response…');
      })
    );

    // Listen for action awaiting approval (HITL Suspension)
    unlistenPromises.push(
      listen<{ taskId: number; approvalId: string; tool: string; params?: any; description?: string }>(
        'action_awaiting_approval',
        (event) => {
          const { taskId, approvalId, tool, params, description } = event.payload;
          if (!isCurrentContext(taskId)) return;
          console.log('[Workspace] Action awaiting approval:', tool, approvalId);
          setWorkingText('Awaiting security authorization…');

          const approvalData: ApprovalData = {
            approvalId,
            tool: tool || 'unknown_tool',
            params,
            description: description || `Agent requests approval to execute '${tool}'`,
            status: 'pending',
          };

          setMessages((current) => {
            const activeMsgId = getActiveAssistantMsgId(taskId);
            const existing = current.find((m) => m.id === activeMsgId);

            if (existing) {
              return current.map((m) =>
                m.id === activeMsgId
                  ? { ...m, approvalRequests: [...(m.approvalRequests || []), approvalData] }
                  : m
              );
            } else {
              return [
                ...current,
                {
                  id: activeMsgId,
                  role: 'assistant',
                  content: '',
                  approvalRequests: [approvalData],
                },
              ];
            }
          });
        }
      )
    );

    // Listen for action started
    unlistenPromises.push(
      listen<AgentEvent>('action_started', (event) => {
        const { taskId, parentTaskId, tool, description, params } = event.payload;

        // Sub-agent nested event handling
        if (parentTaskId && parentTaskId === currentConversationIdRef.current) {
          const logEntry: SubAgentLogEntry = {
            subAgentId: tool || 'subagent_action',
            subAgentName: description || tool,
            tool,
            details: description || `Executing ${tool}…`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          setMessages((current) => {
            const activeMsgId = getActiveAssistantMsgId(parentTaskId);
            return current.map((m) =>
              m.id === activeMsgId
                ? { ...m, subAgentLogs: [...(m.subAgentLogs || []), logEntry] }
                : m
            );
          });
          return;
        }

        if (!isCurrentContext(taskId)) return;
        console.log('[Workspace] Action started:', tool);
        setWorkingText(description || `Executing ${tool}…`);
        
        setMessages((current) => {
          const activeMsgId = getActiveAssistantMsgId(taskId);
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
        if (!isCurrentContext(taskId)) return;
        console.log('[Workspace] Action completed:', tool);
        setMessages((current) => {
          const activeMsgId = getActiveAssistantMsgId(taskId);
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

    // Listen for action failed — with premium upgrade interception
    unlistenPromises.push(
      listen<AgentEvent>('action_failed', (event) => {
        const { taskId, tool, error } = event.payload;
        if (!isCurrentContext(taskId)) return;
        console.error('[Workspace] Action failed:', tool, error);

        // ── Tier Upgrade Interception ────────────────────────────────
        // If the error payload starts with "UPGRADE_REQUIRED", suppress
        // the generic error bubble and render a premium upgrade banner.
        const errorStr = typeof error === 'string' ? error : String(error);
        if (errorStr.startsWith('UPGRADE_REQUIRED')) {
          setMessages((current) => [
            ...current,
            {
              id: `upgrade-${taskId}-${Date.now()}`,
              role: 'assistant',
              content: [
                '✨ **Unlock Premium Capabilities**\n\n',
                `This agent persona requires a **Premium upgrade** to execute \`${tool}\`.\n\n`,
                '> 🔒 High-impact automation, browser control, email/calendar write access, ',
                'and advanced integrations are available on the **Premium Tier**.\n\n',
                '**[Upgrade Now →](/settings/billing)**',
              ].join(''),
              meta: 'Premium Required',
            },
          ]);
          setIsWorking(false);
          return;
        }

        // Standard error handling (non-upgrade errors)
        setMessages((current) => {
          const activeMsgId = getActiveAssistantMsgId(taskId);
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
        if (!isCurrentContext(taskId)) return;
        console.log('[Workspace] Task completed:', taskId);
        setMessages((current) => {
          const activeMsgId = getActiveAssistantMsgId(taskId);
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
        if (!isCurrentContext(taskId)) return;
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

    // Reboot recovery: check for pending approval sessions in SQLite database
    invoke<Array<{ conversation_id: number; pending_tool_name?: string; pending_tool_params?: string }>>('get_pending_suspensions')
      .then((pendingList) => {
        if (pendingList && pendingList.length > 0) {
          pendingList.forEach((item) => {
            if (item.conversation_id && item.pending_tool_name) {
              const taskId = item.conversation_id;
              const tool = item.pending_tool_name;
              let params: any = undefined;
              try {
                if (item.pending_tool_params) params = JSON.parse(item.pending_tool_params);
              } catch (_) {}
              const approvalId = `approval-${taskId}-recovered`;

              const approvalData: ApprovalData = {
                approvalId,
                tool,
                params,
                description: `Recovered session: Agent requests approval to execute '${tool}'`,
                status: 'pending',
              };

              setMessages((current) => {
                const activeMsgId = getActiveAssistantMsgId(taskId);
                const existing = current.find((m) => m.id === activeMsgId);

                if (existing) {
                  return current.map((m) =>
                    m.id === activeMsgId
                      ? { ...m, approvalRequests: [...(m.approvalRequests || []), approvalData] }
                      : m
                  );
                } else {
                  return [
                    ...current,
                    {
                      id: activeMsgId,
                      role: 'assistant',
                      content: 'Execution suspended awaiting human approval (recovered session).',
                      approvalRequests: [approvalData],
                    },
                  ];
                }
              });
            }
          });
        }
      })
      .catch((err) => console.warn('[Workspace] Could not fetch pending suspensions:', err));

    // Cleanup listeners on unmount
    return () => {
      Promise.all(unlistenPromises).then((unlisteners) => {
        unlisteners.forEach((unlisten) => unlisten());
      });
    };
  }, []);


  const handleResolveApproval = async (approvalId: string, approved: boolean) => {
    try {
      console.log('[Workspace] Resolving approval:', approvalId, approved);
      setWorkingText(approved ? 'Executing authorized action…' : 'Action rejected. Continuing…');

      setMessages((current) =>
        current.map((m) => {
          if (m.approvalRequests) {
            const hasTarget = m.approvalRequests.some((a) => a.approvalId === approvalId);
            if (hasTarget) {
              return {
                ...m,
                approvalRequests: m.approvalRequests.map((a) =>
                  a.approvalId === approvalId
                    ? { ...a, status: approved ? 'approved' as const : 'denied' as const }
                    : a
                ),
              };
            }
          }
          return m;
        })
      );

      await invoke('resolve_suspension', { id: approvalId, approved });
    } catch (err) {
      console.error('[Workspace] Failed to resolve suspension:', err);
    }
  };

  const submitTask = async (description: string) => {
    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `assistant-turn-${Date.now()}`;
    activeTurnMsgIdRef.current = assistantMsgId;

    setMessages((current) => [
      ...current,
      { id: userMsgId, role: 'user', content: description },
      { id: assistantMsgId, role: 'assistant', content: '' },
    ]);
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
        return current.map((m) =>
          m.id === assistantMsgId
            ? { ...m, content: response.content || m.content }
            : m
        );
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
      activeTurnMsgIdRef.current = null;
    }
  };

  return (
    <BoltStyleChat
      username={profile.username}
      messages={messages}
      isWorking={isWorking}
      workingText={workingText}
      onSend={submitTask}
      onResolveApproval={handleResolveApproval}
    />
  );
}

export default function Workspace() {
  return <WorkspaceBoundary><WorkspaceContent /></WorkspaceBoundary>;
}
