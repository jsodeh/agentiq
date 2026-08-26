import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { SetupTimeline } from '../../components/SetupTimeline';

interface SetupStep {
  id: string;
  name: string;
  icon: string;
  timestamp: number;
  status: 'completed' | 'in_progress' | 'pending';
}

export default function Launch() {
  const navigate = useNavigate();
  const [steps, setSteps] = useState<SetupStep[]>([]);
  const [launching, setLaunching] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);

  useEffect(() => {
    // Build setup steps from localStorage
    const setupSteps: SetupStep[] = [
      {
        id: 'mode',
        name: 'Deployment Mode Selected',
        icon: '🎯',
        timestamp: Date.now() - 8000,
        status: 'completed',
      },
      {
        id: 'device',
        name: 'System Check Passed',
        icon: '✅',
        timestamp: Date.now() - 7000,
        status: 'completed',
      },
      {
        id: 'model',
        name: 'AI Model Downloaded',
        icon: '🤖',
        timestamp: Date.now() - 6000,
        status: (!!localStorage.getItem('selected_model') ? 'completed' : 'pending'),
      },
      {
        id: 'agents',
        name: 'Agents Selected',
        icon: '👥',
        timestamp: Date.now() - 5000,
        status: (!!localStorage.getItem('selected_agents') ? 'completed' : 'pending'),
      },
      {
        id: 'integrations',
        name: 'Integrations Connected',
        icon: '🔗',
        timestamp: Date.now() - 4000,
        status: 'completed',
      },
      {
        id: 'config',
        name: 'Agents Configured',
        icon: '⚙️',
        timestamp: Date.now() - 3000,
        status: (!!localStorage.getItem('agent_configs') ? 'completed' : 'pending'),
      },
      {
        id: 'voice',
        name: 'Voice Setup Complete',
        icon: '🎤',
        timestamp: Date.now() - 2000,
        status: (!!localStorage.getItem('voice_config') ? 'completed' : 'pending'),
      },
      {
        id: 'complete',
        name: 'Setup Complete',
        icon: '🎉',
        timestamp: Date.now() - 1000,
        status: 'completed',
      },
    ];

    setSteps(setupSteps);

    // Animate timeline in
    setTimeout(() => setShowTimeline(true), 500);
  }, []);

  const handleLaunch = async () => {
    setLaunching(true);

    try {
      // Start the orchestrator
      await invoke('start_orchestrator');

      // Wait for animation
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mark setup as complete
      localStorage.setItem('setup_complete', 'true');

      // Navigate to dashboard with onboarding tour flag
      navigate('/?onboarding=true');
    } catch (error) {
      console.error('Failed to start orchestrator:', error);
      alert('Failed to launch agēntīq. Please try again.');
      setLaunching(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark flex items-center justify-center p-8 overflow-hidden">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-3xl w-full"
      >
        <div className="text-center mb-12">
          <motion.h1
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-5xl font-bold text-white mb-4"
          >
            Setup Complete!
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-xl text-midGray"
          >
            Your AI agents are ready to launch
          </motion.p>
        </div>

        {/* Animated Timeline */}
        {showTimeline && (
          <div className="mb-12">
            <SetupTimeline steps={steps} onComplete={() => console.log('Timeline complete')} />
          </div>
        )}

        {/* Launch Button */}
        <div className="text-center">
          <motion.button
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: steps.length * 0.1 + 0.5 }}
            whileHover={{ scale: launching ? 1 : 1.05 }}
            whileTap={{ scale: launching ? 1 : 0.95 }}
            onClick={handleLaunch}
            disabled={launching}
            className="relative px-16 py-6 bg-gradient-to-r from-brand to-accent text-white text-2xl font-bold rounded-2xl shadow-2xl shadow-brand/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all overflow-hidden group"
          >
            {launching ? (
              <span className="flex items-center gap-3">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-6 h-6 border-2 border-white border-t-transparent rounded-full"
                />
                Launching...
              </span>
            ) : (
              <>
                <span className="relative z-10">Launch ÀGENT</span>
                <motion.div
                  className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity"
                  initial={false}
                />
              </>
            )}
          </motion.button>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: steps.length * 0.1 + 0.7 }}
            className="text-midGray mt-6"
          >
            Click to start your AI agent orchestrator
          </motion.p>
        </div>

        {/* Animated Background Elements */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-brand rounded-full opacity-20"
              initial={{
                x: Math.random() * window.innerWidth,
                y: window.innerHeight + 100,
              }}
              animate={{
                y: -100,
                x: Math.random() * window.innerWidth,
              }}
              transition={{
                duration: Math.random() * 10 + 10,
                repeat: Infinity,
                delay: Math.random() * 5,
              }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
