import { AnimatePresence, motion } from 'motion/react';
import { CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';

export function Toasts() {
  const toasts = useUIStore((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[90] flex flex-col items-center gap-2 px-4 pt-safe" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ y: -30, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="pointer-events-auto flex max-w-[420px] items-center gap-3 rounded-2xl bg-elevated px-4 py-3 text-[14px] font-medium hairline shadow-soft"
          >
            {t.tone === 'success' && <CircleCheck size={20} className="shrink-0 text-accent" />}
            {t.tone === 'error' && <TriangleAlert size={20} className="shrink-0 text-danger" />}
            {t.tone === 'info' && <Info size={20} className="shrink-0 text-muted" />}
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
