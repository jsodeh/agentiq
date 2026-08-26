import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { invoke } from '@tauri-apps/api/core';

interface ConfigField {
  name: string;
  label: string;
  type: 'text' | 'select' | 'slider' | 'file-upload' | 'time-range-picker' | 'toggle';
  required?: boolean;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: any;
  description?: string;
}

interface AgentConfigSchema {
  agentType: string;
  agentName: string;
  fields: ConfigField[];
  zodSchema: z.ZodObject<any>;
}

// Example config schemas for different agent types
const CONFIG_SCHEMAS: Record<string, AgentConfigSchema> = {
  'research-general': {
    agentType: 'research-general',
    agentName: 'Research Assistant',
    fields: [
      { name: 'maxSources', label: 'Maximum Sources', type: 'slider', min: 3, max: 20, step: 1, defaultValue: 10, description: 'Maximum number of sources to cite' },
      { name: 'citationStyle', label: 'Citation Style', type: 'select', options: ['APA', 'MLA', 'Chicago', 'Harvard'], defaultValue: 'APA' },
      { name: 'deepResearch', label: 'Deep Research Mode', type: 'toggle', defaultValue: false, description: 'Enable thorough multi-level research' },
      { name: 'language', label: 'Research Language', type: 'select', options: ['English', 'Spanish', 'French', 'German'], defaultValue: 'English' },
    ],
    zodSchema: z.object({
      maxSources: z.number().min(3).max(20),
      citationStyle: z.enum(['APA', 'MLA', 'Chicago', 'Harvard']),
      deepResearch: z.boolean(),
      language: z.string(),
    }),
  },
  'code-assistant': {
    agentType: 'code-assistant',
    agentName: 'Code Assistant',
    fields: [
      { name: 'language', label: 'Primary Language', type: 'select', options: ['JavaScript', 'TypeScript', 'Python', 'Rust', 'Go'], defaultValue: 'TypeScript' },
      { name: 'codeStyle', label: 'Code Style', type: 'select', options: ['Standard', 'Airbnb', 'Google', 'Custom'], defaultValue: 'Standard' },
      { name: 'verbosity', label: 'Comment Verbosity', type: 'slider', min: 1, max: 5, step: 1, defaultValue: 3, description: 'Level of code comments' },
      { name: 'autoFormat', label: 'Auto Format Code', type: 'toggle', defaultValue: true },
    ],
    zodSchema: z.object({
      language: z.string(),
      codeStyle: z.string(),
      verbosity: z.number().min(1).max(5),
      autoFormat: z.boolean(),
    }),
  },
  'email-marketer': {
    agentType: 'email-marketer',
    agentName: 'Email Marketer',
    fields: [
      { name: 'tone', label: 'Email Tone', type: 'select', options: ['Professional', 'Casual', 'Friendly', 'Formal'], defaultValue: 'Professional' },
      { name: 'maxLength', label: 'Max Email Length (words)', type: 'slider', min: 100, max: 1000, step: 50, defaultValue: 300 },
      { name: 'includeEmoji', label: 'Include Emojis', type: 'toggle', defaultValue: false },
      { name: 'sendTime', label: 'Preferred Send Time', type: 'time-range-picker', defaultValue: '09:00-17:00' },
    ],
    zodSchema: z.object({
      tone: z.string(),
      maxLength: z.number().min(100).max(1000),
      includeEmoji: z.boolean(),
      sendTime: z.string(),
    }),
  },
};

export default function AgentConfig() {
  const navigate = useNavigate();
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [currentAgentIndex, setCurrentAgentIndex] = useState(0);
  const [configs, setConfigs] = useState<Record<string, any>>({});

  useEffect(() => {
    const ids = JSON.parse(localStorage.getItem('selected_agents') || '[]');
    setSelectedAgentIds(ids);
  }, []);

  const currentAgentId = selectedAgentIds[currentAgentIndex];
  const currentSchema = CONFIG_SCHEMAS[currentAgentId] || CONFIG_SCHEMAS['research-general'];

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm({
    resolver: zodResolver(currentSchema.zodSchema),
    defaultValues: currentSchema.fields.reduce((acc, field) => ({
      ...acc,
      [field.name]: field.defaultValue,
    }), {}),
  });

  const onSubmit = async (data: any) => {
    // Save config for current agent
    const newConfigs = { ...configs, [currentAgentId]: data };
    setConfigs(newConfigs);

    // If more agents to configure, move to next
    if (currentAgentIndex < selectedAgentIds.length - 1) {
      setCurrentAgentIndex(currentAgentIndex + 1);
    } else {
      // Save all configs to SQLite
      try {
        await invoke('save_agent_configs', { configs: newConfigs });
        localStorage.setItem('agent_configs', JSON.stringify(newConfigs));
        navigate('/setup/voice-setup');
      } catch (error) {
        console.error('Failed to save configs:', error);
        navigate('/setup/voice-setup');
      }
    }
  };

  const renderField = (field: ConfigField) => {
    const fieldName = field.name as any;
    switch (field.type) {
      case 'text':
        return (
          <input
            {...register(fieldName)}
            type="text"
            className="w-full px-4 py-2 bg-dark border border-midGray rounded-md text-white focus:border-brand outline-none"
          />
        );

      case 'select':
        return (
          <select
            {...register(fieldName)}
            className="w-full px-4 py-2 bg-dark border border-midGray rounded-md text-white focus:border-brand outline-none"
          >
            {field.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );

      case 'slider':
        const sliderValue = watch(fieldName);
        return (
          <div>
            <input
              {...register(fieldName, { valueAsNumber: true })}
              type="range"
              min={field.min}
              max={field.max}
              step={field.step}
              className="w-full h-2 bg-midGray rounded-lg appearance-none cursor-pointer accent-brand"
            />
            <div className="flex justify-between text-sm text-midGray mt-2">
              <span>{field.min}</span>
              <span className="text-brand font-semibold">{sliderValue}</span>
              <span>{field.max}</span>
            </div>
          </div>
        );

      case 'toggle':
        const toggleValue = watch(fieldName);
        return (
          <button
            type="button"
            onClick={() => setValue(fieldName, !toggleValue)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              toggleValue ? 'bg-brand' : 'bg-midGray'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                toggleValue ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        );

      case 'time-range-picker':
        return (
          <input
            {...register(fieldName)}
            type="text"
            placeholder="09:00-17:00"
            className="w-full px-4 py-2 bg-dark border border-midGray rounded-md text-white focus:border-brand outline-none"
          />
        );

      case 'file-upload':
        return (
          <input
            {...register(fieldName)}
            type="file"
            className="w-full px-4 py-2 bg-dark border border-midGray rounded-md text-white focus:border-brand outline-none file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-brand file:text-white file:cursor-pointer"
          />
        );

      default:
        return null;
    }
  };

  if (selectedAgentIds.length === 0) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <p className="text-midGray">No agents selected</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark flex items-center justify-center p-8">
      <motion.div
        key={currentAgentIndex}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="max-w-2xl w-full"
      >
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">Configure Agent</h1>
          <p className="text-xl text-midGray mb-2">{currentSchema.agentName}</p>
          <p className="text-sm text-midGray">
            Agent {currentAgentIndex + 1} of {selectedAgentIds.length}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="bg-dark border border-midGray rounded-2xl p-8">
          <div className="space-y-6">
            {currentSchema.fields.map((field) => (
              <div key={field.name}>
                <label className="block text-white font-medium mb-2">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                {field.description && (
                  <p className="text-sm text-midGray mb-2">{field.description}</p>
                )}
                {renderField(field)}
                {(errors as any)[field.name] && (
                  <p className="text-red-500 text-sm mt-1">
                    {(errors as any)[field.name]?.message as string}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center mt-8">
            <button
              type="button"
              onClick={() => {
                if (currentAgentIndex > 0) {
                  setCurrentAgentIndex(currentAgentIndex - 1);
                } else {
                  navigate('/setup/integrations');
                }
              }}
              className="px-6 py-3 border border-midGray hover:border-brand text-white rounded-lg transition-colors"
            >
              ← Back
            </button>

            <button
              type="submit"
              className="px-8 py-3 bg-brand hover:bg-opacity-80 text-white rounded-lg transition-colors font-semibold"
            >
              {currentAgentIndex < selectedAgentIds.length - 1 ? 'Next Agent →' : 'Continue →'}
            </button>
          </div>
        </form>

        {/* Progress Indicator */}
        <div className="mt-6">
          <div className="flex gap-2 justify-center">
            {selectedAgentIds.map((_, index) => (
              <div
                key={index}
                className={`h-2 rounded-full transition-all ${
                  index === currentAgentIndex
                    ? 'w-8 bg-brand'
                    : index < currentAgentIndex
                    ? 'w-2 bg-accent'
                    : 'w-2 bg-midGray'
                }`}
              />
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
