import { motion } from 'framer-motion';
import type { Task } from '../types';

interface TaskListProps {
  tasks: Task[];
}

export default function TaskList({ tasks }: TaskListProps) {
  const getStatusColor = (status: Task['status']) => {
    switch (status) {
      case 'completed': return 'text-accent';
      case 'in_progress': return 'text-brand';
      case 'failed': return 'text-red-500';
      default: return 'text-midGray';
    }
  };

  return (
    <div className="space-y-3">
      {tasks.map((task, index) => (
        <motion.div
          key={task.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.05 }}
          className="bg-dark border border-midGray rounded-lg p-4 hover:border-brand transition-colors"
        >
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <p className="text-white">{task.description}</p>
              <p className="text-sm text-midGray mt-1">
                {new Date(task.created_at).toLocaleString()}
              </p>
            </div>
            <span className={`text-sm font-medium ${getStatusColor(task.status)}`}>
              {task.status.replace('_', ' ')}
            </span>
          </div>
        </motion.div>
      ))}
      {tasks.length === 0 && (
        <p className="text-midGray text-center py-8">No tasks yet</p>
      )}
    </div>
  );
}
