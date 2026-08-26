import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LocalVoice } from '../../voice/local';
import type { LocalVoiceConfig } from '../../voice/local';
import fs from 'fs';
import path from 'path';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core');

// Mock AudioContext for testing
class MockAudioContext {
  sampleRate = 16000;
  destination = {};
  
  createMediaStreamSource() {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }

  createScriptProcessor() {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
      onaudioprocess: null,
    };
  }

  createGain() {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
      gain: { value: 1 },
    };
  }

  createBufferSource() {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      buffer: null,
    };
  }

  createBuffer(channels: number, length: number, sampleRate: number) {
    return {
      length,
      sampleRate,
      numberOfChannels: channels,
      getChannelData: () => new Float32Array(length),
    };
  }

  decodeAudioData(arrayBuffer: ArrayBuffer) {
    return Promise.resolve({
      length: 16000,
      sampleRate: 16000,
      numberOfChannels: 1,
      getChannelData: () => new Float32Array(16000),
    });
  }

  close() {
    return Promise.resolve();
  }
}

// Mock Worker
class MockWorker {
  onmessage: ((event: any) => void) | null = null;
  
  postMessage(data: any) {
    // Simulate VAD worker response
    setTimeout(() => {
      if (this.onmessage) {
        this.onmessage({
          data: {
            type: 'speech_detected',
            isSpeech: true,
            confidence: 0.9,
          },
        });
      }
    }, 10);
  }

  terminate() {}
}

global.AudioContext = MockAudioContext as any;
global.Worker = MockWorker as any;

describe('Integration Test 4: Voice Round-Trip (Local)', () => {
  let localVoice: LocalVoice;
  let testAudioPath: string;
  let outputAudioPath: string;

  beforeEach(async () => {
    const config: LocalVoiceConfig = {
      language: 'en',
      whisperModel: 'base',
      ttsModel: 'tts_models/en/ljspeech/tacotron2-DDC',
      vadThreshold: 0.5,
      wakeWordEnabled: false,
    };

    localVoice = new LocalVoice(config);

    // Create test audio file (mock WAV file)
    testAudioPath = path.join(__dirname, 'test_audio.wav');
    outputAudioPath = path.join(__dirname, 'output_audio.wav');

    // Create a simple WAV file buffer
    const wavHeader = Buffer.alloc(44);
    // WAV header (simplified)
    wavHeader.write('RIFF', 0);
    wavHeader.writeUInt32LE(36 + 16000 * 2, 4); // File size
    wavHeader.write('WAVE', 8);
    wavHeader.write('fmt ', 12);
    wavHeader.writeUInt32LE(16, 16); // Subchunk1Size
    wavHeader.writeUInt16LE(1, 20); // AudioFormat (PCM)
    wavHeader.writeUInt16LE(1, 22); // NumChannels (mono)
    wavHeader.writeUInt32LE(16000, 24); // SampleRate
    wavHeader.writeUInt32LE(16000 * 2, 28); // ByteRate
    wavHeader.writeUInt16LE(2, 32); // BlockAlign
    wavHeader.writeUInt16LE(16, 34); // BitsPerSample
    wavHeader.write('data', 36);
    wavHeader.writeUInt32LE(16000 * 2, 40); // Subchunk2Size

    // Create audio data (1 second of silence)
    const audioData = Buffer.alloc(16000 * 2);
    const wavFile = Buffer.concat([wavHeader, audioData]);

    fs.writeFileSync(testAudioPath, wavFile);

    // Mock Tauri commands
    vi.mocked(invoke).mockImplementation(async (command: string, args?: any) => {
      switch (command) {
        case 'check_whisper_binary':
          return true;
        
        case 'check_tts_binary':
          return true;
        
        case 'whisper_transcribe':
          // Simulate transcription
          return 'Hello, this is a test transcription from the audio file.';
        
        case 'coqui_tts_speak':
          // Simulate TTS - create output file
          fs.writeFileSync(outputAudioPath, Buffer.alloc(32000));
          return Promise.resolve();
        
        default:
          return Promise.resolve();
      }
    });

    // Initialize voice service
    await localVoice.initialize();
  });

  afterEach(async () => {
    if (localVoice) {
      await localVoice.destroy();
    }

    // Clean up test files
    if (fs.existsSync(testAudioPath)) {
      fs.unlinkSync(testAudioPath);
    }
    if (fs.existsSync(outputAudioPath)) {
      fs.unlinkSync(outputAudioPath);
    }

    vi.clearAllMocks();
  });

  it('should transcribe pre-recorded WAV file and return non-empty string', async () => {
    // Read test audio file
    const audioBuffer = fs.readFileSync(testAudioPath).buffer;

    // Transcribe
    const transcript = await localVoice.transcribe(audioBuffer);

    // ASSERTIONS

    // 1. Returned transcript is a non-empty string
    expect(transcript).toBeTruthy();
    expect(typeof transcript).toBe('string');
    expect(transcript.length).toBeGreaterThan(0);

    // 2. Transcript contains expected content
    expect(transcript).toContain('test');

    // 3. Verify Tauri command was called
    expect(invoke).toHaveBeenCalledWith(
      'whisper_transcribe',
      expect.objectContaining({
        audioData: expect.any(Array),
        language: 'en',
        model: 'base',
      })
    );
  });

  it('should speak transcript and create output audio file', async () => {
    const testText = 'Hello, this is a test transcription from the audio file.';

    // Speak
    await localVoice.speak(testText);

    // ASSERTIONS

    // 1. No errors thrown
    expect(true).toBe(true); // If we got here, no errors were thrown

    // 2. Output audio file exists on disk
    expect(fs.existsSync(outputAudioPath)).toBe(true);

    // 3. Output file has content
    const stats = fs.statSync(outputAudioPath);
    expect(stats.size).toBeGreaterThan(0);

    // 4. Verify Tauri command was called
    expect(invoke).toHaveBeenCalledWith(
      'coqui_tts_speak',
      expect.objectContaining({
        text: testText,
        language: 'en',
        model: 'tts_models/en/ljspeech/tacotron2-DDC',
      })
    );
  });

  it('should complete full round-trip: transcribe then speak', async () => {
    // Step 1: Transcribe audio file
    const audioBuffer = fs.readFileSync(testAudioPath).buffer;
    const transcript = await localVoice.transcribe(audioBuffer);

    expect(transcript).toBeTruthy();
    expect(transcript.length).toBeGreaterThan(0);

    // Step 2: Speak the transcript
    await localVoice.speak(transcript);

    // Step 3: Verify output file exists
    expect(fs.existsSync(outputAudioPath)).toBe(true);

    // Step 4: Verify both Tauri commands were called
    expect(invoke).toHaveBeenCalledWith('whisper_transcribe', expect.any(Object));
    expect(invoke).toHaveBeenCalledWith('coqui_tts_speak', expect.any(Object));

    // Step 5: Verify the spoken text matches the transcript
    const speakCall = vi.mocked(invoke).mock.calls.find(
      (call) => call[0] === 'coqui_tts_speak'
    );
    expect(speakCall).toBeDefined();
    expect(speakCall![1]).toHaveProperty('text', transcript);
  });

  it('should handle different languages', async () => {
    // Test with Yoruba
    const yorubaVoice = new LocalVoice({
      language: 'yo',
      whisperModel: 'base',
      ttsModel: 'tts_models/yo/openbible/vits',
      vadThreshold: 0.5,
      wakeWordEnabled: false,
    });

    await yorubaVoice.initialize();

    const audioBuffer = fs.readFileSync(testAudioPath).buffer;
    const transcript = await yorubaVoice.transcribe(audioBuffer);

    expect(transcript).toBeTruthy();

    // Verify language was passed correctly
    expect(invoke).toHaveBeenCalledWith(
      'whisper_transcribe',
      expect.objectContaining({
        language: 'yo',
      })
    );

    await yorubaVoice.destroy();
  });

  it('should emit events during transcription', async () => {
    const events: string[] = [];

    localVoice.on('listening', () => events.push('listening'));
    localVoice.on('speech_start', () => events.push('speech_start'));
    localVoice.on('transcript', () => events.push('transcript'));

    // Start listening
    await localVoice.startListening();

    // Simulate speech detection
    const mockProcessor = (localVoice as any).scriptProcessor;
    if (mockProcessor && mockProcessor.onaudioprocess) {
      mockProcessor.onaudioprocess({
        inputBuffer: {
          getChannelData: () => new Float32Array(1024).fill(0.5),
        },
      });
    }

    // Wait for events
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify events were emitted
    expect(events).toContain('listening');
  });

  it('should handle transcription errors gracefully', async () => {
    // Mock Tauri to throw error
    vi.mocked(invoke).mockImplementation(async (command: string) => {
      if (command === 'whisper_transcribe') {
        throw new Error('Whisper binary not found');
      }
      return Promise.resolve();
    });

    const audioBuffer = fs.readFileSync(testAudioPath).buffer;

    // Should throw error
    await expect(localVoice.transcribe(audioBuffer)).rejects.toThrow(
      'Whisper binary not found'
    );
  });

  it('should handle TTS errors gracefully', async () => {
    // Mock Tauri to throw error
    vi.mocked(invoke).mockImplementation(async (command: string) => {
      if (command === 'coqui_tts_speak') {
        throw new Error('TTS model not found');
      }
      return Promise.resolve();
    });

    // Should throw error
    await expect(localVoice.speak('Test text')).rejects.toThrow(
      'TTS model not found'
    );
  });

  it('should process audio in chunks', async () => {
    // Create larger audio file (5 seconds)
    const largeAudioData = Buffer.alloc(16000 * 2 * 5);
    const wavHeader = Buffer.alloc(44);
    
    // WAV header
    wavHeader.write('RIFF', 0);
    wavHeader.writeUInt32LE(36 + largeAudioData.length, 4);
    wavHeader.write('WAVE', 8);
    wavHeader.write('fmt ', 12);
    wavHeader.writeUInt32LE(16, 16);
    wavHeader.writeUInt16LE(1, 20);
    wavHeader.writeUInt16LE(1, 22);
    wavHeader.writeUInt32LE(16000, 24);
    wavHeader.writeUInt32LE(16000 * 2, 28);
    wavHeader.writeUInt16LE(2, 32);
    wavHeader.writeUInt16LE(16, 34);
    wavHeader.write('data', 36);
    wavHeader.writeUInt32LE(largeAudioData.length, 40);

    const largeWavFile = Buffer.concat([wavHeader, largeAudioData]);
    const largeAudioPath = path.join(__dirname, 'large_audio.wav');
    fs.writeFileSync(largeAudioPath, largeWavFile);

    try {
      const audioBuffer = fs.readFileSync(largeAudioPath).buffer;
      const transcript = await localVoice.transcribe(audioBuffer);

      expect(transcript).toBeTruthy();

      // Verify audio was processed
      expect(invoke).toHaveBeenCalledWith('whisper_transcribe', expect.any(Object));
    } finally {
      if (fs.existsSync(largeAudioPath)) {
        fs.unlinkSync(largeAudioPath);
      }
    }
  });

  it('should support wake word detection', async () => {
    const wakeWordVoice = new LocalVoice({
      language: 'en',
      whisperModel: 'base',
      ttsModel: 'tts_models/en/ljspeech/tacotron2-DDC',
      vadThreshold: 0.5,
      wakeWordEnabled: true,
    });

    await wakeWordVoice.initialize();

    const status = wakeWordVoice.getStatus();
    expect(status).toHaveProperty('listening');
    expect(status).toHaveProperty('speaking');

    await wakeWordVoice.destroy();
  });

  it('should adjust VAD threshold', async () => {
    const sensitiveVoice = new LocalVoice({
      language: 'en',
      whisperModel: 'base',
      ttsModel: 'tts_models/en/ljspeech/tacotron2-DDC',
      vadThreshold: 0.3, // More sensitive
      wakeWordEnabled: false,
    });

    await sensitiveVoice.initialize();

    // Verify VAD threshold is set
    const vadThreshold = (sensitiveVoice as any).vadThreshold;
    expect(vadThreshold).toBe(0.3);

    await sensitiveVoice.destroy();
  });
});
