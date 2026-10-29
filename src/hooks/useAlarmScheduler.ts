import { useEffect } from 'react';
import { runSchedulerTick } from '../services/alarmScheduler';
import { useAlarmStore } from '../stores/alarmStore';

const TICK_MS = 1000;
const CLOCK_JUMP_MS = 90_000;

/** Mounts the one global scheduler loop. Detects clock/timezone changes and recovers on resume. */
export function useAlarmScheduler(): void {
  useEffect(() => {
    let last = Date.now();
    const tick = () => {
      const now = Date.now();
      // A gap far from the 1s cadence means the page slept, or the clock/timezone changed.
      // Recompute future occurrences (past-due ones are handled by the tick itself as ring/missed).
      if (Math.abs(now - last - TICK_MS) > CLOCK_JUMP_MS) void useAlarmStore.getState().recomputeFuture(now);
      last = now;
      runSchedulerTick(now);
    };
    tick();
    const id = window.setInterval(tick, TICK_MS);
    const onVisible = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', tick);
    window.addEventListener('pageshow', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', tick);
      window.removeEventListener('pageshow', tick);
    };
  }, []);
}
