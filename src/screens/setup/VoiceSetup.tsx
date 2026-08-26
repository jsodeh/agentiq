import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

interface VoiceModel {
  name: string;
  size: string;
  type: 'stt' | 'tts';
  downloaded: boolean;
}

export default function VoiceSetup() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'local' | 'cloud'>('local');
  const [language, setLanguage] = useState('English');
  const [deepgramKey, setDeepgramKey] = useState('');
  const [elevenLabsKey, setElevenLabsKey] = useState('');
  const [models, setModels] = useState<VoiceModel[]>([
    { name: 'Whisper.cpp (Base)', size: '140 MB', type: 'stt', downloaded: false },
    { name: 'Coqui TTS (VITS)', size: '85 MB', type: 'tts', downloaded: false },
  ]);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const handleDownloadModel = async (modelName: string) => {
    setDownloading(modelName);
    setDownloadProgress(0);

    try {
      // Listen for progress events
      const unlisten = await listen<{ progress: number }>('voice_model_download_progress', (event) => {
        setDownloadProgress(event.payload.progress);
      });

      // Start download
      await invoke('download_voice_model', { modelName });

      // Update model status
      setModels(prev =>
        prev.map(m => (m.name === modelName ? { ...m, downloaded: true } : m))
      );

      unlisten();
    } catch (error) {
      console.error('Failed to download model:', error);
      alert(`Failed to download ${modelName}`);
    } finally {
      setDownloading(null);
      setDownloadProgress(0);
    }
  };

  const handleTestVoice = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      // Record 3 seconds of audio
      await invoke('start_voice_recording', { duration: 3 });
      
      // Wait for recording to complete
      await new Promise(resolve => setTimeout(resolve, 3500));

      // Transcribe
      const transcription = await invoke<string>('transcribe_audio', {
        language,
        useCloud: mode === 'cloud',
        apiKey: mode === 'cloud' ? deepgramKey : null,
      });

      // Speak back
      await invoke('speak_text', {
        text: transcription,
        language,
        useCloud: mode === 'cloud',
        apiKey: mode === 'cloud' ? elevenLabsKey : null,
      });

      setTestResult(transcription);
    } catch (error) {
      console.error('Voice test failed:', error);
      alert('Voice test failed. Please check your setup.');
    } finally {
      setTesting(false);
    }
  };

  const handleContinue = () => {
    // Save voice settings
    const voiceConfig = {
      mode,
      language,
      deepgramKey: mode === 'cloud' ? deepgramKey : null,
      elevenLabsKey: mode === 'cloud' ? elevenLabsKey : null,
      modelsDownloaded: mode === 'local' ? models.every(m => m.downloaded) : true,
    };

    localStorage.setItem('voice_config', JSON.stringify(voiceConfig));
    navigate('/setup/launch');
  };

  const canContinue = mode === 'cloud'
    ? deepgramKey && elevenLabsKey
    : models.every(m => m.downloaded);

  return (
    <div className="min-h-screen bg-dark flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl w-full"
      >
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Voice Setup</h1>
          <p className="text-xl text-midGray">Configure speech-to-text and text-to-speech</p>
        </div>

        {/* Mode Selection */}
        <div className="flex gap-4 mb-8 justify-center">
          <button
            onClick={() => setMode('local')}
            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
              mode === 'local'
                ? 'bg-brand text-white'
                : 'bg-dark border border-midGray text-midGray hover:border-brand'
            }`}
          >
            Local Voice
          </button>
          <button
            onClick={() => setMode('cloud')}
            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
              mode === 'cloud'
                ? 'bg-brand text-white'
                : 'bg-dark border border-midGray text-midGray hover:border-brand'
            }`}
          >
            Cloud Voice
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Local Voice Column */}
          {mode === 'local' && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-dark border border-midGray rounded-2xl p-6"
            >
              <h2 className="text-2xl font-bold text-white mb-6">Local Models</h2>
              
              <div className="space-y-4">
                {models.map((model) => (
                  <div key={model.name} className="border border-midGray rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="text-white font-semibold">{model.name}</h3>
                        <p className="text-sm text-midGray">{model.size}</p>
                      </div>
                      <span className="px-2 py-1 bg-brand bg-opacity-20 text-brand text-xs rounded-full">
                        {model.type.toUpperCase()}
                      </span>
                    </div>

                    {model.downloaded ? (
                      <div className="flex items-center gap-2 text-accent">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span className="text-sm">Downloaded</span>
                      </div>
                    ) : downloading === model.name ? (
                      <div>
                        <div className="w-full bg-midGray bg-opacity-20 rounded-full h-2 mb-2">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${downloadProgress}%` }}
                            className="h-full bg-brand rounded-full"
                          />
                        </div>
                        <p className="text-sm text-midGray">{downloadProgress}%</p>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleDownloadModel(model.name)}
                        className="w-full px-4 py-2 bg-brand hover:bg-opacity-80 text-white rounded-md transition-colors"
                      >
                        Download
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Cloud Voice Column */}
          {mode === 'cloud' && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-dark border border-midGray rounded-2xl p-6 md:col-span-2"
            >
              <h2 className="text-2xl font-bold text-white mb-6">Cloud API Keys</h2>
              
              <div className="space-y-6 max-w-2xl">
                <div>
                  <label className="block text-white font-medium mb-2">
                    Deepgram API Key (Speech-to-Text)
                  </label>
                  <input
                    type="password"
                    value={deepgramKey}
                    onChange={(e) => setDeepgramKey(e.target.value)}
                    placeholder="Enter your Deepgram API key"
                    className="w-full px-4 py-3 bg-dark border border-midGray rounded-lg text-white focus:border-brand outline-none"
                  />
                  <p className="text-sm text-midGray mt-1">
                    Get your key at{' '}
                    <a href="https://deepgram.com" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                      deepgram.com
                    </a>
                  </p>
                </div>

                <div>
                  <label className="block text-white font-medium mb-2">
                    ElevenLabs API Key (Text-to-Speech)
                  </label>
                  <input
                    type="password"
                    value={elevenLabsKey}
                    onChange={(e) => setElevenLabsKey(e.target.value)}
                    placeholder="Enter your ElevenLabs API key"
                    className="w-full px-4 py-3 bg-dark border border-midGray rounded-lg text-white focus:border-brand outline-none"
                  />
                  <p className="text-sm text-midGray mt-1">
                    Get your key at{' '}
                    <a href="https://elevenlabs.io" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                      elevenlabs.io
                    </a>
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Language Selector */}
        <div className="bg-dark border border-midGray rounded-2xl p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Language</h2>
          <div className="flex flex-wrap gap-3">
            {['English', 'Pidgin', 'Yoruba', 'Igbo', 'Hausa'].map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                  language === lang
                    ? 'bg-brand text-white'
                    : 'bg-dark border border-midGray text-midGray hover:border-brand'
                }`}
              >
                {lang}
              </button>
            ))}
          </div>
        </div>

        {/* Test Voice */}
        <div className="bg-dark border border-midGray rounded-2xl p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Test Voice</h2>
          <p className="text-midGray mb-4">
            Click the button below to record 3 seconds of audio. We'll transcribe it and speak it back to you.
          </p>
          
          <button
            onClick={handleTestVoice}
            disabled={testing || !canContinue}
            className="px-6 py-3 bg-accent hover:bg-opacity-80 disabled:opacity-50 disabled:cursor-not-allowed text-dark font-semibold rounded-lg transition-colors"
          >
            {testing ? 'Testing...' : 'Test Voice'}
          </button>

          {testResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-4 bg-brand bg-opacity-10 border border-brand rounded-lg"
            >
              <p className="text-sm text-midGray mb-1">Transcription:</p>
              <p className="text-white">{testResult}</p>
            </motion.div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <button
            onClick={() => navigate('/setup/agent-config')}
            className="px-6 py-3 border border-midGray hover:border-brand text-white rounded-lg transition-colors"
          >
            ← Back
          </button>

          <button
            onClick={handleContinue}
            disabled={!canContinue}
            className="px-8 py-3 bg-brand hover:bg-opacity-80 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-semibold"
          >
            Continue →
          </button>
        </div>
      </motion.div>
    </div>
  );
}
