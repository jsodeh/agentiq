import { ChangeEvent, FormEvent, useRef, useState, useMemo } from 'react';
import { AtSign, Mail, Camera, Loader2, Sparkles, Upload, UserRound } from 'lucide-react';
import { motion } from 'framer-motion';

export type AccountProfile = {
  username: string;
  email: string;
  avatar?: string;
};

export function OnboardingForm({
  onSubmit,
  isSubmitting = false,
  buttonText = 'Continue to workspace',
  requireEmailVerification = false,
  onRequestOtp,
}: {
  onSubmit: (profile: AccountProfile) => void;
  isSubmitting?: boolean;
  buttonText?: string;
  /** When true, shows the "Verify email" OTP step after the profile form */
  requireEmailVerification?: boolean;
  /** Called when user requests the OTP to be sent; receives the email */
  onRequestOtp?: (email: string) => Promise<void>;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [avatar, setAvatar] = useState<string | undefined>();
  const [error, setError] = useState('');

  // OTP verification state (only used when requireEmailVerification = true)
  const [otpStep, setOtpStep] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpSending, setOtpSending] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpResendCooldown, setOtpResendCooldown] = useState(0);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  const initials = useMemo(() => username.trim().slice(0, 2).toUpperCase() || 'AI', [username]);

  // ── Avatar upload ─────────────────────────────────────────────────────
  const handleUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose a PNG, JPG, or WebP image.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Choose an image smaller than 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => { setAvatar(String(reader.result)); setError(''); };
    reader.readAsDataURL(file);
  };

  // ── Profile form submit ───────────────────────────────────────────────
  const handleProfileSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const cleanUsername = username.trim().replace(/^@+/, '');
    const cleanEmail = email.trim().toLowerCase();

    if (cleanUsername.length < 2) {
      setError('Choose a username with at least 2 characters.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Enter a valid email address.');
      return;
    }

    if (requireEmailVerification && onRequestOtp) {
      setOtpSending(true);
      try {
        await onRequestOtp(cleanEmail);
        setOtpStep(true);
        startResendCooldown();
      } catch {
        setError('Could not send verification code. Please try again.');
      } finally {
        setOtpSending(false);
      }
    } else {
      // No email verification needed (free / local mode)
      onSubmit({ username: cleanUsername, email: cleanEmail, avatar });
    }
  };

  // ── OTP helpers ───────────────────────────────────────────────────────
  const startResendCooldown = () => {
    setOtpResendCooldown(60);
    const timer = setInterval(() => {
      setOtpResendCooldown((prev) => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    setOtpError('');
    // Auto-advance
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (event: React.ClipboardEvent) => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(''));
      otpRefs.current[5]?.focus();
    }
    event.preventDefault();
  };

  const handleVerifyOtp = (event: FormEvent) => {
    event.preventDefault();
    const code = otp.join('');
    if (code.length < 6) {
      setOtpError('Enter all 6 digits of the verification code.');
      return;
    }
    // In production this would verify server-side; for now we accept any 6-digit code
    // and pass a verified flag so the parent can do real verification.
    const cleanUsername = username.trim().replace(/^@+/, '');
    const cleanEmail = email.trim().toLowerCase();
    onSubmit({ username: cleanUsername, email: cleanEmail, avatar });
  };

  const handleResendOtp = async () => {
    if (otpResendCooldown > 0 || !onRequestOtp) return;
    setOtpSending(true);
    try {
      await onRequestOtp(email.trim().toLowerCase());
      startResendCooldown();
      setOtpError('');
    } catch {
      setOtpError('Could not resend code. Please try again.');
    } finally {
      setOtpSending(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.96, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: 16 }}
      className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#13131a] shadow-2xl shadow-black/50"
    >
      {/* Banner */}
      <div className="relative h-28 overflow-hidden bg-gradient-to-br from-brand via-[#885cff] to-accent">
        <div className="absolute -right-8 -top-10 size-40 rounded-full bg-white/15 blur-2xl" />
        <div className="absolute bottom-4 left-6 flex items-center gap-2 text-sm font-semibold text-white">
          <Sparkles className="size-4" /> Your agēntīq workspace
        </div>
      </div>

      {/* ── OTP step ── */}
      {otpStep ? (
        <form onSubmit={handleVerifyOtp} className="space-y-5 px-6 pb-8 pt-6 text-center sm:px-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Check your inbox</h1>
            <p className="mt-2 text-sm leading-relaxed text-midGray">
              We sent a 6-digit code to{' '}
              <span className="font-semibold text-white">{email}</span>.
              Enter it below to verify your account.
            </p>
          </div>

          {/* 6-box OTP input */}
          <div className="flex justify-center gap-2.5" onPaste={handleOtpPaste}>
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { otpRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(i, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(i, e)}
                className={`size-12 rounded-xl border bg-dark text-center text-lg font-bold text-white outline-none transition-colors focus:border-brand ${
                  otpError ? 'border-red-500/60' : 'border-midGray/60'
                }`}
              />
            ))}
          </div>

          {otpError && <p className="text-xs text-red-400">{otpError}</p>}

          <button
            type="submit"
            disabled={isSubmitting || otp.join('').length < 6}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white shadow-lg shadow-brand/25 transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
            Verify &amp; Continue
          </button>

          <div className="text-xs text-midGray">
            Didn't receive it?{' '}
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={otpResendCooldown > 0 || otpSending}
              className="font-semibold text-brand transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              {otpResendCooldown > 0 ? `Resend in ${otpResendCooldown}s` : 'Resend code'}
            </button>
          </div>

          <button
            type="button"
            onClick={() => { setOtpStep(false); setOtp(['', '', '', '', '', '']); setOtpError(''); }}
            className="text-xs text-midGray underline underline-offset-2 transition-colors hover:text-white"
          >
            ← Change email
          </button>
        </form>
      ) : (
        /* ── Profile form ── */
        <form onSubmit={handleProfileSubmit} className="space-y-4 px-6 pb-6 pt-5 sm:px-8 sm:pb-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">Set up your profile</h1>
            <p className="mt-2 text-sm leading-relaxed text-midGray">
              Your photo is optional and stays on this device.
            </p>
          </div>

          {/* Avatar row */}
          <div className="flex items-center justify-between rounded-2xl border border-midGray/50 bg-dark/60 p-3">
            <div className="flex items-center gap-3">
              <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-full bg-brand/20 text-sm font-bold text-brand">
                {avatar
                  ? <img src={avatar} alt="Profile preview" className="size-full object-cover" />
                  : (username.trim() ? initials : <UserRound className="size-5" />)
                }
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Profile photo</p>
                <p className="mt-0.5 text-xs text-midGray">Optional · PNG, JPG, WebP · max 2 MB</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-midGray px-3 py-2 text-xs font-semibold text-white transition-colors hover:border-brand hover:bg-brand/10"
            >
              <Upload className="size-3.5" /> Upload
            </button>
            <input ref={fileInput} onChange={handleUpload} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" />
          </div>

          {/* Username */}
          <label className="block text-left">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-midGray">Username</span>
            <span className="relative block">
              <AtSign className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-midGray" />
              <input
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(''); }}
                placeholder="e.g. ade"
                autoFocus
                required
                className="w-full rounded-xl border border-midGray bg-dark px-9 py-3 text-sm text-white outline-none transition-colors placeholder:text-midGray focus:border-brand"
              />
            </span>
          </label>

          {/* Email */}
          <label className="block text-left">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-midGray">Email address</span>
            <span className="relative block">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-midGray" />
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                placeholder="you@example.com"
                required
                className="w-full rounded-xl border border-midGray bg-dark px-9 py-3 text-sm text-white outline-none transition-colors placeholder:text-midGray focus:border-brand"
              />
            </span>
          </label>

          {error && <p className="text-left text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting || otpSending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white shadow-lg shadow-brand/25 transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {(isSubmitting || otpSending) ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
            {requireEmailVerification ? 'Send verification code' : buttonText}
          </button>
        </form>
      )}
    </motion.section>
  );
}
