import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { getApprovalGate, getSessionRecorder, type ComputerUseAction } from '../computer-use';
import type { Recording } from '../computer-use/session-recorder';

interface ComputerUsePanelProps {
  agentId?: number;
}

export const ComputerUsePanel: React.FC<ComputerUsePanelProps> = ({ agentId }) => {
  const [activeTab, setActiveTab] = useState<'live' | 'recordings' | 'approvals'>('live');
  const [liveScreenshot, setLiveScreenshot] = useState<string>('');
  const [isLiveSessionActive, setIsLiveSessionActive] = useState(false);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<ComputerUseAction[]>([]);
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);

  // Poll for live screenshot
  useEffect(() => {
    if (activeTab !== 'live' || !isLiveSessionActive) return;

    const interval = setInterval(async () => {
      try {
        const screenshot = await invoke<string>('get_live_screenshot', { agentId });
        setLiveScreenshot(screenshot);
      } catch (error) {
        console.error('Failed to get live screenshot:', error);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [activeTab, isLiveSessionActive, agentId]);

  // Load recordings
  useEffect(() => {
    if (activeTab !== 'recordings') return;

    const loadRecordings = async () => {
      try {
        const recorder = getSessionRecorder();
        const recs = await recorder.getAllRecordings(agentId);
        setRecordings(recs);
      } catch (error) {
        console.error('Failed to load recordings:', error);
      }
    };

    loadRecordings();
  }, [activeTab, agentId]);

  // Load pending approvals
  useEffect(() => {
    if (activeTab !== 'approvals') return;

    const loadApprovals = async () => {
      try {
        const gate = getApprovalGate();
        const pending = await gate.getPendingActions();
        setPendingApprovals(pending);
      } catch (error) {
        console.error('Failed to load pending approvals:', error);
      }
    };

    loadApprovals();

    // Listen for new pending actions
    const unlisten = listen('computer_use_pending', (event: any) => {
      const action = JSON.parse(event.payload.action);
      setPendingApprovals(prev => [...prev, action]);
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, [activeTab]);

  const handleApprove = async (actionId: string) => {
    try {
      await invoke('approve_computer_use', { actionId, reason: 'Approved by user' });
      setPendingApprovals(prev => prev.filter(a => a.id !== actionId));
    } catch (error) {
      console.error('Failed to approve action:', error);
    }
  };

  const handleReject = async (actionId: string) => {
    try {
      await invoke('reject_computer_use', { actionId, reason: 'Rejected by user' });
      setPendingApprovals(prev => prev.filter(a => a.id !== actionId));
    } catch (error) {
      console.error('Failed to reject action:', error);
    }
  };

  const handleStarRecording = async (recordingId: string) => {
    try {
      const recorder = getSessionRecorder();
      const recording = recordings.find(r => r.id === recordingId);
      
      if (recording?.starred) {
        await recorder.unstarRecording(recordingId);
      } else {
        await recorder.starRecording(recordingId);
      }

      // Reload recordings
      const recs = await recorder.getAllRecordings(agentId);
      setRecordings(recs);
    } catch (error) {
      console.error('Failed to star recording:', error);
    }
  };

  const handleDeleteRecording = async (recordingId: string) => {
    if (!confirm('Are you sure you want to delete this recording?')) return;

    try {
      const recorder = getSessionRecorder();
      await recorder.deleteRecording(recordingId);

      // Reload recordings
      const recs = await recorder.getAllRecordings(agentId);
      setRecordings(recs);
    } catch (error) {
      console.error('Failed to delete recording:', error);
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const getRiskColor = (risk: string): string => {
    switch (risk) {
      case 'low': return 'text-green-400';
      case 'medium': return 'text-yellow-400';
      case 'high': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="bg-dark rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Computer Use</h2>
        
        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('live')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'live'
                ? 'bg-brand text-white'
                : 'bg-midGray text-gray-300 hover:bg-gray-600'
            }`}
          >
            Live Session
          </button>
          <button
            onClick={() => setActiveTab('recordings')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'recordings'
                ? 'bg-brand text-white'
                : 'bg-midGray text-gray-300 hover:bg-gray-600'
            }`}
          >
            Recordings
          </button>
          <button
            onClick={() => setActiveTab('approvals')}
            className={`px-4 py-2 rounded-lg transition-colors relative ${
              activeTab === 'approvals'
                ? 'bg-brand text-white'
                : 'bg-midGray text-gray-300 hover:bg-gray-600'
            }`}
          >
            Approvals
            {pendingApprovals.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {pendingApprovals.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'live' && (
          <motion.div
            key="live"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            {isLiveSessionActive ? (
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-white font-medium">Live Session Active</span>
                  </div>
                  <button
                    onClick={() => setIsLiveSessionActive(false)}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                  >
                    Stop Session
                  </button>
                </div>

                {/* Live Screenshot */}
                <div className="bg-black rounded-lg overflow-hidden aspect-video">
                  {liveScreenshot ? (
                    <img
                      src={`data:image/png;base64,${liveScreenshot}`}
                      alt="Live session"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                      Loading...
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-gray-800 rounded-lg p-8 text-center">
                <p className="text-gray-400 mb-4">No active session</p>
                <button
                  onClick={() => setIsLiveSessionActive(true)}
                  className="px-6 py-3 bg-brand text-white rounded-lg hover:bg-purple-600 transition-colors"
                >
                  Start Session
                </button>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'recordings' && (
          <motion.div
            key="recordings"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            {recordings.length === 0 ? (
              <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-400">
                No recordings yet
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recordings.map(recording => (
                  <div
                    key={recording.id}
                    className="bg-gray-800 rounded-lg overflow-hidden hover:ring-2 hover:ring-brand transition-all cursor-pointer"
                    onClick={() => setSelectedRecording(recording)}
                  >
                    {/* Thumbnail */}
                    <div className="bg-black aspect-video relative">
                      {recording.thumbnail ? (
                        <img
                          src={recording.thumbnail}
                          alt="Recording thumbnail"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-500">
                          No thumbnail
                        </div>
                      )}
                      
                      {/* Duration overlay */}
                      <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 px-2 py-1 rounded text-white text-sm">
                        {formatDuration(recording.duration)}
                      </div>

                      {/* Star indicator */}
                      {recording.starred && (
                        <div className="absolute top-2 right-2">
                          <span className="text-yellow-400 text-xl">⭐</span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-4">
                      <p className="text-white font-medium mb-2">
                        {new Date(recording.startTime).toLocaleString()}
                      </p>
                      <p className="text-gray-400 text-sm mb-3">
                        {formatFileSize(recording.fileSize)}
                      </p>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStarRecording(recording.id);
                          }}
                          className="flex-1 px-3 py-2 bg-midGray text-white rounded hover:bg-gray-600 transition-colors text-sm"
                        >
                          {recording.starred ? 'Unstar' : 'Star'}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRecording(recording.id);
                          }}
                          className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'approvals' && (
          <motion.div
            key="approvals"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            {pendingApprovals.length === 0 ? (
              <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-400">
                No pending approvals
              </div>
            ) : (
              pendingApprovals.map(action => (
                <div
                  key={action.id}
                  className="bg-gray-800 rounded-lg p-6 border-l-4 border-brand"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-white font-medium text-lg mb-1">
                        {action.description}
                      </h3>
                      <p className="text-gray-400 text-sm">
                        {new Date(action.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRiskColor(action.risk)}`}>
                      {action.risk.toUpperCase()} RISK
                    </span>
                  </div>

                  {/* Action details */}
                  <div className="bg-gray-900 rounded p-4 mb-4">
                    <p className="text-gray-300 text-sm mb-2">
                      <span className="text-gray-500">Action:</span> {action.action}
                    </p>
                    {action.preview?.url && (
                      <p className="text-gray-300 text-sm mb-2">
                        <span className="text-gray-500">URL:</span> {action.preview.url}
                      </p>
                    )}
                    {action.preview?.selector && (
                      <p className="text-gray-300 text-sm mb-2">
                        <span className="text-gray-500">Selector:</span> {action.preview.selector}
                      </p>
                    )}
                    {action.preview?.screenshot && (
                      <div className="mt-3">
                        <img
                          src={`data:image/png;base64,${action.preview.screenshot}`}
                          alt="Action preview"
                          className="rounded max-h-48 object-contain"
                        />
                      </div>
                    )}
                  </div>

                  {/* Approval buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleApprove(action.id)}
                      className="flex-1 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
                    >
                      ✓ Approve
                    </button>
                    <button
                      onClick={() => handleReject(action.id)}
                      className="flex-1 px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
                    >
                      ✗ Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recording Player Modal */}
      {selectedRecording && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-8"
          onClick={() => setSelectedRecording(null)}
        >
          <div
            className="bg-gray-800 rounded-lg max-w-4xl w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white text-xl font-bold">
                Recording - {new Date(selectedRecording.startTime).toLocaleString()}
              </h3>
              <button
                onClick={() => setSelectedRecording(null)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            <video
              src={selectedRecording.filePath}
              controls
              className="w-full rounded-lg bg-black"
            />
          </div>
        </div>
      )}
    </div>
  );
};
