import { vi } from 'vitest';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((cmd?: string) => {
    if (cmd === 'check_whisper_binary' || cmd === 'check_tts_binary' || cmd?.startsWith('check_')) {
      return Promise.resolve(true);
    }
    return Promise.resolve(true);
  }),
}));

vi.mock('@tauri-apps/api/event', () => ({
  emit: vi.fn(),
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: 'div',
    button: 'button',
    span: 'span',
    h1: 'h1',
    h2: 'h2',
    p: 'p',
    section: 'section',
    ul: 'ul',
    li: 'li',
  },
  AnimatePresence: ({ children }: any) => children,
}));

// Mock Anthropic SDK
class MockAnthropic {
  messages = {
    create: vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Mock response' }],
    }),
  };
  beta = {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Mock response' }],
      }),
    },
  };
}

vi.mock('@anthropic-ai/sdk', () => ({
  default: MockAnthropic,
  Anthropic: MockAnthropic,
}));

// Mock Composio SDK
vi.mock('composio-core', () => ({
  Composio: vi.fn().mockImplementation(() => ({
    executeAction: vi.fn(),
  })),
}));

// Mock better-sqlite3
class MockDatabase {
  prepare = vi.fn(() => ({
    run: vi.fn(() => ({ lastInsertRowid: 1, changes: 1 })),
    get: vi.fn(() => ({
      id: 1,
      name: 'Test Agent',
      type: 'General',
      status: 'idle',
      config: JSON.stringify({
        escalationRules: [
          { id: 'rule-1', type: 'error_retry_count', threshold: 3, action: 'notify', enabled: true },
          { id: 'rule-2', type: 'deal_value_threshold', threshold: 1000000, action: 'human_approval', enabled: true },
          { id: 'rule-3', type: 'sentiment_score', threshold: 0.3, action: 'pause', enabled: true },
          { id: 'rule-4', type: 'payment_amount_threshold', threshold: 500000, action: 'human_approval', enabled: true },
          { id: 'rule-5', type: 'reply_rate_threshold', threshold: 0.1, action: 'notify', enabled: true },
        ],
      }),
    })),
    all: vi.fn(() => [
      { id: 1, name: 'Test Agent 1', type: 'General', status: 'idle' },
      { id: 2, name: 'Test Agent 2', type: 'General', status: 'idle' },
    ]),
  }));
  pragma = vi.fn();
  close = vi.fn();
  exec = vi.fn();
}

vi.mock('better-sqlite3', () => ({
  default: MockDatabase,
}));

// Mock Paystack
vi.mock('paystack', () => {
  const mockPaystack = vi.fn(() => ({
    plan: {
      create: vi.fn(),
    },
    customer: {
      create: vi.fn(),
    },
    transaction: {
      initialize: vi.fn(),
      verify: vi.fn(),
      list: vi.fn(),
      charge: vi.fn(),
    },
    subscription: {
      create: vi.fn(),
      disable: vi.fn(),
      get: vi.fn(),
    },
  }));

  return {
    default: mockPaystack,
  };
});

// Mock Flutterwave
class MockFlutterwave {
  Transaction = {
    initiate: vi.fn(),
    verify: vi.fn(),
  };
  Subscription = {
    create: vi.fn(),
    cancel: vi.fn(),
    get: vi.fn(),
  };
}

vi.mock('flutterwave-node-v3', () => ({
  default: MockFlutterwave,
}));

// Mock localStorage
global.localStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};

// Mock fetch
global.fetch = vi.fn((url?: any, _init?: any) => {
  const urlStr = String(url || '');
  if (urlStr.includes('elevenlabs') || urlStr.includes('voices')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ voices: [{ voice_id: 'v1', name: 'Rachel' }] }),
      text: () => Promise.resolve(JSON.stringify({ voices: [{ voice_id: 'v1', name: 'Rachel' }] })),
    } as Response);
  }
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ response: 'ok', projects: [] }),
    text: () => Promise.resolve('ok'),
  } as Response);
});

// Mock navigator.mediaDevices
Object.defineProperty(global.navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: vi.fn(() =>
      Promise.resolve({
        getTracks: () => [],
        getAudioTracks: () => [],
        getVideoTracks: () => [],
        addTrack: vi.fn(),
        removeTrack: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })
    ),
    enumerateDevices: vi.fn(() => Promise.resolve([])),
  },
});

// Mock AudioContext
class MockAudioContext {
  sampleRate = 16000;
  destination = {};
  createMediaStreamSource = vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
  }));
  createScriptProcessor = vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    onaudioprocess: null,
  }));
  createGain = vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    gain: { value: 1 },
  }));
  createBufferSource = vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    buffer: null,
  }));
  createBuffer = vi.fn((channels: number, length: number, sampleRate: number) => ({
    length,
    sampleRate,
    numberOfChannels: channels,
    getChannelData: () => new Float32Array(length),
  }));
  decodeAudioData = vi.fn((arrayBuffer: ArrayBuffer) =>
    Promise.resolve({
      length: 16000,
      sampleRate: 16000,
      numberOfChannels: 1,
      getChannelData: () => new Float32Array(16000),
    })
  );
  close = vi.fn(() => Promise.resolve());
}

(global as any).AudioContext = MockAudioContext;
(global as any).webkitAudioContext = MockAudioContext;

// Mock Worker
class MockWorker {
  onmessage: any = null;
  postMessage = vi.fn((data: any) => {
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
  });
  terminate = vi.fn();
}

(global as any).Worker = MockWorker;

// Mock Deepgram SDK
vi.mock('@deepgram/sdk', () => ({
  createClient: vi.fn(() => ({
    listen: {
      live: vi.fn(() => ({
        on: vi.fn(),
        send: vi.fn(),
        finish: vi.fn(),
      })),
    },
    speak: vi.fn(() => Promise.resolve({
      getStream: () => new ReadableStream(),
    })),
  })),
}));

// Mock process.env
process.env = {
  ...process.env,
  PAYSTACK_SECRET_KEY: 'test_sk_paystack',
  PAYSTACK_PUBLIC_KEY: 'test_pk_paystack',
  PAYSTACK_WEBHOOK_SECRET: 'test_webhook_secret',
  FLUTTERWAVE_PUBLIC_KEY: 'test_pk_flutterwave',
  FLUTTERWAVE_SECRET_KEY: 'test_sk_flutterwave',
  FLUTTERWAVE_ENCRYPTION_KEY: 'test_enc_key',
  FLUTTERWAVE_WEBHOOK_SECRET: 'test_webhook_secret_fw',
  APP_URL: 'http://localhost:3000',
};
