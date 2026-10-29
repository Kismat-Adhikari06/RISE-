import { AnimatePresence } from 'motion/react';
import { motion } from 'motion/react';
import { AlarmClock, BedDouble, Moon, ShieldAlert, TriangleAlert, X } from 'lucide-react';
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
      <header className="pt-5">
        <p className="text-[12px] font-semibold tracking-[0.18em] text-accent">{greeting(date)}</p>
        <h1 className="mt-2 text-[38px] font-extrabold leading-[1.05] tracking-tight">Your mornings,<br />mastered.</h1>
        <p className="mt-3 text-[14px] text-muted">
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

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative mt-6 overflow-hidden rounded-[32px] p-6 hairline shadow-soft"
        style={{ background: 'radial-gradient(120% 120% at 100% 0%, rgba(196,244,109,0.20) 0%, rgba(24,24,27,1) 55%)' }}
      >
        <p className="text-[12px] font-semibold tracking-[0.18em] text-accent">NEXT ALARM</p>
        {next ? (
          <>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="tnum text-[64px] font-extrabold leading-none tracking-tight">
                {formatTime(next.hour, next.minute, format).main}
              </span>
              <span className="text-[22px] font-semibold text-muted">{formatTime(next.hour, next.minute, format).suffix}</span>
            </div>
            <p className="mt-2 text-[16px] font-medium">{describeDay(next.nextOccurrence as number, now)}</p>
            <p className="mt-1 text-[14px] text-muted">
              Ringing in <span className="tnum font-semibold text-accent">{formatCountdown((next.nextOccurrence as number) - now)}</span>
            </p>
            <p className="mt-4 text-[14px] italic text-muted">Rise and shine.</p>
          </>
        ) : (
          <>
            <p className="mt-3 text-[34px] font-extrabold leading-tight">Nothing scheduled</p>
            <p className="mt-2 text-[14px] text-muted">Turn on an alarm or create a new one to see it here.</p>
          </>
        )}
        <Button variant="secondary" className="mt-5 !min-h-[44px]" icon={<Moon size={18} />} onClick={() => open({ name: 'nightstand' })}>
          Nightstand mode
        </Button>
      </motion.div>

      {!noteHidden && (
        <div className="mt-4 flex gap-3 rounded-2xl bg-card p-4 hairline">
          <ShieldAlert size={20} className="mt-0.5 shrink-0 text-accent" />
          <p className="flex-1 text-[13px] leading-relaxed text-muted">
            <span className="font-semibold text-fg">Heads up:</span> RISE is a web app. Alarms only ring while this page is open and your phone is awake, so
            use Nightstand mode and keep a regular phone alarm as a backup.
          </p>
          <button type="button" aria-label="Dismiss" onClick={dismissNote} className="-m-2 h-fit p-2 text-muted">
            <X size={18} />
          </button>
        </div>
      )}

      <h2 className="mb-3 mt-8 px-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">Your alarms</h2>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center rounded-[32px] bg-card px-6 py-12 text-center hairline">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent/10 text-accent">
            <BedDouble size={36} />
          </div>
          <h3 className="mt-5 text-[22px] font-bold">No alarms yet</h3>
          <p className="mt-2 max-w-[260px] text-[14px] leading-relaxed text-muted">
            Create your first alarm and add a math or object-scan mission to make waking up count.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Button icon={<AlarmClock size={18} />} onClick={() => open({ name: 'editor', alarmId: null })}>
              Create an alarm
            </Button>
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
    </div>
  );
}
