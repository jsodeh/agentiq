import React, { useState } from 'react';
import { ChatLayout } from '../ChatLayout';
import { ChatMessage, Message } from '../ChatMessage';
import { ToolCallEntry } from './tool-calls-section';

// Example usage of the linear message thread UI
export function MessageThreadDemo() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [messages] = useState<Message[]>([
    {
      id: '1',
      role: 'user',
      content: 'Send an email to the team about the product launch and create a calendar event for the kickoff meeting.',
      timestamp: new Date(Date.now() - 120000),
    },
    {
      id: '2',
      role: 'assistant',
      content: 'I\'ll help you with that. Let me send the email and create the calendar event.',
      timestamp: new Date(Date.now() - 110000),
      toolCalls: [
        {
          tool_name: 'send_email',
          tool_category: 'gmail',
          integration_name: 'Gmail',
          message: 'Sent email to the team',
          inputs: { 
            to: 'team@company.com', 
            subject: 'Product Launch - Important Update',
            body: 'Team, we are launching next week. Please review the docs.'
          },
          output: 'Email delivered successfully to 12 recipients.',
        },
        {
          tool_name: 'create_event',
          tool_category: 'google_calendar',
          integration_name: 'Google Calendar',
          message: 'Created meeting for tomorrow at 2 PM',
          inputs: { 
            title: 'Product Launch Kickoff', 
            start: '2024-03-20T14:00:00Z', 
            duration: '45m',
            attendees: ['team@company.com']
          },
          output: 'Event created successfully. Meeting link: https://meet.google.com/abc-defg-hij',
        },
      ] as ToolCallEntry[],
    },
    {
      id: '3',
      role: 'user',
      content: 'Great! Can you also analyze our recent sales data?',
      timestamp: new Date(Date.now() - 60000),
    },
    {
      id: '4',
      role: 'assistant',
      content: 'I\'ll analyze the sales data for you.',
      timestamp: new Date(Date.now() - 50000),
      toolCalls: [
        {
          tool_name: 'query_database',
          tool_category: 'database',
          message: 'Queried sales database',
          inputs: {
            query: 'SELECT * FROM sales WHERE date >= DATE_SUB(NOW(), INTERVAL 30 DAY)',
            database: 'production'
          },
          output: 'Retrieved 1,247 sales records from the last 30 days.',
        },
        {
          tool_name: 'analyze_data',
          tool_category: 'analytics',
          message: 'Performed statistical analysis',
          inputs: {
            dataset: 'sales_last_30_days',
            metrics: ['total_revenue', 'avg_order_value', 'conversion_rate']
          },
          output: JSON.stringify({
            total_revenue: '$125,430',
            avg_order_value: '$101.50',
            conversion_rate: '3.2%',
            trend: 'up 15% from previous month'
          }, null, 2),
        },
      ] as ToolCallEntry[],
    },
    {
      id: '5',
      role: 'assistant',
      content: `Based on the analysis:\n\n**Sales Performance (Last 30 Days)**\n\n- Total Revenue: $125,430\n- Average Order Value: $101.50\n- Conversion Rate: 3.2%\n- Trend: Up 15% from previous month\n\nGreat performance! Revenue is trending upward consistently.`,
      timestamp: new Date(Date.now() - 40000),
    },
    {
      id: '6',
      role: 'user',
      content: 'Excellent! Can you prepare a summary report and schedule a review meeting?',
      timestamp: new Date(Date.now() - 20000),
    },
    {
      id: '7',
      role: 'assistant',
      content: 'I need your approval to create a document and schedule a meeting.',
      timestamp: new Date(Date.now() - 10000),
      workflow: {
        id: 'workflow-1',
        steps: [
          { id: '1', name: 'Generate sales report', status: 'pending' },
          { id: '2', name: 'Upload to shared drive', status: 'pending' },
          { id: '3', name: 'Schedule review meeting', status: 'pending' },
          { id: '4', name: 'Send notifications', status: 'pending' },
        ],
      },
    },
  ]);

  const [currentWorkflow] = useState({
    id: 'workflow-1',
    steps: [
      { id: '1', name: 'Generate sales report', status: 'pending' },
      { id: '2', name: 'Upload to shared drive', status: 'pending' },
      { id: '3', name: 'Schedule review meeting', status: 'pending' },
      { id: '4', name: 'Send notifications', status: 'pending' },
    ],
  });

  const [pendingStep] = useState({
    tool: 'create_document',
    params: {
      title: 'Sales Performance Report - March 2024',
      content: 'Sales analysis and insights...',
      format: 'pdf',
    },
  });

  const handleApprove = () => {
    console.log('Workflow approved');
    alert('Workflow approved! Agent will continue execution.');
  };

  const handleReject = () => {
    console.log('Workflow rejected');
    alert('Workflow rejected. Agent stopped.');
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
    document.documentElement.classList.toggle('dark');
  };

  return (
    <div className={theme}>
      <ChatLayout
        theme={theme}
        onThemeToggle={toggleTheme}
        status="Connected"
      >
        <div className="min-h-full">
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              currentWorkflow={message.workflow ? currentWorkflow : null}
              pendingStep={message.workflow ? pendingStep : undefined}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          ))}
        </div>
      </ChatLayout>
    </div>
  );
}

export default MessageThreadDemo;
