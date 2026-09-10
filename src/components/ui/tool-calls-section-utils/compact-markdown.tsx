import React from 'react';

interface CompactMarkdownProps {
  content: unknown;
}

export function CompactMarkdown({ content }: CompactMarkdownProps) {
  if (!content) return null;

  const renderContent = () => {
    if (typeof content === 'string') {
      return <pre className="text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap break-words">{content}</pre>;
    }

    if (typeof content === 'object') {
      return (
        <pre className="text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap break-words overflow-auto">
          {JSON.stringify(content, null, 2)}
        </pre>
      );
    }

    return <span className="text-zinc-700 dark:text-zinc-300">{String(content)}</span>;
  };

  return <div className="text-[11px] font-mono">{renderContent()}</div>;
}
