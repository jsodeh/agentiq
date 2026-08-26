import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';

interface CheckResult {
  status: 'pending' | 'pass' | 'warn' | 'fail';
  message: string;
}

interface SystemInfo {
  ramGb: number;
  freeDiskGb: number;
  gpuInfo: string;
  hasInternet: boolean;
}

export default function DeviceCheck() {
  const navigate = useNavigate();
  const [checks, setChecks] = useState<Record<string, CheckResult>>({
    ram: { status: 'pending', message: 'Checking RAM...' },
    disk: { status: 'pending', message: 'Checking disk space...' },
    gpu: { status: 'pending', message: 'Checking GPU...' },
    internet: { status: 'pending', message: 'Checking internet...' },
  });
  const [showBlockingModal, setShowBlockingModal] = useState(false);
  const [allChecksComplete, setAllChecksComplete] = useState(false);

  useEffect(() => {
    runChecks();
  }, []);

  useEffect(() => {
    if (allChecksComplete) {
      const allPass = Object.values(checks).every(c => c.status === 'pass' || c.status === 'warn');
      if (allPass) {
        setTimeout(() => {
          navigate('/setup/model-select');
        }, 1500);
      }
    }
  }, [allChecksComplete, checks, navigate]);

  const runChecks = async () => {
    try {
      // Run all checks in parallel
      const [ramGb, freeDiskGb, gpuInfo, hasInternet] = await Promise.all([
        invoke<number>('get_ram_gb'),
        invoke<number>('get_free_disk_gb'),
        invoke<string>('get_gpu_info'),
        invoke<boolean>('check_internet'),
      ]);

      const systemInfo: SystemInfo = { ramGb, freeDiskGb, gpuInfo, hasInternet };

      // RAM Check
      let ramCheck: CheckResult;
      if (systemInfo.ramGb < 4) {
        ramCheck = { status: 'fail', message: `${systemInfo.ramGb.toFixed(1)} GB RAM - Insufficient (4GB minimum required)` };
        setShowBlockingModal(true);
      } else if (systemInfo.ramGb < 8) {
        ramCheck = { status: 'warn', message: `${systemInfo.ramGb.toFixed(1)} GB RAM - Limited (8GB recommended)` };
      } else {
        ramCheck = { status: 'pass', message: `${systemInfo.ramGb.toFixed(1)} GB RAM - Excellent` };
      }

      // Disk Check
      let diskCheck: CheckResult;
      if (systemInfo.freeDiskGb < 10) {
        diskCheck = { status: 'fail', message: `${systemInfo.freeDiskGb.toFixed(1)} GB free - Insufficient` };
      } else if (systemInfo.freeDiskGb < 50) {
        diskCheck = { status: 'warn', message: `${systemInfo.freeDiskGb.toFixed(1)} GB free - Limited` };
      } else {
        diskCheck = { status: 'pass', message: `${systemInfo.freeDiskGb.toFixed(1)} GB free - Excellent` };
      }

      // GPU Check
      let gpuCheck: CheckResult;
      if (systemInfo.gpuInfo.toLowerCase().includes('nvidia') || systemInfo.gpuInfo.toLowerCase().includes('amd')) {
        gpuCheck = { status: 'pass', message: `GPU detected: ${systemInfo.gpuInfo}` };
      } else if (systemInfo.gpuInfo.toLowerCase().includes('intel')) {
        gpuCheck = { status: 'warn', message: `Integrated GPU: ${systemInfo.gpuInfo}` };
      } else {
        gpuCheck = { status: 'warn', message: 'No dedicated GPU detected' };
      }

      // Internet Check
      const internetCheck: CheckResult = systemInfo.hasInternet
        ? { status: 'pass', message: 'Internet connection active' }
        : { status: 'warn', message: 'No internet connection' };

      setChecks({
        ram: ramCheck,
        disk: diskCheck,
        gpu: gpuCheck,
        internet: internetCheck,
      });

      setAllChecksComplete(true);
    } catch (error) {
      console.error('System check failed:', error);
      setChecks({
        ram: { status: 'fail', message: 'Failed to check RAM' },
        disk: { status: 'fail', message: 'Failed to check disk' },
        gpu: { status: 'fail', message: 'Failed to check GPU' },
        internet: { status: 'fail', message: 'Failed to check internet' },
      });
      setAllChecksComplete(true);
    }
  };

  const getStatusIcon = (status: CheckResult['status']) => {
    switch (status) {
      case 'pending':
        return (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full"
          />
        );
      case 'pass':
        return (
          <motion.svg
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-6 h-6 text-accent"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </motion.svg>
        );
      case 'warn':
        return (
          <motion.svg
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-6 h-6 text-yellow-500"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </motion.svg>
        );
      case 'fail':
        return (
          <motion.svg
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-6 h-6 text-red-500"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </motion.svg>
        );
    }
  };

  return (
    <div className="min-h-screen bg-dark flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl w-full"
      >
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">System Check</h1>
          <p className="text-xl text-midGray">Verifying your device capabilities</p>
        </div>

        <div className="bg-dark border border-midGray rounded-2xl p-8 space-y-6">
          {Object.entries(checks).map(([key, check]) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-4"
            >
              {getStatusIcon(check.status)}
              <div className="flex-1">
                <p className={`text-lg ${
                  check.status === 'pass' ? 'text-white' :
                  check.status === 'warn' ? 'text-yellow-500' :
                  check.status === 'fail' ? 'text-red-500' :
                  'text-midGray'
                }`}>
                  {check.message}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {allChecksComplete && Object.values(checks).every(c => c.status === 'pass' || c.status === 'warn') && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-accent mt-6"
          >
            All checks passed! Continuing...
          </motion.p>
        )}
      </motion.div>

      {/* Blocking Modal for Insufficient RAM */}
      <AnimatePresence>
        {showBlockingModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center p-8 z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-dark border-2 border-red-500 rounded-2xl p-8 max-w-md"
            >
              <div className="text-center">
                <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <h2 className="text-2xl font-bold text-white mb-4">Insufficient RAM</h2>
                <p className="text-midGray mb-6">
                  Your system has less than 4GB of RAM. agēntīq requires at least 4GB to run local AI models.
                </p>
                <p className="text-midGray mb-8">
                  Please consider upgrading your RAM or using Cloud Mode instead.
                </p>
                <button
                  onClick={() => navigate('/setup')}
                  className="px-6 py-3 bg-brand hover:bg-opacity-80 text-white rounded-md transition-colors"
                >
                  Back to Mode Selection
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
