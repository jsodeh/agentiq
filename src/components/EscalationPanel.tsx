import { motion } from 'framer-motion';
import type { Escalation } from '../types';

interface EscalationPanelProps {
  escalations: Escalation[];
  onResolve: (id: number) => void;
  onDismiss: (id: number) => void;
}

export default function EscalationPanel({ escalations, onResolve, onDismiss }: EscalationPanelProps) {
  const pending = escalations.filter(e => e.status === 'pending');

  if (pending.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-yellow-900 bg-opacity-20 border border-yellow-500 rounded-lg p-4 mb-6"
    >
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        <h3 className="text-yellow-500 font-semibold">
          {pending.length} Escalation{pending.length !== 1 ? 's' : ''} Pending
        </h3>
      </div>

      <div className="space-y-3">
        {pending.map((escalation) => (
          <div key={escalation.id} className="bg-dark rounded p-3">
            <p className="text-white mb-2">{escalation.reason}</p>
            <p className="text-xs text-midGray mb-3">
              Task #{escalation.task_id} • {new Date(escalation.created_at).toLocaleString()}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => onResolve(escalation.id)}
                className="px-3 py-1 bg-accent hover:bg-opacity-80 text-dark text-sm rounded transition-colors"
              >
                Resolve
              </button>
              <button
                onClick={() => onDismiss(escalation.id)}
                className="px-3 py-1 border border-midGray hover:border-white text-white text-sm rounded transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
