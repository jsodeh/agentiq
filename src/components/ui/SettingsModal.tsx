import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { open as openUrl } from '@tauri-apps/plugin-shell';
import { 
  Bot, 
  Brain, 
  Check, 
  Cpu, 
  ExternalLink,
  Globe, 
  Key, 
  Lock, 
  Plug,
  Save, 
  Search,
  Settings2, 
  ShieldCheck, 
  Sparkles, 
  Terminal, 
  User, 
  Wrench, 
  X 
} from 'lucide-react';

export interface AppConfig {
  mode: 'cloud' | 'local';
  models: {
    default_model: string;
    local_base_model: string;
    cloud_provider: string;
    cloud_model: string;
    anthropic_api_key?: string;
    openai_api_key?: string;
    gemini_api_key?: string;
    custom_endpoint?: string;
  };
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface IntegrationService {
  id: string;
  name: string;
  category: string;
  credentialKey: string;
  placeholder: string;
  description: string;
  actionsCount: number;
  devConsoleUrl: string;
}

const INTEGRATION_SERVICES: IntegrationService[] = [
  // --- Communication ---
  { id: 'slack',           name: 'Slack',                  category: 'Communication',    credentialKey: 'bot_token',            placeholder: 'xoxb-... (Bot User OAuth Token)',            description: 'Post messages, send channel notifications, and trigger alerts.',             actionsCount: 24, devConsoleUrl: 'https://api.slack.com/apps' },
  { id: 'gmail',           name: 'Google Gmail',           category: 'Communication',    credentialKey: 'oauth_token',          placeholder: 'OAuth2 Client Credentials JSON...',          description: 'Draft, search, and send emails via Gmail API.',                             actionsCount: 26, devConsoleUrl: 'https://console.cloud.google.com/apis/credentials' },
  { id: 'outlook_mail',   name: 'Outlook Mail',           category: 'Communication',    credentialKey: 'access_token',         placeholder: 'Graph API Access Token...',                  description: 'Manage Microsoft 365 Outlook inbox and drafts.',                           actionsCount: 21, devConsoleUrl: 'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade' },
  { id: 'zoom',            name: 'Zoom',                   category: 'Communication',    credentialKey: 'jwt_token',            placeholder: 'Server-to-Server OAuth Token...',            description: 'Schedule video meetings and fetch call recordings.',                       actionsCount: 16, devConsoleUrl: 'https://marketplace.zoom.us/develop/create' },
  { id: 'microsoft_teams', name: 'Microsoft Teams',        category: 'Communication',    credentialKey: 'bot_token',            placeholder: 'Graph API / Bot Token...',                   description: 'Post channel notifications and team chat alerts.',                          actionsCount: 18, devConsoleUrl: 'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade' },
  { id: 'google_meet',    name: 'Google Meet',            category: 'Communication',    credentialKey: 'api_token',            placeholder: 'GCP OAuth2 Credentials...',                  description: 'Generate meeting links and manage video sessions.',                         actionsCount: 9,  devConsoleUrl: 'https://console.cloud.google.com/apis/credentials' },

  // --- Development ---
  { id: 'github',          name: 'GitHub',                 category: 'Development',      credentialKey: 'access_token',         placeholder: 'ghp_... (Classic Personal Access Token)',    description: 'Create issues, review pull requests, and query repository files.',         actionsCount: 38, devConsoleUrl: 'https://github.com/settings/tokens/new' },
  { id: 'linear',          name: 'Linear',                 category: 'Development',      credentialKey: 'api_key',              placeholder: 'lin_api_...',                                description: 'Create and track software issues, cycles, and roadmap tasks.',             actionsCount: 19, devConsoleUrl: 'https://linear.app/settings/api' },
  { id: 'gitlab',          name: 'GitLab',                 category: 'Development',      credentialKey: 'private_token',        placeholder: 'glpat-... (Personal Access Token)',          description: 'Query repos, merge requests, and CI/CD pipeline triggers.',                actionsCount: 29, devConsoleUrl: 'https://gitlab.com/-/profile/personal_access_tokens' },
  { id: 'bitbucket',       name: 'Bitbucket',              category: 'Development',      credentialKey: 'app_password',         placeholder: 'App Password...',                            description: 'Manage code repositories and pull requests.',                               actionsCount: 15, devConsoleUrl: 'https://bitbucket.org/account/settings/app-passwords/new' },

  // --- Project Management ---
  { id: 'asana',           name: 'Asana',                  category: 'Project Mgmt',     credentialKey: 'personal_token',       placeholder: '1/120... (Personal Access Token)',           description: 'Manage task boards, project sections, and team assignments.',              actionsCount: 22, devConsoleUrl: 'https://app.asana.com/0/my-apps' },
  { id: 'notion',          name: 'Notion',                 category: 'Project Mgmt',     credentialKey: 'integration_token',    placeholder: 'secret_... (Internal Integration Token)',    description: 'Read/write database pages, docs, and knowledge bases.',                   actionsCount: 16, devConsoleUrl: 'https://www.notion.so/my-integrations' },
  { id: 'trello',          name: 'Trello',                 category: 'Project Mgmt',     credentialKey: 'api_key',              placeholder: 'Key & Token pair...',                        description: 'Automate Kanban cards, lists, and board workflows.',                       actionsCount: 14, devConsoleUrl: 'https://trello.com/app-key' },
  { id: 'jira',            name: 'Jira',                   category: 'Project Mgmt',     credentialKey: 'api_token',            placeholder: 'ATATT3... (Atlassian API Token)',            description: 'Query backlog, create epics, and update issue statuses.',                  actionsCount: 31, devConsoleUrl: 'https://id.atlassian.com/manage-profile/security/api-tokens' },
  { id: 'clickup',         name: 'ClickUp',                category: 'Project Mgmt',     credentialKey: 'api_token',            placeholder: 'pk_... (Personal API Key)',                  description: 'Synchronize tasks, goals, and team workload spaces.',                      actionsCount: 20, devConsoleUrl: 'https://app.clickup.com/settings/apps' },
  { id: 'monday',          name: 'Monday.com',             category: 'Project Mgmt',     credentialKey: 'api_token',            placeholder: 'eyJhbG... (V2 API Token)',                   description: 'Query boards, items, and status updates.',                                  actionsCount: 18, devConsoleUrl: 'https://auth.monday.com/user/api_tokens' },
  { id: 'basecamp',        name: 'Basecamp',               category: 'Project Mgmt',     credentialKey: 'access_token',         placeholder: 'OAuth Access Token...',                      description: 'Track to-dos, message boards, and project check-ins.',                    actionsCount: 12, devConsoleUrl: 'https://launchpad.37signals.com/integrations' },

  // --- Scheduling ---
  { id: 'google_calendar', name: 'Google Calendar',        category: 'Scheduling',       credentialKey: 'api_token',            placeholder: 'GCP OAuth2 Credentials...',                  description: 'Create events, check availability, and schedule meetings.',                actionsCount: 17, devConsoleUrl: 'https://console.cloud.google.com/apis/credentials' },
  { id: 'outlook_calendar',name: 'Outlook Calendar',       category: 'Scheduling',       credentialKey: 'access_token',         placeholder: 'Graph API Access Token...',                  description: 'Manage Outlook calendar events and invites.',                               actionsCount: 15, devConsoleUrl: 'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade' },
  { id: 'calendly',        name: 'Calendly',               category: 'Scheduling',       credentialKey: 'api_token',            placeholder: 'cal_... (Personal Access Token)',            description: 'Automate booking queries, availability checks, and meeting links.',       actionsCount: 11, devConsoleUrl: 'https://calendly.com/integrations/api_subscriptions' },

  // --- Databases ---
  { id: 'postgres',        name: 'PostgreSQL',             category: 'Databases',        credentialKey: 'connection_string',    placeholder: 'postgresql://user:pass@host:5432/db',        description: 'Query SQL tables, schema metadata, and perform data reads.',               actionsCount: 42, devConsoleUrl: 'https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING' },
  { id: 'sqlite',          name: 'SQLite',                 category: 'Databases',        credentialKey: 'db_path',              placeholder: '/path/to/database.db',                       description: 'Local lightweight database queries and inspections.',                       actionsCount: 35, devConsoleUrl: 'https://www.sqlite.org/docs.html' },
  { id: 'airtable',        name: 'Airtable',               category: 'Databases',        credentialKey: 'api_key',              placeholder: 'pat... (Personal Access Token)',             description: 'Query relational grid bases, views, and record rows.',                    actionsCount: 23, devConsoleUrl: 'https://airtable.com/create/tokens' },
  { id: 'mongodb',         name: 'MongoDB',                category: 'Databases',        credentialKey: 'uri',                  placeholder: 'mongodb+srv://user:pass@cluster.mongodb.net',description: 'Query document collections and JSON stores.',                               actionsCount: 33, devConsoleUrl: 'https://cloud.mongodb.com/v2#/org//settings/publicApi' },
  { id: 'redis',           name: 'Redis',                  category: 'Databases',        credentialKey: 'connection_url',       placeholder: 'redis://:password@host:6379',                description: 'Key-value store, caching, and pub/sub message queues.',                    actionsCount: 21, devConsoleUrl: 'https://redis.io/docs/ui/insight/' },
  { id: 'supabase',        name: 'Supabase',               category: 'Databases',        credentialKey: 'service_role_key',     placeholder: 'eyJh... (Service Role Key)',                 description: 'Manage PostgreSQL, Auth, and Storage buckets.',                            actionsCount: 40, devConsoleUrl: 'https://supabase.com/dashboard/project/_/settings/api' },

  // --- Storage ---
  { id: 'google_drive',   name: 'Google Drive',           category: 'Storage',          credentialKey: 'api_token',            placeholder: 'OAuth2 / Service Account Key JSON...',      description: 'Access workspace files, PDFs, and spreadsheet docs.',                     actionsCount: 27, devConsoleUrl: 'https://console.cloud.google.com/apis/credentials' },
  { id: 'aws_s3',         name: 'AWS S3',                 category: 'Storage',          credentialKey: 'access_key',           placeholder: 'AKIA... (Access Key ID)',                    description: 'Upload/download cloud storage bucket files.',                               actionsCount: 30, devConsoleUrl: 'https://console.aws.amazon.com/iam/home#/security_credentials' },
  { id: 'dropbox',         name: 'Dropbox',                category: 'Storage',          credentialKey: 'access_token',         placeholder: 'sl.B... (OAuth Access Token)',               description: 'Sync file assets, documents, and shared folders.',                         actionsCount: 19, devConsoleUrl: 'https://www.dropbox.com/developers/apps/create' },
  { id: 'box',             name: 'Box',                    category: 'Storage',          credentialKey: 'access_token',         placeholder: 'Developer Token...',                         description: 'Manage enterprise document storage and security.',                          actionsCount: 17, devConsoleUrl: 'https://app.box.com/developers/console' },

  // --- Analytics ---
  { id: 'snowflake',       name: 'Snowflake',              category: 'Analytics',        credentialKey: 'account_url',          placeholder: 'account.snowflakecomputing.com',             description: 'Run cloud data warehouse SQL analytics queries.',                           actionsCount: 28, devConsoleUrl: 'https://app.snowflake.com' },
  { id: 'bigquery',        name: 'BigQuery',               category: 'Analytics',        credentialKey: 'credentials_json',     placeholder: 'GCP Service Account JSON...',                description: 'Execute massive analytical dataset queries.',                               actionsCount: 32, devConsoleUrl: 'https://console.cloud.google.com/iam-admin/serviceaccounts' },
  { id: 'segment',         name: 'Segment',                category: 'Analytics',        credentialKey: 'write_key',            placeholder: 'Write Key...',                               description: 'Track customer event pipelines and data routing.',                          actionsCount: 13, devConsoleUrl: 'https://app.segment.com/goto-my-workspace/sources/catalog' },
  { id: 'mixpanel',        name: 'Mixpanel',               category: 'Analytics',        credentialKey: 'service_account_secret',placeholder: 'Service Account Secret...',                description: 'Query product analytics, funnels, and retention reports.',                  actionsCount: 22, devConsoleUrl: 'https://mixpanel.com/settings/project#serviceaccounts' },
  { id: 'posthog',         name: 'PostHog',                category: 'Analytics',        credentialKey: 'api_key',              placeholder: 'phx_... (Personal API Key)',                 description: 'Query event funnels, session recordings, and feature flags.',              actionsCount: 26, devConsoleUrl: 'https://us.posthog.com/settings/user-api-keys' },
  { id: 'google_analytics',name: 'Google Analytics 4',    category: 'Analytics',        credentialKey: 'credentials_json',     placeholder: 'GCP Service Account Credentials JSON...',   description: 'Fetch website traffic, conversion events, and user demographics.',         actionsCount: 24, devConsoleUrl: 'https://console.cloud.google.com/iam-admin/serviceaccounts' },

  // --- Finance ---
  { id: 'stripe',          name: 'Stripe',                 category: 'Finance',          credentialKey: 'secret_key',           placeholder: 'sk_live_... or sk_test_...',                 description: 'Query customer subscriptions, charges, and invoices.',                     actionsCount: 34, devConsoleUrl: 'https://dashboard.stripe.com/apikeys' },
  { id: 'quickbooks',      name: 'QuickBooks',             category: 'Finance',          credentialKey: 'access_token',         placeholder: 'OAuth Access Token...',                      description: 'Track invoices, expense receipts, and financial reports.',                 actionsCount: 25, devConsoleUrl: 'https://developer.intuit.com/app/developer/dashboard' },

  // --- CRM & Sales ---
  { id: 'hubspot',         name: 'HubSpot',                category: 'CRM & Sales',      credentialKey: 'access_token',         placeholder: 'pat-na1-... (Private App Token)',            description: 'Query CRM contacts, deals, companies, and tickets.',                       actionsCount: 36, devConsoleUrl: 'https://app.hubspot.com/private-apps' },
  { id: 'salesforce',      name: 'Salesforce',             category: 'CRM & Sales',      credentialKey: 'access_token',         placeholder: 'OAuth Session Token...',                     description: 'Manage leads, opportunities, and enterprise CRM data.',                    actionsCount: 45, devConsoleUrl: 'https://login.salesforce.com' },

  // --- Marketing ---
  { id: 'mailchimp',       name: 'Mailchimp',              category: 'Marketing',        credentialKey: 'api_key',              placeholder: 'key-usX (API Key)',                          description: 'Manage subscriber lists, campaigns, and newsletters.',                     actionsCount: 18, devConsoleUrl: 'https://admin.mailchimp.com/account/api/' },

  // --- Commerce ---
  { id: 'shopify',         name: 'Shopify',                category: 'Commerce',         credentialKey: 'access_token',         placeholder: 'shpat_... (Admin API Access Token)',         description: 'Query orders, product catalog, and customer records.',                     actionsCount: 37, devConsoleUrl: 'https://www.shopify.com/partners' },

  // --- Customer Support ---
  { id: 'intercom',        name: 'Intercom',               category: 'Customer Support', credentialKey: 'access_token',         placeholder: 'dG9rOi... (Access Token)',                   description: 'Fetch support tickets, user conversations, and FAQs.',                    actionsCount: 22, devConsoleUrl: 'https://developers.intercom.com/building-apps/docs/authentication' },
  { id: 'zendesk',         name: 'Zendesk',                category: 'Customer Support', credentialKey: 'api_token',            placeholder: 'user@domain.com/token:...',                  description: 'Query support tickets, user profiles, and help center articles.',          actionsCount: 28, devConsoleUrl: 'https://support.zendesk.com/hc/en-us/articles/4408889192858-Generating-a-new-API-token' },
  { id: 'freshdesk',       name: 'Freshdesk',              category: 'Customer Support', credentialKey: 'api_key',              placeholder: 'API Key...',                                 description: 'Manage customer support tickets and agent dispatch.',                       actionsCount: 20, devConsoleUrl: 'https://support.freshdesk.com/en/support/solutions/articles/215517' },

  // --- Social ---
  { id: 'linkedin',        name: 'LinkedIn',               category: 'Social',           credentialKey: 'access_token',         placeholder: 'OAuth Access Token...',                      description: 'Post company updates and query professional network profiles.',             actionsCount: 14, devConsoleUrl: 'https://www.linkedin.com/developers/apps/new' },
  { id: 'twitter_x',      name: 'X (Twitter)',            category: 'Social',           credentialKey: 'bearer_token',         placeholder: 'Bearer Token...',                            description: 'Post tweets, monitor mentions, and run social analytics.',                 actionsCount: 19, devConsoleUrl: 'https://developer.x.com/en/portal/keys-and-tokens' },
  { id: 'discord',         name: 'Discord',                category: 'Social',           credentialKey: 'bot_token',            placeholder: 'MTA... (Bot Token)',                         description: 'Post announcements, send channel embeds, and manage roles.',               actionsCount: 24, devConsoleUrl: 'https://discord.com/developers/applications' },
  { id: 'telegram',        name: 'Telegram Bot',           category: 'Social',           credentialKey: 'bot_token',            placeholder: '123456789:ABCdef... (Bot Token)',            description: 'Send automated group messages, alerts, and bot triggers.',                 actionsCount: 16, devConsoleUrl: 'https://t.me/BotFather' },
  { id: 'whatsapp',        name: 'WhatsApp Business',      category: 'Social',           credentialKey: 'access_token',         placeholder: 'EAAG... (Meta Graph API Token)',             description: 'Send template messages and customer notifications.',                        actionsCount: 15, devConsoleUrl: 'https://developers.facebook.com/apps/' },
];

// Derived ordered list of unique categories
const INTEGRATION_CATEGORIES = ['All', ...Array.from(new Set(INTEGRATION_SERVICES.map(s => s.category)))];

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'models' | 'agents' | 'tools' | 'integrations' | 'profile'>('models');
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Form state
  const [mode, setMode] = useState<'cloud' | 'local'>('cloud');
  const [cloudProvider, setCloudProvider] = useState<string>('anthropic');
  const [cloudModel, setCloudModel] = useState<string>('claude-3-5-sonnet-20241022');
  const [localModel, setLocalModel] = useState<string>('llama3.2:3b');
  const [anthropicKey, setAnthropicKey] = useState<string>('');
  const [openaiKey, setOpenaiKey] = useState<string>('');
  const [geminiKey, setGeminiKey] = useState<string>('');
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);

  // Integrations State & Setup Modal State
  const [connectedServices, setConnectedServices] = useState<string[]>([]);
  const [activeSetupService, setActiveSetupService] = useState<IntegrationService | null>(null);
  const [setupTokenInput, setSetupTokenInput] = useState<string>('');
  const [integrationSearch, setIntegrationSearch] = useState('');
  const [integrationCategory, setIntegrationCategory] = useState('All');

  // Agent behaviors state
  const [selectedAgent, setSelectedAgent] = useState<string>('lead-gen-maps');
  const [autonomyLevel, setAutonomyLevel] = useState<'full' | 'approval'>('approval');

  // Tools state
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);
  const [browserAutomationEnabled, setBrowserAutomationEnabled] = useState(true);
  const [mcpEnabled, setMcpEnabled] = useState(true);

  // User Profile
  const profile = (() => {
    try {
      return JSON.parse(localStorage.getItem('user_profile') || '{}');
    } catch {
      return {};
    }
  })();
  const deploymentMode = localStorage.getItem('deployment_mode') || 'cloud';
  const subTier = localStorage.getItem('subscription_tier') || 'Free';

  // Load user services from backend
  const fetchUserServices = async () => {
    try {
      if (typeof window !== 'undefined' && (window as any).__TAURI__) {
        const services = await invoke<string[]>('list_user_services');
        setConnectedServices(services || []);
      }
    } catch (err) {
      console.warn('[Settings] Failed to fetch connected services:', err);
    }
  };

  // Load existing config & services on mount / open
  useEffect(() => {
    if (!isOpen) return;

    fetchUserServices();

    const loadConfig = async () => {
      setLoading(true);
      try {
        if (typeof window !== 'undefined' && (window as any).__TAURI__) {
          const cfg = await invoke<AppConfig>('get_llm_config');
          if (cfg) {
            setMode(cfg.mode || 'cloud');
            
            const anthKey = cfg.models.anthropic_api_key || '';
            const gKey = cfg.models.gemini_api_key || '';
            const oKey = cfg.models.openai_api_key || '';
            
            let provider = cfg.models.cloud_provider || 'anthropic';
            if (provider === 'anthropic' && !anthKey && gKey) {
              provider = 'gemini';
            }

            setCloudProvider(provider);
            
            let model = cfg.models.cloud_model || '';
            if (!model || model === 'gemini-1.5-flash' || model === 'gemini-2.5-flash') {
              model = provider === 'gemini' ? 'gemini-3.6-flash' : 'claude-3-5-sonnet-20241022';
            }
            setCloudModel(model);

            setLocalModel(cfg.models.local_base_model || 'llama3.2:3b');
            setAnthropicKey(anthKey);
            setOpenaiKey(oKey);
            setGeminiKey(gKey);
          }
        }
      } catch (err) {
        console.warn('[Settings] Failed to fetch backend config, using defaults:', err);
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && activeTab === 'integrations') {
      fetchUserServices();
    }
  }, [isOpen, activeTab]);

  const handleModalConnect = async (serviceId: string, credentialKey: string, rawToken: string) => {
    const token = rawToken.trim();
    if (!token) return;

    setLoading(true);
    setSaveError(null);
    try {
      if (typeof window !== 'undefined' && (window as any).__TAURI__) {
        await invoke('save_user_credential', {
          serviceId,
          credentialKey,
          token,
        });
        await fetchUserServices();
      } else {
        setConnectedServices(prev => Array.from(new Set([...prev, serviceId])));
      }

      setActiveSetupService(null);
      setSetupTokenInput('');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      setSaveError(String(err));
      setTimeout(() => setSaveError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectService = async (serviceId: string, credentialKey: string) => {
    setLoading(true);
    setSaveError(null);
    try {
      if (typeof window !== 'undefined' && (window as any).__TAURI__) {
        await invoke('delete_user_credential', {
          serviceId,
          credentialKey,
        });
        await fetchUserServices();
      } else {
        // Mock fallback for non-tauri dev environment
        setConnectedServices(prev => prev.filter(s => s !== serviceId));
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      setSaveError(String(err));
      setTimeout(() => setSaveError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleCloudProviderChange = (provider: string) => {
    setCloudProvider(provider);
    if (provider === 'anthropic') {
      setCloudModel('claude-3-5-sonnet-20241022');
    } else if (provider === 'openai') {
      setCloudModel('gpt-4o');
    } else if (provider === 'gemini') {
      setCloudModel('gemini-3.6-flash');
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setSaveSuccess(false);
    setSaveError(null);

    const payload = {
      mode,
      models: {
        default_model: mode === 'cloud' ? cloudModel : localModel,
        local_base_model: localModel,
        cloud_provider: cloudProvider,
        cloud_model: cloudModel,
        anthropic_api_key: anthropicKey || null,
        openai_api_key: openaiKey || null,
        gemini_api_key: geminiKey || null,
        custom_endpoint: null,
      }
    };

    try {
      if (typeof window !== 'undefined' && (window as any).__TAURI__) {
        await invoke('update_llm_config', payload);
      }

      localStorage.setItem('deployment_mode', mode);
      localStorage.setItem('selected_model', mode === 'cloud' ? cloudModel : localModel);

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      const errMsg = String(err);
      console.error('[Settings] Failed to save settings:', errMsg);
      setSaveError(errMsg);
      setTimeout(() => setSaveError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative flex h-[82vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-[#181818] text-white shadow-2xl"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 z-20 rounded-lg p-1.5 text-midGray transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="size-5" />
          </button>

          {/* Left Navigation Sidebar */}
          <aside className="w-60 border-r border-white/10 bg-[#122224] p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 px-2 py-3 mb-4">
                <div className="grid size-8 place-items-center rounded-xl bg-brand/20 text-brand">
                  <Settings2 className="size-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold tracking-tight text-white">Settings</h2>
                  <p className="text-[10px] text-midGray">Workspace &amp; Agent Core</p>
                </div>
              </div>

              <nav className="space-y-1">
                <button
                  onClick={() => setActiveTab('models')}
                  className={`flex w-full items-center gap-2 px-3 py-2.5 text-xs font-semibold text-left rounded-xl transition-colors ${
                    activeTab === 'models' ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'text-midGray hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Cpu className="size-4 shrink-0" /> AI Models &amp; Provider
                </button>

                <button
                  onClick={() => setActiveTab('agents')}
                  className={`flex w-full items-center gap-2 px-3 py-2.5 text-xs font-semibold text-left rounded-xl transition-colors ${
                    activeTab === 'agents' ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'text-midGray hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Bot className="size-4 shrink-0" /> Agent Behaviors
                </button>

                <button
                  onClick={() => setActiveTab('tools')}
                  className={`flex w-full items-center gap-2 px-3 py-2.5 text-xs font-semibold text-left rounded-xl transition-colors ${
                    activeTab === 'tools' ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'text-midGray hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Wrench className="size-4 shrink-0" /> Tools &amp; MCP
                </button>

                <button
                  onClick={() => setActiveTab('integrations')}
                  className={`flex w-full items-center gap-2 px-3 py-2.5 text-xs font-semibold text-left rounded-xl transition-colors ${
                    activeTab === 'integrations' ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'text-midGray hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Plug className="size-4 shrink-0" /> Integrations &amp; Connections
                </button>

                <button
                  onClick={() => setActiveTab('profile')}
                  className={`flex w-full items-center gap-2 px-3 py-2.5 text-xs font-semibold text-left rounded-xl transition-colors ${
                    activeTab === 'profile' ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'text-midGray hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <User className="size-4 shrink-0" /> Profile &amp; Plan
                </button>
              </nav>
            </div>

            {/* Save Status Footer */}
            <div className="pt-4 border-t border-white/10 space-y-2">
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-dark transition-all hover:bg-accent/90 disabled:opacity-50"
              >
                {saveSuccess ? (
                  <>
                    <Check className="size-4 text-dark" /> Saved!
                  </>
                ) : (
                  <>
                    <Save className="size-4" /> {loading ? 'Saving…' : 'Save Settings'}
                  </>
                )}
              </button>
              {saveError && (
                <p className="rounded-lg bg-red-900/40 border border-red-500/40 px-3 py-2 text-[10px] text-red-300 leading-relaxed">
                  ⚠️ {saveError}
                </p>
              )}
            </div>
          </aside>

          {/* Right Tab Content Area */}
          <main className="flex-1 overflow-y-auto p-6">
            {/* TAB 1: AI MODELS & PROVIDERS */}
            {activeTab === 'models' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Cpu className="size-5 text-brand" /> AI Model Configuration
                  </h3>
                  <p className="text-xs text-midGray mt-1">
                    Select your primary execution mode and configure API keys or local base models.
                  </p>
                </div>

                {/* Mode Selector Toggle */}
                <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-black/40 p-1.5">
                  <button
                    type="button"
                    onClick={() => setMode('cloud')}
                    className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all ${
                      mode === 'cloud' ? 'bg-brand text-white shadow-md' : 'text-midGray hover:text-white'
                    }`}
                  >
                    <Globe className="size-4" /> Cloud Mode (Anthropic / OpenAI / Gemini)
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode('local')}
                    className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all ${
                      mode === 'local' ? 'bg-brand text-white shadow-md' : 'text-midGray hover:text-white'
                    }`}
                  >
                    <Terminal className="size-4" /> Local Mode (Ollama)
                  </button>
                </div>

                {/* Cloud Mode Settings */}
                {mode === 'cloud' && (
                  <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-brand">Cloud Model Settings</h4>
                    
                    {/* Cloud Provider Select */}
                    <div>
                      <label className="block text-xs font-semibold text-midGray mb-1.5">Cloud Provider</label>
                      <select
                        value={cloudProvider}
                        onChange={(e) => handleCloudProviderChange(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-xs text-white outline-none focus:border-brand"
                      >
                        <option value="anthropic">Anthropic (Claude)</option>
                        <option value="openai">OpenAI (ChatGPT)</option>
                        <option value="gemini">Google (Gemini)</option>
                      </select>
                    </div>

                    {/* Model Choice */}
                    <div>
                      <label className="block text-xs font-semibold text-midGray mb-1.5">Selected Cloud Model</label>
                      <select
                        value={cloudModel}
                        onChange={(e) => setCloudModel(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-xs text-white outline-none focus:border-brand"
                      >
                        {cloudProvider === 'anthropic' && (
                          <>
                            <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet (Recommended)</option>
                            <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku (Fast)</option>
                            <option value="claude-3-opus-20240229">Claude 3 Opus (Complex reasoning)</option>
                          </>
                        )}
                        {cloudProvider === 'openai' && (
                          <>
                            <option value="gpt-4o">GPT-4o (Omni)</option>
                            <option value="gpt-4o-mini">GPT-4o Mini (Fast)</option>
                            <option value="o1-preview">o1 Preview (Reasoning)</option>
                          </>
                        )}
                        {cloudProvider === 'gemini' && (
                          <>
                            <option value="gemini-3.6-flash">Gemini 3.6 Flash (Recommended)</option>
                            <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
                            <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                            <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                          </>
                        )}
                      </select>
                    </div>

                    {/* Provider API Keys Section */}
                    <div className="pt-3 border-t border-white/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
                          <Key className="size-3.5 text-brand" /> Cloud Provider API Keys
                        </h5>
                        <span className="text-[10px] text-midGray">Keys are persisted securely in config.toml</span>
                      </div>

                      {/* Gemini Key */}
                      <div className={`p-2.5 rounded-xl border transition-all ${cloudProvider === 'gemini' ? 'border-brand/50 bg-brand/5' : 'border-white/10 bg-black/30'}`}>
                        <label className="block text-xs font-semibold text-midGray mb-1 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            Google Gemini Key
                            {cloudProvider === 'gemini' && <span className="rounded bg-brand/20 px-1.5 py-0.5 text-[9px] font-bold text-brand">Active</span>}
                          </span>
                          {geminiKey ? (
                            <span className="text-[10px] text-emerald-400 font-medium">✓ Key Configured</span>
                          ) : (
                            <span className="text-[10px] text-midGray">Not Set</span>
                          )}
                        </label>
                        <div className="relative">
                          <input
                            type={showGeminiKey ? 'text' : 'password'}
                            value={geminiKey}
                            onChange={(e) => setGeminiKey(e.target.value)}
                            placeholder="AQ.Ab8... / AIzaSy..."
                            className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-1.5 pr-10 text-xs text-white outline-none focus:border-brand font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => setShowGeminiKey(!showGeminiKey)}
                            className="absolute right-3 top-2 text-midGray hover:text-white"
                          >
                            <Key className="size-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Anthropic Key */}
                      <div className={`p-2.5 rounded-xl border transition-all ${cloudProvider === 'anthropic' ? 'border-brand/50 bg-brand/5' : 'border-white/10 bg-black/30'}`}>
                        <label className="block text-xs font-semibold text-midGray mb-1 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            Anthropic API Key
                            {cloudProvider === 'anthropic' && <span className="rounded bg-brand/20 px-1.5 py-0.5 text-[9px] font-bold text-brand">Active</span>}
                          </span>
                          {anthropicKey ? (
                            <span className="text-[10px] text-emerald-400 font-medium">✓ Key Configured</span>
                          ) : (
                            <span className="text-[10px] text-midGray">Not Set</span>
                          )}
                        </label>
                        <div className="relative">
                          <input
                            type={showAnthropicKey ? 'text' : 'password'}
                            value={anthropicKey}
                            onChange={(e) => setAnthropicKey(e.target.value)}
                            placeholder="sk-ant-api03-..."
                            className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-1.5 pr-10 text-xs text-white outline-none focus:border-brand font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                            className="absolute right-3 top-2 text-midGray hover:text-white"
                          >
                            <Key className="size-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* OpenAI Key */}
                      <div className={`p-2.5 rounded-xl border transition-all ${cloudProvider === 'openai' ? 'border-brand/50 bg-brand/5' : 'border-white/10 bg-black/30'}`}>
                        <label className="block text-xs font-semibold text-midGray mb-1 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            OpenAI API Key
                            {cloudProvider === 'openai' && <span className="rounded bg-brand/20 px-1.5 py-0.5 text-[9px] font-bold text-brand">Active</span>}
                          </span>
                          {openaiKey ? (
                            <span className="text-[10px] text-emerald-400 font-medium">✓ Key Configured</span>
                          ) : (
                            <span className="text-[10px] text-midGray">Not Set</span>
                          )}
                        </label>
                        <div className="relative">
                          <input
                            type={showOpenaiKey ? 'text' : 'password'}
                            value={openaiKey}
                            onChange={(e) => setOpenaiKey(e.target.value)}
                            placeholder="sk-..."
                            className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-1.5 pr-10 text-xs text-white outline-none focus:border-brand font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                            className="absolute right-3 top-2 text-midGray hover:text-white"
                          >
                            <Key className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Local Mode Settings */}
                {mode === 'local' && (
                  <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-accent">Local Model Settings (Ollama)</h4>
                    <div>
                      <label className="block text-xs font-semibold text-midGray mb-1.5">Ollama Model Target</label>
                      <select
                        value={localModel}
                        onChange={(e) => setLocalModel(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-xs text-white outline-none focus:border-accent"
                      >
                        <option value="llama3.2:3b">llama3.2:3b (Default - 2.0 GB)</option>
                        <option value="llama3.1:8b">llama3.1:8b (Higher quality - 4.7 GB)</option>
                        <option value="mistral">mistral:7b (7 GB)</option>
                        <option value="codellama">codellama:7b (Coding specialist)</option>
                        <option value="deepseek-r1:8b">deepseek-r1:8b (Reasoning)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: AGENT BEHAVIORS */}
            {activeTab === 'agents' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Bot className="size-5 text-brand" /> Agent Behaviors &amp; Prompts
                  </h3>
                  <p className="text-xs text-midGray mt-1">
                    Manage agent routing rules, system prompts, and human approval safeguards.
                  </p>
                </div>

                {/* Agent selector */}
                <div>
                  <label className="block text-xs font-semibold text-midGray mb-1.5">Select Agent Plugin</label>
                  <select
                    value={selectedAgent}
                    onChange={(e) => setSelectedAgent(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-xs text-white outline-none focus:border-brand"
                  >
                    <option value="lead-gen-maps">Maps Lead Generator</option>
                    <option value="coder">Code Master</option>
                    <option value="invoice-generator">Smart Invoice Generator</option>
                    <option value="social-media-manager">Social Media Buzzmaker</option>
                    <option value="customer-support-whatsapp">WhatsApp Support Hero</option>
                    <option value="assistant">Executive Assistant (Default)</option>
                  </select>
                </div>

                {/* Safeguard Level */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-brand">Autonomy Safeguards</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setAutonomyLevel('approval')}
                      className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                        autonomyLevel === 'approval' ? 'border-accent bg-accent/10 text-white' : 'border-white/10 bg-black/30 text-midGray'
                      }`}
                    >
                      <span className="text-xs font-bold flex items-center gap-1.5"><ShieldCheck className="size-3.5 text-accent" /> Require Approval</span>
                      <span className="text-[10px] mt-1 opacity-70">Ask before executing financial or filesystem actions</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAutonomyLevel('full')}
                      className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                        autonomyLevel === 'full' ? 'border-brand bg-brand/10 text-white' : 'border-white/10 bg-black/30 text-midGray'
                      }`}
                    >
                      <span className="text-xs font-bold flex items-center gap-1.5"><Sparkles className="size-3.5 text-brand" /> Autonomous</span>
                      <span className="text-[10px] mt-1 opacity-70">Execute all tools automatically without pausing</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: TOOLS & MCP */}
            {activeTab === 'tools' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Wrench className="size-5 text-brand" /> Tools &amp; Model Context Protocol
                  </h3>
                  <p className="text-xs text-midGray mt-1">
                    Toggle active capability integrations and subprocess tools.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/10 bg-white/[0.02]">
                    <div>
                      <h4 className="text-xs font-bold text-white">Model Context Protocol (MCP)</h4>
                      <p className="text-[10px] text-midGray">Connect standard MCP tool servers for Supabase, Slack, GitHub, etc.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={mcpEnabled}
                      onChange={(e) => setMcpEnabled(e.target.checked)}
                      className="size-4 rounded accent-brand"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/10 bg-white/[0.02]">
                    <div>
                      <h4 className="text-xs font-bold text-white">Web Search Tool</h4>
                      <p className="text-[10px] text-midGray">Enable real-time DuckDuckGo web research capability</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={webSearchEnabled}
                      onChange={(e) => setWebSearchEnabled(e.target.checked)}
                      className="size-4 rounded accent-brand"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/10 bg-white/[0.02]">
                    <div>
                      <h4 className="text-xs font-bold text-white">Playwright Browser Automation</h4>
                      <p className="text-[10px] text-midGray">Headless browser CLI runner for page navigation &amp; screenshots</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={browserAutomationEnabled}
                      onChange={(e) => setBrowserAutomationEnabled(e.target.checked)}
                      className="size-4 rounded accent-brand"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB: INTEGRATIONS & CONNECTIONS */}
            {activeTab === 'integrations' && (() => {
              const q = integrationSearch.toLowerCase().trim();
              const filtered = INTEGRATION_SERVICES.filter(s => {
                const matchesCategory = integrationCategory === 'All' || s.category === integrationCategory;
                const matchesSearch = !q || s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
                return matchesCategory && matchesSearch;
              });
              const connectedCount = connectedServices.length;

              return (
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Plug className="size-5 text-brand" /> Connections &amp; Integrations
                      </h3>
                      <p className="text-xs text-midGray mt-0.5">
                        {connectedCount > 0 ? (
                          <span><span className="text-emerald-400 font-semibold">{connectedCount}</span> service{connectedCount !== 1 ? 's' : ''} connected · </span>
                        ) : null}
                        Credentials are machine-seed encrypted.
                      </p>
                    </div>
                  </div>

                  {/* Search bar */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-midGray pointer-events-none" />
                    <input
                      type="text"
                      value={integrationSearch}
                      onChange={e => setIntegrationSearch(e.target.value)}
                      placeholder="Search integrations…"
                      className="w-full rounded-xl border border-white/10 bg-black/40 pl-9 pr-4 py-2 text-xs text-white placeholder-midGray outline-none focus:border-brand transition-colors"
                    />
                    {integrationSearch && (
                      <button
                        type="button"
                        onClick={() => setIntegrationSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-midGray hover:text-white"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Category tab strip */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {INTEGRATION_CATEGORIES.map(cat => {
                      const count = cat === 'All'
                        ? INTEGRATION_SERVICES.length
                        : INTEGRATION_SERVICES.filter(s => s.category === cat).length;
                      const active = integrationCategory === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setIntegrationCategory(cat)}
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold transition-all ${
                            active
                              ? 'bg-brand text-white shadow-sm shadow-brand/30'
                              : 'bg-white/5 text-midGray border border-white/10 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          {cat}
                          <span className={`ml-1 opacity-60 text-[9px] ${active ? 'text-white' : ''}`}>{count}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Service grid */}
                  {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Search className="size-8 text-white/10 mb-3" />
                      <p className="text-sm font-semibold text-midGray">No integrations found</p>
                      <p className="text-xs text-midGray/60 mt-1">Try adjusting your search or category filter</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {filtered.map((service) => {
                        const isConnected = connectedServices.includes(service.id);
                        return (
                          <div
                            key={service.id}
                            className={`rounded-xl border px-4 py-3 flex items-center justify-between transition-all ${
                              isConnected
                                ? 'border-brand/40 bg-brand/[0.04] shadow-sm shadow-brand/10'
                                : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
                            }`}
                          >
                            <div className="space-y-0.5 pr-3 min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="text-xs font-bold text-white tracking-tight truncate">{service.name}</h4>
                                {isConnected && (
                                  <span className="shrink-0 flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400 border border-emerald-500/20">
                                    <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" /> Connected
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-midGray/70 font-medium">{service.actionsCount} actions</p>
                            </div>
                            {/* Toggle switch */}
                            <button
                              type="button"
                              aria-label={isConnected ? `Configure ${service.name}` : `Connect ${service.name}`}
                              onClick={() => { setActiveSetupService(service); setSetupTokenInput(''); }}
                              className={`shrink-0 relative inline-flex h-5 w-9 items-center rounded-full border transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                                isConnected ? 'border-brand/50 bg-brand' : 'border-white/20 bg-white/10'
                              }`}
                            >
                              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                                isConnected ? 'translate-x-[18px]' : 'translate-x-[2px]'
                              }`} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* TAB 4: PROFILE & PLAN */}
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <User className="size-5 text-brand" /> Account &amp; Workspace Profile
                  </h3>
                  <p className="text-xs text-midGray mt-1">
                    Your current workspace status and subscription plan.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="grid size-10 place-items-center rounded-xl bg-accent/20 text-sm font-bold text-accent">
                      {profile.username?.slice(0, 2).toUpperCase() || 'AI'}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{profile.username || 'Workspace User'}</h4>
                      <p className="text-xs text-midGray">{profile.email || 'local@agentiq.app'}</p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                    <span className="text-midGray">Deployment Mode</span>
                    <span className="font-bold text-brand uppercase">{deploymentMode}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-midGray">Subscription Tier</span>
                    <span className="font-bold text-accent">{subTier}</span>
                  </div>
                </div>
              </div>
            )}
          </main>
        </motion.div>
      </div>
    </AnimatePresence>

    {/* SETUP & ONBOARDING POPUP MODAL */}
    <AnimatePresence>
      {activeSetupService && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/15 bg-[#1a1a1a] p-6 text-white shadow-2xl space-y-5"
          >
            {/* Close button */}
            <button
              onClick={() => setActiveSetupService(null)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-midGray transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="size-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-brand/20 text-brand">
                <Plug className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">{activeSetupService.name}</h3>
                  <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-midGray">
                    {activeSetupService.category}
                  </span>
                </div>
                <p className="text-xs text-midGray mt-0.5">{activeSetupService.description}</p>
              </div>
            </div>

            <div className="rounded-xl border border-brand/20 bg-brand/5 p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-brand" /> Capabilities &amp; Access
                </span>
                <span className="font-bold text-brand">{activeSetupService.actionsCount} Actions Unlocked</span>
              </div>
              <p className="text-[11px] text-midGray leading-relaxed">
                Connecting {activeSetupService.name} grants AGENTIQ OS permissions to run automated tools over machine-seed encrypted MCP channels.
              </p>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await openUrl(activeSetupService.devConsoleUrl);
                  } catch (err) {
                    console.warn('[Settings] openUrl failed, falling back to window.open:', err);
                    window.open(activeSetupService.devConsoleUrl, '_blank', 'noopener,noreferrer');
                  }
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-brand hover:underline pt-1 text-left cursor-pointer"
              >
                Get your API key from {activeSetupService.name} Console <ExternalLink className="size-3.5" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-midGray">
                {activeSetupService.credentialKey.toUpperCase().replace(/_/g, ' ')} / API TOKEN
              </label>
              <input
                type="password"
                value={setupTokenInput}
                onChange={(e) => setSetupTokenInput(e.target.value)}
                placeholder={activeSetupService.placeholder}
                className="w-full rounded-xl border border-white/10 bg-black/60 px-3.5 py-2.5 text-xs text-white outline-none focus:border-brand font-mono"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              {connectedServices.includes(activeSetupService.id) ? (
                <button
                  type="button"
                  onClick={async () => {
                    await handleDisconnectService(activeSetupService.id, activeSetupService.credentialKey);
                    setActiveSetupService(null);
                  }}
                  disabled={loading}
                  className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                >
                  Disconnect Service
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveSetupService(null)}
                  className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-midGray transition-colors hover:bg-white/5 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!setupTokenInput.trim()) return;
                    await handleModalConnect(activeSetupService.id, activeSetupService.credentialKey, setupTokenInput);
                  }}
                  disabled={loading || !setupTokenInput.trim()}
                  className="rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white transition-all hover:bg-brand/90 disabled:opacity-40 shadow-lg shadow-brand/20"
                >
                  {loading ? 'Authenticating…' : 'Save & Authenticate'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  </>
);
}
