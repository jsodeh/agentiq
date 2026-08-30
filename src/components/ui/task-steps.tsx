import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

const POP = { type: 'spring', stiffness: 640, damping: 22, mass: 0.7 } as const;
const STILL = { duration: 0 } as const;

export type TaskStep = { id: string; label: string; meta?: string };
export type TaskStepStatus = 'pending' | 'active' | 'done' | 'error';

export function useTaskSteps({ steps, current, failed = false }: {
  steps: TaskStep[];
  current: number;
  failed?: boolean;
}) {
  const complete = !failed && current >= steps.length;
  const rows = steps.map((step, index) => ({
    ...step,
    status: (index < current ? 'done' : index === current && failed ? 'error' : index === current && !complete ? 'active' : 'pending') as TaskStepStatus,
  }));
  const active = rows.find((row) => row.status === 'active');
  const sentence = failed
    ? `Setup paused at ${steps[Math.min(current, steps.length - 1)]?.label ?? 'a step'}`
    : complete
      ? `All ${steps.length} setup steps complete`
      : active
        ? `${active.label}, step ${current + 1} of ${steps.length}`
        : '';

  return { rows, complete, sentence };
}

function StatusIcon({ status }: { status: TaskStepStatus }) {
  if (status === 'done') {
    return <motion.span initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} transition={POP} className="grid size-4 place-items-center rounded-[5px] bg-accent/15 text-accent">✓</motion.span>;
  }
  if (status === 'error') return <span className="grid size-4 place-items-center rounded-[5px] bg-red-500/15 text-red-400">×</span>;
  if (status === 'active') {
    return <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.8, ease: 'linear', repeat: Infinity }} className="size-4 rounded-full border-2 border-brand border-t-transparent" />;
  }
  return <span className="size-[5px] rounded-[2px] bg-white/20" />;
}

export function TaskSteps({ steps, current, failed = false, label = 'Task progress', className = '' }: {
  steps: TaskStep[];
  current: number;
  failed?: boolean;
  label?: string;
  className?: string;
}) {
  const { rows, complete, sentence } = useTaskSteps({ steps, current, failed });
  const reducedMotion = useReducedMotion() === true;
  const [spoken, setSpoken] = useState('');

  useEffect(() => {
    if (!sentence) return;
    const timeout = window.setTimeout(() => setSpoken(sentence), 400);
    return () => window.clearTimeout(timeout);
  }, [sentence]);

  return (
    <div className={`w-full ${className}`}>
      <ol aria-label={label} className="space-y-1">
        {rows.map((row) => (
          <li key={row.id} aria-current={row.status === 'active' ? 'step' : undefined} className="flex min-h-8 items-center gap-3 rounded-lg px-2">
            <span className="grid size-4 shrink-0 place-items-center"><AnimatePresence initial={false}><StatusIcon status={row.status} /></AnimatePresence></span>
            {row.status === 'active' && !reducedMotion ? (
              <motion.span className="min-w-0 flex-1 truncate bg-gradient-to-r from-midGray via-white to-midGray bg-[length:220%_100%] bg-clip-text text-sm font-medium text-transparent" animate={{ backgroundPosition: ['120% 0', '-120% 0'] }} transition={{ duration: 1.6, ease: 'linear', repeat: Infinity }}>{row.label}</motion.span>
            ) : <span className={`min-w-0 flex-1 truncate text-sm ${row.status === 'done' ? 'text-white/75' : row.status === 'error' ? 'text-red-400' : 'text-midGray'}`}>{row.label}</span>}
            {row.meta && <span className={`shrink-0 font-mono text-[10px] ${row.status === 'done' ? 'text-midGray' : 'opacity-0'}`}>{row.meta}</span>}
          </li>
        ))}
      </ol>
      <span role="status" className="sr-only">{spoken}</span>
      <span className="sr-only" aria-live={complete || failed ? 'polite' : 'off'}>{complete ? 'Setup complete' : failed ? 'Setup failed' : ''}</span>
    </div>
  );
}

export default TaskSteps;
