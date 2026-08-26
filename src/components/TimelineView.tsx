import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as ReactWindow from 'react-window';
const FixedSizeList = (ReactWindow as any).FixedSizeList || (ReactWindow as any).default?.FixedSizeList;
import { motion, AnimatePresence } from 'framer-motion';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface LogEntry {
  id: string;
  agentId: number;
  agentName: string;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  timestamp: number;
  metadata?: Record<string, any>;
  actionType?: string;
}

interface TimelineViewProps {
  height?: number;
  initialLogs?: LogEntry[];
}

const LEVEL_COLORS = {
  info: '#3B82F6',
  warning: '#F59E0B',
  error: '#EF4444',
  success: '#10B981',
};

const LEVEL_ICONS = {
  info: 'ℹ️',
  warning: '⚠️',
  error: '❌',
  success: '✅',
};

export const TimelineView: React.FC<TimelineViewProps> = ({ 
  height = 600,
  initialLogs = []
}) => {
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  
  // Filters
  const [selectedAgents, setSelectedAgents] = useState<number[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [searchText, setSearchText] = useState('');
  const [dateRange, setDateRange] = useState<{ start: number; end: number }>({
    start: Date.now() - 7 * 24 * 60 * 60 * 1000, // Last 7 days
    end: Date.now(),
  });

  // Load logs on mount
  useEffect(() => {
    loadLogs();
  }, []);

  // Listen for real-time log updates
  useEffect(() => {
    const unlisten = listen<LogEntry>('new_log', (event) => {
      setLogs(prev => [event.payload, ...prev]);
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, []);

  const loadLogs = async () => {
    try {
      const result = await invoke<string>('get_logs', {
        limit: 10000,
        startDate: dateRange.start,
        endDate: dateRange.end,
      });
      const loadedLogs = JSON.parse(result);
      setLogs(loadedLogs);
    } catch (error) {
      console.error('Failed to load logs:', error);
    }
  };

  // Get unique agents for filter
  const uniqueAgents = useMemo(() => {
    const agentMap = new Map<number, string>();
    logs.forEach(log => {
      if (!agentMap.has(log.agentId)) {
        agentMap.set(log.agentId, log.agentName);
      }
    });
    return Array.from(agentMap.entries()).map(([id, name]) => ({ id, name }));
  }, [logs]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Agent filter
      if (selectedAgents.length > 0 && !selectedAgents.includes(log.agentId)) {
        return false;
      }

      // Level filter
      if (selectedLevels.length > 0 && !selectedLevels.includes(log.level)) {
        return false;
      }

      // Date range filter
      if (log.timestamp < dateRange.start || log.timestamp > dateRange.end) {
        return false;
      }

      // Text search
      if (searchText) {
        const searchLower = searchText.toLowerCase();
        return (
          log.message.toLowerCase().includes(searchLower) ||
          log.agentName.toLowerCase().includes(searchLower) ||
          log.actionType?.toLowerCase().includes(searchLower)
        );
      }

      return true;
    });
  }, [logs, selectedAgents, selectedLevels, dateRange, searchText]);

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const exportToCSV = () => {
    const headers = ['Timestamp', 'Agent', 'Level', 'Action', 'Message'];
    const rows = filteredLogs.map(log => [
      new Date(log.timestamp).toLocaleString(),
      log.agentName,
      log.level,
      log.actionType || '',
      log.message,
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('Activity Logs', 14, 20);

    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
    doc.text(`Total Entries: ${filteredLogs.length}`, 14, 34);

    const tableData = filteredLogs.map(log => [
      new Date(log.timestamp).toLocaleString(),
      log.agentName,
      log.level.toUpperCase(),
      log.actionType || '-',
      log.message.substring(0, 100),
    ]);

    autoTable(doc, {
      head: [['Timestamp', 'Agent', 'Level', 'Action', 'Message']],
      body: tableData,
      startY: 40,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [108, 59, 255] },
    });

    doc.save(`logs_${Date.now()}.pdf`);
  };

  const LogRow = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const log = filteredLogs[index];
    const isExpanded = expandedIds.has(log.id);

    return (
      <div style={style} className="px-4">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-gray-800 rounded-lg p-4 mb-2 hover:bg-gray-750 transition-colors cursor-pointer"
          onClick={() => toggleExpanded(log.id)}
        >
          <div className="flex items-start gap-4">
            {/* Timestamp */}
            <div className="text-gray-400 text-sm whitespace-nowrap">
              {new Date(log.timestamp).toLocaleTimeString()}
            </div>

            {/* Level Icon */}
            <div
              className="text-2xl"
              style={{ color: LEVEL_COLORS[log.level] }}
              title={log.level}
            >
              {LEVEL_ICONS[log.level]}
            </div>

            {/* Agent Badge */}
            <div className="px-3 py-1 bg-brand rounded-full text-white text-sm font-medium whitespace-nowrap">
              {log.agentName}
            </div>

            {/* Action Type */}
            {log.actionType && (
              <div className="px-3 py-1 bg-midGray rounded-full text-white text-sm whitespace-nowrap">
                {log.actionType}
              </div>
            )}

            {/* Message */}
            <div className="flex-1 text-white">
              <p className={isExpanded ? '' : 'truncate'}>{log.message}</p>
            </div>

            {/* Expand Icon */}
            <div className="text-gray-400">
              {isExpanded ? '▼' : '▶'}
            </div>
          </div>

          {/* Expanded Details */}
          <AnimatePresence>
            {isExpanded && log.metadata && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-4 pt-4 border-t border-gray-700"
              >
                <h4 className="text-gray-400 text-sm font-medium mb-2">Details:</h4>
                <pre className="text-gray-300 text-xs bg-gray-900 p-3 rounded overflow-x-auto">
                  {JSON.stringify(log.metadata, null, 2)}
                </pre>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    );
  };

  return (
    <div className="bg-dark rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Activity Timeline</h2>
        <div className="flex gap-2">
          <button
            onClick={exportToCSV}
            className="px-4 py-2 bg-midGray text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            Export CSV
          </button>
          <button
            onClick={exportToPDF}
            className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-purple-600 transition-colors"
          >
            Export PDF
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-gray-800 rounded-lg p-4 mb-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Agent Filter */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">Agents</label>
            <select
              multiple
              value={selectedAgents.map(String)}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions).map(opt => Number(opt.value));
                setSelectedAgents(selected);
              }}
              className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
              size={3}
            >
              {uniqueAgents.map(agent => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </div>

          {/* Level Filter */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">Levels</label>
            <div className="space-y-2">
              {Object.keys(LEVEL_COLORS).map(level => (
                <label key={level} className="flex items-center gap-2 text-white text-sm">
                  <input
                    type="checkbox"
                    checked={selectedLevels.includes(level)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedLevels([...selectedLevels, level]);
                      } else {
                        setSelectedLevels(selectedLevels.filter(l => l !== level));
                      }
                    }}
                    className="rounded"
                  />
                  <span style={{ color: LEVEL_COLORS[level as keyof typeof LEVEL_COLORS] }}>
                    {LEVEL_ICONS[level as keyof typeof LEVEL_ICONS]} {level}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">Date Range</label>
            <input
              type="date"
              value={new Date(dateRange.start).toISOString().split('T')[0]}
              onChange={(e) => {
                setDateRange(prev => ({
                  ...prev,
                  start: new Date(e.target.value).getTime(),
                }));
              }}
              className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm mb-2"
            />
            <input
              type="date"
              value={new Date(dateRange.end).toISOString().split('T')[0]}
              onChange={(e) => {
                setDateRange(prev => ({
                  ...prev,
                  end: new Date(e.target.value).getTime(),
                }));
              }}
              className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
            />
          </div>

          {/* Text Search */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">Search</label>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search logs..."
              className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
            />
            <button
              onClick={() => {
                setSelectedAgents([]);
                setSelectedLevels([]);
                setSearchText('');
                setDateRange({
                  start: Date.now() - 7 * 24 * 60 * 60 * 1000,
                  end: Date.now(),
                });
              }}
              className="mt-2 w-full px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-500 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Results Count */}
        <div className="text-gray-400 text-sm">
          Showing {filteredLogs.length} of {logs.length} entries
        </div>
      </div>

      {/* Virtualized Log List */}
      <div className="bg-gray-900 rounded-lg overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            No logs found matching your filters
          </div>
        ) : (
          <FixedSizeList
            height={height}
            itemCount={filteredLogs.length}
            itemSize={80}
            width="100%"
          >
            {LogRow}
          </FixedSizeList>
        )}
      </div>
    </div>
  );
};
