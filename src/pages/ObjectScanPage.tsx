import { ObjectScanner } from '../components/scanner/ObjectScanner';
import { useSessionStore } from '../stores/sessionStore';
import type { AlarmSession, Mission, ObjectScanConfig } from '../types';

export function ObjectScanPage({ session, mission }: { session: AlarmSession; mission: Mission }) {
  const complete = useSessionStore((s) => s.completeMission);
  const useEmergency = useSessionStore((s) => s.useEmergency);
  const cfg = mission.config as ObjectScanConfig;
  const isLast = session.missions.at(-1)?.challengeId === mission.challengeId;
  const number = session.missions.findIndex((m) => m.challengeId === mission.challengeId) + 1;
  return (
    <ObjectScanner
      target={cfg.targetClass}
      threshold={cfg.confidenceThreshold}
      kicker={isLast ? 'FINAL MISSION' : `MISSION ${String(number).padStart(2, '0')}`}
      onConfirmed={() => complete(mission.challengeId, Date.now())}
      onEmergency={() => useEmergency(mission.challengeId)}
    />
  );
}
