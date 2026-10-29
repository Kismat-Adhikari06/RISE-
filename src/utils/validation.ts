import { DEFAULT_CONFIDENCE_THRESHOLD, DEFAULT_SETTINGS, MATH_QUESTION_COUNTS, OBJECT_OPTIONS, SOUNDS } from '../constants';
import type { Alarm, ChallengeConfig, MathDifficulty, Settings, SnoozeMinutes, SoundId, Weekday } from '../types';
import { computeNextOccurrence } from './alarmRecurrence';
import { uid } from './id';

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const int = (v: unknown, min: number, max: number): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null;

export function sanitizeChallenge(raw: unknown): ChallengeConfig | null {
  if (!isObj(raw) || !isObj(raw.config)) return null;
  const id = typeof raw.id === 'string' && raw.id ? raw.id : uid();
  const enabled = raw.enabled !== false;
  if (raw.type === 'math') {
    const d = raw.config.difficulty;
    const difficulty: MathDifficulty = d === 'easy' || d === 'medium' || d === 'hard' ? d : 'medium';
    const qc = raw.config.questionCount as 1 | 3 | 5 | 10;
    return { id, type: 'math', enabled, config: { difficulty, questionCount: MATH_QUESTION_COUNTS.includes(qc) ? qc : 3 } };
  }
  if (raw.type === 'object') {
    const cls = raw.config.targetClass;
    if (typeof cls !== 'string' || !OBJECT_OPTIONS.some((o) => o.cocoClass === cls)) return null;
    const t = raw.config.confidenceThreshold;
    const confidenceThreshold = typeof t === 'number' && t >= 0.3 && t <= 0.95 ? t : DEFAULT_CONFIDENCE_THRESHOLD;
    return { id, type: 'object', enabled, config: { targetClass: cls, confidenceThreshold } };
  }
  return null;
}

export function sanitizeAlarm(raw: unknown, now = Date.now()): Alarm | null {
  if (!isObj(raw)) return null;
  const hour = int(raw.hour, 0, 23);
  const minute = int(raw.minute, 0, 59);
  if (hour === null || minute === null) return null;
  const repeatDays = Array.isArray(raw.repeatDays)
    ? ([...new Set(raw.repeatDays.filter((d): d is Weekday => int(d, 0, 6) !== null))].sort() as Weekday[])
    : [];
  const soundId: SoundId = SOUNDS.some((s) => s.id === raw.soundId) ? (raw.soundId as SoundId) : DEFAULT_SETTINGS.defaultSound;
  const snoozeMinutes: SnoozeMinutes = [0, 5, 10, 15].includes(raw.snoozeMinutes as number) ? (raw.snoozeMinutes as SnoozeMinutes) : 5;
  const challenges = (Array.isArray(raw.challenges) ? raw.challenges : [])
    .map(sanitizeChallenge)
    .filter((c): c is ChallengeConfig => c !== null);
  const enabled = raw.enabled !== false;
  const alarm: Alarm = {
    id: typeof raw.id === 'string' && raw.id ? raw.id : uid(),
    hour,
    minute,
    label: typeof raw.label === 'string' ? raw.label.slice(0, 60) : 'Wake up',
    enabled,
    repeatDays,
    soundId,
    snoozeMinutes,
    challenges,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : now,
    updatedAt: now,
    nextOccurrence: null,
    lastTriggeredOccurrence: null,
  };
  alarm.nextOccurrence = enabled ? computeNextOccurrence(alarm, now) : null;
  return alarm;
}

export function sanitizeSettings(raw: unknown): Settings {
  const s = isObj(raw) ? raw : {};
  const num = (v: unknown, min: number, max: number, fallback: number) =>
    typeof v === 'number' && v >= min && v <= max ? v : fallback;
  return {
    timeFormat: s.timeFormat === '24' ? '24' : '12',
    defaultSound: SOUNDS.some((x) => x.id === s.defaultSound) ? (s.defaultSound as SoundId) : DEFAULT_SETTINGS.defaultSound,
    defaultSnooze: [0, 5, 10, 15].includes(s.defaultSnooze as number) ? (s.defaultSnooze as SnoozeMinutes) : DEFAULT_SETTINGS.defaultSnooze,
    defaultMathDifficulty:
      s.defaultMathDifficulty === 'easy' || s.defaultMathDifficulty === 'hard' ? s.defaultMathDifficulty : 'medium',
    theme: 'dark',
    vibrationEnabled: s.vibrationEnabled !== false,
    alarmVolume: num(s.alarmVolume, 0.1, 1, DEFAULT_SETTINGS.alarmVolume),
    missionVolumeRatio: num(s.missionVolumeRatio, 0.1, 0.8, DEFAULT_SETTINGS.missionVolumeRatio),
  };
}

export interface ExportFile {
  app: 'rise';
  version: 1;
  exportedAt: number;
  settings: Settings;
  alarms: Alarm[];
}

export function parseImport(text: string): { alarms: Alarm[]; settings: Settings | null } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  if (!isObj(data) || data.app !== 'rise' || !Array.isArray(data.alarms)) throw new Error('That file is not a RISE export.');
  const alarms = data.alarms.map((a) => sanitizeAlarm(a)).filter((a): a is Alarm => a !== null);
  return { alarms, settings: data.settings ? sanitizeSettings(data.settings) : null };
}
