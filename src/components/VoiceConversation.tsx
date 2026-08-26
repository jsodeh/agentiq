import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVoice } from '../hooks/useVoice';
import ChatInterface from './ChatInterface';
import type { Message } from '../types';

interface VoiceConversationProps {
  conversationId: number;
  messages: Message[];
  onSendMessage: (content: string) => Promise<string>; // Returns AI response
}

export default function VoiceConversation({
  conversationId,
  messages,
  onSendMessage,
}: VoiceConversationProps) {
  const voice = useVoice();
  const [isProcessing, setIsProcessing] = useState(false);

  // Handle transcript from voice
  useEffect(() => {
    if (voice.transcript && !isProcessing) {
      handleVoiceInput(voice.transcript);
    }
  }, [voice.transcript]);

  const handleVoiceInput = async (transcript: string) => {
    if (!transcript.trim()) return;

    setIsProcessing(true);

    try {
      // Stop listening while processing
      await voice.stopListening();

      // Send message to orchestrator
      const response = await onSendMessage(transcript);

      // Speak the response
      if (response) {
        await voice.speak(response);
      }
    } catch (error) {
      console.error('Voice conversation error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMicClick = async () => {
    if (voice.listening) {
      await voice.stopListening();
    } else {
      await voice.startListening();
    }
  };

  const getMicButtonColor = () => {
    if (voice.speaking) return 'bg-accent';
    if (voice.listening) return 'bg-red-500 animate-pulse';
    return 'bg-brand';
  };

  const getMicIcon = () => {
    if (voice.speaking) {
      return (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" />
        </svg>
      );
    }

    if (voice.listening) {
      return (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
        </svg>
      );
    }

    return (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    );
  };

  return (
    <div className="relative h-full flex flex-col">
      {/* Voice Status Bar */}
      <AnimatePresence>
        {(voice.listening || voice.speaking || isProcessing) && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-0 left-0 right-0 z-10 bg-dark border-b border-brand p-3"
          >
            <div className="flex items-center justify-center gap-3">
              {voice.listening && (
                <>
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="w-3 h-3 bg-red-500 rounded-full"
                  />
                  <span className="text-white font-medium">Listening...</span>
                </>
              )}

              {voice.speaking && (
                <>
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                    className="w-3 h-3 bg-accent rounded-full"
                  />
                  <span className="text-white font-medium">Speaking...</span>
                </>
              )}

              {isProcessing && !voice.speaking && (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full"
                  />
                  <span className="text-white font-medium">Processing...</span>
                </>
              )}
            </div>

            {voice.transcript && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center text-midGray text-sm mt-2"
              >
                "{voice.transcript}"
              </motion.p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Interface */}
      <div className={`flex-1 ${voice.listening || voice.speaking || isProcessing ? 'mt-20' : ''}`}>
        <ChatInterface
          conversationId={conversationId}
          messages={messages}
          onSendMessage={async (content) => {
            const response = await onSendMessage(content);
            // Optionally speak the response
            if (voice.initialized && !voice.listening) {
              await voice.speak(response);
            }
          }}
        />
      </div>

      {/* Voice Control Button */}
      <div className="absolute bottom-24 right-6">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleMicClick}
          disabled={!voice.initialized || isProcessing}
          className={`${getMicButtonColor()} disabled:opacity-50 disabled:cursor-not-allowed text-white p-4 rounded-full shadow-lg transition-colors`}
          title={voice.listening ? 'Stop listening' : 'Start voice input'}
        >
          {getMicIcon()}
        </motion.button>

        {/* Mode Indicator */}
        <div className="absolute -top-2 -right-2 bg-dark border border-midGray rounded-full px-2 py-1">
          <span className="text-xs text-midGray">{voice.mode}</span>
        </div>
      </div>

      {/* Error Display */}
      <AnimatePresence>
        {voice.error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-40 left-6 right-6 bg-red-500 bg-opacity-20 border border-red-500 rounded-lg p-4"
          >
            <p className="text-red-500 text-sm">
              Voice Error: {voice.error.message}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Language Selector (Optional) */}
      {voice.initialized && (
        <div className="absolute top-4 right-4">
          <select
            value={voice.language}
            onChange={(e) => voice.setLanguage(e.target.value)}
            className="px-3 py-1 bg-dark border border-midGray rounded-md text-white text-sm focus:border-brand outline-none"
          >
            <option value="English">English</option>
            <option value="Pidgin">Pidgin</option>
            <option value="Yoruba">Yoruba</option>
            <option value="Igbo">Igbo</option>
            <option value="Hausa">Hausa</option>
          </select>
        </div>
      )}
    </div>
  );
}
