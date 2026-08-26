import { invoke } from '@tauri-apps/api/core';
import { appDataDir } from '@tauri-apps/api/path';
import { join } from 'path';

export interface ScreenCaptureOptions {
  displayId?: number;
  region?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  format?: 'png' | 'jpg';
  quality?: number; // 0-100 for jpg
}

export interface ScreenInfo {
  id: number;
  name: string;
  width: number;
  height: number;
  isPrimary: boolean;
}

export interface CaptureResult {
  path: string;
  width: number;
  height: number;
  timestamp: number;
  fileSize: number;
}

export class ScreenCapture {
  private capturesDir: string = '';
  private initialized: boolean = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const dataDir = await appDataDir();
      this.capturesDir = join(dataDir, 'screen-captures');

      // Create captures directory via Tauri
      await invoke('create_directory', { path: this.capturesDir });

      this.initialized = true;
      console.log('ScreenCapture initialized');
    } catch (error) {
      console.error('Failed to initialize ScreenCapture:', error);
      throw error;
    }
  }

  async captureScreen(options?: ScreenCaptureOptions): Promise<CaptureResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const timestamp = Date.now();
      const format = options?.format || 'png';
      const filename = `capture_${timestamp}.${format}`;
      const filepath = join(this.capturesDir, filename);

      // Capture screen via Tauri
      const result = await invoke<string>('capture_screen', {
        displayId: options?.displayId,
        region: options?.region ? JSON.stringify(options.region) : null,
        outputPath: filepath,
        format,
        quality: options?.quality || 90,
      });

      const captureInfo = JSON.parse(result);

      return {
        path: filepath,
        width: captureInfo.width,
        height: captureInfo.height,
        timestamp,
        fileSize: captureInfo.fileSize,
      };
    } catch (error) {
      console.error('Failed to capture screen:', error);
      throw error;
    }
  }

  async captureWindow(windowTitle: string): Promise<CaptureResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const timestamp = Date.now();
      const filename = `window_${timestamp}.png`;
      const filepath = join(this.capturesDir, filename);

      // Capture specific window via Tauri
      const result = await invoke<string>('capture_window', {
        windowTitle,
        outputPath: filepath,
      });

      const captureInfo = JSON.parse(result);

      return {
        path: filepath,
        width: captureInfo.width,
        height: captureInfo.height,
        timestamp,
        fileSize: captureInfo.fileSize,
      };
    } catch (error) {
      console.error('Failed to capture window:', error);
      throw error;
    }
  }

  async getScreens(): Promise<ScreenInfo[]> {
    try {
      const result = await invoke<string>('get_screens');
      return JSON.parse(result);
    } catch (error) {
      console.error('Failed to get screens:', error);
      return [];
    }
  }

  async getPrimaryScreen(): Promise<ScreenInfo | null> {
    const screens = await this.getScreens();
    return screens.find(s => s.isPrimary) || null;
  }

  async captureRegion(
    x: number,
    y: number,
    width: number,
    height: number
  ): Promise<CaptureResult> {
    return this.captureScreen({
      region: { x, y, width, height },
    });
  }

  async captureToBuffer(options?: ScreenCaptureOptions): Promise<Buffer> {
    try {
      const result = await invoke<number[]>('capture_screen_to_buffer', {
        displayId: options?.displayId,
        region: options?.region ? JSON.stringify(options.region) : null,
        format: options?.format || 'png',
        quality: options?.quality || 90,
      });

      return Buffer.from(result);
    } catch (error) {
      console.error('Failed to capture screen to buffer:', error);
      throw error;
    }
  }

  async captureForVerification(
    actionId: string,
    agentId: number
  ): Promise<CaptureResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const timestamp = Date.now();
      const filename = `verification_${agentId}_${actionId}_${timestamp}.png`;
      const filepath = join(this.capturesDir, filename);

      const result = await invoke<string>('capture_screen', {
        outputPath: filepath,
        format: 'png',
        quality: 90,
      });

      const captureInfo = JSON.parse(result);

      // Log to database for audit trail
      await invoke('log_verification_capture', {
        actionId,
        agentId,
        capturePath: filepath,
        timestamp,
      });

      return {
        path: filepath,
        width: captureInfo.width,
        height: captureInfo.height,
        timestamp,
        fileSize: captureInfo.fileSize,
      };
    } catch (error) {
      console.error('Failed to capture for verification:', error);
      throw error;
    }
  }

  async cleanupOldCaptures(daysToKeep: number = 7): Promise<void> {
    try {
      const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);

      await invoke('cleanup_old_captures', {
        directory: this.capturesDir,
        cutoffTime,
      });

      console.log(`Cleaned up captures older than ${daysToKeep} days`);
    } catch (error) {
      console.error('Failed to cleanup old captures:', error);
    }
  }

  async getCaptureStats(): Promise<{
    totalCaptures: number;
    totalSize: number;
    oldestCapture: number;
    newestCapture: number;
  }> {
    try {
      const result = await invoke<string>('get_capture_stats', {
        directory: this.capturesDir,
      });
      return JSON.parse(result);
    } catch (error) {
      console.error('Failed to get capture stats:', error);
      return {
        totalCaptures: 0,
        totalSize: 0,
        oldestCapture: 0,
        newestCapture: 0,
      };
    }
  }

  getCapturesDirectory(): string {
    return this.capturesDir;
  }

  async deleteCapture(capturePath: string): Promise<void> {
    try {
      await invoke('delete_file', { path: capturePath });
      console.log(`Deleted capture: ${capturePath}`);
    } catch (error) {
      console.error('Failed to delete capture:', error);
      throw error;
    }
  }

  async exportCapture(capturePath: string, destinationPath: string): Promise<void> {
    try {
      await invoke('copy_file', {
        source: capturePath,
        destination: destinationPath,
      });
      console.log(`Exported capture to: ${destinationPath}`);
    } catch (error) {
      console.error('Failed to export capture:', error);
      throw error;
    }
  }
}

// Singleton instance
let screenCaptureInstance: ScreenCapture | null = null;

export function getScreenCapture(): ScreenCapture {
  if (!screenCaptureInstance) {
    screenCaptureInstance = new ScreenCapture();
  }
  return screenCaptureInstance;
}
