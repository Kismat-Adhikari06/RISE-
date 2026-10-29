import { create } from 'zustand';
import { storage } from '../services/storage';
import type { AlarmSession } from '../types';
import * as machine from '../utils/sessionMachine';

interface SessionState {
  hydrated: boolean;
  /** The one session currently taking over the screen (RINGING / CHALLENGE_ACTIVE). */
  active: AlarmSession | null;
  /** Sessions waiting out a snooze. */
  snoozed: AlarmSession[];
  /** Real finished sessions (COMPLETED / MISSED), newest first. Never includes test sessions. */
  history: AlarmSession[];
  /** Shown on the completion screen until acknowledged. */
  justCompleted: AlarmSession | null;
  hydrate: () => Promise<void>;
  ring: (s: AlarmSession) => void;
  startMissions: () => void;
  dismiss: (now: number) => void;
  forceStop: (now: number) => void;
  advanceMath: (challengeId: string, expectedIndex: number, emergency?: boolean) => void;
  completeMission: (challengeId: string, now: number) => void;
  useEmergency: (challengeId: string) => void;
  snooze: (now: number) => void;
  wakeSnoozed: (now: number) => void;
  recordMissed: (s: AlarmSession) => void;
  acknowledgeMissed: (id: string) => void;
  closeCompletion: () => void;
  clearHistory: () => Promise<void>;
}

const save = (s: AlarmSession) => storage.saveSession(s).catch((e) => console.error('Failed to save session', e));

export const useSessionStore = create<SessionState>((set, get) => {
  /** Applies a transition to the active session, persists it, and routes it on completion. */
  const applyActive = (fn: (s: AlarmSession) => AlarmSession) => {
    const cur = get().active;
    if (!cur) return;
    const next = fn(cur);
    if (next === cur) return; // no-op transition (duplicate event)
    if (next.status === 'COMPLETED') {
      set((st) => ({
        active: null,
        justCompleted: next,
        history: next.isTest ? st.history : [next, ...st.history],
      }));
      if (next.isTest) storage.deleteSession(next.id).catch(() => undefined);
      else save(next);
    } else if (next.status === 'SNOOZED') {
      set((st) => ({ active: null, snoozed: [...st.snoozed, next] }));
      save(next);
    } else {
      set({ active: next });
      save(next);
    }
  };

  return {
    hydrated: false,
    active: null,
    snoozed: [],
    history: [],
    justCompleted: null,
    async hydrate() {
      try {
        const all = await storage.loadSessions();
        const history = all
          .filter((s) => (s.status === 'COMPLETED' || s.status === 'MISSED') && !s.isTest)
          .sort((a, b) => b.triggeredAt - a.triggeredAt);
        const live = all.filter((s) => s.status === 'RINGING' || s.status === 'CHALLENGE_ACTIVE').sort((a, b) => a.triggeredAt - b.triggeredAt);
        const snoozed = all.filter((s) => s.status === 'SNOOZED');
        // Test sessions never survive a reload as history; live ones are restored so a refresh can't bypass missions.
        const active = live[0] ?? null;
        // Any extra live sessions (should not exist) are queued as snoozed-now so they ring afterwards.
        const extras = live.slice(1).map((s) => ({ ...s, status: 'SNOOZED' as const, snoozeUntil: Date.now() }));
        set({ history, active, snoozed: [...snoozed, ...extras], hydrated: true });
      } catch (e) {
        console.error('Failed to load sessions', e);
        set({ hydrated: true });
      }
    },
    ring(s) {
      if (get().active) return;
      set({ active: s });
      save(s);
    },
    startMissions: () => applyActive(machine.startMissions),
    dismiss: (now) => applyActive((s) => machine.dismiss(s, now)),
    forceStop: (now) => applyActive((s) => machine.forceStop(s, now)),
    advanceMath: (id, idx, emergency) => applyActive((s) => machine.advanceMath(s, id, idx, emergency)),
    completeMission: (id, now) => applyActive((s) => machine.completeMission(s, id, now)),
    useEmergency: (id) => applyActive((s) => machine.useEmergency(s, id)),
    snooze: (now) => applyActive((s) => machine.snooze(s, now)),
    wakeSnoozed(now) {
      if (get().active) return;
      const due = get()
        .snoozed.filter((s) => (s.snoozeUntil ?? 0) <= now)
        .sort((a, b) => (a.snoozeUntil ?? 0) - (b.snoozeUntil ?? 0))[0];
      if (!due) return;
      const woke = machine.resumeFromSnooze(due);
      set((st) => ({ active: woke, snoozed: st.snoozed.filter((s) => s.id !== due.id) }));
      save(woke);
    },
    recordMissed(s) {
      set((st) => ({ history: [s, ...st.history] }));
      save(s);
    },
    acknowledgeMissed(id) {
      const s = get().history.find((x) => x.id === id);
      if (!s) return;
      const upd = { ...s, acknowledged: true };
      set((st) => ({ history: st.history.map((x) => (x.id === id ? upd : x)) }));
      save(upd);
    },
    closeCompletion: () => set({ justCompleted: null }),
    async clearHistory() {
      set({ history: [] });
      await storage.clearHistory().catch((e) => console.error(e));
    },
  };
});
