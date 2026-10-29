import { EMERGENCY_QUESTION_COUNT } from '../constants';
import type { Alarm, AlarmSession, MathConfig, Mission, ObjectScanConfig } from '../types';
import { occurrenceId } from './alarmRecurrence';
import { uid } from './id';
import { generateQuestions } from './mathGenerator';

/**
 * Deterministic session/mission state machine. Every function is pure (returns a new session or the
 * very same object when the transition is a no-op), so duplicate events can never double-complete a mission.
 */

export function createSession(
  alarm: Pick<Alarm, 'id' | 'label' | 'soundId' | 'snoozeMinutes' | 'challenges'>,
  scheduledAt: number,
  now: number,
  isTest = false,
): AlarmSession {
  const missions: Mission[] = alarm.challenges
    .filter((c) => c.enabled)
    .map((c) => ({ challengeId: c.id, type: c.type, status: 'PENDING', config: { ...c.config } }));
  return {
    id: uid(),
    alarmId: alarm.id,
    occurrenceId: isTest ? `test@${now}` : occurrenceId(alarm.id, scheduledAt),
    label: alarm.label,
    soundId: alarm.soundId,
    snoozeMinutes: alarm.snoozeMinutes,
    isTest,
    scheduledAt,
    triggeredAt: now,
    completedAt: null,
    status: 'RINGING',
    missions,
    snoozeCount: 0,
    snoozeUntil: null,
    mathSolved: 0,
    objectScans: 0,
    emergencyUsed: false,
    acknowledged: false,
  };
}

export function createMissedSession(alarm: Alarm, scheduledAt: number, now: number): AlarmSession {
  return { ...createSession(alarm, scheduledAt, now), status: 'MISSED' };
}

export const activeMission = (s: AlarmSession): Mission | undefined => s.missions.find((m) => m.status === 'ACTIVE');
export const completedMissionCount = (s: AlarmSession): number => s.missions.filter((m) => m.status === 'COMPLETED').length;

function activate(m: Mission): Mission {
  if (m.type === 'math') {
    const cfg = m.config as MathConfig;
    return { ...m, status: 'ACTIVE', math: { questions: generateQuestions(cfg.difficulty, cfg.questionCount), index: 0 } };
  }
  return { ...m, status: 'ACTIVE' };
}

function activateNext(missions: Mission[]): Mission[] {
  if (missions.some((m) => m.status === 'ACTIVE')) return missions;
  const idx = missions.findIndex((m) => m.status === 'PENDING');
  if (idx === -1) return missions;
  return missions.map((m, i) => (i === idx ? activate(m) : m));
}

function finishIfDone(s: AlarmSession, now: number): AlarmSession {
  if (s.missions.every((m) => m.status === 'COMPLETED')) return { ...s, status: 'COMPLETED', completedAt: now, snoozeUntil: null };
  return s;
}

/** RINGING -> CHALLENGE_ACTIVE. With no missions the alarm completes via `dismiss` instead. */
export function startMissions(s: AlarmSession): AlarmSession {
  if (s.status !== 'RINGING' || s.missions.length === 0) return s;
  return { ...s, status: 'CHALLENGE_ACTIVE', missions: activateNext(s.missions) };
}

/** Only legal for alarms without missions. Challenge alarms can never be dismissed this way. */
export function dismiss(s: AlarmSession, now: number): AlarmSession {
  if (s.status !== 'RINGING' || s.missions.length > 0) return s;
  return { ...s, status: 'COMPLETED', completedAt: now };
}

/** Testing aid (see ALLOW_SKIP_MISSIONS): stop a ringing alarm without doing its missions. */
export function forceStop(s: AlarmSession, now: number): AlarmSession {
  if (s.status !== 'RINGING') return s;
  return { ...s, status: 'COMPLETED', completedAt: now };
}

/** Advance one math question. Idempotent per (mission, index): a stale/duplicate event is ignored. */
export function advanceMath(s: AlarmSession, challengeId: string, expectedIndex: number, emergency = false): AlarmSession {
  if (s.status !== 'CHALLENGE_ACTIVE') return s;
  const m = s.missions.find((x) => x.challengeId === challengeId);
  if (!m || m.status !== 'ACTIVE') return s;
  const run = emergency ? m.emergency : m.math;
  if (!run || run.index !== expectedIndex || run.index >= run.questions.length) return s;
  const next = { ...run, index: run.index + 1 };
  const updated: Mission = emergency ? { ...m, emergency: next } : { ...m, math: next };
  return {
    ...s,
    mathSolved: s.mathSolved + 1,
    missions: s.missions.map((x) => (x.challengeId === challengeId ? updated : x)),
  };
}

/** Mark a mission COMPLETED (idempotent), activate the next one, and complete the session when all are done. */
export function completeMission(s: AlarmSession, challengeId: string, now: number): AlarmSession {
  if (s.status !== 'CHALLENGE_ACTIVE') return s;
  const m = s.missions.find((x) => x.challengeId === challengeId);
  if (!m || m.status !== 'ACTIVE') return s;
  // A math mission may only complete after every question was answered.
  if (m.type === 'math' && m.math && m.math.index < m.math.questions.length) return s;
  if (m.type === 'object' && m.emergency && m.emergency.index < m.emergency.questions.length) return s;
  const missions = activateNext(s.missions.map((x) => (x.challengeId === challengeId ? { ...x, status: 'COMPLETED' as const } : x)));
  return finishIfDone(
    { ...s, missions, objectScans: s.objectScans + (m.type === 'object' && !m.emergency ? 1 : 0) },
    now,
  );
}

/** Switch a failed scan mission to the emergency math fallback. */
export function useEmergency(s: AlarmSession, challengeId: string): AlarmSession {
  if (s.status !== 'CHALLENGE_ACTIVE') return s;
  const m = s.missions.find((x) => x.challengeId === challengeId);
  if (!m || m.status !== 'ACTIVE' || m.type !== 'object' || m.emergency) return s;
  return {
    ...s,
    emergencyUsed: true,
    missions: s.missions.map((x) =>
      x.challengeId === challengeId
        ? { ...x, emergency: { questions: generateQuestions('hard', EMERGENCY_QUESTION_COUNT), index: 0 } }
        : x,
    ),
  };
}

/** Snooze never completes anything: progress is reset so missions must be redone on the next ring. */
export function snooze(s: AlarmSession, now: number): AlarmSession {
  if ((s.status !== 'RINGING' && s.status !== 'CHALLENGE_ACTIVE') || s.snoozeMinutes === 0) return s;
  return {
    ...s,
    status: 'SNOOZED',
    snoozeCount: s.snoozeCount + 1,
    snoozeUntil: now + s.snoozeMinutes * 60_000,
    missions: s.missions.map((m): Mission => ({ challengeId: m.challengeId, type: m.type, status: 'PENDING', config: m.config })),
  };
}

export function resumeFromSnooze(s: AlarmSession): AlarmSession {
  if (s.status !== 'SNOOZED') return s;
  return { ...s, status: 'RINGING', snoozeUntil: null };
}

export const missionObjectConfig = (m: Mission): ObjectScanConfig => m.config as ObjectScanConfig;
export const missionMathConfig = (m: Mission): MathConfig => m.config as MathConfig;
