import Dexie, { type EntityTable } from 'dexie';
import type { Alarm, AlarmSession, Settings } from '../types';

interface SettingsRow {
  key: 'settings';
  value: Settings;
}

class RiseDB extends Dexie {
  alarms!: EntityTable<Alarm, 'id'>;
  sessions!: EntityTable<AlarmSession, 'id'>;
  settings!: EntityTable<SettingsRow, 'key'>;
  constructor() {
    super('rise');
    this.version(1).stores({
      alarms: 'id, enabled, nextOccurrence',
      sessions: 'id, alarmId, status, isTest, triggeredAt',
      settings: 'key',
    });
  }
}

export const db = new RiseDB();

export const storage = {
  loadAlarms: (): Promise<Alarm[]> => db.alarms.toArray(),
  saveAlarm: (a: Alarm) => db.alarms.put(a),
  saveAlarms: (a: Alarm[]) => db.alarms.bulkPut(a),
  deleteAlarm: (id: string) => db.alarms.delete(id),

  loadSessions: (): Promise<AlarmSession[]> => db.sessions.toArray(),
  saveSession: (s: AlarmSession) => db.sessions.put(s),
  deleteSession: (id: string) => db.sessions.delete(id),
  clearHistory: () => db.sessions.where('status').anyOf('COMPLETED', 'MISSED').delete(),

  async loadSettings(): Promise<Settings | null> {
    return (await db.settings.get('settings'))?.value ?? null;
  },
  saveSettings: (value: Settings) => db.settings.put({ key: 'settings', value }),
};
