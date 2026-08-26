import { useState, useEffect, useCallback } from 'react';
import { getVoiceService, initializeVoiceService, VoiceConfig } from '../voice';

export interface VoiceState {
  initialized: boolean;
  listening: boolean;
  speaking: boolean;
  mode: 'local' | 'cloud';
  language: string;
  error: Error | null;
}

export function useVoice(config?: VoiceConfig) {
  const [state, setState] = useState<VoiceState>({
    initialized: false,
    listening: false,
    speaking: false,
    mode: 'local',
    language: 'English',
    error: null,
  });

  const [transcript, setTranscript] = useState<string>('');

  useEffect(() => {
    let voiceService: ReturnType<typeof getVoiceService> | null = null;

    const initialize = async () => {
      try {
        // Load config from localStorage if not provided
        const savedConfig = localStorage.getItem('voice_config');
        const voiceConfig: VoiceConfig = config || (savedConfig ? JSON.parse(savedConfig) : {
          mode: 'local',
          language: 'English',
          autoFallback: true,
          local: {
            whisperModel: 'base',
            ttsModel: 'vits',
            vadThreshold: 0.5,
            wakeWordEnabled: false,
          },
        });

        voiceService = initializeVoiceService(voiceConfig);

        // Set up event listeners
        voiceService.on('initialized', ({ mode }) => {
          setState(prev => ({ ...prev, initialized: true, mode, error: null }));
        });

        voiceService.on('listening', () => {
          setState(prev => ({ ...prev, listening: true }));
        });

        voiceService.on('speech_start', () => {
          setTranscript('');
        });

        voiceService.on('transcript', (text: string) => {
          setTranscript(text);
        });

        voiceService.on('speaking', () => {
          setState(prev => ({ ...prev, speaking: true }));
        });

        voiceService.on('idle', () => {
          setState(prev => ({ ...prev, listening: false, speaking: false }));
        });

        voiceService.on('error', (error: Error) => {
          setState(prev => ({ ...prev, error }));
        });

        voiceService.on('fallback', ({ from, to }) => {
          console.log(`Voice fallback: ${from} → ${to}`);
          setState(prev => ({ ...prev, mode: to }));
        });

        voiceService.on('mode_changed', ({ mode }) => {
          setState(prev => ({ ...prev, mode }));
        });

        await voiceService.initialize();
      } catch (error) {
        setState(prev => ({ ...prev, error: error as Error }));
      }
    };

    initialize();

    return () => {
      if (voiceService) {
        voiceService.destroy();
      }
    };
  }, [config]);

  const startListening = useCallback(async () => {
    try {
      const voiceService = getVoiceService();
      await voiceService.startListening();
    } catch (error) {
      setState(prev => ({ ...prev, error: error as Error }));
    }
  }, []);

  const stopListening = useCallback(async () => {
    try {
      const voiceService = getVoiceService();
      await voiceService.stopListening();
    } catch (error) {
      setState(prev => ({ ...prev, error: error as Error }));
    }
  }, []);

  const speak = useCallback(async (text: string) => {
    try {
      const voiceService = getVoiceService();
      await voiceService.speak(text);
    } catch (error) {
      setState(prev => ({ ...prev, error: error as Error }));
    }
  }, []);

  const setLanguage = useCallback(async (language: string) => {
    try {
      const voiceService = getVoiceService();
      await voiceService.setLanguage(language);
      setState(prev => ({ ...prev, language }));
    } catch (error) {
      setState(prev => ({ ...prev, error: error as Error }));
    }
  }, []);

  const switchMode = useCallback(async (mode: 'local' | 'cloud') => {
    try {
      const voiceService = getVoiceService();
      await voiceService.switchMode(mode);
    } catch (error) {
      setState(prev => ({ ...prev, error: error as Error }));
    }
  }, []);

  return {
    ...state,
    transcript,
    startListening,
    stopListening,
    speak,
    setLanguage,
    switchMode,
  };
}
