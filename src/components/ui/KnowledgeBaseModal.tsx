import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, Database, Plus, Trash2, X, Search, FileText, Upload, CheckCircle } from 'lucide-react';

export interface KnowledgeItem {
  id: number;
  title: string;
  content: string;
  category: string;
  tags?: string;
  created_at: string;
}

interface KnowledgeBaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KnowledgeBaseModal({ isOpen, onClose }: KnowledgeBaseModalProps) {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('brand_guidelines');
  const [tags, setTags] = useState('');
  const [content, setContent] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await invoke<string>('get_knowledge_items');
      const parsed = JSON.parse(res);
      setItems(parsed || []);
    } catch (err) {
      console.error('Failed to fetch knowledge base items:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchItems();
    }
  }, [isOpen]);

  const handleCreate = async () => {
    if (!title.trim() || !content.trim()) {
      setStatusMsg('Please fill in both Title and Content.');
      return;
    }

    try {
      await invoke('add_knowledge_item', {
        title: title.trim(),
        content: content.trim(),
        category,
        tags: tags.trim() || null,
      });

      setStatusMsg('Knowledge item saved successfully!');
      setTitle('');
      setContent('');
      setTags('');
      setIsAdding(false);
      fetchItems();

      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err) {
      console.error('Error adding knowledge item:', err);
      setStatusMsg('Failed to save item.');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await invoke('delete_knowledge_item', { id });
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error('Error deleting knowledge item:', err);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!title) {
      setTitle(file.name.replace(/\.[^/.]+$/, ''));
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        setContent(text);
      }
    };
    reader.readAsText(file);
  };

  const filteredItems = items.filter(
    (item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.tags && item.tags.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/70 backdrop-blur-md"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative z-10 flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#14141c] text-white shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 bg-[#191924]">
            <div className="flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-xl bg-brand/20 text-brand">
                <Database className="size-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Business Knowledge Base</h2>
                <p className="text-xs text-[#a0a0a8]">
                  Store brand guidelines, FAQs, specs & profiles for automatic Master Agent RAG
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="grid size-8 place-items-center rounded-lg text-gray-400 hover:bg-white/10 hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Status Message */}
          {statusMsg && (
            <div className="flex items-center gap-2 bg-brand/20 border-b border-brand/30 px-6 py-2.5 text-xs font-semibold text-brand">
              <CheckCircle className="size-4" />
              {statusMsg}
            </div>
          )}

          {/* Main Body */}
          <div className="flex flex-1 overflow-hidden">
            {/* Left Sidebar List */}
            <div className="flex w-1/3 flex-col border-r border-white/10 bg-[#111118] p-4">
              <div className="mb-3 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 size-3.5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search docs..."
                    className="w-full rounded-lg border border-white/10 bg-white/5 py-1.5 pl-8 pr-3 text-xs text-white placeholder-gray-500 outline-none focus:border-brand"
                  />
                </div>
                <button
                  onClick={() => setIsAdding(true)}
                  className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                >
                  <Plus className="size-3.5" /> Add
                </button>
              </div>

              {/* Items List */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {loading ? (
                  <p className="py-8 text-center text-xs text-gray-400">Loading knowledge base...</p>
                ) : filteredItems.length === 0 ? (
                  <div className="py-12 text-center text-xs text-gray-500">
                    <BookOpen className="mx-auto mb-2 size-8 opacity-40" />
                    No documents found. Click "+ Add" to create one.
                  </div>
                ) : (
                  filteredItems.map((item) => (
                    <div
                      key={item.id}
                      className="group relative flex flex-col justify-between rounded-xl border border-white/5 bg-white/[0.03] p-3 transition-colors hover:border-brand/40 hover:bg-white/[0.06]"
                    >
                      <div className="flex items-start justify-between">
                        <h4 className="text-xs font-bold text-white line-clamp-1">{item.title}</h4>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                      <span className="mt-1 w-fit rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-medium text-brand">
                        {item.category}
                      </span>
                      <p className="mt-2 text-[11px] text-gray-400 line-clamp-2">{item.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right Pane: Form or Detailed View */}
            <div className="flex flex-1 flex-col p-6 overflow-y-auto bg-[#14141c]">
              {isAdding ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <h3 className="text-sm font-bold text-white">Add New Business Knowledge Document</h3>
                    <button
                      onClick={() => setIsAdding(false)}
                      className="text-xs text-gray-400 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1">Document Title</label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. Acme Corp Brand Identity Guidelines"
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-brand"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1">Category</label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-[#1a1a24] px-3 py-2 text-xs text-white outline-none focus:border-brand"
                      >
                        <option value="brand_guidelines">Brand Guidelines</option>
                        <option value="product_catalog">Product Catalog / Specs</option>
                        <option value="faq">Customer FAQs</option>
                        <option value="target_audience">Target Audience / Persona</option>
                        <option value="pricing_strategy">Pricing & Strategy</option>
                        <option value="general">General Business Doc</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">Tags (Comma Separated)</label>
                    <input
                      type="text"
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                      placeholder="marketing, logo, primary-colors, voice"
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-brand"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-gray-300">Document Content</label>
                      <label className="inline-flex items-center gap-1 text-[11px] text-brand cursor-pointer hover:underline">
                        <Upload className="size-3" /> Upload File (.md, .txt, .csv)
                        <input
                          type="file"
                          accept=".txt,.md,.csv,.json"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      rows={12}
                      placeholder="Paste text or markdown content here. The Master Agent will read and use this context to answer queries..."
                      className="w-full rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-white placeholder-gray-500 outline-none focus:border-brand font-mono"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setIsAdding(false)}
                      className="rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-white/5"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreate}
                      className="rounded-lg bg-brand px-5 py-2 text-xs font-semibold text-white hover:opacity-90"
                    >
                      Save Document
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center text-center p-8">
                  <FileText className="size-12 text-brand/40 mb-3" />
                  <h3 className="text-base font-bold text-white mb-1">RAG Context Engine Active</h3>
                  <p className="max-w-md text-xs text-gray-400 mb-6">
                    All documents added here are automatically indexed in SQLite and hydrated into AgentIQ Prime's context window for any user query.
                  </p>
                  <button
                    onClick={() => setIsAdding(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-bold text-white hover:opacity-90 shadow-lg shadow-brand/20"
                  >
                    <Plus className="size-4" /> Add Knowledge Document
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
