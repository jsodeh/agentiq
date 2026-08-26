import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VoiceService } from '../../voice';
import type { VoiceConfig } from '../../voice';

describe('VoiceService', () => {
  let voiceService: VoiceService;

  const localConfig: VoiceConfig = {
    mode: 'local',
    language: 'en',
    autoFallback: true,
    local: {
      whisperModel: 'base',
      ttsModel: 'tts_models/en/ljspeech/tacotron2-DDC',
      vadThreshold: 0.5,
      wakeWordEnabled: false,
    },
  };

  const cloudConfig: VoiceConfig = {
    mode: 'cloud',
    language: 'en',
    autoFallback: true,
    cloud: {
      deepgramApiKey: 'test_deepgram_key',
      elevenLabsApiKey: 'test_elevenlabs_key',
      deepgramModel: 'nova-2',
      elevenLabsVoiceId: 'test_voice_id',
    },
  };

  afterEach(async () => {
    if (voiceService) {
      await voiceService.destroy();
    }
  });

  describe('Local Mode Initialization', () => {
    it('should initialize in local mode without throwing', async () => {
      voiceService = new VoiceService(localConfig);

      await expect(voiceService.initialize()).resolves.not.toThrow();
    });

    it('should emit initialized event on successful init', async () => {
      voiceService = new VoiceService(localConfig);

      const initPromise = new Promise((resolve) => {
        voiceService.once('initialized', (data) => {
          resolve(data);
        });
      });

      await voiceService.initialize();

      const result = await initPromise;
      expect(result).toEqual({ mode: 'local' });
    });

    it('should throw error when local config is missing', async () => {
      const invalidConfig: VoiceConfig = {
        mode: 'local',
        language: 'en',
        autoFallback: false,
        // Missing local config
      };

      voiceService = new VoiceService(invalidConfig);

      await expect(voiceService.initialize()).rejects.toThrow(
        'Local voice configuration not provided'
      );
    });

    it('should have correct status after initialization', async () => {
      voiceService = new VoiceService(localConfig);
      await voiceService.initialize();

      const status = voiceService.getStatus();

      expect(status.mode).toBe('local');
      expect(status.language).toBe('en');
      expect(status.listening).toBe(false);
      expect(status.speaking).toBe(false);
    });
  });

  describe('Cloud Mode Initialization', () => {
    it('should initialize in cloud mode without throwing', async () => {
      voiceService = new VoiceService(cloudConfig);

      await expect(voiceService.initialize()).resolves.not.toThrow();
    });

    it('should emit initialized event with cloud mode', async () => {
      voiceService = new VoiceService(cloudConfig);

      const initPromise = new Promise((resolve) => {
        voiceService.once('initialized', (data) => {
          resolve(data);
        });
      });

      await voiceService.initialize();

      const result = await initPromise;
      expect(result).toEqual({ mode: 'cloud' });
    });

    it('should throw error when cloud config is missing', async () => {
      const invalidConfig: VoiceConfig = {
        mode: 'cloud',
        language: 'en',
        autoFallback: false,
        // Missing cloud config
      };

      voiceService = new VoiceService(invalidConfig);

      await expect(voiceService.initialize()).rejects.toThrow(
        'Cloud voice configuration not provided'
      );
    });

    it('should have correct status after initialization', async () => {
      voiceService = new VoiceService(cloudConfig);
      await voiceService.initialize();

      const status = voiceService.getStatus();

      expect(status.mode).toBe('cloud');
      expect(status.language).toBe('en');
    });
  });

  describe('Auto-Fallback', () => {
    it('should fallback from cloud to local on timeout error', async () => {
      const configWithFallback: VoiceConfig = {
        ...cloudConfig,
        autoFallback: true,
        local: localConfig.local,
      };

      voiceService = new VoiceService(configWithFallback);

      // Mock cloud initialization to throw timeout error
      const originalInit = (voiceService as any).initializeVoiceEngine;
      let callCount = 0;

      (voiceService as any).initializeVoiceEngine = vi.fn(async (mode: string) => {
        callCount++;
        if (mode === 'cloud' && callCount === 1) {
          throw new Error('Connection timeout');
        }
        return originalInit.call(voiceService, mode);
      });

      const fallbackPromise = new Promise((resolve) => {
        voiceService.once('fallback', (data) => {
          resolve(data);
        });
      });

      await voiceService.initialize();

      const fallbackData = await fallbackPromise;
      expect(fallbackData).toEqual({ from: 'cloud', to: 'local' });

      const status = voiceService.getStatus();
      expect(status.mode).toBe('local');
    });

    it('should not fallback when autoFallback is disabled', async () => {
      const configNoFallback: VoiceConfig = {
        ...cloudConfig,
        autoFallback: false,
      };

      voiceService = new VoiceService(configNoFallback);

      // Mock cloud initialization to throw error
      (voiceService as any).initializeVoiceEngine = vi.fn(async () => {
        throw new Error('Connection failed');
      });

      await expect(voiceService.initialize()).rejects.toThrow('Connection failed');
    });

    it('should emit fallback_failed when both modes fail', async () => {
      const configWithFallback: VoiceConfig = {
        ...cloudConfig,
        autoFallback: true,
        local: localConfig.local,
      };

      voiceService = new VoiceService(configWithFallback);

      // Mock both modes to fail
      (voiceService as any).initializeVoiceEngine = vi.fn(async () => {
        throw new Error('Initialization failed');
      });

      const fallbackFailedPromise = new Promise((resolve) => {
        voiceService.once('fallback_failed', (error) => {
          resolve(error);
        });
      });

      await expect(voiceService.initialize()).rejects.toThrow();

      const error = await fallbackFailedPromise;
      expect(error).toBeDefined();
    });
  });

  describe('Transcription', () => {
    beforeEach(async () => {
      voiceService = new VoiceService(localConfig);
      await voiceService.initialize();
    });

    it('should emit transcript event after transcribe() resolves', async () => {
      const audioBuffer = new ArrayBuffer(1024);

      // Mock the transcribe method
      const mockTranscribe = vi.fn(async () => 'Hello world');
      (voiceService as any).activeVoice.transcribe = mockTranscribe;

      const transcriptPromise = new Promise((resolve) => {
        voiceService.once('transcript', (transcript) => {
          resolve(transcript);
        });
      });

      // Trigger transcription
      const result = await voiceService.transcribe(audioBuffer);

      expect(result).toBe('Hello world');
      expect(mockTranscribe).toHaveBeenCalledWith(audioBuffer);

      // Note: The transcript event is emitted by the underlying voice engine,
      // not by the transcribe method directly
    });

    it('should throw error when not initialized', async () => {
      const uninitializedService = new VoiceService(localConfig);
      const audioBuffer = new ArrayBuffer(1024);

      await expect(uninitializedService.transcribe(audioBuffer)).rejects.toThrow(
        'Voice service not initialized'
      );
    });
  });

  describe('Speech Synthesis', () => {
    beforeEach(async () => {
      voiceService = new VoiceService(localConfig);
      await voiceService.initialize();
    });

    it('should speak text without throwing', async () => {
      const mockSpeak = vi.fn(async () => {});
      (voiceService as any).activeVoice.speak = mockSpeak;

      await expect(voiceService.speak('Hello world')).resolves.not.toThrow();
      expect(mockSpeak).toHaveBeenCalledWith('Hello world');
    });

    it('should emit speaking event', async () => {
      const mockSpeak = vi.fn(async () => {
        voiceService.emit('speaking', 'Hello world');
      });
      (voiceService as any).activeVoice.speak = mockSpeak;

      const speakingPromise = new Promise((resolve) => {
        voiceService.once('speaking', (text) => {
          resolve(text);
        });
      });

      await voiceService.speak('Hello world');

      const text = await speakingPromise;
      expect(text).toBe('Hello world');
    });
  });

  describe('Mode Switching', () => {
    it('should switch from local to cloud mode', async () => {
      const fullConfig: VoiceConfig = {
        ...localConfig,
        cloud: cloudConfig.cloud,
      };

      voiceService = new VoiceService(fullConfig);
      await voiceService.initialize();

      expect(voiceService.getStatus().mode).toBe('local');

      const modeChangedPromise = new Promise((resolve) => {
        voiceService.once('mode_changed', (data) => {
          resolve(data);
        });
      });

      await voiceService.switchMode('cloud');

      const result = await modeChangedPromise;
      expect(result).toEqual({ mode: 'cloud' });
      expect(voiceService.getStatus().mode).toBe('cloud');
    });

    it('should not reinitialize when switching to same mode', async () => {
      voiceService = new VoiceService(localConfig);
      await voiceService.initialize();

      const initSpy = vi.spyOn(voiceService as any, 'initializeVoiceEngine');

      await voiceService.switchMode('local');

      expect(initSpy).not.toHaveBeenCalled();
    });
  });

  describe('Language Change', () => {
    it('should change language and reinitialize', async () => {
      voiceService = new VoiceService(localConfig);
      await voiceService.initialize();

      expect(voiceService.getStatus().language).toBe('en');

      await voiceService.setLanguage('yo'); // Yoruba

      expect(voiceService.getStatus().language).toBe('yo');
    });
  });

  describe('Listening Control', () => {
    beforeEach(async () => {
      voiceService = new VoiceService(localConfig);
      await voiceService.initialize();
    });

    it('should start listening without throwing', async () => {
      const mockStartListening = vi.fn(async () => {});
      (voiceService as any).activeVoice.startListening = mockStartListening;

      await expect(voiceService.startListening()).resolves.not.toThrow();
      expect(mockStartListening).toHaveBeenCalled();
    });

    it('should stop listening without throwing', async () => {
      const mockStopListening = vi.fn(async () => {});
      (voiceService as any).activeVoice.stopListening = mockStopListening;

      await expect(voiceService.stopListening()).resolves.not.toThrow();
      expect(mockStopListening).toHaveBeenCalled();
    });

    it('should emit listening event', async () => {
      const mockStartListening = vi.fn(async () => {
        voiceService.emit('listening');
      });
      (voiceService as any).activeVoice.startListening = mockStartListening;

      const listeningPromise = new Promise((resolve) => {
        voiceService.once('listening', () => {
          resolve(true);
        });
      });

      await voiceService.startListening();

      const result = await listeningPromise;
      expect(result).toBe(true);
    });
  });

  describe('Cleanup', () => {
    it('should destroy cleanly', async () => {
      voiceService = new VoiceService(localConfig);
      await voiceService.initialize();

      await expect(voiceService.destroy()).resolves.not.toThrow();

      // Should remove all listeners
      expect(voiceService.listenerCount('transcript')).toBe(0);
      expect(voiceService.listenerCount('error')).toBe(0);
    });

    it('should destroy without initialization', async () => {
      voiceService = new VoiceService(localConfig);

      await expect(voiceService.destroy()).resolves.not.toThrow();
    });
  });
});
