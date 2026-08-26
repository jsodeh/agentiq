import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Database from 'better-sqlite3';
import { invoke } from '@tauri-apps/api/core';
import WizardScreen from '../../screens/WizardScreen';
import fs from 'fs';
import path from 'path';

vi.mock('@tauri-apps/api/core');
vi.mock('composio-core', () => ({
  Composio: vi.fn().mockImplementation(() => ({
    initiateOAuth: vi.fn(async () => ({
      success: true,
      redirectUrl: 'agent://oauth-callback?code=test_code&state=test_state',
    })),
  })),
}));

describe('Integration Test 1: Full Wizard Flow', () => {
  let testDb: Database.Database;
  let testDbPath: string;

  beforeEach(() => {
    // Create test database
    testDbPath = path.join(__dirname, `test_wizard_${Date.now()}.db`);
    testDb = new Database(testDbPath);

    // Initialize schema
    const schema = fs.readFileSync(
      path.join(__dirname, '../../db/schema.sql'),
      'utf-8'
    );
    testDb.exec(schema);

    // Mock all Tauri commands
    vi.mocked(invoke).mockImplementation(async (command: string, args?: any) => {
      switch (command) {
        case 'check_ollama':
          return true;
        
        case 'get_ram_gb':
          return 16.0;
        
        case 'get_free_disk_gb':
          return 500.0;
        
        case 'get_gpu_info':
          return 'NVIDIA GeForce RTX 3080';
        
        case 'check_internet':
          return true;
        
        case 'download_model':
          // Simulate download progress
          setTimeout(() => {
            window.dispatchEvent(
              new CustomEvent('download_progress', {
                detail: {
                  downloaded: 5000000000,
                  total: 5000000000,
                  speed: 10000000,
                  eta: 0,
                },
              })
            );
          }, 100);
          return Promise.resolve();
        
        case 'verify_model_checksum':
          return true;
        
        case 'save_agent_configs':
          // Save to test database
          const configs = JSON.parse(args.configs);
          configs.forEach((config: any) => {
            testDb
              .prepare(
                'INSERT INTO agents (user_id, name, type, status, config) VALUES (?, ?, ?, ?, ?)'
              )
              .run(
                1,
                config.name,
                config.type,
                'paused',
                JSON.stringify(config.config)
              );
          });
          return Promise.resolve();
        
        case 'start_orchestrator':
          return Promise.resolve();
        
        case 'download_voice_model':
          setTimeout(() => {
            window.dispatchEvent(
              new CustomEvent('voice_model_download_progress', {
                detail: { progress: 100 },
              })
            );
          }, 100);
          return Promise.resolve();
        
        default:
          return Promise.resolve();
      }
    });

    // Mock localStorage
    const localStorageMock: Record<string, string> = {};
    global.localStorage = {
      getItem: (key: string) => localStorageMock[key] || null,
      setItem: (key: string, value: string) => {
        localStorageMock[key] = value;
      },
      removeItem: (key: string) => {
        delete localStorageMock[key];
      },
      clear: () => {
        Object.keys(localStorageMock).forEach(key => delete localStorageMock[key]);
      },
      length: Object.keys(localStorageMock).length,
      key: (index: number) => Object.keys(localStorageMock)[index] || null,
    };
  });

  afterEach(() => {
    if (testDb) {
      testDb.close();
    }
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    vi.clearAllMocks();
  });

  it('should complete full wizard flow and save to database', async () => {
    const { container } = render(
      <BrowserRouter>
        <WizardScreen />
      </BrowserRouter>
    );

    // SCREEN 1: Mode Select
    await waitFor(() => {
      expect(screen.getByText(/deployment mode/i)).toBeInTheDocument();
    });

    const cloudModeButton = screen.getByRole('button', { name: /cloud mode/i });
    fireEvent.click(cloudModeButton);

    // Verify localStorage
    expect(localStorage.getItem('deployment_mode')).toBe('cloud');

    // Click Next
    const nextButton = screen.getByRole('button', { name: /next/i });
    fireEvent.click(nextButton);

    // SCREEN 2: Device Check
    await waitFor(() => {
      expect(screen.getByText(/system check/i)).toBeInTheDocument();
    });

    // Wait for checks to complete
    await waitFor(
      () => {
        expect(invoke).toHaveBeenCalledWith('check_ollama');
        expect(invoke).toHaveBeenCalledWith('get_ram_gb');
        expect(invoke).toHaveBeenCalledWith('get_free_disk_gb');
        expect(invoke).toHaveBeenCalledWith('get_gpu_info');
        expect(invoke).toHaveBeenCalledWith('check_internet');
      },
      { timeout: 3000 }
    );

    // Click Next
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // SCREEN 3: Model Select
    await waitFor(() => {
      expect(screen.getByText(/select ai model/i)).toBeInTheDocument();
    });

    // Select a model
    const modelCard = screen.getByText(/llama3.2:3b/i).closest('div');
    fireEvent.click(modelCard!);

    // Wait for download
    await waitFor(
      () => {
        expect(invoke).toHaveBeenCalledWith('download_model', expect.any(Object));
      },
      { timeout: 5000 }
    );

    // Verify localStorage
    expect(localStorage.getItem('selected_model')).toBe('llama3.2:3b');

    // Click Next
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // SCREEN 4: Agent Select
    await waitFor(() => {
      expect(screen.getByText(/select agents/i)).toBeInTheDocument();
    });

    // Select multiple agents
    const leadGenAgent = screen.getByText(/lead gen/i).closest('div');
    const coldOutreachAgent = screen.getByText(/cold outreach/i).closest('div');
    const whatsappAgent = screen.getByText(/whatsapp/i).closest('div');

    fireEvent.click(leadGenAgent!);
    fireEvent.click(coldOutreachAgent!);
    fireEvent.click(whatsappAgent!);

    // Verify localStorage
    const selectedAgents = JSON.parse(localStorage.getItem('selected_agents') || '[]');
    expect(selectedAgents).toContain('lead-gen-maps');
    expect(selectedAgents).toContain('cold-outreach');
    expect(selectedAgents).toContain('customer-support-whatsapp');

    // Click Next
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // SCREEN 5: Integrations
    await waitFor(() => {
      expect(screen.getByText(/connect integrations/i)).toBeInTheDocument();
    });

    // Connect Google Maps (for lead-gen-maps)
    const googleMapsButton = screen.getByRole('button', { name: /connect google maps/i });
    fireEvent.click(googleMapsButton);

    // Wait for OAuth to complete
    await waitFor(() => {
      expect(screen.getByText(/connected/i)).toBeInTheDocument();
    });

    // Click Next
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // SCREEN 6: Agent Config
    await waitFor(() => {
      expect(screen.getByText(/configure agents/i)).toBeInTheDocument();
    });

    // Fill in config for first agent (lead-gen-maps)
    const businessNameInput = screen.getByLabelText(/business name/i);
    fireEvent.change(businessNameInput, { target: { value: 'Test Business' } });

    const locationInput = screen.getByLabelText(/target location/i);
    fireEvent.change(locationInput, { target: { value: 'Lagos, Nigeria' } });

    // Save config
    const saveConfigButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveConfigButton);

    // Verify localStorage
    const agentConfigs = JSON.parse(localStorage.getItem('agent_configs') || '{}');
    expect(agentConfigs['lead-gen-maps']).toBeDefined();
    expect(agentConfigs['lead-gen-maps'].businessName).toBe('Test Business');

    // Click Next
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // SCREEN 7: Voice Setup
    await waitFor(() => {
      expect(screen.getByText(/voice setup/i)).toBeInTheDocument();
    });

    // Select cloud mode
    const cloudVoiceButton = screen.getByRole('button', { name: /cloud voice/i });
    fireEvent.click(cloudVoiceButton);

    // Enter API keys
    const deepgramKeyInput = screen.getByLabelText(/deepgram api key/i);
    fireEvent.change(deepgramKeyInput, { target: { value: 'test_deepgram_key' } });

    const elevenLabsKeyInput = screen.getByLabelText(/elevenlabs api key/i);
    fireEvent.change(elevenLabsKeyInput, { target: { value: 'test_elevenlabs_key' } });

    // Verify localStorage
    const voiceConfig = JSON.parse(localStorage.getItem('voice_config') || '{}');
    expect(voiceConfig.mode).toBe('cloud');
    expect(voiceConfig.deepgramApiKey).toBe('test_deepgram_key');

    // Click Next
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // SCREEN 8: Launch
    await waitFor(() => {
      expect(screen.getByText(/setup complete/i)).toBeInTheDocument();
    });

    // Click Launch
    const launchButton = screen.getByRole('button', { name: /launch/i });
    fireEvent.click(launchButton);

    // Wait for orchestrator to start
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('start_orchestrator');
    });

    // ASSERTIONS: Query SQLite directly
    
    // 1. Check agents table has rows matching selected agent IDs
    const agents = testDb
      .prepare('SELECT * FROM agents WHERE user_id = ?')
      .all(1);

    expect(agents.length).toBe(3);
    
    const agentTypes = agents.map((a: any) => a.type);
    expect(agentTypes).toContain('lead-gen-maps');
    expect(agentTypes).toContain('cold-outreach');
    expect(agentTypes).toContain('customer-support-whatsapp');

    // 2. Each agent row has a valid config JSON blob
    agents.forEach((agent: any) => {
      expect(agent.config).toBeTruthy();
      
      // Should be valid JSON
      expect(() => JSON.parse(agent.config)).not.toThrow();
      
      const config = JSON.parse(agent.config);
      expect(typeof config).toBe('object');
      
      // Should have at least some config properties
      if (agent.type === 'lead-gen-maps') {
        expect(config.businessName).toBe('Test Business');
        expect(config.targetLocation).toBe('Lagos, Nigeria');
      }
    });

    // 3. Mode is set correctly in users table (or localStorage)
    expect(localStorage.getItem('deployment_mode')).toBe('cloud');
    expect(localStorage.getItem('setup_complete')).toBe('true');

    // Verify all expected localStorage keys exist
    expect(localStorage.getItem('selected_model')).toBeTruthy();
    expect(localStorage.getItem('selected_agents')).toBeTruthy();
    expect(localStorage.getItem('agent_configs')).toBeTruthy();
    expect(localStorage.getItem('voice_config')).toBeTruthy();
  });

  it('should disable Next button when required fields are empty', async () => {
    render(
      <BrowserRouter>
        <WizardScreen />
      </BrowserRouter>
    );

    // SCREEN 1: Mode Select - Next should be disabled until mode selected
    await waitFor(() => {
      expect(screen.getByText(/deployment mode/i)).toBeInTheDocument();
    });

    let nextButton = screen.getByRole('button', { name: /next/i });
    expect(nextButton).toBeDisabled();

    // Select mode
    const cloudModeButton = screen.getByRole('button', { name: /cloud mode/i });
    fireEvent.click(cloudModeButton);

    // Now Next should be enabled
    expect(nextButton).not.toBeDisabled();
  });

  it('should handle OAuth deep-link callback', async () => {
    render(
      <BrowserRouter>
        <WizardScreen />
      </BrowserRouter>
    );

    // Navigate to Integrations screen
    // ... (skip to screen 5)

    await waitFor(() => {
      expect(screen.getByText(/connect integrations/i)).toBeInTheDocument();
    });

    // Trigger OAuth
    const connectButton = screen.getByRole('button', { name: /connect/i });
    fireEvent.click(connectButton);

    // Simulate deep-link callback
    window.dispatchEvent(
      new CustomEvent('deep-link', {
        detail: {
          url: 'agent://oauth-callback?code=test_code&state=google_maps',
        },
      })
    );

    // Wait for connection status to update
    await waitFor(() => {
      expect(screen.getByText(/connected/i)).toBeInTheDocument();
    });

    // Verify integration is marked as connected
    const integrations = JSON.parse(localStorage.getItem('connected_integrations') || '{}');
    expect(integrations['google_maps']).toBe(true);
  });
});
