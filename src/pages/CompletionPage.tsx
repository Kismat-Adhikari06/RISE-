import { Check } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '../components/ui/Button';
import { useSessionStore } from '../stores/sessionStore';
import { useSettingsStore } from '../stores/settingsStore';
import { completedMissionCount } from '../utils/sessionMachine';
import { formatDuration, formatTimestamp } from '../utils/dateTime';

const CONFETTI = Array.from({ length: 22 }, (_, i) => ({
  x: ((i * 37) % 100) - 50,
  d: 0.6 + ((i * 13) % 10) / 10,
  r: (i * 47) % 360,
  c: i % 3 === 0 ? '#C4F46D' : i % 3 === 1 ? '#FAFAFA' : '#7fb83a',
}));

export function CompletionPage() {
  const s = useSessionStore((st) => st.justCompleted);
  const close = useSessionStore((st) => st.closeCompletion);
  const format = useSettingsStore((st) => st.settings.timeFormat);
  if (!s || s.completedAt === null) return null;
  const total = s.missions.length;

  const rows: [string, string][] = [
    ['Wake-up time', formatTimestamp(s.completedAt, format)],
    ['Challenges completed', `${completedMissionCount(s)}/${total}`],
    ['Time to dismiss', formatDuration(s.completedAt - s.triggeredAt)],
  ];

  return (
    <div className="absolute inset-0 z-[70] flex flex-col items-center overflow-hidden bg-bg px-6 pb-safe pt-safe text-center" role="dialog" aria-label="Alarm completed">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/3 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: 'radial-gradient(circle, rgba(196,244,109,0.2), transparent 65%)' }} />
      {CONFETTI.map((p, i) => (
        <motion.span
          key={i}
          aria-hidden
          className="absolute left-1/2 top-[34%] h-2.5 w-1.5 rounded-sm"
          style={{ background: p.c }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{ x: p.x * 5, y: [0, -90 - p.d * 60, 380], opacity: [1, 1, 0], rotate: p.r * 3 }}
          transition={{ duration: 1.9 + p.d, ease: 'easeOut' }}
        />
      ))}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center">
        <motion.div initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', damping: 11, stiffness: 160 }} className="flex h-32 w-32 items-center justify-center rounded-full bg-accent text-black shadow-glow">
          <Check size={68} strokeWidth={3} />
        </motion.div>
        <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-8 text-[38px] font-extrabold tracking-tight">
          YOU DID IT.
        </motion.h1>
        <p className="mt-2 text-[18px] text-white/80">You’re officially awake.</p>
        <p className="mt-1 text-[14px] text-muted">Small wins build great mornings.</p>
        {s.isTest && <p className="mt-3 rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold text-muted">TEST SESSION — not counted in Insights</p>}
        {s.emergencyUsed && <p className="mt-3 text-[12px] text-muted">Completed with the emergency fallback.</p>}
        <div className="mt-8 w-full max-w-[360px] divide-y divide-white/5 rounded-3xl bg-card px-5 hairline">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-4 py-4 text-[15px]">
              <span className="text-muted">{k}</span>
              <span className="tnum font-bold">{v}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="relative z-10 w-full max-w-[420px] pb-2">
        <Button size="lg" full onClick={close}>Start my day</Button>
      </div>
    </div>
  );
}
