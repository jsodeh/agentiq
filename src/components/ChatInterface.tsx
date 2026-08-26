import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { Message } from '../types';

interface ChatInterfaceProps {
  conversationId: number;
  messages: Message[];
  onSendMessage: (content: string) => void;
}

export default function ChatInterface({ conversationId, messages, onSendMessage }: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSendMessage(input);
      setInput('');
    }
  };

  return (
    <div className="flex flex-col h-full bg-dark border border-midGray rounded-lg">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] rounded-lg p-3 ${
                message.role === 'user'
                  ? 'bg-brand text-white'
                  : message.role === 'assistant'
                  ? 'bg-midGray text-white'
                  : 'bg-dark border border-midGray text-midGray'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              <p className="text-xs opacity-70 mt-1">
                {new Date(message.created_at).toLocaleTimeString()}
              </p>
            </div>
          </motion.div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-midGray">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 bg-dark border border-midGray rounded-md text-white focus:border-brand outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="px-6 py-2 bg-brand hover:bg-opacity-80 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md transition-colors"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
