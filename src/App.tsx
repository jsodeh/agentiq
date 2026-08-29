import { Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './screens/Dashboard';
import WizardScreen from './screens/WizardScreen';
import AgentDetail from './screens/AgentDetail';
import ModeSelect from './screens/setup/ModeSelect';
import DeviceCheck from './screens/setup/DeviceCheck';
import ModelSelect from './screens/setup/ModelSelect';
import AgentSelect from './screens/setup/AgentSelect';
import Integrations from './screens/setup/Integrations';
import AgentConfig from './screens/setup/AgentConfig';
import VoiceSetup from './screens/setup/VoiceSetup';
import Launch from './screens/setup/Launch';

function RootRoute() {
  const isSetupComplete = localStorage.getItem('setup_complete') === 'true';
  const hasStoredAgents = Boolean(localStorage.getItem('agentiq_agents') || localStorage.getItem('selected_agents'));

  if (!isSetupComplete && !hasStoredAgents) {
    return <Navigate to="/setup" replace />;
  }
  return <Dashboard />;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRoute />} />
      <Route path="/wizard" element={<WizardScreen />} />
      <Route path="/agent/:id" element={<AgentDetail />} />
      <Route path="/setup" element={<ModeSelect />} />
      <Route path="/setup/device-check" element={<DeviceCheck />} />
      <Route path="/setup/model-select" element={<ModelSelect />} />
      <Route path="/setup/agent-select" element={<AgentSelect />} />
      <Route path="/setup/integrations" element={<Integrations />} />
      <Route path="/setup/agent-config" element={<AgentConfig />} />
      <Route path="/setup/voice-setup" element={<VoiceSetup />} />
      <Route path="/setup/launch" element={<Launch />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;

