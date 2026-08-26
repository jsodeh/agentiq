import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-shell';

export default function ModeSelect() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);

  const handleLocalMode = async () => {
    setChecking(true);
    try {
      const ollamaInstalled = await invoke<boolean>('check_ollama');
      if (ollamaInstalled) {
        navigate('/setup/device-check');
      } else {
        alert('Ollama is not installed. Please install Ollama first.');
      }
    } catch (error) {
      console.error('Failed to check Ollama:', error);
      alert('Failed to check Ollama installation');
    } finally {
      setChecking(false);
    }
  };

  const handleCloudMode = async () => {
    try {
      // Open Clerk hosted sign-up URL
      await open('https://accounts.agentiq.app/sign-up');
      // Deep link listener will handle agent://auth/callback
    } catch (error) {
      console.error('Failed to open sign-up URL:', error);
    }
  };

  return (
    <div className="min-h-screen bg-dark flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl w-full"
      >
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">Welcome to agēntīq</h1>
          <p className="text-xl text-midGray">Choose your deployment mode</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Local Mode Card */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleLocalMode}
            disabled={checking}
            className="bg-dark border-2 border-midGray hover:border-brand rounded-2xl p-12 text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="mb-6">
              <svg className="w-16 h-16 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">Local Mode</h2>
            <p className="text-midGray text-lg mb-6">
              Run AI models locally on your machine using Ollama. Complete privacy, no internet required after setup.
            </p>
            <ul className="space-y-2 text-midGray mb-8">
              <li className="flex items-center gap-2">
                <span className="text-accent">✓</span> Full data privacy
              </li>
              <li className="flex items-center gap-2">
                <span className="text-accent">✓</span> No API costs
              </li>
              <li className="flex items-center gap-2">
                <span className="text-accent">✓</span> Offline capable
              </li>
              <li className="flex items-center gap-2">
                <span className="text-accent">✓</span> Requires 8GB+ RAM
              </li>
            </ul>
            <div className="text-brand font-semibold text-lg">
              {checking ? 'Checking Ollama...' : 'Get Started →'}
            </div>
          </motion.button>

          {/* Cloud Mode Card */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleCloudMode}
            className="bg-dark border-2 border-midGray hover:border-accent rounded-2xl p-12 text-left transition-all"
          >
            <div className="mb-6">
              <svg className="w-16 h-16 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">Cloud Mode</h2>
            <p className="text-midGray text-lg mb-6">
              Connect to cloud AI services like Anthropic Claude. Faster setup, access to latest models.
            </p>
            <ul className="space-y-2 text-midGray mb-8">
              <li className="flex items-center gap-2">
                <span className="text-accent">✓</span> Latest AI models
              </li>
              <li className="flex items-center gap-2">
                <span className="text-accent">✓</span> No local resources needed
              </li>
              <li className="flex items-center gap-2">
                <span className="text-accent">✓</span> Instant setup
              </li>
              <li className="flex items-center gap-2">
                <span className="text-accent">✓</span> Pay-per-use pricing
              </li>
            </ul>
            <div className="text-accent font-semibold text-lg">
              Sign Up →
            </div>
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
