import { MathChallenge } from '../components/challenges/MathChallenge';
import { useSessionStore } from '../stores/sessionStore';
import type { AlarmSession, Mission } from '../types';

export function MathChallengePage({ session, mission, emergency = false }: { session: AlarmSession; mission: Mission; emergency?: boolean }) {
  const advance = useSessionStore((s) => s.advanceMath);
  const complete = useSessionStore((s) => s.completeMission);
  const run = emergency ? mission.emergency : mission.math;
  if (!run) return null;
  const number = session.missions.findIndex((m) => m.challengeId === mission.challengeId) + 1;
  return (
    <MathChallenge
      key={`${mission.challengeId}-${emergency}`}
      kicker={emergency ? 'EMERGENCY FALLBACK' : `MISSION ${String(number).padStart(2, '0')}`}
      title={emergency ? 'Prove you’re awake.' : 'Wake up your brain.'}
      run={run}
      onCorrect={(i) => advance(mission.challengeId, i, emergency)}
      onComplete={() => complete(mission.challengeId, Date.now())}
    />
  );
}
