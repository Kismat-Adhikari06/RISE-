import { Moon, ShieldAlert, Volume2, X } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '../components/ui/Button';
import { useAudioBlocked } from '../hooks/useAlarmAudio';
import { useNow } from '../hooks/useNow';
import { useWakeLock } from '../hooks/useWakeLock';
import { audioEngine } from '../services/audioEngine';
import { useAlarmStore } from '../stores/alarmStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useUIStore } from '../stores/uiStore';
import { describeDay, formatCountdown, formatTime, formatTimestamp } from '../utils/dateTime';

export function NightstandPage() {
  const now = useNow(1000);
  const close = useUIStore((s) => s.close);
  const format = useSettingsStore((s) => s.settings.timeFormat);
  const alarms = useAlarmStore((s) => s.alarms);
  const wake = useWakeLock(true);
  const blocked = useAudioBlocked();
  const next = alarms.filter((a) => a.enabled && a.nextOccurrence !== null).sort((a, b) => (a.nextOccurrence as number) - (b.nextOccurrence as number))[0];
  const d = new Date(now);
  const { main, suffix } = formatTime(d.getHours(), d.getMinutes(), format);

  useEffect(() => {
    void audioEngine.unlock(); // entering via a tap: arm audio now so the alarm can sound later
  }, []);

  return (
    <div className="relative flex h-full flex-col items-center bg-black px-6 pb-safe pt-safe text-center">
      <div className="mt-4 flex w-full items-center justify-between">
        <span className="flex items-center gap-2 text-[12px] font-semibold tracking-[0.2em] text-accent/60"><Moon size={14} /> NIGHTSTAND</span>
        <button type="button" aria-label="Exit nightstand mode" onClick={close} className="flex h-12 items-center gap-2 rounded-full bg-white/10 px-4 text-[14px] font-semibold text-white/80 active:scale-95">
          <X size={18} /> Exit
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="flex items-baseline gap-3 text-accent/70">
          <span className="tnum text-[88px] font-extrabold leading-none tracking-tight sm:text-[104px]">{main}</span>
          {suffix && <span className="text-[26px] font-semibold">{suffix}</span>}
        </div>
        <div className="mt-10 text-white/45">
          {next ? (
            <>
              <p className="text-[18px]">Next alarm at <span className="font-semibold text-white/70">{formatTimestamp(next.nextOccurrence as number, format)}</span> · {describeDay(next.nextOccurrence as number, now).toLowerCase()}</p>
              <p className="tnum mt-2 text-[16px]">{formatCountdown((next.nextOccurrence as number) - now)} remaining</p>
            </>
          ) : (
            <p className="text-[18px]">No alarm scheduled</p>
          )}
        </div>
      </div>

      <div className="w-full max-w-[420px] space-y-2 pb-2 text-[13px]">
        {blocked && (
          <Button variant="secondary" full icon={<Volume2 size={18} />} onClick={() => void audioEngine.unlock()}>
            Tap to arm alarm sound
          </Button>
        )}
        <p className={`rounded-2xl px-4 py-3 ${wake === 'active' ? 'bg-white/5 text-white/45' : 'border border-danger/30 bg-danger/10 text-danger'}`}>
          {wake === 'active' && 'Screen wake lock active — keep your phone plugged in.'}
          {wake === 'inactive' && 'Wake lock released. It will re-activate when the screen is visible.'}
          {wake === 'failed' && 'Could not keep the screen awake. Disable auto-lock in your phone settings, or the alarm may not ring.'}
          {wake === 'unsupported' && 'This browser can’t keep the screen awake. Disable auto-lock in your phone settings.'}
        </p>
        <p className="flex items-start gap-2 px-1 text-left text-white/35"><ShieldAlert size={14} className="mt-0.5 shrink-0" /> Web apps can’t guarantee alarms if the OS suspends the page. Keep a regular phone alarm as backup.</p>
      </div>
    </div>
  );
}
