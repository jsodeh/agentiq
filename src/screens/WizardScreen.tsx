import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export default function WizardScreen() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  return (
    <div className="min-h-screen bg-dark flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-2xl w-full bg-dark border border-midGray rounded-lg p-8"
      >
        <h2 className="text-3xl font-bold text-white mb-6">
          Create New Agent
        </h2>
        
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`w-1/3 h-2 rounded-full mx-1 ${
                  s <= step ? 'bg-brand' : 'bg-midGray'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {step === 1 && (
            <div>
              <label className="block text-white mb-2">Agent Name</label>
              <input
                type="text"
                className="w-full px-4 py-2 bg-dark border border-midGray rounded-md text-white focus:border-brand outline-none"
                placeholder="My Assistant"
              />
            </div>
          )}

          {step === 2 && (
            <div>
              <label className="block text-white mb-2">Agent Type</label>
              <select className="w-full px-4 py-2 bg-dark border border-midGray rounded-md text-white focus:border-brand outline-none">
                <option>General</option>
                <option>Research</option>
                <option>Coding</option>
                <option>Communication</option>
                <option>Data Analysis</option>
              </select>
            </div>
          )}

          {step === 3 && (
            <div>
              <label className="block text-white mb-2">System Prompt</label>
              <textarea
                className="w-full px-4 py-2 bg-dark border border-midGray rounded-md text-white focus:border-brand outline-none h-32"
                placeholder="Enter custom instructions..."
              />
            </div>
          )}
        </div>

        <div className="flex justify-between mt-8">
          <button
            onClick={() => step > 1 ? setStep(step - 1) : navigate('/')}
            className="px-6 py-2 border border-midGray text-white rounded-md hover:border-brand transition-colors"
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>
          <button
            onClick={() => step < 3 ? setStep(step + 1) : navigate('/')}
            className="px-6 py-2 bg-brand hover:bg-opacity-80 text-white rounded-md transition-colors"
          >
            {step === 3 ? 'Create Agent' : 'Next'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
