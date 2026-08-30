import { ChangeEvent, FormEvent, useMemo, useRef, useState } from 'react';
import { AtSign, Camera, Loader2, Sparkles, Upload, UserRound } from 'lucide-react';
import { motion } from 'framer-motion';

export type AccountProfile = { username: string; avatar?: string };

export function OnboardingForm({ onSubmit, isSubmitting = false, buttonText = 'Continue to workspace' }: {
  onSubmit: (profile: AccountProfile) => void;
  isSubmitting?: boolean;
  buttonText?: string;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState<string>();
  const [error, setError] = useState('');
  const initials = useMemo(() => username.trim().slice(0, 2).toUpperCase() || 'AI', [username]);

  const handleUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please choose a PNG, JPG, or WebP image.'); return; }
    if (file.size > 2 * 1024 * 1024) { setError('Choose an image smaller than 2 MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => { setAvatar(String(reader.result)); setError(''); };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const cleanUsername = username.trim().replace(/^@+/, '');
    if (cleanUsername.length < 2) { setError('Choose a username with at least 2 characters.'); return; }
    onSubmit({ username: cleanUsername, avatar });
  };

  return (
    <motion.section initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 16 }} className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#13131a] shadow-2xl shadow-black/50">
      <div className="relative h-28 overflow-hidden bg-gradient-to-br from-brand via-[#885cff] to-accent">
        <div className="absolute -right-8 -top-10 size-40 rounded-full bg-white/15 blur-2xl" />
        <div className="absolute bottom-4 left-6 flex items-center gap-2 text-sm font-semibold text-white"><Sparkles className="size-4" /> Your agēntīq workspace</div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5 px-6 pb-6 pt-5 text-center sm:px-8 sm:pb-8">
        <div><h1 className="text-2xl font-bold text-white">Set up your profile</h1><p className="mt-2 text-sm leading-relaxed text-midGray">Add a name for your workspace. Your photo is optional and stays on this device.</p></div>
        <div className="flex items-center justify-between rounded-2xl border border-midGray/50 bg-dark/60 p-3 text-left">
          <div className="flex items-center gap-3">
            <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-full bg-brand/20 text-sm font-bold text-brand">{avatar ? <img src={avatar} alt="Profile preview" className="size-full object-cover" /> : <UserRound className="size-5" />}</div>
            <div><p className="text-sm font-semibold text-white">Profile photo</p><p className="mt-0.5 text-xs text-midGray">Optional · PNG, JPG, WebP</p></div>
          </div>
          <button type="button" onClick={() => fileInput.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-midGray px-3 py-2 text-xs font-semibold text-white transition-colors hover:border-brand hover:bg-brand/10"><Upload className="size-3.5" /> Upload</button>
          <input ref={fileInput} onChange={handleUpload} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" />
        </div>
        <label className="block text-left"><span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-midGray">Username</span><span className="relative block"><AtSign className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-midGray" /><input value={username} onChange={(event) => { setUsername(event.target.value); setError(''); }} placeholder="e.g. ade" autoFocus required className="w-full rounded-xl border border-midGray bg-dark px-9 py-3 text-sm text-white outline-none transition-colors placeholder:text-midGray focus:border-brand" /></span></label>
        {error && <p className="text-left text-xs text-red-400">{error}</p>}
        <button type="submit" disabled={isSubmitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white shadow-lg shadow-brand/25 transition-opacity hover:opacity-90 disabled:opacity-60">{isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />} {buttonText}</button>
      </form>
    </motion.section>
  );
}
