import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, ChevronLeft, Search, Sparkles, type LucideIcon, Bot, BriefcaseBusiness, ChartNoAxesCombined, Code2, Headphones, Landmark, Megaphone, PackageCheck, ShieldCheck, Truck, UsersRound, Wrench } from 'lucide-react';
import { useStore } from '../../store';
import { getAllAgents } from '../../agents/registry';

const categoryIcons: Record<string, { icon: LucideIcon; color: string; surface: string }> = {
  Sales: { icon: BriefcaseBusiness, color: 'text-blue-300', surface: 'bg-blue-500/15' }, Support: { icon: Headphones, color: 'text-rose-300', surface: 'bg-rose-500/15' }, Operations: { icon: PackageCheck, color: 'text-orange-300', surface: 'bg-orange-500/15' }, Marketing: { icon: Megaphone, color: 'text-pink-300', surface: 'bg-pink-500/15' }, Finance: { icon: Landmark, color: 'text-emerald-300', surface: 'bg-emerald-500/15' }, HR: { icon: UsersRound, color: 'text-violet-300', surface: 'bg-violet-500/15' }, Productivity: { icon: ChartNoAxesCombined, color: 'text-cyan-300', surface: 'bg-cyan-500/15' }, Legal: { icon: ShieldCheck, color: 'text-amber-300', surface: 'bg-amber-500/15' }, 'Customer Service': { icon: Headphones, color: 'text-rose-300', surface: 'bg-rose-500/15' }, Coding: { icon: Code2, color: 'text-indigo-300', surface: 'bg-indigo-500/15' }, Research: { icon: Search, color: 'text-teal-300', surface: 'bg-teal-500/15' }, Logistics: { icon: Truck, color: 'text-orange-300', surface: 'bg-orange-500/15' }, Default: { icon: Bot, color: 'text-brand', surface: 'bg-brand/15' },
};

const toolIcons: Record<string, LucideIcon> = { Gmail: Bot, Slack: Sparkles, GitHub: Code2, 'Google Maps': Search, 'Google Workspace': BriefcaseBusiness, 'Google Calendar': ChartNoAxesCombined, Trello: PackageCheck, Notion: Bot, LinkedIn: UsersRound, WhatsApp: Headphones, Paystack: Landmark, Flutterwave: Landmark, 'Agent workspace': Wrench };

export default function AgentSelect() {
  const navigate = useNavigate();
  const { addAgent } = useStore();
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const profile = useMemo(() => { try { return JSON.parse(localStorage.getItem('user_profile') || '{}') as { username?: string }; } catch { return {}; } }, []);
  const agents = useMemo(() => getAllAgents(), []);
  const categories = ['All', ...Array.from(new Set(agents.map((agent) => agent.category)))];
  const filteredAgents = agents.filter((agent) => categoryFilter === 'All' || agent.category === categoryFilter).filter((agent) => `${agent.name} ${agent.description} ${agent.category}`.toLowerCase().includes(filter.toLowerCase()));
  const backRoute = localStorage.getItem('deployment_mode') === 'cloud' ? '/setup' : '/setup/model-select';

  const toggleAgent = (agentId: string) => setSelectedAgents((current) => { const next = new Set(current); next.has(agentId) ? next.delete(agentId) : next.add(agentId); return next; });
  const handleComplete = () => {
    const chosen = agents.filter((agent) => selectedAgents.has(agent.id));
    const existing = JSON.parse(localStorage.getItem('agentiq_agents') || '[]');
    const newAgents = chosen.map((agent, index) => ({ id: Date.now() + index, user_id: 1, name: agent.name, type: agent.category, status: 'stopped' as const, config: JSON.stringify({ agentType: agent.id, icon: agent.icon, description: agent.description, whatItDoes: agent.whatItDoes }), created_at: new Date().toISOString() }));
    newAgents.forEach(addAgent);
    localStorage.setItem('agentiq_agents', JSON.stringify([...existing, ...newAgents]));
    localStorage.setItem('selected_agents', JSON.stringify(Array.from(selectedAgents)));
    navigate('/setup/integrations');
  };

  return <div className="min-h-screen bg-dark px-5 py-6 sm:px-8"><motion.main initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-6xl">
    <header className="mb-6 flex flex-col gap-4 border-b border-midGray/35 pb-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-brand">{profile.username ? `Welcome, @${profile.username}` : 'Build your team'}</p><h1 className="text-2xl font-bold tracking-tight text-white">Choose your agents</h1><p className="mt-1 text-sm text-midGray">Pick the specialists that should join your workspace.</p></div><div className="rounded-xl border border-midGray/45 bg-white/[0.03] px-4 py-2 text-sm"><span className="font-bold text-white">{selectedAgents.size}</span><span className="ml-1 text-midGray">selected</span></div></header>
    <section className="mb-5 rounded-2xl border border-midGray/40 bg-white/[0.025] p-3"><div className="flex flex-col gap-3 md:flex-row md:items-center"><label className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-midGray" /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Search specialists" className="w-full rounded-xl border border-midGray/50 bg-dark px-10 py-2.5 text-sm text-white outline-none placeholder:text-midGray focus:border-brand" /></label><div className="flex gap-1 overflow-x-auto pb-1 md:max-w-[60%] md:pb-0">{categories.map((category) => <button key={category} onClick={() => setCategoryFilter(category)} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${categoryFilter === category ? 'bg-brand text-white shadow-md shadow-brand/20' : 'text-midGray hover:bg-white/5 hover:text-white'}`}>{category}</button>)}</div></div></section>
    <div className="grid grid-cols-1 gap-3 pb-24 sm:grid-cols-2 lg:grid-cols-3">{filteredAgents.map((agent, index) => { const visual = categoryIcons[agent.category] || categoryIcons.Default; const Icon = visual.icon; const selected = selectedAgents.has(agent.id); return <motion.button key={agent.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.015, 0.25) }} onClick={() => toggleAgent(agent.id)} className={`relative min-h-[132px] rounded-2xl border p-4 text-left transition-all ${selected ? 'border-brand bg-brand/[0.08] shadow-lg shadow-brand/10' : 'border-midGray/45 bg-white/[0.025] hover:border-brand/60 hover:bg-white/[0.04]'}`}><div className="flex gap-3"><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${visual.surface} ${visual.color}`}><Icon className="size-5" strokeWidth={2.2} /></span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><h2 className="truncate text-sm font-bold text-white">{agent.name}</h2>{selected && <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand text-white"><Check className="size-3" strokeWidth={3} /></span>}</div><p className="mt-1 line-clamp-2 text-xs leading-relaxed text-midGray">{agent.description}</p></div></div><div className="mt-3 flex items-center gap-1.5 overflow-hidden">{(agent.integrations ?? []).slice(0, 3).map((integration) => { const ToolIcon = toolIcons[integration.label] || Wrench; return <span key={integration.id} title={integration.label} className="grid size-6 shrink-0 place-items-center rounded-md border border-midGray/35 bg-dark text-accent"><ToolIcon className="size-3.5" /></span>; })}<span className="ml-1 truncate text-[10px] font-medium uppercase tracking-wider text-midGray">{agent.category}</span></div></motion.button>; })}</div>
    {filteredAgents.length === 0 && <div className="rounded-2xl border border-dashed border-midGray/50 py-16 text-center text-sm text-midGray">No agents match that search.</div>}
    <footer className="fixed inset-x-0 bottom-0 border-t border-midGray/45 bg-[#10101a]/95 px-5 py-3 backdrop-blur sm:px-8"><div className="mx-auto flex max-w-6xl items-center justify-between"><button onClick={() => navigate(backRoute)} className="inline-flex items-center gap-1 text-sm font-medium text-midGray transition-colors hover:text-white"><ChevronLeft className="size-4" /> Back</button><button onClick={handleComplete} disabled={!selectedAgents.size} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand/25 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">Activate {selectedAgents.size || ''} agent{selectedAgents.size === 1 ? '' : 's'} <span className="ml-1">→</span></button></div></footer>
  </motion.main></div>;
}
