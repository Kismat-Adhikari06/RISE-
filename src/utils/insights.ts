import type { AlarmSession } from '../types';
import { dayDiff, startOfDay } from './dateTime';

export interface Insights {
  total: number;
  streak: number;
  avgDismissMs: number | null;
  mathSolved: number;
  objectScans: number;
  week: { dayStart: number; count: number }[]; // last 7 days, oldest first
}

/** Only real (non-test) completed sessions count. */
export function computeInsights(history: AlarmSession[], now: number): Insights {
  const done = history.filter((s) => s.status === 'COMPLETED' && !s.isTest && s.completedAt !== null);
  const durations = done.map((s) => (s.completedAt as number) - s.triggeredAt);
  const days = new Set(done.map((s) => startOfDay(s.completedAt as number)));

  let streak = 0;
  // A streak is still alive if the last wake-up was today or yesterday.
  let cursor = days.has(startOfDay(now)) ? startOfDay(now) : startOfDay(now) - 86_400_000;
  while (days.has(startOfDay(cursor))) {
    streak++;
    const d = new Date(cursor);
    d.setDate(d.getDate() - 1);
    cursor = d.getTime();
  }

  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfDay(now));
    d.setDate(d.getDate() - (6 - i));
    const dayStart = d.getTime();
    return { dayStart, count: done.filter((s) => dayDiff(s.completedAt as number, dayStart) === 0).length };
  });

  return {
    total: done.length,
    streak,
    avgDismissMs: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null,
    mathSolved: done.reduce((a, s) => a + s.mathSolved, 0),
    objectScans: done.reduce((a, s) => a + s.objectScans, 0),
    week,
  };
}
