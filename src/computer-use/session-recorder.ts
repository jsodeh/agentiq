import { invoke } from '@tauri-apps/api/core';
import { appDataDir } from '@tauri-apps/api/path';
import { join } from 'path';

export interface Recording {
  id: string;
  sessionId: string;
  agentId: number;
  filePath: string;
  fileSize: number;
  duration: number;
  startTime: number;
  endTime: number;
  starred: boolean;
  thumbnail?: string;
}

export class SessionRecorder {
  private recordingsDir: string = '';
  private initialized: boolean = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const dataDir = await appDataDir();
      this.recordingsDir = join(dataDir, 'recordings');

      // Create recordings directory via Tauri
      await invoke('create_directory', { path: this.recordingsDir });

      // Start cleanup task
      await this.cleanupOldRecordings();

      this.initialized = true;
      console.log('SessionRecorder initialized');
    } catch (error) {
      console.error('Failed to initialize SessionRecorder:', error);
      throw error;
    }
  }

  async saveRecording(
    sessionId: string,
    agentId: number,
    videoPath: string,
    startTime: number,
    endTime: number
  ): Promise<Recording> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Get file info
      const fileInfo = await invoke<{ size: number }>('get_file_info', { path: videoPath });
      const duration = Math.floor((endTime - startTime) / 1000); // seconds

      // Generate thumbnail
      const thumbnailPath = await this.generateThumbnail(videoPath, sessionId);

      const recording: Recording = {
        id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        sessionId,
        agentId,
        filePath: videoPath,
        fileSize: fileInfo.size,
        duration,
        startTime,
        endTime,
        starred: false,
        thumbnail: thumbnailPath,
      };

      // Save to database
      await invoke('save_recording', {
        recording: JSON.stringify(recording),
      });

      console.log(`Recording saved: ${recording.id}`);
      return recording;
    } catch (error) {
      console.error('Failed to save recording:', error);
      throw error;
    }
  }

  async getRecording(recordingId: string): Promise<Recording | null> {
    try {
      const result = await invoke<string>('get_recording', { recordingId });
      return JSON.parse(result);
    } catch (error) {
      console.error('Failed to get recording:', error);
      return null;
    }
  }

  async getAllRecordings(agentId?: number): Promise<Recording[]> {
    try {
      const result = await invoke<string>('get_all_recordings', { agentId });
      return JSON.parse(result);
    } catch (error) {
      console.error('Failed to get recordings:', error);
      return [];
    }
  }

  async getRecordingsBySession(sessionId: string): Promise<Recording[]> {
    try {
      const result = await invoke<string>('get_recordings_by_session', { sessionId });
      return JSON.parse(result);
    } catch (error) {
      console.error('Failed to get recordings by session:', error);
      return [];
    }
  }

  async starRecording(recordingId: string): Promise<void> {
    try {
      await invoke('star_recording', { recordingId, starred: true });
      console.log(`Recording ${recordingId} starred`);
    } catch (error) {
      console.error('Failed to star recording:', error);
      throw error;
    }
  }

  async unstarRecording(recordingId: string): Promise<void> {
    try {
      await invoke('star_recording', { recordingId, starred: false });
      console.log(`Recording ${recordingId} unstarred`);
    } catch (error) {
      console.error('Failed to unstar recording:', error);
      throw error;
    }
  }

  async deleteRecording(recordingId: string): Promise<void> {
    try {
      const recording = await this.getRecording(recordingId);
      if (!recording) {
        throw new Error('Recording not found');
      }

      // Delete video file
      await invoke('delete_file', { path: recording.filePath });

      // Delete thumbnail if exists
      if (recording.thumbnail) {
        await invoke('delete_file', { path: recording.thumbnail });
      }

      // Delete from database
      await invoke('delete_recording', { recordingId });

      console.log(`Recording ${recordingId} deleted`);
    } catch (error) {
      console.error('Failed to delete recording:', error);
      throw error;
    }
  }

  async cleanupOldRecordings(): Promise<void> {
    try {
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      const recordings = await this.getAllRecordings();

      for (const recording of recordings) {
        // Skip starred recordings
        if (recording.starred) continue;

        // Delete if older than 30 days
        if (recording.endTime < thirtyDaysAgo) {
          await this.deleteRecording(recording.id);
          console.log(`Cleaned up old recording: ${recording.id}`);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old recordings:', error);
    }
  }

  private async generateThumbnail(videoPath: string, sessionId: string): Promise<string> {
    try {
      const thumbnailsDir = join(this.recordingsDir, 'thumbnails');
      await invoke('create_directory', { path: thumbnailsDir });

      const thumbnailPath = join(thumbnailsDir, `${sessionId}.jpg`);

      // Generate thumbnail via Tauri (uses ffmpeg)
      await invoke('generate_video_thumbnail', {
        videoPath,
        thumbnailPath,
        timestamp: 1, // 1 second into video
      });

      return thumbnailPath;
    } catch (error) {
      console.error('Failed to generate thumbnail:', error);
      return '';
    }
  }

  async getRecordingStats(): Promise<{
    totalRecordings: number;
    totalSize: number;
    starredCount: number;
    oldestRecording: number;
    newestRecording: number;
  }> {
    try {
      const recordings = await this.getAllRecordings();

      const stats = {
        totalRecordings: recordings.length,
        totalSize: recordings.reduce((sum, r) => sum + r.fileSize, 0),
        starredCount: recordings.filter(r => r.starred).length,
        oldestRecording: Math.min(...recordings.map(r => r.startTime)),
        newestRecording: Math.max(...recordings.map(r => r.endTime)),
      };

      return stats;
    } catch (error) {
      console.error('Failed to get recording stats:', error);
      return {
        totalRecordings: 0,
        totalSize: 0,
        starredCount: 0,
        oldestRecording: 0,
        newestRecording: 0,
      };
    }
  }

  async exportRecording(recordingId: string, destinationPath: string): Promise<void> {
    try {
      const recording = await this.getRecording(recordingId);
      if (!recording) {
        throw new Error('Recording not found');
      }

      // Copy file to destination
      await invoke('copy_file', {
        source: recording.filePath,
        destination: destinationPath,
      });

      console.log(`Recording exported to: ${destinationPath}`);
    } catch (error) {
      console.error('Failed to export recording:', error);
      throw error;
    }
  }

  getRecordingsDirectory(): string {
    return this.recordingsDir;
  }
}

// Singleton instance
let recorderInstance: SessionRecorder | null = null;

export function getSessionRecorder(): SessionRecorder {
  if (!recorderInstance) {
    recorderInstance = new SessionRecorder();
  }
  return recorderInstance;
}
