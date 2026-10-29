import { AnimatePresence } from 'motion/react';
import { motion } from 'motion/react';
import { TriangleAlert, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AlarmCard } from '../components/alarms/AlarmCard';
import { Button } from '../components/ui/Button';
import { useNow } from '../hooks/useNow';
import { useAlarmStore } from '../stores/alarmStore';
import { useSessionStore } from '../stores/sessionStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useUIStore } from '../stores/uiStore';
import { createQuickAlarm } from '../utils/quickAlarm';
import { describeDay, formatCountdown, formatTime, greeting } from '../utils/dateTime';
import { formatTimestamp } from '../utils/dateTime';

const NOTE_KEY = 'rise.noteDismissed';
const readDismissed = () => {
  try {
    return localStorage.getItem(NOTE_KEY) === '1';
  } catch {
    return false;
  }
};

export function HomePage() {
  const now = useNow(5000);
  const alarms = useAlarmStore((s) => s.alarms);
  const loadError = useAlarmStore((s) => s.loadError);
  const setEnabled = useAlarmStore((s) => s.setEnabled);
  const format = useSettingsStore((s) => s.settings.timeFormat);
  const open = useUIStore((s) => s.open);
  const toast = useUIStore((s) => s.toast);
  const history = useSessionStore((s) => s.history);
  const ack = useSessionStore((s) => s.acknowledgeMissed);
  const [noteHidden, setNoteHidden] = useState(readDismissed);

  const sorted = useMemo(
    () =>
      [...alarms].sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute) || a.createdAt - b.createdAt),
    [alarms],
  );
  const next = useMemo(
    () =>
      alarms
        .filter((a) => a.enabled && a.nextOccurrence !== null)
        .sort((a, b) => (a.nextOccurrence as number) - (b.nextOccurrence as number))[0],
    [alarms],
  );
  const missed = history.filter((s) => s.status === 'MISSED' && !s.acknowledged);
  const date = new Date(now);

  const dismissNote = () => {
    setNoteHidden(true);
    try {
      localStorage.setItem(NOTE_KEY, '1');
    } catch {
      /* private mode */
    }
  };

  const quick = async () => {
    const a = await createQuickAlarm();
    toast(`Test alarm set for ${formatTimestamp(a.nextOccurrence as number, format)}`);
  };

  return (
    <div className="px-5 pb-48 pt-safe">
      <header className="pt-6">
        <h1 className="text-[34px] font-bold leading-tight tracking-tight">{greeting(date)}</h1>
        <p className="mt-1 text-[15px] text-muted">
          {date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </header>

      {loadError && (
        <div className="mt-5 flex gap-3 rounded-2xl border border-danger/30 bg-danger/10 p-4 text-[14px] text-danger">
          <TriangleAlert size={20} className="shrink-0" /> {loadError}
        </div>
      )}

      <AnimatePresence>
        {missed.map((s) => (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-5 overflow-hidden"
          >
            <div className="flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger/10 p-4">
              <TriangleAlert size={20} className="mt-0.5 shrink-0 text-danger" />
              <div className="flex-1 text-[14px]">
                <p className="font-semibold text-danger">Missed alarm</p>
                <p className="mt-0.5 text-muted">
                  “{s.label || 'Alarm'}” was due at {formatTimestamp(s.scheduledAt, format)} on {describeDay(s.scheduledAt, now)}, but RISE wasn’t
                  running. Browsers can’t ring a closed page.
                </p>
              </div>
              <button type="button" aria-label="Dismiss notice" onClick={() => ack(s.id)} className="-m-2 p-2 text-muted">
                <X size={18} />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      <section className="mt-7 rounded-2xl bg-card p-6 hairline" aria-label="Next alarm">
        {next ? (
          <>
            <p className="text-[15px] text-muted">Next alarm</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="tnum text-[56px] font-bold leading-none tracking-tight">
                {formatTime(next.hour, next.minute, format).main}
              </span>
              <span className="text-[20px] font-semibold text-muted">{formatTime(next.hour, next.minute, format).suffix}</span>
            </div>
            <p className="mt-2 text-[15px] text-muted">
              {describeDay(next.nextOccurrence as number, now)} ·{' '}
              <span className="tnum">{formatCountdown((next.nextOccurrence as number) - now)}</span>
            </p>
            <Button variant="secondary" className="mt-4 !min-h-[44px]" onClick={() => open({ name: 'nightstand' })}>
              Nightstand mode
            </Button>
          </>
        ) : (
          <>
            <p className="text-[15px] text-muted">No alarms set</p>
            <p className="mt-1 text-[15px]">Pick a time and a mission below.</p>
            <Button variant="secondary" className="mt-4 !min-h-[44px]" onClick={() => open({ name: 'nightstand' })}>
              Nightstand mode
            </Button>
          </>
        )}
      </section>

      {!noteHidden && (
        <div className="mt-3 flex gap-3 rounded-2xl px-1 py-3 text-[13px] leading-relaxed text-muted" role="note">
          <p className="flex-1">
            Alarms only ring while this page is open. Keep the app in Nightstand mode, and keep a regular phone alarm as a backup.
          </p>
          <button type="button" aria-label="Dismiss" onClick={dismissNote} className="-m-2 h-fit p-2 text-muted">
            <X size={18} />
          </button>
        </div>
      )}

      <section className="mt-8" aria-label="Your alarms">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl bg-card px-6 py-12 text-center hairline">
            <p className="text-[17px] font-semibold">No alarms yet</p>
            <p className="mt-2 max-w-[260px] text-[14px] leading-relaxed text-muted">
              Create one and add a math or object-scan mission to make waking up count.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Button onClick={() => open({ name: 'editor', alarmId: null })}>Create an alarm</Button>
              <Button variant="ghost" onClick={quick}>
                Set a test alarm for 1 minute from now
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {sorted.map((a, i) => (
                <AlarmCard
                  key={a.id}
                  alarm={a}
                  format={format}
                  index={i}
                  onOpen={() => open({ name: 'editor', alarmId: a.id })}
                  onToggle={(v) => void setEnabled(a.id, v)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>
    </div>
  );
}
