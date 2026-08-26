import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SetupStep {
  id: string;
  name: string;
  icon: string;
  timestamp: number;
  status: 'completed' | 'in_progress' | 'pending';
}

interface SetupTimelineProps {
  steps: SetupStep[];
  onComplete?: () => void;
}

export const SetupTimeline: React.FC<SetupTimelineProps> = ({ steps, onComplete }) => {
  const [visibleSteps, setVisibleSteps] = useState<SetupStep[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < steps.length) {
      const timer = setTimeout(() => {
        setVisibleSteps(prev => [...prev, steps[currentIndex]]);
        setCurrentIndex(prev => prev + 1);
      }, 300); // Delay between each step

      return () => clearTimeout(timer);
    } else if (currentIndex === steps.length && onComplete) {
      // All steps shown, trigger completion callback
      const timer = setTimeout(onComplete, 500);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, steps, onComplete]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <AnimatePresence>
        {visibleSteps.map((step, index) => (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{
              duration: 0.4,
              ease: 'easeOut',
            }}
            className="mb-4"
          >
            <div className="bg-gray-800 rounded-lg p-6 flex items-center gap-4 hover:bg-gray-750 transition-colors">
              {/* Checkmark Animation */}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{
                  delay: 0.2,
                  type: 'spring',
                  stiffness: 200,
                  damping: 15,
                }}
                className="flex-shrink-0 w-12 h-12 rounded-full bg-green-500 flex items-center justify-center"
              >
                <motion.svg
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ delay: 0.3, duration: 0.3 }}
                  className="w-6 h-6 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <motion.path d="M5 13l4 4L19 7" />
                </motion.svg>
              </motion.div>

              {/* Icon */}
              <div className="text-4xl">{step.icon}</div>

              {/* Step Info */}
              <div className="flex-1">
                <h3 className="text-white font-medium text-lg">{step.name}</h3>
                <p className="text-gray-400 text-sm">
                  {new Date(step.timestamp).toLocaleTimeString()}
                </p>
              </div>

              {/* Status Badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  step.status === 'completed'
                    ? 'bg-green-500 text-white'
                    : step.status === 'in_progress'
                    ? 'bg-yellow-500 text-white'
                    : 'bg-gray-600 text-gray-300'
                }`}
              >
                {step.status === 'completed' ? '✓ Complete' : step.status === 'in_progress' ? 'In Progress' : 'Pending'}
              </motion.div>
            </div>

            {/* Connecting Line */}
            {index < visibleSteps.length - 1 && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 24 }}
                transition={{ duration: 0.2 }}
                className="w-0.5 bg-gray-700 ml-11 my-2"
              />
            )}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Loading indicator for remaining steps */}
      {currentIndex < steps.length && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-center gap-2 text-gray-400 mt-8"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full"
          />
          <span>Loading setup steps...</span>
        </motion.div>
      )}
    </div>
  );
};

// Example usage with default setup steps
export const defaultSetupSteps: SetupStep[] = [
  {
    id: 'mode',
    name: 'Mode Selection',
    icon: '🎯',
    timestamp: Date.now() - 8000,
    status: 'completed',
  },
  {
    id: 'device',
    name: 'Device Check',
    icon: '💻',
    timestamp: Date.now() - 7000,
    status: 'completed',
  },
  {
    id: 'model',
    name: 'Model Download',
    icon: '🤖',
    timestamp: Date.now() - 6000,
    status: 'completed',
  },
  {
    id: 'agents',
    name: 'Agent Selection',
    icon: '🎭',
    timestamp: Date.now() - 5000,
    status: 'completed',
  },
  {
    id: 'integrations',
    name: 'Integrations Setup',
    icon: '🔌',
    timestamp: Date.now() - 4000,
    status: 'completed',
  },
  {
    id: 'config',
    name: 'Agent Configuration',
    icon: '⚙️',
    timestamp: Date.now() - 3000,
    status: 'completed',
  },
  {
    id: 'voice',
    name: 'Voice Setup',
    icon: '🎤',
    timestamp: Date.now() - 2000,
    status: 'completed',
  },
  {
    id: 'complete',
    name: 'Setup Complete',
    icon: '🎉',
    timestamp: Date.now() - 1000,
    status: 'completed',
  },
];
