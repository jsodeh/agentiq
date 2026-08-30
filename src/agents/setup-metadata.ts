import type { AgentDefinition } from './types';

export type AgentIntegration = {
  id: string;
  label: string;
  kind: 'required' | 'recommended';
};

const INTEGRATION_LABELS: Record<string, string> = {
  gmail: 'Gmail', google: 'Google Workspace', googlemaps: 'Google Maps', google_calendar: 'Google Calendar',
  slack: 'Slack', trello: 'Trello', notion: 'Notion', github: 'GitHub', linkedin: 'LinkedIn',
  twitter: 'X / Twitter', whatsapp: 'WhatsApp', hubspot: 'HubSpot', stripe: 'Stripe', paystack: 'Paystack',
  flutterwave: 'Flutterwave', shopify: 'Shopify', hunterio: 'Hunter.io',
};

function integrationForTool(tool: string, index: number): AgentIntegration {
  const matchedKey = Object.keys(INTEGRATION_LABELS).find((key) => tool.toLowerCase().includes(key));
  return {
    id: tool,
    label: matchedKey ? INTEGRATION_LABELS[matchedKey] : tool.replace(/[_-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
    kind: index === 0 ? 'required' : 'recommended',
  };
}

export function getAgentSetup(agent: AgentDefinition): Required<Pick<AgentDefinition, 'skills' | 'integrations'>> {
  const tools = agent.composioTools?.length ? agent.composioTools : agent.tools ?? [];
  const integrations = tools.map(integrationForTool).filter((integration, index, list) => list.findIndex((item) => item.label === integration.label) === index);

  return {
    skills: agent.skills?.length ? agent.skills : [agent.category, 'Autonomous workflows', 'Human approval handling'],
    integrations: agent.integrations?.length ? agent.integrations : integrations.length ? integrations : [{ id: `${agent.id}-workspace`, label: 'Agent workspace', kind: 'required' }],
  };
}
