import { EventEmitter } from 'events';
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import { ElevenLabsClient } from 'elevenlabs';

export interface CloudVoiceConfig {
  language: string;
  deepgramApiKey: string;
  elevenLabsApiKey: string;
  deepgramModel?: string;
  elevenLabsVoiceId?: string;
}

export class CloudVoice extends EventEmitter {
  private config: CloudVoiceConfig;
  private deepgramClient: any;
  private elevenLabsClient: ElevenLabsClient;
  private deepgramConnection: any = null;
  private isListening: boolean = false;
  private isSpeaking: boolean = false;
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;

  constructor(config: CloudVoiceConfig) {
    super();
    this.config = config;
    this.deepgramClient = createClient(config.deepgramApiKey);
    this.elevenLabsClient = new ElevenLabsClient({ apiKey: config.elevenLabsApiKey });
  }

  async initialize(): Promise<void> {
    try {
      // Test Deepgram connection
      await this.testDeepgramConnection();

      // Test ElevenLabs connection
      await this.testElevenLabsConnection();

      this.emit('initialized');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  private async testDeepgramConnection(): Promise<void> {
    try {
      // Simple test to verify API key
      const response = await fetch('https://api.deepgram.com/v1/projects', {
        headers: {
          Authorization: `Token ${this.config.deepgramApiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error('Invalid Deepgram API key');
      }
    } catch (error) {
      throw new Error(`Deepgram connection failed: ${error}`);
    }
  }

  private async testElevenLabsConnection(): Promise<void> {
    try {
      // Test by fetching voices
      await this.elevenLabsClient.voices.getAll();
    } catch (error) {
      throw new Error(`ElevenLabs connection failed: ${error}`);
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

      // Create Deepgram live transcription connection
      this.deepgramConnection = this.deepgramClient.listen.live({
        model: this.config.deepgramModel || 'nova-2',
        language: this.mapLanguageCode(this.config.language),
        smart_format: true,
        interim_results: false,
        utterance_end_ms: 1000,
        vad_events: true,
      });

      // Set up event listeners
      this.deepgramConnection.on(LiveTranscriptionEvents.Open, () => {
        this.isListening = true;
        this.emit('listening');

        // Start sending audio to Deepgram
        this.startAudioStreaming();
      });

      this.deepgramConnection.on(LiveTranscriptionEvents.Transcript, (data: any) => {
        const transcript = data.channel?.alternatives?.[0]?.transcript;
        
        if (transcript && transcript.trim()) {
          this.emit('transcript', transcript.trim());
        }
      });

      this.deepgramConnection.on(LiveTranscriptionEvents.SpeechStarted, () => {
        this.emit('speech_start');
      });

      this.deepgramConnection.on(LiveTranscriptionEvents.UtteranceEnd, () => {
        this.emit('utterance_end');
      });

      this.deepgramConnection.on(LiveTranscriptionEvents.Error, (error: any) => {
        this.emit('error', error);
      });

      this.deepgramConnection.on(LiveTranscriptionEvents.Close, () => {
        this.isListening = false;
        this.emit('idle');
      });

    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  private startAudioStreaming(): void {
    if (!this.mediaStream || !this.deepgramConnection) return;

    this.mediaRecorder = new MediaRecorder(this.mediaStream, {
      mimeType: 'audio/webm',
    });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0 && this.deepgramConnection) {
        this.deepgramConnection.send(event.data);
      }
    };

    this.mediaRecorder.start(250); // Send data every 250ms
  }

  async stopListening(): Promise<void> {
    if (!this.isListening) return;

    if (this.mediaRecorder) {
      this.mediaRecorder.stop();
      this.mediaRecorder = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.deepgramConnection) {
      this.deepgramConnection.finish();
      this.deepgramConnection = null;
    }

    this.isListening = false;
    this.emit('idle');
  }

  async transcribe(audioBuffer: ArrayBuffer): Promise<string> {
    try {
      // For one-shot transcription (not streaming)
      const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });
      
      const response = await fetch('https://api.deepgram.com/v1/listen', {
        method: 'POST',
        headers: {
          Authorization: `Token ${this.config.deepgramApiKey}`,
          'Content-Type': 'audio/wav',
        },
        body: audioBlob,
      });

      const result = (await response.json()) as any;
      const transcript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
      
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

      const voiceId = this.config.elevenLabsVoiceId || this.getDefaultVoiceId();

      // Stream audio from ElevenLabs
      const audioStream = await this.elevenLabsClient.generate({
        voice: voiceId,
        text,
        model_id: 'eleven_multilingual_v2',
      });

      // Play audio
      await this.playAudioStream(audioStream);

      this.isSpeaking = false;
      this.emit('idle');
    } catch (error) {
      this.isSpeaking = false;
      this.emit('error', error);
      throw error;
    }
  }

  private async playAudioStream(audioStream: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const audioContext = new AudioContext();
      const chunks: Uint8Array[] = [];

      audioStream.on('data', (chunk: Uint8Array) => {
        chunks.push(chunk);
      });

      audioStream.on('end', async () => {
        try {
          // Combine all chunks
          const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
          const combinedArray = new Uint8Array(totalLength);
          let offset = 0;

          for (const chunk of chunks) {
            combinedArray.set(chunk, offset);
            offset += chunk.length;
          }

          // Decode and play audio
          const audioBuffer = await audioContext.decodeAudioData(combinedArray.buffer);
          const source = audioContext.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(audioContext.destination);

          source.onended = () => {
            audioContext.close();
            resolve();
          };

          source.start(0);
        } catch (error) {
          reject(error);
        }
      });

      audioStream.on('error', reject);
    });
  }

  private mapLanguageCode(language: string): string {
    const languageMap: Record<string, string> = {
      'English': 'en',
      'Pidgin': 'en', // Use English model for Pidgin
      'Yoruba': 'yo',
      'Igbo': 'ig',
      'Hausa': 'ha',
    };

    return languageMap[language] || 'en';
  }

  private getDefaultVoiceId(): string {
    // Default ElevenLabs voice IDs
    const voiceMap: Record<string, string> = {
      'English': 'EXAVITQu4vr4xnSDxMaL', // Sarah
      'Pidgin': 'EXAVITQu4vr4xnSDxMaL', // Sarah (English voice)
      'Yoruba': 'EXAVITQu4vr4xnSDxMaL',
      'Igbo': 'EXAVITQu4vr4xnSDxMaL',
      'Hausa': 'EXAVITQu4vr4xnSDxMaL',
    };

    return voiceMap[this.config.language] || 'EXAVITQu4vr4xnSDxMaL';
  }

  async destroy(): Promise<void> {
    await this.stopListening();
    this.removeAllListeners();
  }

  getStatus(): { listening: boolean; speaking: boolean } {
    return {
      listening: this.isListening,
      speaking: this.isSpeaking,
    };
  }
}
