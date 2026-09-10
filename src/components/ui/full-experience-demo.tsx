import React, { useState, useEffect, useRef } from 'react';
import { ChatLayout } from '../ChatLayout';
import { ChatMessage, Message } from '../ChatMessage';
import { ToolCallEntry } from './tool-calls-section';
import { Send, Sparkles, Calendar, Mail, Clock, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

// Suggestion card type
interface SuggestionCard {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  prompt: string;
  color: string;
}

// Demo suggestions
const suggestions: SuggestionCard[] = [
  {
    id: '1',
    icon: Calendar,
    title: "What's my day like?",
    description: "Check calendar, emails, and tasks",
    prompt: "What's my day like today?",
    color: "from-blue-500 to-cyan-500",
  },
  {
    id: '2',
    icon: Mail,
    title: "Catch up on emails",
    description: "Summarize unread emails and draft replies",
    prompt: "Catch me up on my emails and help me respond",
    color: "from-purple-500 to-pink-500",
  },
  {
    id: '3',
    icon: TrendingUp,
    title: "Sales performance",
    description: "Analyze sales data and create report",
    prompt: "Analyze this week's sales performance and create a summary report",
    color: "from-emerald-500 to-teal-500",
  },
  {
    id: '4',
    icon: Clock,
    title: "Schedule meeting",
    description: "Find time and send invites",
    prompt: "Schedule a team sync for this week and send calendar invites",
    color: "from-amber-500 to-orange-500",
  },
];

// Simulated workflow steps
const generateWorkflowSteps = (type: string) => {
  const workflows: Record<string, any[]> = {
    "day": [
      { id: '1', name: 'Check calendar events', status: 'pending' },
      { id: '2', name: 'Fetch unread emails', status: 'pending' },
      { id: '3', name: 'Get pending tasks', status: 'pending' },
      { id: '4', name: 'Generate daily summary', status: 'pending' },
    ],
    "emails": [
      { id: '1', name: 'Fetch unread emails', status: 'pending' },
      { id: '2', name: 'Analyze email content', status: 'pending' },
      { id: '3', name: 'Draft reply to important emails', status: 'pending' },
      { id: '4', name: 'Save drafts to Gmail', status: 'pending' },
    ],
    "sales": [
      { id: '1', name: 'Query sales database', status: 'pending' },
      { id: '2', name: 'Analyze trends and metrics', status: 'pending' },
      { id: '3', name: 'Generate charts and graphs', status: 'pending' },
      { id: '4', name: 'Create PDF report', status: 'pending' },
      { id: '5', name: 'Send report to stakeholders', status: 'pending' },
    ],
    "meeting": [
      { id: '1', name: 'Check team availability', status: 'pending' },
      { id: '2', name: 'Find optimal time slot', status: 'pending' },
      { id: '3', name: 'Create calendar event', status: 'pending' },
      { id: '4', name: 'Send meeting invites', status: 'pending' },
    ],
  };
  return workflows[type] || workflows["day"];
};

export function FullExperienceDemo() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize dark theme
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    document.documentElement.classList.toggle('dark');
  };

  // Simulate agent response with workflow
  const simulateAgentResponse = async (userPrompt: string) => {
    setIsProcessing(true);
    setShowSuggestions(false);

    // Determine workflow type
    let workflowType = "day";
    if (userPrompt.toLowerCase().includes("email")) workflowType = "emails";
    else if (userPrompt.toLowerCase().includes("sales") || userPrompt.toLowerCase().includes("performance")) workflowType = "sales";
    else if (userPrompt.toLowerCase().includes("schedule") || userPrompt.toLowerCase().includes("meeting")) workflowType = "meeting";

    // Add user message
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userPrompt,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 800));

    // Agent acknowledges
    const ackMsg: Message = {
      id: `ack-${Date.now()}`,
      role: 'assistant',
      content: "I'll help you with that. Let me create a plan...",
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, ackMsg]);

    await new Promise(resolve => setTimeout(resolve, 1200));

    // Agent creates workflow
    const workflowSteps = generateWorkflowSteps(workflowType);
    const workflowId = `workflow-${Date.now()}`;
    
    const planMsg: Message = {
      id: `plan-${Date.now()}`,
      role: 'assistant',
      content: `Created a plan with ${workflowSteps.length} steps. Let me execute this for you.`,
      timestamp: new Date(),
      workflow: {
        id: workflowId,
        steps: workflowSteps,
      },
    };
    setMessages(prev => [...prev, planMsg]);

    await new Promise(resolve => setTimeout(resolve, 1500));

    // Execute workflow steps with tool calls
    await executeWorkflowSteps(workflowId, workflowSteps, workflowType);

    setIsProcessing(false);
  };

  const executeWorkflowSteps = async (workflowId: string, steps: any[], type: string) => {
    const toolCallsByType: Record<string, ToolCallEntry[][]> = {
      "day": [
        [
          {
            tool_name: 'get_calendar_events',
            tool_category: 'google_calendar',
            integration_name: 'Google Calendar',
            message: 'Retrieved today\'s calendar events',
            inputs: { date: new Date().toISOString().split('T')[0], timeZone: 'America/New_York' },
            output: 'Found 4 events: Team standup (9am), Client call (11am), Lunch with Sarah (12:30pm), Design review (3pm)',
          },
        ],
        [
          {
            tool_name: 'fetch_unread_emails',
            tool_category: 'gmail',
            integration_name: 'Gmail',
            message: 'Fetched unread emails',
            inputs: { mailbox: 'INBOX', limit: 50 },
            output: 'Retrieved 12 unread emails. 3 marked as important.',
          },
        ],
        [
          {
            tool_name: 'get_tasks',
            tool_category: 'database',
            message: 'Retrieved pending tasks',
            inputs: { status: 'pending', assignee: 'me' },
            output: 'Found 7 pending tasks. 2 due today, 5 due this week.',
          },
        ],
        [
          {
            tool_name: 'generate_summary',
            tool_category: 'automation',
            message: 'Generated daily summary',
            inputs: { 
              events: 4, 
              emails: 12, 
              tasks: 7,
              format: 'markdown' 
            },
            output: 'Summary generated successfully.',
          },
        ],
      ],
      "emails": [
        [
          {
            tool_name: 'fetch_unread_emails',
            tool_category: 'gmail',
            integration_name: 'Gmail',
            message: 'Fetched unread emails',
            inputs: { mailbox: 'INBOX', limit: 50 },
            output: 'Retrieved 12 unread emails from the last 24 hours.',
          },
        ],
        [
          {
            tool_name: 'analyze_content',
            tool_category: 'automation',
            message: 'Analyzed email content',
            inputs: { emails: 12, extract: ['sentiment', 'priority', 'action_items'] },
            output: JSON.stringify({ urgent: 2, important: 3, routine: 7 }, null, 2),
          },
        ],
        [
          {
            tool_name: 'draft_reply',
            tool_category: 'gmail',
            integration_name: 'Gmail',
            message: 'Drafted replies to important emails',
            inputs: { count: 3, tone: 'professional' },
            output: 'Created 3 draft replies. Ready for review.',
          },
        ],
        [
          {
            tool_name: 'save_drafts',
            tool_category: 'gmail',
            integration_name: 'Gmail',
            message: 'Saved drafts to Gmail',
            inputs: { drafts: 3 },
            output: 'All drafts saved successfully. You can review and send them from Gmail.',
          },
        ],
      ],
      "sales": [
        [
          {
            tool_name: 'query_database',
            tool_category: 'database',
            message: 'Queried sales database',
            inputs: { 
              query: 'SELECT * FROM sales WHERE date >= DATE_SUB(NOW(), INTERVAL 7 DAY)',
              database: 'production' 
            },
            output: 'Retrieved 847 sales records from the last 7 days.',
          },
        ],
        [
          {
            tool_name: 'analyze_metrics',
            tool_category: 'analytics',
            message: 'Analyzed trends and calculated metrics',
            inputs: { 
              metrics: ['revenue', 'conversion_rate', 'avg_order_value'],
              compare_to: 'previous_week' 
            },
            output: JSON.stringify({
              revenue: '$87,430',
              revenue_growth: '+12%',
              conversion_rate: '3.4%',
              avg_order_value: '$103.20',
            }, null, 2),
          },
        ],
        [
          {
            tool_name: 'generate_charts',
            tool_category: 'automation',
            message: 'Generated visualization charts',
            inputs: { 
              charts: ['revenue_trend', 'top_products', 'regional_breakdown'],
              format: 'png' 
            },
            output: 'Created 3 charts successfully.',
          },
        ],
        [
          {
            tool_name: 'create_pdf_report',
            tool_category: 'file',
            message: 'Created PDF report',
            inputs: { 
              title: 'Weekly Sales Report',
              sections: ['summary', 'charts', 'recommendations'],
              branding: true 
            },
            output: 'Report generated: weekly_sales_report_2024.pdf (2.4 MB)',
          },
        ],
        // This step needs approval
        [],
      ],
      "meeting": [
        [
          {
            tool_name: 'check_availability',
            tool_category: 'google_calendar',
            integration_name: 'Google Calendar',
            message: 'Checked team member availability',
            inputs: { 
              attendees: ['john@company.com', 'sarah@company.com', 'mike@company.com'],
              duration: 60,
              timeframe: 'this_week' 
            },
            output: 'Found 8 time slots where all attendees are available.',
          },
        ],
        [
          {
            tool_name: 'find_optimal_time',
            tool_category: 'automation',
            message: 'Found optimal meeting time',
            inputs: { 
              slots: 8,
              preferences: ['morning', 'avoid_lunch', 'avoid_friday'] 
            },
            output: 'Best time: Thursday 10:00 AM - 11:00 AM',
          },
        ],
        [
          {
            tool_name: 'create_calendar_event',
            tool_category: 'google_calendar',
            integration_name: 'Google Calendar',
            message: 'Created calendar event',
            inputs: { 
              title: 'Team Sync Meeting',
              start: '2024-03-21T10:00:00Z',
              duration: 60,
              attendees: 3,
              location: 'Conference Room A' 
            },
            output: 'Event created successfully. Event ID: evt_abc123',
          },
        ],
        // This step needs approval
        [],
      ],
    };

    const toolCalls = toolCallsByType[type] || toolCallsByType["day"];
    const finalResults: Record<string, string> = {
      "day": `**Your Day at a Glance**

📅 **Calendar** (4 events)
- 9:00 AM - Team Standup (30 min)
- 11:00 AM - Client Call with Acme Corp (60 min)
- 12:30 PM - Lunch with Sarah (60 min)
- 3:00 PM - Design Review (45 min)

📧 **Emails** (12 unread)
- 3 important emails requiring action
- 9 routine emails

✅ **Tasks** (7 pending)
- 2 due today: "Finalize Q1 report", "Review design mockups"
- 5 due this week

You have a moderately busy day. I recommend reviewing those 3 important emails before your 11 AM call.`,
      
      "emails": `**Email Summary**

I've analyzed your 12 unread emails and created draft replies for the 3 most important ones:

**Urgent (2)**
- Client inquiry from Acme Corp - needs proposal by EOD
- Team escalation - requires your decision on bug priority

**Important (3)**
- Partnership opportunity from Tech Solutions
- Meeting request from VP of Sales
- Invoice approval needed

**Routine (7)**
- Newsletter subscriptions
- Team updates
- Calendar notifications

✅ **3 draft replies created** - Check your Gmail drafts to review and send.`,

      "sales": `**Weekly Sales Performance Report**

📊 **Key Metrics**
- Total Revenue: **$87,430** (↑12% vs last week)
- Conversion Rate: **3.4%** (↑0.3%)
- Average Order Value: **$103.20** (↑$8.50)
- Total Orders: **847**

🏆 **Top Performers**
1. Product A - $28,540 (32.7%)
2. Product B - $19,230 (22.0%)
3. Product C - $15,180 (17.4%)

🌍 **Regional Breakdown**
- West Coast: 38%
- East Coast: 34%
- Central: 28%

✅ **PDF Report Created**: weekly_sales_report_2024.pdf

Strong performance this week! Revenue growth continues its upward trend.`,

      "meeting": `**Meeting Scheduled**

✅ **Team Sync Meeting**
- **Date**: Thursday, March 21, 2024
- **Time**: 10:00 AM - 11:00 AM
- **Location**: Conference Room A
- **Attendees**: John, Sarah, Mike (+ you)

📧 **Calendar invites ready to send**

The timing works well for everyone - morning slot with no conflicts. All attendees have confirmed availability.`,
    };

    // Execute steps one by one
    for (let i = 0; i < steps.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Update step status to running
      const runningSteps = steps.map((s, idx) => ({
        ...s,
        status: idx < i ? 'completed' : idx === i ? 'running' : 'pending',
      }));

      // Update workflow in messages
      setMessages(prev => prev.map(msg => 
        msg.workflow?.id === workflowId 
          ? { ...msg, workflow: { ...msg.workflow, steps: runningSteps } }
          : msg
      ));

      await new Promise(resolve => setTimeout(resolve, 1800));

      // Complete the step
      const completedSteps = steps.map((s, idx) => ({
        ...s,
        status: idx <= i ? 'completed' : 'pending',
      }));

      setMessages(prev => prev.map(msg => 
        msg.workflow?.id === workflowId 
          ? { ...msg, workflow: { ...msg.workflow, steps: completedSteps } }
          : msg
      ));

      // Add tool call message if available
      if (toolCalls[i] && toolCalls[i].length > 0) {
        await new Promise(resolve => setTimeout(resolve, 400));
        
        const toolMsg: Message = {
          id: `tools-${Date.now()}-${i}`,
          role: 'assistant',
          content: `Step ${i + 1} completed.`,
          timestamp: new Date(),
          toolCalls: toolCalls[i],
        };
        setMessages(prev => [...prev, toolMsg]);
      }

      // Check if we need approval on the last step
      if (i === steps.length - 1 && (type === "sales" || type === "meeting")) {
        await new Promise(resolve => setTimeout(resolve, 800));

        // Show approval gate
        const approvalMsg: Message = {
          id: `approval-${Date.now()}`,
          role: 'assistant',
          content: 'I need your approval to proceed with the final step.',
          timestamp: new Date(),
          workflow: {
            id: workflowId,
            steps: completedSteps,
          },
        };

        setMessages(prev => [...prev, approvalMsg]);

        // Set pending step
        const pendingStepData = {
          tool: type === "sales" ? 'send_email_report' : 'send_calendar_invites',
          params: type === "sales" 
            ? { 
                recipients: ['team@company.com', 'executives@company.com'],
                subject: 'Weekly Sales Report',
                attachments: ['weekly_sales_report_2024.pdf'] 
              }
            : { 
                attendees: ['john@company.com', 'sarah@company.com', 'mike@company.com'],
                event_id: 'evt_abc123' 
              },
        };

        // Update the approval message with pending step
        setMessages(prev => prev.map((msg, idx) => {
          if (msg.id === approvalMsg.id) {
            return {
              ...msg,
              workflow: {
                id: workflowId,
                steps: completedSteps,
              },
            };
          }
          return msg;
        }));

        // Store workflow for approval handlers
        (window as any).__currentWorkflow = {
          id: workflowId,
          steps: completedSteps,
        };
        (window as any).__pendingStep = pendingStepData;

        return; // Wait for user approval
      }
    }

    // All steps completed - show final result
    await new Promise(resolve => setTimeout(resolve, 1000));

    const resultMsg: Message = {
      id: `result-${Date.now()}`,
      role: 'assistant',
      content: finalResults[type],
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, resultMsg]);
  };

  const handleApprove = async () => {
    const workflow = (window as any).__currentWorkflow;
    const pendingStep = (window as any).__pendingStep;

    if (!workflow || !pendingStep) return;

    // Add approval message
    const approvalMsg: Message = {
      id: `approved-${Date.now()}`,
      role: 'system',
      content: '✅ Workflow approved. Executing final step...',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, approvalMsg]);

    await new Promise(resolve => setTimeout(resolve, 1500));

    // Execute final step
    const finalToolCall: ToolCallEntry = pendingStep.tool === 'send_email_report'
      ? {
          tool_name: 'send_email',
          tool_category: 'gmail',
          integration_name: 'Gmail',
          message: 'Sent report to stakeholders',
          inputs: pendingStep.params,
          output: 'Email sent successfully to 2 recipients with 1 attachment.',
        }
      : {
          tool_name: 'send_calendar_invites',
          tool_category: 'google_calendar',
          integration_name: 'Google Calendar',
          message: 'Sent meeting invites',
          inputs: pendingStep.params,
          output: 'Calendar invites sent to 3 attendees. All invites accepted.',
        };

    const toolMsg: Message = {
      id: `final-tool-${Date.now()}`,
      role: 'assistant',
      content: 'Final step completed successfully!',
      timestamp: new Date(),
      toolCalls: [finalToolCall],
    };
    setMessages(prev => [...prev, toolMsg]);

    // Clear workflow data
    delete (window as any).__currentWorkflow;
    delete (window as any).__pendingStep;

    // Update messages to remove pending workflow
    setMessages(prev => prev.map(msg => 
      msg.workflow?.id === workflow.id ? { ...msg, workflow: undefined } : msg
    ));

    await new Promise(resolve => setTimeout(resolve, 800));

    const doneMsg: Message = {
      id: `done-${Date.now()}`,
      role: 'assistant',
      content: '✅ **All done!** Is there anything else I can help you with?',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, doneMsg]);

    setShowSuggestions(true);
  };

  const handleReject = () => {
    const workflow = (window as any).__currentWorkflow;

    const rejectMsg: Message = {
      id: `rejected-${Date.now()}`,
      role: 'system',
      content: '❌ Workflow cancelled. The final step was not executed.',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, rejectMsg]);

    // Clear workflow data
    delete (window as any).__currentWorkflow;
    delete (window as any).__pendingStep;

    // Update messages to remove pending workflow
    setMessages(prev => prev.map(msg => 
      msg.workflow?.id === workflow.id ? { ...msg, workflow: undefined } : msg
    ));

    setShowSuggestions(true);
  };

  // Get current workflow and pending step for approval
  const currentWorkflow = (window as any).__currentWorkflow;
  const pendingStep = (window as any).__pendingStep;

  const handleSendMessage = () => {
    if (!input.trim() || isProcessing) return;
    simulateAgentResponse(input);
    setInput('');
  };

  const handleSuggestionClick = (prompt: string) => {
    setInput(prompt);
    setTimeout(() => handleSendMessage(), 100);
  };

  return (
    <div className={theme}>
      <ChatLayout
        theme={theme}
        onThemeToggle={toggleTheme}
        status={isProcessing ? "Processing..." : "Ready"}
      >
        <div className="flex flex-col min-h-full">
          {/* Empty state with suggestions */}
          {messages.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-8">
              <div className="text-center space-y-3 max-w-md">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-2">
                  <Sparkles className="w-8 h-8 text-primary" />
                </div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-primary via-purple-400 to-pink-500 bg-clip-text text-transparent">
                  Welcome to agentiq
                </h1>
                <p className="text-muted-foreground text-sm">
                  Your AI-powered workspace assistant. Choose a suggestion below or describe what you need.
                </p>
              </div>

              {/* Suggestion Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl">
                {suggestions.map((suggestion) => {
                  const Icon = suggestion.icon;
                  return (
                    <button
                      key={suggestion.id}
                      onClick={() => handleSuggestionClick(suggestion.prompt)}
                      className="group relative overflow-hidden rounded-xl border border-border bg-card hover:bg-card/80 p-4 text-left transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <div className={cn(
                        "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-10 transition-opacity",
                        suggestion.color
                      )} />
                      <div className="relative flex items-start gap-3">
                        <div className={cn(
                          "flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br shrink-0",
                          suggestion.color
                        )}>
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm text-foreground mb-1">
                            {suggestion.title}
                          </h3>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {suggestion.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.length > 0 && (
            <div className="flex-1 pb-32">
              {messages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  currentWorkflow={msg.workflow ? currentWorkflow : null}
                  pendingStep={msg.workflow ? pendingStep : undefined}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Show suggestions again after completion */}
          {messages.length > 0 && showSuggestions && !isProcessing && (
            <div className="px-6 pb-32 pt-6">
              <p className="text-xs text-muted-foreground text-center mb-4">
                Try another action:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-2xl mx-auto">
                {suggestions.map((suggestion) => {
                  const Icon = suggestion.icon;
                  return (
                    <button
                      key={suggestion.id}
                      onClick={() => handleSuggestionClick(suggestion.prompt)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card hover:bg-card/80 text-left transition-all text-xs"
                    >
                      <Icon className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-foreground font-medium">{suggestion.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background to-transparent p-4 border-t border-border">
            <div className="max-w-3xl mx-auto">
              <div className="flex gap-2 items-end">
                <div className="flex-1 relative">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Describe what you need..."
                    disabled={isProcessing}
                    className="w-full px-4 py-3 pr-12 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed"
                    rows={1}
                    style={{ minHeight: '48px', maxHeight: '120px' }}
                  />
                </div>
                <button
                  onClick={handleSendMessage}
                  disabled={!input.trim() || isProcessing}
                  className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground text-center mt-2">
                Press Enter to send • Shift+Enter for new line
              </p>
            </div>
          </div>
        </div>
      </ChatLayout>
    </div>
  );
}

export default FullExperienceDemo;
