import { BellRing, Moon, Square, VolumeX } from 'lucide-react';
import { motion } from 'motion/react';
import { missionSummary } from '../components/challenges/ChallengeChips';
import { Button } from '../components/ui/Button';
import { ALLOW_SKIP_MISSIONS } from '../constants';
import { useAudioBlocked } from '../hooks/useAlarmAudio';
import { audioEngine } from '../services/audioEngine';
import { useSessionStore } from '../stores/sessionStore';
import { useSettingsStore } from '../stores/settingsStore';
import type { AlarmSession, ChallengeConfig } from '../types';
import { formatTime } from '../utils/dateTime';

export function RingingPage({ session }: { session: AlarmSession }) {
  const format = useSettingsStore((s) => s.settings.timeFormat);
  const { startMissions, dismiss, snooze, forceStop } = useSessionStore();
  const blocked = useAudioBlocked();
  const { main, suffix } = formatTime(new Date(session.triggeredAt).getHours(), new Date(session.triggeredAt).getMinutes(), format);
  const n = session.missions.length;
  const summary = missionSummary(
    session.missions.map((m) => ({ id: m.challengeId, type: m.type, enabled: true, config: m.config }) as ChallengeConfig),
  );

  return (
    <div className="relative flex h-full flex-col items-center overflow-hidden bg-bg px-6 pb-safe pt-safe text-center">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[34%] h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(196,244,109,0.22) 0%, rgba(196,244,109,0) 65%)' }}
        animate={{ scale: [1, 1.12, 1], opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative z-10 mt-6 flex items-center gap-2 text-accent">
        <BellRing size={18} className="animate-pulse" />
        <span className="text-[12px] font-semibold tracking-[0.2em]">{session.isTest ? 'TEST ALARM' : session.label.toUpperCase()}</span>
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center">
        <p className="text-[18px] font-semibold tracking-[0.3em] text-white/80">IT’S TIME.</p>
        <div className="relative mt-8 flex h-[290px] w-[290px] items-center justify-center">
          <span className="ringpulse absolute inset-0 rounded-full border border-accent/60" />
          <span className="ringpulse absolute inset-0 rounded-full border border-accent/40" style={{ animationDelay: '1.2s' }} />
          <div className="flex h-[250px] w-[250px] flex-col items-center justify-center rounded-full bg-card/80 hairline shadow-glow">
            <span className="tnum text-[68px] font-extrabold leading-none text-accent drop-shadow-[0_0_24px_rgba(196,244,109,0.55)]">{main}</span>
            {suffix && <span className="mt-1 text-[20px] font-semibold text-accent/80">{suffix}</span>}
          </div>
        </div>
        <p className="mt-8 text-[17px] text-white/70">Your future self is counting on you.</p>
        {n > 0 && (
          <div className="mt-5 rounded-2xl bg-white/5 px-5 py-3 hairline">
            <p className="text-[15px] font-semibold">{n} {n === 1 ? 'mission' : 'missions'} between you and your morning.</p>
            <p className="mt-0.5 text-[13px] text-muted">{summary}</p>
          </div>
        )}
        {session.snoozeCount > 0 && <p className="mt-3 text-[13px] text-muted">Snoozed {session.snoozeCount}×</p>}
      </div>

      <div className="relative z-10 flex w-full max-w-[420px] flex-col gap-3 pb-2">
        {blocked && (
          <button
            type="button"
            onClick={() => void audioEngine.unlock()}
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-danger/40 bg-danger/10 px-4 text-[14px] font-semibold text-danger"
          >
            <VolumeX size={18} /> Sound is blocked by your browser — tap to enable
          </button>
        )}
        {n > 0 ? (
          <Button size="lg" full onClick={startMissions}>Start missions</Button>
        ) : (
          <Button size="lg" full onClick={() => dismiss(Date.now())}>Dismiss</Button>
        )}
        {ALLOW_SKIP_MISSIONS && n > 0 && (
          <Button variant="danger" full icon={<Square size={16} />} onClick={() => forceStop(Date.now())}>
            Stop alarm (skip missions)
          </Button>
        )}
        {session.snoozeMinutes > 0 && (
          <Button variant="secondary" full icon={<Moon size={18} />} onClick={() => snooze(Date.now())}>
            Snooze {session.snoozeMinutes} min
          </Button>
        )}
      </div>
    </div>
  );
}
