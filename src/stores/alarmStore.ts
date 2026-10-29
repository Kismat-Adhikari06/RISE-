import { create } from 'zustand';
import { storage } from '../services/storage';
import type { Alarm } from '../types';
import { computeNextOccurrence } from '../utils/alarmRecurrence';
import { sanitizeAlarm } from '../utils/validation';

interface AlarmState {
  alarms: Alarm[];
  hydrated: boolean;
  loadError: string | null;
  hydrate: () => Promise<void>;
  save: (alarm: Alarm) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setEnabled: (id: string, enabled: boolean) => Promise<void>;
  /** Called after an occurrence fires/is missed: advances (or disables a one-time alarm). */
  advance: (id: string, firedOccurrence: number, now: number) => Promise<void>;
  /** Recompute future occurrences after a clock / timezone change. */
  recomputeFuture: (now: number) => Promise<void>;
  mergeImported: (alarms: Alarm[]) => Promise<void>;
}

const persist = (a: Alarm) => storage.saveAlarm(a).catch((e) => console.error('Failed to save alarm', e));

export const useAlarmStore = create<AlarmState>((set, get) => {
  const replaceOne = (a: Alarm) => set((s) => ({ alarms: s.alarms.map((x) => (x.id === a.id ? a : x)) }));
  return {
    alarms: [],
    hydrated: false,
    loadError: null,
    async hydrate() {
      try {
        const raw = await storage.loadAlarms();
        const now = Date.now();
        const alarms: Alarm[] = [];
        for (const r of raw) {
          const clean = sanitizeAlarm(r, now);
          if (!clean) continue;
          // Keep scheduling state from storage: only fill gaps.
          alarms.push({
            ...clean,
            createdAt: r.createdAt ?? clean.createdAt,
            updatedAt: r.updatedAt ?? clean.updatedAt,
            nextOccurrence: r.enabled ? (typeof r.nextOccurrence === 'number' ? r.nextOccurrence : clean.nextOccurrence) : null,
            lastTriggeredOccurrence: r.lastTriggeredOccurrence ?? null,
          });
        }
        set({ alarms, hydrated: true });
      } catch (e) {
        console.error('Failed to load alarms', e);
        set({ hydrated: true, loadError: 'Could not read saved alarms. Changes may not persist in this browser.' });
      }
    },
    async save(alarm) {
      const now = Date.now();
      const next: Alarm = {
        ...alarm,
        updatedAt: now,
        nextOccurrence: alarm.enabled ? computeNextOccurrence(alarm, now) : null,
      };
      set((s) => ({
        alarms: s.alarms.some((a) => a.id === next.id) ? s.alarms.map((a) => (a.id === next.id ? next : a)) : [...s.alarms, next],
      }));
      await storage.saveAlarm(next);
    },
    async remove(id) {
      set((s) => ({ alarms: s.alarms.filter((a) => a.id !== id) }));
      await storage.deleteAlarm(id).catch((e) => console.error(e));
    },
    async setEnabled(id, enabled) {
      const a = get().alarms.find((x) => x.id === id);
      if (!a) return;
      const now = Date.now();
      const next = { ...a, enabled, updatedAt: now, nextOccurrence: enabled ? computeNextOccurrence(a, now) : null };
      replaceOne(next);
      await persist(next);
    },
    async advance(id, fired, now) {
      const a = get().alarms.find((x) => x.id === id);
      if (!a) return;
      const oneTime = a.repeatDays.length === 0;
      const next: Alarm = {
        ...a,
        lastTriggeredOccurrence: fired,
        enabled: oneTime ? false : a.enabled,
        nextOccurrence: oneTime ? null : computeNextOccurrence(a, Math.max(now, fired)),
        updatedAt: now,
      };
      replaceOne(next);
      await persist(next);
    },
    async recomputeFuture(now) {
      const changed: Alarm[] = [];
      const alarms = get().alarms.map((a) => {
        if (!a.enabled || a.nextOccurrence === null || a.nextOccurrence <= now) return a;
        const n = computeNextOccurrence(a, now);
        if (n === a.nextOccurrence) return a;
        const upd = { ...a, nextOccurrence: n };
        changed.push(upd);
        return upd;
      });
      if (changed.length) {
        set({ alarms });
        await storage.saveAlarms(changed).catch((e) => console.error(e));
      }
    },
    async mergeImported(imported) {
      const ids = new Set(imported.map((a) => a.id));
      set((s) => ({ alarms: [...s.alarms.filter((a) => !ids.has(a.id)), ...imported] }));
      await storage.saveAlarms(imported);
    },
  };
});
