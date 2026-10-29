export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday (matches Date#getDay)
export type TimeFormat = '12' | '24';
export type MathDifficulty = 'easy' | 'medium' | 'hard';
export type SnoozeMinutes = 0 | 5 | 10 | 15;

export type SoundId = 'sunrise' | 'digital' | 'pulse' | 'classic' | 'urgent';

export interface MathConfig {
  difficulty: MathDifficulty;
  questionCount: 1 | 3 | 5 | 10;
}
export interface ObjectScanConfig {
  targetClass: string; // COCO-SSD class name
  confidenceThreshold: number;
}

interface ChallengeBase {
  id: string;
  enabled: boolean;
}
export interface MathChallenge extends ChallengeBase {
  type: 'math';
  config: MathConfig;
}
export interface ObjectChallenge extends ChallengeBase {
  type: 'object';
  config: ObjectScanConfig;
}
/** Array order inside Alarm.challenges is the mission order. */
export type ChallengeConfig = MathChallenge | ObjectChallenge;
export type ChallengeType = ChallengeConfig['type'];

export interface Alarm {
  id: string;
  hour: number; // 0-23, device-local
  minute: number;
  label: string;
  enabled: boolean;
  repeatDays: Weekday[]; // empty = one-time
  soundId: SoundId;
  snoozeMinutes: SnoozeMinutes;
  challenges: ChallengeConfig[];
  createdAt: number;
  updatedAt: number;
  nextOccurrence: number | null; // epoch ms
  lastTriggeredOccurrence: number | null;
}

export type MissionStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'FAILED';
export type SessionStatus = 'RINGING' | 'CHALLENGE_ACTIVE' | 'SNOOZED' | 'COMPLETED' | 'MISSED';

export interface MathQuestion {
  text: string;
  answer: number;
}
export interface QuestionRun {
  questions: MathQuestion[];
  index: number;
}

export interface Mission {
  challengeId: string;
  type: ChallengeType;
  status: MissionStatus;
  config: MathConfig | ObjectScanConfig;
  math?: QuestionRun;
  /** Set only after a genuine camera/model failure (or confirmed emergency action). */
  emergency?: QuestionRun;
}

export interface AlarmSession {
  id: string;
  alarmId: string;
  occurrenceId: string;
  label: string;
  soundId: SoundId;
  snoozeMinutes: SnoozeMinutes;
  isTest: boolean;
  scheduledAt: number;
  triggeredAt: number;
  completedAt: number | null;
  status: SessionStatus;
  missions: Mission[];
  snoozeCount: number;
  snoozeUntil: number | null;
  mathSolved: number;
  objectScans: number;
  emergencyUsed: boolean;
  acknowledged: boolean; // for missed alarms
}

export interface Settings {
  timeFormat: TimeFormat;
  defaultSound: SoundId;
  defaultSnooze: SnoozeMinutes;
  defaultMathDifficulty: MathDifficulty;
  theme: 'dark';
  vibrationEnabled: boolean;
  alarmVolume: number; // 0.1 - 1 (app-level gain; cannot override system volume)
  missionVolumeRatio: number; // fraction of alarmVolume used during missions
}
