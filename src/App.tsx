import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import Dashboard from './screens/Dashboard';
import WizardScreen from './screens/WizardScreen';
import AgentDetail from './screens/AgentDetail';
import ModeSelect from './screens/setup/ModeSelect';
import Workspace from './screens/Workspace';
import Landing from './screens/Landing';
import FullExperienceDemo from './components/ui/full-experience-demo';

function RootRoute() {
  const isSetupComplete = localStorage.getItem('setup_complete') === 'true';
  const hasStoredAgents = Boolean(localStorage.getItem('agentiq_agents') || localStorage.getItem('selected_agents'));

  if (!isSetupComplete && !hasStoredAgents) {
    return <Landing />;
  }
  return <Navigate to="/workspace" replace />;
}

function App() {
  // Initialize database on app startup
  useEffect(() => {
    const initApp = async () => {
      try {
        if (typeof window !== 'undefined' && (window as any).__TAURI__) {
          await invoke('init_database');
          console.log('[App] Database initialized');
        }
      } catch (error) {
        console.error('[App] Failed to initialize database:', error);
      }
    };

    initApp();
  }, []);

  return (
    <Routes>
      <Route path="/" element={<RootRoute />} />
      <Route path="/wizard" element={<WizardScreen />} />
      <Route path="/agent/:id" element={<AgentDetail />} />
      <Route path="/setup" element={<ModeSelect />} />
      <Route path="/welcome" element={<Landing />} />
      <Route path="/workspace" element={<Workspace />} />
      <Route path="/demo" element={<FullExperienceDemo />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
