import type { TimeFormat } from '../types';

export function to12h(hour24: number): { hour12: number; pm: boolean } {
  return { hour12: hour24 % 12 === 0 ? 12 : hour24 % 12, pm: hour24 >= 12 };
}
export function to24h(hour12: number, pm: boolean): number {
  return (hour12 % 12) + (pm ? 12 : 0);
}

const pad = (n: number) => String(n).padStart(2, '0');

export function formatTime(hour: number, minute: number, fmt: TimeFormat): { main: string; suffix: string } {
  if (fmt === '24') return { main: `${pad(hour)}:${pad(minute)}`, suffix: '' };
  const { hour12, pm } = to12h(hour);
  return { main: `${pad(hour12)}:${pad(minute)}`, suffix: pm ? 'PM' : 'AM' };
}
export function formatTimeString(hour: number, minute: number, fmt: TimeFormat): string {
  const { main, suffix } = formatTime(hour, minute, fmt);
  return suffix ? `${main} ${suffix}` : main;
}
export function formatTimestamp(ts: number, fmt: TimeFormat): string {
  const d = new Date(ts);
  return formatTimeString(d.getHours(), d.getMinutes(), fmt);
}

export function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 5) return 'GOOD NIGHT';
  if (h < 12) return 'GOOD MORNING';
  if (h < 17) return 'GOOD AFTERNOON';
  return 'GOOD EVENING';
}

export function formatCountdown(ms: number): string {
  const totalMin = Math.max(0, Math.ceil(ms / 60_000));
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`;
}

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
export function dayDiff(a: number, b: number): number {
  // Calendar-day difference using local midnights (DST-safe via rounding).
  return Math.round((startOfDay(a) - startOfDay(b)) / 86_400_000);
}

/** "Today", "Tomorrow", or "Mon, Oct 30" */
export function describeDay(ts: number, now: number): string {
  const diff = dayDiff(ts, now);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return new Date(ts).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}
