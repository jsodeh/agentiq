import { motion } from 'framer-motion';
import type { Log } from '../types';

interface LogViewerProps {
  logs: Log[];
}

export default function LogViewer({ logs }: LogViewerProps) {
  const getLevelColor = (level: Log['level']) => {
    switch (level) {
      case 'error': return 'text-red-500';
      case 'warning': return 'text-yellow-500';
      default: return 'text-accent';
    }
  };

  return (
    <div className="bg-dark border border-midGray rounded-lg p-4 max-h-96 overflow-y-auto">
      <h3 className="text-white font-semibold mb-3">Activity Logs</h3>
      <div className="space-y-2 font-mono text-sm">
        {logs.map((log) => (
          <div key={log.id} className="flex gap-3">
            <span className="text-midGray text-xs">
              {new Date(log.created_at).toLocaleTimeString()}
            </span>
            <span className={`font-medium ${getLevelColor(log.level)}`}>
              [{log.level.toUpperCase()}]
            </span>
            <span className="text-white flex-1">{log.message}</span>
          </div>
        ))}
        {logs.length === 0 && (
          <p className="text-midGray text-center py-4">No logs available</p>
        )}
      </div>
    </div>
  );
}
