import React from 'react';
import { CheckCircle2, Circle, XCircle, Clock } from 'lucide-react';
import { cn } from '../lib/utils';

interface Step {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  description?: string;
}

interface PlanViewProps {
  steps: Step[];
  className?: string;
}

const getStepIcon = (status: Step['status']) => {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-red-500" />;
    case 'running':
      return <Clock className="w-4 h-4 text-blue-500 animate-pulse" />;
    default:
      return <Circle className="w-4 h-4 text-zinc-400" />;
  }
};

export default function PlanView({ steps, className }: PlanViewProps) {
  if (!steps || steps.length === 0) return null;

  return (
    <div className={cn("bg-muted/20 border border-border/30 rounded-lg p-3", className)}>
      <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2">
        Execution Plan
      </h4>
      <div className="space-y-1">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-start gap-2">
            <div className="flex flex-col items-center">
              <div className="flex items-center justify-center">
                {getStepIcon(step.status)}
              </div>
              {index < steps.length - 1 && (
                <div className="w-px h-4 bg-border/50 my-0.5" />
              )}
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <p className={cn(
                "text-[11px] font-medium",
                step.status === 'completed' && "text-foreground",
                step.status === 'running' && "text-blue-500",
                step.status === 'failed' && "text-red-500",
                step.status === 'pending' && "text-muted-foreground"
              )}>
                {step.name}
              </p>
              {step.description && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {step.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
