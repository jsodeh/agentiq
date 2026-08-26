import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useStore } from '../../store';

interface Integration {
  appName: string;
  logo: string;
  displayName: string;
  required: boolean;
  connected: boolean;
  requiredBy: string[];
}

const APP_REQUIREMENTS: Record<string, string[]> = {
  'gmail': ['email-marketer', 'customer-success', 'sales-assistant'],
  'slack': ['social-media', 'customer-success', 'project-manager'],
  'github': ['code-assistant', 'frontend-dev', 'backend-dev', 'devops-engineer'],
  'notion': ['content-writer', 'project-manager', 'research-general'],
  'google-drive': ['research-general', 'data-analyst', 'content-writer'],
  'trello': ['project-manager', 'product-manager', 'operations-manager'],
  'hubspot': ['sales-assistant', 'customer-success', 'email-marketer'],
  'twitter': ['social-media', 'pr-specialist', 'journalist'],
  'linkedin': ['social-media', 'hr-assistant', 'sales-assistant'],
  'calendar': ['project-manager', 'sales-assistant', 'customer-success'],
};

export default function Integrations() {
  const navigate = useNavigate();
  const { agents } = useStore();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);

  useEffect(() => {
    // Get selected agent IDs from localStorage
    const selectedAgentIds = JSON.parse(localStorage.getItem('selected_agents') || '[]');
    
    // Determine required integrations
    const requiredApps = new Map<string, { required: boolean; requiredBy: string[] }>();
    
    Object.entries(APP_REQUIREMENTS).forEach(([appName, agentTypes]) => {
      const matchingAgents = agentTypes.filter(type => 
        selectedAgentIds.some((id: string) => id.includes(type))
      );
      
      if (matchingAgents.length > 0) {
        requiredApps.set(appName, {
          required: matchingAgents.length >= 2, // Required if 2+ agents need it
          requiredBy: matchingAgents,
        });
      }
    });

    // Build integrations list
    const integrationsList: Integration[] = Array.from(requiredApps.entries()).map(
      ([appName, { required, requiredBy }]) => ({
        appName,
        logo: `https://logo.clearbit.com/${appName}.com`,
        displayName: appName.charAt(0).toUpperCase() + appName.slice(1),
        required,
        connected: false,
        requiredBy,
      })
    );

    setIntegrations(integrationsList);

    // Listen for deep link callback
    const handleDeepLink = (event: CustomEvent) => {
      const { appName, status } = event.detail;
      if (status === 'success') {
        setIntegrations(prev =>
          prev.map(int =>
            int.appName === appName ? { ...int, connected: true } : int
          )
        );
      }
    };

    window.addEventListener('agent-deeplink' as any, handleDeepLink);
    return () => window.removeEventListener('agent-deeplink' as any, handleDeepLink);
  }, [agents]);

  const handleConnect = async (appName: string) => {
    setConnecting(appName);
    try {
      // Import composio-core dynamically
      const composioModule = await import('composio-core');
      const ComposioClass = (composioModule as any).Composio || (composioModule as any).default;
      const composio = new ComposioClass({ apiKey: import.meta.env.VITE_COMPOSIO_API_KEY });
      
      // Initiate OAuth flow
      if (typeof composio.initiateOAuth === 'function') {
        await composio.initiateOAuth(appName);
      } else if (typeof composio.connectedAccounts?.initiate === 'function') {
        await composio.connectedAccounts.initiate({ appName });
      }
      
      // OAuth will redirect to agent://composio/callback
    } catch (error) {
      console.error('Failed to connect:', error);
      alert(`Failed to connect to ${appName}`);
    } finally {
      setConnecting(null);
    }
  };

  const handleSkipOptional = () => {
    const allRequiredConnected = integrations
      .filter(int => int.required)
      .every(int => int.connected);
    
    if (!allRequiredConnected) {
      alert('Please connect all required integrations before continuing');
      return;
    }
    
    navigate('/setup/agent-config');
  };

  const handleNext = () => {
    const allRequiredConnected = integrations
      .filter(int => int.required)
      .every(int => int.connected);
    
    if (!allRequiredConnected) {
      alert('Please connect all required integrations before continuing');
      return;
    }
    
    navigate('/setup/agent-config');
  };

  return (
    <div className="min-h-screen bg-dark flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl w-full"
      >
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Connect Integrations</h1>
          <p className="text-xl text-midGray">
            Connect the apps your agents need to work effectively
          </p>
        </div>

        <div className="bg-dark border border-midGray rounded-2xl p-8 mb-8">
          {integrations.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-midGray">No integrations required for your selected agents</p>
            </div>
          ) : (
            <div className="space-y-4">
              {integrations.map((integration, index) => (
                <motion.div
                  key={integration.appName}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center gap-4 p-4 bg-dark border border-midGray rounded-lg hover:border-brand transition-colors"
                >
                  <img
                    src={integration.logo}
                    alt={integration.displayName}
                    className="w-12 h-12 rounded-lg"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="%236C3BFF"/></svg>';
                    }}
                  />
                  
                  <div className="flex-1">
                    <h3 className="text-white font-semibold">{integration.displayName}</h3>
                    <p className="text-sm text-midGray">
                      Required by: {integration.requiredBy.join(', ')}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        integration.required
                          ? 'bg-red-500 bg-opacity-20 text-red-500'
                          : 'bg-yellow-500 bg-opacity-20 text-yellow-500'
                      }`}
                    >
                      {integration.required ? 'Required' : 'Optional'}
                    </span>

                    {integration.connected ? (
                      <div className="flex items-center gap-2 text-accent">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span className="text-sm font-medium">Connected</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleConnect(integration.appName)}
                        disabled={connecting === integration.appName}
                        className="px-4 py-2 bg-brand hover:bg-opacity-80 disabled:opacity-50 text-white rounded-md transition-colors"
                      >
                        {connecting === integration.appName ? 'Connecting...' : 'Connect'}
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center">
          <button
            onClick={() => navigate('/setup/agent-select')}
            className="px-6 py-3 border border-midGray hover:border-brand text-white rounded-lg transition-colors"
          >
            ← Back
          </button>

          <div className="flex gap-3">
            {integrations.some(int => !int.required) && (
              <button
                onClick={handleSkipOptional}
                className="px-6 py-3 border border-midGray hover:border-brand text-white rounded-lg transition-colors"
              >
                Skip Optional
              </button>
            )}
            
            <button
              onClick={handleNext}
              className="px-8 py-3 bg-brand hover:bg-opacity-80 text-white rounded-lg transition-colors font-semibold"
            >
              Next →
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
