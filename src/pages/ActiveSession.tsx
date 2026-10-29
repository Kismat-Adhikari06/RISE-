import { AnimatePresence, motion } from 'motion/react';
import { useWakeLock } from '../hooks/useWakeLock';
import { useSessionStore } from '../stores/sessionStore';
import { activeMission } from '../utils/sessionMachine';
import { MathChallengePage } from './MathChallengePage';
import { ObjectScanPage } from './ObjectScanPage';
import { RingingPage } from './RingingPage';

/** Full-screen takeover for the single active session. UI can only show what the state machine allows. */
export function ActiveSession() {
  const session = useSessionStore((s) => s.active);
  useWakeLock(!!session); // keep the screen on while an alarm is ringing / missions run
  if (!session) return null;

  const mission = session.status === 'CHALLENGE_ACTIVE' ? activeMission(session) : undefined;
  const key = `${session.id}:${session.status}:${mission?.challengeId ?? ''}:${mission?.emergency ? 'e' : ''}`;

  return (
    <div className="absolute inset-0 z-[60] bg-bg" role="dialog" aria-modal="true" aria-label="Alarm">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={key} className="h-full" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
          {!mission && <RingingPage session={session} />}
          {mission?.type === 'math' && <MathChallengePage session={session} mission={mission} />}
          {mission?.type === 'object' && (mission.emergency ? <MathChallengePage session={session} mission={mission} emergency /> : <ObjectScanPage session={session} mission={mission} />)}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
