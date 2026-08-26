import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

interface Model {
  id: string;
  name: string;
  size: string;
  ramRequired: number;
  capabilities: string[];
  description: string;
}

interface DownloadProgress {
  downloaded: number;
  total: number;
  speed: number;
  eta: number;
}

const MODELS: Model[] = [
  {
    id: 'llama3.2:3b',
    name: 'Llama 3.2 (3B)',
    size: '2.0 GB',
    ramRequired: 4,
    capabilities: ['Fast', 'General Purpose', 'Coding'],
    description: 'Lightweight model for everyday tasks',
  },
  {
    id: 'llama3.2:8b',
    name: 'Llama 3.2 (8B)',
    size: '4.7 GB',
    ramRequired: 8,
    capabilities: ['Balanced', 'Reasoning', 'Analysis'],
    description: 'Best balance of speed and capability',
  },
  {
    id: 'llama3.1:70b',
    name: 'Llama 3.1 (70B)',
    size: '40 GB',
    ramRequired: 48,
    capabilities: ['Advanced', 'Expert', 'Research'],
    description: 'Most capable model for complex tasks',
  },
];

export default function ModelSelect() {
  const navigate = useNavigate();
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [verifying, setVerifying] = useState(false);

  const handleModelSelect = async (modelId: string) => {
    if (downloading) return;
    
    setSelectedModel(modelId);
    setDownloading(true);
    setProgress({ downloaded: 0, total: 0, speed: 0, eta: 0 });

    try {
      // Listen for progress events
      const unlisten = await listen<DownloadProgress>('download_progress', (event) => {
        setProgress(event.payload);
      });

      // Start download
      await invoke('download_model', { modelId });

      // Cleanup listener
      unlisten();

      // Verify SHA-256
      setVerifying(true);
      const verified = await invoke<boolean>('verify_model_checksum', { modelId });

      if (verified) {
        // Save selected model to store/db
        localStorage.setItem('selected_model', modelId);
        setTimeout(() => {
          navigate('/setup/agent-select');
        }, 500);
      } else {
        alert('Model verification failed. Please try again.');
        setDownloading(false);
        setVerifying(false);
        setProgress(null);
      }
    } catch (error) {
      console.error('Model download failed:', error);
      alert('Failed to download model. Please try again.');
      setDownloading(false);
      setVerifying(false);
      setProgress(null);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  return (
    <div className="min-h-screen bg-dark flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-5xl w-full"
      >
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Select AI Model</h1>
          <p className="text-xl text-midGray">Choose the model that fits your hardware</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {MODELS.map((model) => (
            <motion.button
              key={model.id}
              whileHover={{ scale: downloading ? 1 : 1.02 }}
              whileTap={{ scale: downloading ? 1 : 0.98 }}
              onClick={() => handleModelSelect(model.id)}
              disabled={downloading}
              className={`bg-dark border-2 rounded-xl p-6 text-left transition-all disabled:opacity-50 ${
                selectedModel === model.id
                  ? 'border-brand'
                  : 'border-midGray hover:border-brand'
              }`}
            >
              <div className="mb-4">
                <h3 className="text-xl font-bold text-white mb-2">{model.name}</h3>
                <p className="text-midGray text-sm mb-3">{model.description}</p>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-midGray">Size:</span>
                  <span className="text-white font-semibold">{model.size}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-midGray">RAM Required:</span>
                  <span className="text-white font-semibold">{model.ramRequired} GB</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {model.capabilities.map((cap) => (
                  <span
                    key={cap}
                    className="px-2 py-1 bg-brand bg-opacity-20 text-brand text-xs rounded-full"
                  >
                    {cap}
                  </span>
                ))}
              </div>
            </motion.button>
          ))}
        </div>

        {/* Download Progress */}
        {downloading && progress && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-dark border border-brand rounded-xl p-6"
          >
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-white font-semibold">
                  {verifying ? 'Verifying SHA-256...' : 'Downloading Model...'}
                </span>
                <span className="text-midGray text-sm">
                  {verifying ? '100%' : `${Math.round((progress.downloaded / progress.total) * 100)}%`}
                </span>
              </div>
              <div className="w-full bg-midGray bg-opacity-20 rounded-full h-3 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: verifying ? '100%' : `${(progress.downloaded / progress.total) * 100}%` }}
                  transition={{ duration: 0.3 }}
                  className="h-full bg-brand rounded-full"
                />
              </div>
            </div>

            {!verifying && (
              <div className="flex justify-between text-sm text-midGray">
                <span>
                  {formatBytes(progress.downloaded)} / {formatBytes(progress.total)}
                </span>
                <span>
                  {formatBytes(progress.speed)}/s • ETA: {formatTime(progress.eta)}
                </span>
              </div>
            )}

            {verifying && (
              <div className="flex items-center justify-center gap-2 text-accent">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full"
                />
                <span className="text-sm">Verifying integrity...</span>
              </div>
            )}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
