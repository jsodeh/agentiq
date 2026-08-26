import { BrowserAgent } from './browser-agent';
import { SessionRecorder, getSessionRecorder } from './session-recorder';
import { ApprovalGate, getApprovalGate, ComputerUseAction } from './approval-gate';
import { ScreenCapture, getScreenCapture } from './screen-capture';

export interface ComputerUseConfig {
  agentId: number;
  autoApprove: boolean;
  recordSessions: boolean;
  headless: boolean;
  approvalTimeout?: number;
}

export class ComputerUse {
  private browserAgent: BrowserAgent | null = null;
  private sessionRecorder: SessionRecorder;
  private approvalGate: ApprovalGate;
  private screenCapture: ScreenCapture;
  private config: ComputerUseConfig;
  private sessionId: string = '';

  constructor(config: ComputerUseConfig) {
    this.config = config;
    this.sessionRecorder = getSessionRecorder();
    this.approvalGate = getApprovalGate();
    this.screenCapture = getScreenCapture();
  }

  async initialize(): Promise<void> {
    try {
      // Initialize components
      await this.sessionRecorder.initialize();
      await this.screenCapture.initialize();

      // Set approval gate config
      await this.approvalGate.setAutoApprove(this.config.autoApprove);
      if (this.config.approvalTimeout) {
        this.approvalGate.setApprovalTimeout(this.config.approvalTimeout);
      }

      // Initialize browser agent
      this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.browserAgent = new BrowserAgent(this.config.agentId, this.sessionId);

      await this.browserAgent.initialize({
        headless: this.config.headless,
        recordVideo: this.config.recordSessions,
      });

      console.log('ComputerUse initialized');
    } catch (error) {
      console.error('Failed to initialize ComputerUse:', error);
      throw error;
    }
  }

  async navigate(url: string): Promise<void> {
    if (!this.browserAgent) throw new Error('ComputerUse not initialized');

    const action: ComputerUseAction = {
      id: this.generateActionId(),
      agentId: this.config.agentId,
      sessionId: this.sessionId,
      action: 'navigate',
      description: `Navigate to ${url}`,
      params: { url },
      risk: ApprovalGate.assessRisk('navigate', { url }),
      timestamp: Date.now(),
      preview: { url },
    };

    const approved = await this.approvalGate.requestApproval(action);
    if (!approved) {
      throw new Error('Action rejected by user');
    }

    await this.browserAgent.navigate(url);
  }

  async click(selector: string): Promise<void> {
    if (!this.browserAgent) throw new Error('ComputerUse not initialized');

    // Capture screen before action
    const screenshot = await this.screenCapture.captureToBuffer();

    const action: ComputerUseAction = {
      id: this.generateActionId(),
      agentId: this.config.agentId,
      sessionId: this.sessionId,
      action: 'click',
      description: `Click element: ${selector}`,
      params: { selector },
      risk: ApprovalGate.assessRisk('click', { selector }),
      timestamp: Date.now(),
      preview: {
        selector,
        screenshot: screenshot.toString('base64'),
      },
    };

    const approved = await this.approvalGate.requestApproval(action);
    if (!approved) {
      throw new Error('Action rejected by user');
    }

    await this.browserAgent.click(selector);
  }

  async fill(selector: string, value: string): Promise<void> {
    if (!this.browserAgent) throw new Error('ComputerUse not initialized');

    const screenshot = await this.screenCapture.captureToBuffer();

    const action: ComputerUseAction = {
      id: this.generateActionId(),
      agentId: this.config.agentId,
      sessionId: this.sessionId,
      action: 'fill',
      description: `Fill input: ${selector}`,
      params: { selector, value: '***' }, // Don't expose value
      risk: ApprovalGate.assessRisk('fill', { selector }),
      timestamp: Date.now(),
      preview: {
        selector,
        value: '***',
        screenshot: screenshot.toString('base64'),
      },
    };

    const approved = await this.approvalGate.requestApproval(action);
    if (!approved) {
      throw new Error('Action rejected by user');
    }

    await this.browserAgent.fill(selector, value);
  }

  async type(selector: string, text: string, delay?: number): Promise<void> {
    if (!this.browserAgent) throw new Error('ComputerUse not initialized');

    const action: ComputerUseAction = {
      id: this.generateActionId(),
      agentId: this.config.agentId,
      sessionId: this.sessionId,
      action: 'type',
      description: `Type into: ${selector}`,
      params: { selector, text: '***', delay },
      risk: ApprovalGate.assessRisk('type', { selector }),
      timestamp: Date.now(),
      preview: { selector },
    };

    const approved = await this.approvalGate.requestApproval(action);
    if (!approved) {
      throw new Error('Action rejected by user');
    }

    await this.browserAgent.type(selector, text, delay);
  }

  async extractText(selector: string): Promise<string> {
    if (!this.browserAgent) throw new Error('ComputerUse not initialized');

    // Read-only action, no approval needed
    return await this.browserAgent.extractText(selector);
  }

  async screenshot(): Promise<Buffer> {
    if (!this.browserAgent) throw new Error('ComputerUse not initialized');

    // Read-only action, no approval needed
    return await this.browserAgent.screenshot();
  }

  async waitForSelector(selector: string, timeout?: number): Promise<void> {
    if (!this.browserAgent) throw new Error('ComputerUse not initialized');

    // Read-only action, no approval needed
    await this.browserAgent.waitForSelector(selector, timeout);
  }

  async getCurrentUrl(): Promise<string> {
    if (!this.browserAgent) throw new Error('ComputerUse not initialized');
    return await this.browserAgent.getCurrentUrl();
  }

  async getTitle(): Promise<string> {
    if (!this.browserAgent) throw new Error('ComputerUse not initialized');
    return await this.browserAgent.getTitle();
  }

  async captureScreen(): Promise<Buffer> {
    return await this.screenCapture.captureToBuffer();
  }

  async close(): Promise<void> {
    if (this.browserAgent) {
      await this.browserAgent.close();
      this.browserAgent = null;
    }
  }

  getSessionId(): string {
    return this.sessionId;
  }

  getApprovalGate(): ApprovalGate {
    return this.approvalGate;
  }

  getSessionRecorder(): SessionRecorder {
    return this.sessionRecorder;
  }

  getScreenCapture(): ScreenCapture {
    return this.screenCapture;
  }

  private generateActionId(): string {
    return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export all classes and functions
export {
  BrowserAgent,
  SessionRecorder,
  getSessionRecorder,
  ApprovalGate,
  getApprovalGate,
  ScreenCapture,
  getScreenCapture,
};

export type { ComputerUseAction };
