import { motion } from 'framer-motion';
import { ArrowRight, Bot, Check, Play, Sparkles, WandSparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const previewTasks = [
  { title: 'Research emerging markets', status: 'In progress', tone: 'bg-brand' },
  { title: 'Prepare client brief', status: 'Ready to review', tone: 'bg-accent' },
  { title: 'Analyse support feedback', status: 'Scheduled', tone: 'bg-amber-300' },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#09091a] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(95%_85%_at_50%_0%,#fff_0%,#e8eaff_24%,#a9b7ff_48%,#4a4dff_77%,#09091a_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#09091a] via-[#09091a]/45 to-transparent" />

      <nav className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between border-b border-[#20224f]/15 px-5 py-4 sm:px-8">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-sm font-bold tracking-tight" aria-label="agēntīq home">
          <span className="grid size-8 place-items-center rounded-lg bg-[#003af9] text-base font-black shadow-lg shadow-blue-600/30">a</span>
          agēntīq
        </button>
        <div className="hidden items-center gap-6 text-sm text-[#45476c] md:flex">
          <a href="#how-it-works" className="transition-colors hover:text-[#11142d]">How it works</a>
          <a href="#agents" className="transition-colors hover:text-[#11142d]">Agents</a>
          <a href="#privacy" className="transition-colors hover:text-[#11142d]">Privacy</a>
        </div>
        <button onClick={() => navigate('/setup')} className="rounded-md bg-[#003af9] px-3 py-1.5 text-sm font-semibold text-white shadow-md shadow-blue-500/25 transition hover:bg-[#002fd0]">
          Get started
        </button>
      </nav>

      <section className="relative z-10 mx-auto flex max-w-7xl flex-col items-center px-5 pb-0 pt-16 text-center sm:px-8 md:pt-20">
        <motion.div
          initial={{ opacity: 0, y: 14, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.65 }}
          className="flex max-w-4xl flex-col items-center"
        >
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#003af9]/20 bg-white/55 px-3 py-1 text-xs font-medium text-[#24347d] shadow-sm backdrop-blur">
            <Sparkles className="size-3 text-[#003af9]" /> Your autonomous workspace
          </span>
          <h1 className="text-4xl font-bold leading-[1.04] tracking-[-0.045em] text-[#12142a] sm:text-5xl lg:text-7xl">
            AI agents that work<br className="hidden sm:block" /> like your best teammate.
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-[#4b4d70] sm:text-base">
            Delegate the work that keeps your team moving. agēntīq chooses the right specialist, prepares the tools, and brings you back a finished result.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <button onClick={() => navigate('/setup')} className="inline-flex items-center justify-center gap-2 rounded-md bg-[#003af9] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:-translate-y-0.5 hover:bg-[#002fd0]">
              Build your workspace <ArrowRight className="size-4" />
            </button>
            <a href="#how-it-works" className="inline-flex items-center justify-center gap-2 rounded-md border border-[#293272]/20 bg-white/50 px-5 py-2.5 text-sm font-semibold text-[#22264b] backdrop-blur transition hover:bg-white/80">
              <Play className="size-3.5 fill-current" /> See how it works
            </a>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 35, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.75, delay: 0.18, ease: 'easeOut' }}
          className="relative mt-12 w-full max-w-5xl rounded-t-xl border border-white/50 bg-[#11121e] p-2 shadow-[0_-10px_60px_rgba(20,27,122,0.30)] sm:mt-16 sm:p-3"
        >
          <div className="overflow-hidden rounded-lg border border-white/[0.08] bg-[#171823] text-left">
            <div className="flex h-10 items-center gap-2 border-b border-white/[0.07] px-3">
              <span className="size-2 rounded-full bg-rose-400/80" /><span className="size-2 rounded-full bg-amber-300/80" /><span className="size-2 rounded-full bg-emerald-400/80" />
              <span className="ml-3 rounded bg-white/[0.06] px-2 py-1 text-[10px] text-[#8f91a8]">agēntīq workspace</span>
            </div>
            <div className="grid min-h-[250px] grid-cols-[54px_1fr] sm:min-h-[330px] sm:grid-cols-[150px_1fr]">
              <aside className="border-r border-white/[0.07] p-3 text-[#77798f] sm:p-4">
                <div className="mb-6 flex items-center gap-2 text-xs font-semibold text-white"><Bot className="size-4 text-[#7794ff]" /><span className="hidden sm:inline">Workspace</span></div>
                <div className="space-y-3 text-[11px]"><p>⌘ <span className="hidden sm:inline">New task</span></p><p>◌ <span className="hidden sm:inline">Activity</span></p><p>◇ <span className="hidden sm:inline">Agents</span></p></div>
              </aside>
              <div className="flex flex-col items-center justify-center p-5 sm:p-10">
                <div className="grid size-9 place-items-center rounded-xl border border-[#6c3bff]/30 bg-[#6c3bff]/10 text-[#a989ff]"><WandSparkles className="size-4" /></div>
                <h2 className="mt-4 text-center text-lg font-semibold sm:text-2xl">What would you like to <span className="text-[#a989ff]">get done?</span></h2>
                <div className="mt-5 w-full max-w-lg rounded-xl border border-white/[0.1] bg-[#22232e] p-3 shadow-xl">
                  <div className="text-xs text-[#8f91a8]">Research the best expansion opportunity for our team…</div>
                  <div className="mt-5 flex items-center justify-between"><span className="text-[10px] text-[#a989ff]">Specialist selected automatically</span><span className="rounded-md bg-[#6c3bff] px-2 py-1 text-[10px] font-semibold">Send</span></div>
                </div>
              </div>
            </div>
          </div>

          <div className="absolute -right-2 bottom-6 hidden w-56 rounded-xl border border-white/15 bg-[#242534]/95 p-3 text-left shadow-2xl backdrop-blur sm:block">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold"><span className="grid size-6 place-items-center rounded-lg bg-accent/15 text-accent"><Check className="size-3.5" /></span> Work in motion</div>
            <div className="space-y-2">{previewTasks.map((task) => <div key={task.title} className="flex items-center gap-2 text-[10px] text-[#bdbfce]"><span className={`size-1.5 rounded-full ${task.tone}`} /><span className="flex-1 truncate">{task.title}</span><span className="text-[#74768c]">{task.status}</span></div>)}</div>
          </div>
        </motion.div>
      </section>

      <section id="how-it-works" className="relative z-10 mx-auto grid max-w-5xl grid-cols-1 gap-4 px-5 py-14 text-left sm:grid-cols-3 sm:px-8">
        {['Describe the outcome', 'Your agent gets prepared', 'Review work that is ready'].map((title, index) => <div key={title} className="rounded-xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm"><span className="text-xs font-semibold text-[#003af9]">0{index + 1}</span><h3 className="mt-2 text-sm font-semibold text-[#171930]">{title}</h3></div>)}
      </section>
    </main>
  );
}
