import { MISSED_GRACE_MS } from '../constants';
import { useAlarmStore } from '../stores/alarmStore';
import { useSessionStore } from '../stores/sessionStore';
import { createMissedSession, createSession } from '../utils/sessionMachine';

/**
 * The single scheduler entry point. Called by one interval (and on visibility/focus changes) —
 * there is never a per-alarm timer. Everything is decided from real timestamps.
 */
export function runSchedulerTick(now: number): void {
  const sessions = useSessionStore.getState();
  if (!sessions.hydrated || !useAlarmStore.getState().hydrated) return;

  sessions.wakeSnoozed(now);
  if (useSessionStore.getState().active) return; // one full-screen session at a time

  const { alarms, advance } = useAlarmStore.getState();
  const due = alarms
    .filter((a) => a.enabled && a.nextOccurrence !== null && a.nextOccurrence <= now)
    .sort((a, b) => (a.nextOccurrence as number) - (b.nextOccurrence as number) || a.id.localeCompare(b.id));

  for (const alarm of due) {
    const occ = alarm.nextOccurrence as number;
    if (alarm.lastTriggeredOccurrence === occ) {
      void advance(alarm.id, occ, now); // already handled; just move on
      continue;
    }
    if (now - occ > MISSED_GRACE_MS) {
      // Page was closed/asleep: record honestly as missed instead of ringing hours late.
      useSessionStore.getState().recordMissed(createMissedSession(alarm, occ, now));
      void advance(alarm.id, occ, now);
      continue;
    }
    useSessionStore.getState().ring(createSession(alarm, occ, now));
    void advance(alarm.id, occ, now);
    if (typeof document !== 'undefined' && document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(alarm.label || 'Alarm', { body: 'Open RISE to complete your missions.', tag: 'rise-alarm', requireInteraction: true });
      } catch {
        /* notifications are best-effort */
      }
    }
    return; // remaining due alarms are picked up after this session ends
  }
}
