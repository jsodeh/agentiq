import { invoke } from '@tauri-apps/api/core';
import { EventEmitter } from 'events';

export interface LocalVoiceConfig {
  language: string;
  whisperModel: string;
  ttsModel: string;
  vadThreshold: number;
  wakeWordEnabled: boolean;
}

export class LocalVoice extends EventEmitter {
  private config: LocalVoiceConfig;
  private isListening: boolean = false;
  private isSpeaking: boolean = false;
  private vadWorker: Worker | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;

  constructor(config: LocalVoiceConfig) {
    super();
    this.config = config;
  }

  get vadThreshold(): number {
    return this.config.vadThreshold;
  }

  async initialize(): Promise<void> {
    try {
      // Initialize audio context
      this.audioContext = new AudioContext({ sampleRate: 16000 });

      // Initialize VAD worker
      this.vadWorker = new Worker(new URL('./vad-worker.ts', import.meta.url), {
        type: 'module',
      });

      this.vadWorker.onmessage = (event) => {
        const { type, data } = event.data;
        
        if (type === 'speech_start') {
          this.emit('speech_start');
        } else if (type === 'speech_end') {
          this.handleSpeechEnd(data.audioBuffer);
        }
      };

      // Check if whisper.cpp and coqui-tts binaries are available
      const whisperAvailable = await invoke<boolean>('check_whisper_binary');
      const ttsAvailable = await invoke<boolean>('check_tts_binary');

      if (!whisperAvailable || !ttsAvailable) {
        throw new Error('Voice binaries not found. Please run setup wizard.');
      }

      this.emit('initialized');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async startListening(): Promise<void> {
    if (this.isListening) return;

    try {
      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      if (!this.audioContext) {
        throw new Error('Audio context not initialized');
      }

      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      const processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (event) => {
        const audioData = event.inputBuffer.getChannelData(0);
        
        // Send audio to VAD worker
        if (this.vadWorker) {
          this.vadWorker.postMessage({
            type: 'process_audio',
            audioData: audioData.buffer,
            threshold: this.config.vadThreshold,
          }, [audioData.buffer]);
        }
      };

      source.connect(processor);
      processor.connect(this.audioContext.destination);

      this.isListening = true;
      this.emit('listening');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async stopListening(): Promise<void> {
    if (!this.isListening) return;

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    this.isListening = false;
    this.emit('idle');
  }

  private async handleSpeechEnd(audioBuffer: ArrayBuffer): Promise<void> {
    try {
      const transcript = await this.transcribe(audioBuffer);
      
      // Check for wake word if enabled
      if (this.config.wakeWordEnabled) {
        const hasWakeWord = await this.detectWakeWord(transcript);
        if (!hasWakeWord) {
          return;
        }
      }

      this.emit('transcript', transcript);
    } catch (error) {
      this.emit('error', error);
    }
  }

  async transcribe(audioBuffer: ArrayBuffer): Promise<string> {
    try {
      // Convert audio buffer to format expected by whisper.cpp
      const audioData = new Float32Array(audioBuffer);

      // Call Tauri command to run whisper.cpp
      const transcript = await invoke<string>('whisper_transcribe', {
        audioData: Array.from(audioData),
        language: this.config.language,
        model: this.config.whisperModel,
      });

      return transcript.trim();
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async speak(text: string): Promise<void> {
    if (this.isSpeaking) {
      throw new Error('Already speaking');
    }

    try {
      this.isSpeaking = true;
      this.emit('speaking', text);

      // Call Tauri command to run coqui-tts
      await invoke('coqui_tts_speak', {
        text,
        language: this.config.language,
        model: this.config.ttsModel,
      });

      this.isSpeaking = false;
      this.emit('idle');
    } catch (error) {
      this.isSpeaking = false;
      this.emit('error', error);
      throw error;
    }
  }

  private async detectWakeWord(transcript: string): Promise<boolean> {
    const normalizedTranscript = transcript.toLowerCase().trim();
    const wakeWords = ['hey agent', 'hey agentiq', 'agent'];

    return wakeWords.some(word => normalizedTranscript.includes(word));
  }

  async destroy(): Promise<void> {
    await this.stopListening();

    if (this.vadWorker) {
      this.vadWorker.terminate();
      this.vadWorker = null;
    }

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    this.removeAllListeners();
  }

  getStatus(): { listening: boolean; speaking: boolean } {
    return {
      listening: this.isListening,
      speaking: this.isSpeaking,
    };
  }
}
