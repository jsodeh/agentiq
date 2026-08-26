import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { invoke } from '@tauri-apps/api/core';
import { appDataDir } from '@tauri-apps/api/path';
import { join } from 'path';

export interface BrowserAction {
  id: string;
  sessionId: string;
  action: string;
  selector?: string;
  value?: string;
  url?: string;
  timestamp: number;
  screenshotPath?: string;
  success: boolean;
  error?: string;
}

export interface BrowserSession {
  id: string;
  agentId: number;
  startTime: number;
  endTime?: number;
  recordingPath?: string;
  actions: BrowserAction[];
}

export class BrowserAgent {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private sessionId: string;
  private agentId: number;
  private screenshotsDir: string = '';
  private isRecording: boolean = false;

  constructor(agentId: number, sessionId?: string) {
    this.agentId = agentId;
    this.sessionId = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async initialize(options?: { headless?: boolean; recordVideo?: boolean }): Promise<void> {
    try {
      const dataDir = await appDataDir();
      this.screenshotsDir = join(dataDir, 'screenshots', this.sessionId);

      // Create screenshots directory via Tauri
      await invoke('create_directory', { path: this.screenshotsDir });

      // Launch browser with Playwright
      this.browser = await chromium.launch({
        headless: options?.headless ?? false,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
          '--no-sandbox',
        ],
      });

      // Create context with optional video recording
      const contextOptions: any = {
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      };

      if (options?.recordVideo) {
        const recordingsDir = join(dataDir, 'recordings');
        await invoke('create_directory', { path: recordingsDir });
        
        contextOptions.recordVideo = {
          dir: recordingsDir,
          size: { width: 1920, height: 1080 },
        };
        this.isRecording = true;
      }

      this.context = await this.browser.newContext(contextOptions);
      this.page = await this.context.newPage();

      // Log session start
      await this.logAction({
        action: 'session_start',
        success: true,
      });

      console.log(`Browser session ${this.sessionId} initialized`);
    } catch (error) {
      console.error('Failed to initialize browser:', error);
      throw error;
    }
  }

  async navigate(url: string): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');

    const actionId = this.generateActionId();
    
    try {
      await this.page.goto(url, { waitUntil: 'networkidle' });
      
      const screenshotPath = await this.takeScreenshot(actionId);
      
      await this.logAction({
        action: 'navigate',
        url,
        success: true,
        screenshotPath,
      });
    } catch (error) {
      await this.logAction({
        action: 'navigate',
        url,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async click(selector: string): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');

    const actionId = this.generateActionId();
    
    try {
      await this.page.click(selector);
      await this.page.waitForTimeout(500); // Wait for any animations
      
      const screenshotPath = await this.takeScreenshot(actionId);
      
      await this.logAction({
        action: 'click',
        selector,
        success: true,
        screenshotPath,
      });
    } catch (error) {
      await this.logAction({
        action: 'click',
        selector,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async fill(selector: string, value: string): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');

    const actionId = this.generateActionId();
    
    try {
      await this.page.fill(selector, value);
      await this.page.waitForTimeout(300);
      
      const screenshotPath = await this.takeScreenshot(actionId);
      
      await this.logAction({
        action: 'fill',
        selector,
        value: '***', // Don't log actual values for security
        success: true,
        screenshotPath,
      });
    } catch (error) {
      await this.logAction({
        action: 'fill',
        selector,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async screenshot(): Promise<Buffer> {
    if (!this.page) throw new Error('Browser not initialized');

    try {
      const screenshot = await this.page.screenshot({ fullPage: false });
      return screenshot;
    } catch (error) {
      console.error('Failed to take screenshot:', error);
      throw error;
    }
  }

  async extractText(selector: string): Promise<string> {
    if (!this.page) throw new Error('Browser not initialized');

    const actionId = this.generateActionId();
    
    try {
      const text = await this.page.textContent(selector);
      
      await this.logAction({
        action: 'extract_text',
        selector,
        value: text?.substring(0, 100) || '', // Log first 100 chars
        success: true,
      });
      
      return text || '';
    } catch (error) {
      await this.logAction({
        action: 'extract_text',
        selector,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async waitForSelector(selector: string, timeout: number = 30000): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');

    const actionId = this.generateActionId();
    
    try {
      await this.page.waitForSelector(selector, { timeout });
      
      await this.logAction({
        action: 'wait_for_selector',
        selector,
        success: true,
      });
    } catch (error) {
      await this.logAction({
        action: 'wait_for_selector',
        selector,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async type(selector: string, text: string, delay: number = 100): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');

    const actionId = this.generateActionId();
    
    try {
      await this.page.type(selector, text, { delay });
      
      const screenshotPath = await this.takeScreenshot(actionId);
      
      await this.logAction({
        action: 'type',
        selector,
        value: '***',
        success: true,
        screenshotPath,
      });
    } catch (error) {
      await this.logAction({
        action: 'type',
        selector,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async select(selector: string, value: string): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');

    const actionId = this.generateActionId();
    
    try {
      await this.page.selectOption(selector, value);
      
      const screenshotPath = await this.takeScreenshot(actionId);
      
      await this.logAction({
        action: 'select',
        selector,
        value,
        success: true,
        screenshotPath,
      });
    } catch (error) {
      await this.logAction({
        action: 'select',
        selector,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async scrollTo(selector: string): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');

    const actionId = this.generateActionId();
    
    try {
      await this.page.locator(selector).scrollIntoViewIfNeeded();
      
      const screenshotPath = await this.takeScreenshot(actionId);
      
      await this.logAction({
        action: 'scroll_to',
        selector,
        success: true,
        screenshotPath,
      });
    } catch (error) {
      await this.logAction({
        action: 'scroll_to',
        selector,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getCurrentUrl(): Promise<string> {
    if (!this.page) throw new Error('Browser not initialized');
    return this.page.url();
  }

  async getTitle(): Promise<string> {
    if (!this.page) throw new Error('Browser not initialized');
    return this.page.title();
  }

  async goBack(): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');
    await this.page.goBack();
    await this.logAction({ action: 'go_back', success: true });
  }

  async goForward(): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');
    await this.page.goForward();
    await this.logAction({ action: 'go_forward', success: true });
  }

  async reload(): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');
    await this.page.reload();
    await this.logAction({ action: 'reload', success: true });
  }

  private async takeScreenshot(actionId: string): Promise<string> {
    if (!this.page) return '';

    try {
      const filename = `${actionId}.png`;
      const filepath = join(this.screenshotsDir, filename);
      
      await this.page.screenshot({ path: filepath });
      
      return filepath;
    } catch (error) {
      console.error('Failed to save screenshot:', error);
      return '';
    }
  }

  private async logAction(action: Partial<BrowserAction>): Promise<void> {
    const actionRecord: BrowserAction = {
      id: action.id || this.generateActionId(),
      sessionId: this.sessionId,
      action: action.action || 'unknown',
      selector: action.selector,
      value: action.value,
      url: action.url,
      timestamp: Date.now(),
      screenshotPath: action.screenshotPath,
      success: action.success ?? false,
      error: action.error,
    };

    try {
      // Save to database
      await invoke('log_browser_action', {
        sessionId: this.sessionId,
        agentId: this.agentId,
        action: JSON.stringify(actionRecord),
      });
    } catch (error) {
      console.error('Failed to log action:', error);
    }
  }

  private generateActionId(): string {
    return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async getRecordingPath(): Promise<string | null> {
    if (!this.isRecording || !this.page) return null;

    try {
      const video = this.page.video();
      if (!video) return null;

      const path = await video.path();
      return path;
    } catch (error) {
      console.error('Failed to get recording path:', error);
      return null;
    }
  }

  async close(): Promise<void> {
    try {
      // Get recording path before closing
      let recordingPath: string | null = null;
      if (this.isRecording && this.page) {
        recordingPath = await this.getRecordingPath();
      }

      // Close page and context
      if (this.page) {
        await this.page.close();
        this.page = null;
      }

      if (this.context) {
        await this.context.close();
        this.context = null;
      }

      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }

      // Log session end
      await this.logAction({
        action: 'session_end',
        success: true,
      });

      // Update session with recording path
      if (recordingPath) {
        await invoke('update_session_recording', {
          sessionId: this.sessionId,
          recordingPath,
        });
      }

      console.log(`Browser session ${this.sessionId} closed`);
    } catch (error) {
      console.error('Failed to close browser:', error);
      throw error;
    }
  }

  getSessionId(): string {
    return this.sessionId;
  }

  isInitialized(): boolean {
    return this.browser !== null && this.page !== null;
  }
}
