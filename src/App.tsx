import { Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './screens/Dashboard';
import WizardScreen from './screens/WizardScreen';
import AgentDetail from './screens/AgentDetail';
import ModeSelect from './screens/setup/ModeSelect';
import Workspace from './screens/Workspace';

function RootRoute() {
  const isSetupComplete = localStorage.getItem('setup_complete') === 'true';
  const hasStoredAgents = Boolean(localStorage.getItem('agentiq_agents') || localStorage.getItem('selected_agents'));

  if (!isSetupComplete && !hasStoredAgents) {
    return <Navigate to="/setup" replace />;
  }
  return <Navigate to="/workspace" replace />;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRoute />} />
      <Route path="/wizard" element={<WizardScreen />} />
      <Route path="/agent/:id" element={<AgentDetail />} />
      <Route path="/setup" element={<ModeSelect />} />
      <Route path="/workspace" element={<Workspace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
