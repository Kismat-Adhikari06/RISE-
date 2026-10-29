import type { Alarm, Weekday } from '../types';
import { WEEKDAY_SHORT } from '../constants';

export const ALL_DAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];
export const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5];
export const WEEKENDS: Weekday[] = [0, 6];

type TimeSpec = Pick<Alarm, 'hour' | 'minute' | 'repeatDays'>;

/**
 * Next occurrence strictly after `after` (epoch ms). Built from local calendar dates so
 * DST shifts and timezone changes resolve to the correct wall-clock time.
 */
export function computeNextOccurrence(alarm: TimeSpec, after: number): number {
  const base = new Date(after);
  for (let offset = 0; offset <= 8; offset++) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset, alarm.hour, alarm.minute, 0, 0);
    if (d.getTime() <= after) continue;
    if (alarm.repeatDays.length === 0 || alarm.repeatDays.includes(d.getDay() as Weekday)) return d.getTime();
  }
  // Unreachable for valid input, but never return garbage.
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1, alarm.hour, alarm.minute).getTime();
}

export const sameDays = (a: Weekday[], b: Weekday[]): boolean =>
  a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);

export function describeRepeat(days: Weekday[]): string {
  if (days.length === 0) return 'Once';
  if (days.length === 7) return 'Every day';
  if (sameDays(days, WEEKDAYS)) return 'Weekdays';
  if (sameDays(days, WEEKENDS)) return 'Weekends';
  return [...days].sort().map((d) => WEEKDAY_SHORT[d]).join(' ');
}

export const occurrenceId = (alarmId: string, ts: number): string => `${alarmId}@${ts}`;
