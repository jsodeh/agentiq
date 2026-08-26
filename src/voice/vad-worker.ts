// Voice Activity Detection Worker using Silero VAD
import { pipeline } from '@xenova/transformers';

let vadModel: any = null;
let audioBuffer: Float32Array[] = [];
let isSpeaking = false;
let silenceFrames = 0;
const SILENCE_THRESHOLD = 20; // frames of silence before speech_end
const MIN_SPEECH_FRAMES = 10; // minimum frames to consider as speech

async function initializeVAD() {
  try {
    vadModel = await pipeline('audio-classification', 'Xenova/silero-vad');
    self.postMessage({ type: 'vad_initialized' });
  } catch (error) {
    self.postMessage({ type: 'error', error: String(error) });
  }
}

async function processAudio(audioData: Float32Array, threshold: number) {
  if (!vadModel) {
    return;
  }

  try {
    // Run VAD on audio chunk
    const result = await vadModel(audioData);
    const speechProbability = result[0].score;

    if (speechProbability > threshold) {
      // Speech detected
      if (!isSpeaking) {
        isSpeaking = true;
        audioBuffer = [];
        self.postMessage({ type: 'speech_start' });
      }

      audioBuffer.push(new Float32Array(audioData));
      silenceFrames = 0;
    } else {
      // Silence detected
      if (isSpeaking) {
        silenceFrames++;

        // Continue buffering during short pauses
        if (silenceFrames < SILENCE_THRESHOLD) {
          audioBuffer.push(new Float32Array(audioData));
        } else {
          // End of speech
          if (audioBuffer.length >= MIN_SPEECH_FRAMES) {
            // Concatenate all audio buffers
            const totalLength = audioBuffer.reduce((sum, buf) => sum + buf.length, 0);
            const combinedBuffer = new Float32Array(totalLength);
            let offset = 0;

            for (const buf of audioBuffer) {
              combinedBuffer.set(buf, offset);
              offset += buf.length;
            }

            (self as any).postMessage({
              type: 'speech_end',
              data: { audioBuffer: combinedBuffer.buffer },
            }, [combinedBuffer.buffer]);
          }

          isSpeaking = false;
          audioBuffer = [];
          silenceFrames = 0;
        }
      }
    }
  } catch (error) {
    self.postMessage({ type: 'error', error: String(error) });
  }
}

// Message handler
self.onmessage = async (event) => {
  const { type, audioData, threshold } = event.data;

  if (type === 'init') {
    await initializeVAD();
  } else if (type === 'process_audio') {
    const audio = new Float32Array(audioData);
    await processAudio(audio, threshold || 0.5);
  }
};

// Initialize on load
initializeVAD();
