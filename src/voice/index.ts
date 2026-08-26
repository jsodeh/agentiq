import { EventEmitter } from 'events';
import { LocalVoice, LocalVoiceConfig } from './local';
import { CloudVoice, CloudVoiceConfig } from './cloud';

export type VoiceMode = 'local' | 'cloud';

export interface VoiceConfig {
  mode: VoiceMode;
  language: string;
  autoFallback: boolean;
  local?: {
    whisperModel: string;
    ttsModel: string;
    vadThreshold: number;
    wakeWordEnabled: boolean;
  };
  cloud?: {
    deepgramApiKey: string;
    elevenLabsApiKey: string;
    deepgramModel?: string;
    elevenLabsVoiceId?: string;
  };
}

export class VoiceService extends EventEmitter {
  private config: VoiceConfig;
  private activeVoice: LocalVoice | CloudVoice | null = null;
  private currentMode: VoiceMode;
  private fallbackAttempted: boolean = false;

  constructor(config: VoiceConfig) {
    super();
    this.config = config;
    this.currentMode = config.mode;
  }

  async initialize(): Promise<void> {
    try {
      await this.initializeVoiceEngine(this.currentMode);
      this.emit('initialized', { mode: this.currentMode });
    } catch (error) {
      this.emit('error', error);

      // Attempt fallback if enabled
      if (this.config.autoFallback && !this.fallbackAttempted) {
        await this.attemptFallback();
      } else {
        throw error;
      }
    }
  }

  private async initializeVoiceEngine(mode: VoiceMode): Promise<void> {
    // Clean up existing voice engine
    if (this.activeVoice) {
      await this.activeVoice.destroy();
      this.activeVoice = null;
    }

    if (mode === 'local') {
      if (!this.config.local) {
        throw new Error('Local voice configuration not provided');
      }

      const localConfig: LocalVoiceConfig = {
        language: this.config.language,
        whisperModel: this.config.local.whisperModel,
        ttsModel: this.config.local.ttsModel,
        vadThreshold: this.config.local.vadThreshold,
        wakeWordEnabled: this.config.local.wakeWordEnabled,
      };

      this.activeVoice = new LocalVoice(localConfig);
    } else {
      if (!this.config.cloud) {
        throw new Error('Cloud voice configuration not provided');
      }

      const cloudConfig: CloudVoiceConfig = {
        language: this.config.language,
        deepgramApiKey: this.config.cloud.deepgramApiKey,
        elevenLabsApiKey: this.config.cloud.elevenLabsApiKey,
        deepgramModel: this.config.cloud.deepgramModel,
        elevenLabsVoiceId: this.config.cloud.elevenLabsVoiceId,
      };

      this.activeVoice = new CloudVoice(cloudConfig);
    }

    // Forward events from voice engine
    this.setupEventForwarding();

    // Initialize the voice engine
    await this.activeVoice.initialize();
  }

  private setupEventForwarding(): void {
    if (!this.activeVoice) return;

    this.activeVoice.on('listening', () => {
      this.emit('listening');
    });

    this.activeVoice.on('speech_start', () => {
      this.emit('speech_start');
    });

    this.activeVoice.on('transcript', (transcript: string) => {
      this.emit('transcript', transcript);
    });

    this.activeVoice.on('speaking', (text: string) => {
      this.emit('speaking', text);
    });

    this.activeVoice.on('idle', () => {
      this.emit('idle');
    });

    this.activeVoice.on('error', async (error: Error) => {
      this.emit('error', error);

      // Attempt fallback on error if enabled
      if (this.config.autoFallback && !this.fallbackAttempted) {
        await this.attemptFallback();
      }
    });
  }

  private async attemptFallback(): Promise<void> {
    this.fallbackAttempted = true;
    const fallbackMode: VoiceMode = this.currentMode === 'cloud' ? 'local' : 'cloud';

    try {
      console.log(`Attempting fallback from ${this.currentMode} to ${fallbackMode}`);
      this.currentMode = fallbackMode;
      await this.initializeVoiceEngine(fallbackMode);
      this.emit('fallback', { from: this.config.mode, to: fallbackMode });
    } catch (fallbackError) {
      this.emit('fallback_failed', fallbackError);
      throw new Error(`Both voice modes failed. Original mode: ${this.config.mode}, Fallback mode: ${fallbackMode}`);
    }
  }

  async startListening(): Promise<void> {
    if (!this.activeVoice) {
      throw new Error('Voice service not initialized');
    }

    await this.activeVoice.startListening();
  }

  async stopListening(): Promise<void> {
    if (!this.activeVoice) {
      throw new Error('Voice service not initialized');
    }

    await this.activeVoice.stopListening();
  }

  async transcribe(audioBuffer: ArrayBuffer): Promise<string> {
    if (!this.activeVoice) {
      throw new Error('Voice service not initialized');
    }

    return await this.activeVoice.transcribe(audioBuffer);
  }

  async speak(text: string): Promise<void> {
    if (!this.activeVoice) {
      throw new Error('Voice service not initialized');
    }

    await this.activeVoice.speak(text);
  }

  async setLanguage(language: string): Promise<void> {
    this.config.language = language;

    // Reinitialize with new language
    if (this.activeVoice) {
      await this.initializeVoiceEngine(this.currentMode);
    }
  }

  async switchMode(mode: VoiceMode): Promise<void> {
    if (mode === this.currentMode) {
      return;
    }

    this.currentMode = mode;
    this.fallbackAttempted = false;
    await this.initializeVoiceEngine(mode);
    this.emit('mode_changed', { mode });
  }

  getStatus(): {
    mode: VoiceMode;
    listening: boolean;
    speaking: boolean;
    language: string;
  } {
    const voiceStatus = this.activeVoice?.getStatus() || {
      listening: false,
      speaking: false,
    };

    return {
      mode: this.currentMode,
      ...voiceStatus,
      language: this.config.language,
    };
  }

  async destroy(): Promise<void> {
    if (this.activeVoice) {
      await this.activeVoice.destroy();
      this.activeVoice = null;
    }

    this.removeAllListeners();
  }
}

// Singleton instance
let voiceServiceInstance: VoiceService | null = null;

export function initializeVoiceService(config: VoiceConfig): VoiceService {
  if (voiceServiceInstance) {
    voiceServiceInstance.destroy();
  }

  voiceServiceInstance = new VoiceService(config);
  return voiceServiceInstance;
}

export function getVoiceService(): VoiceService {
  if (!voiceServiceInstance) {
    throw new Error('Voice service not initialized. Call initializeVoiceService first.');
  }

  return voiceServiceInstance;
}
