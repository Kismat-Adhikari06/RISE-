import { DEFAULT_SETTINGS } from '../constants';
import { useAlarmStore } from '../stores/alarmStore';
import { useSettingsStore } from '../stores/settingsStore';
import type { Alarm } from '../types';
import { computeNextOccurrence } from './alarmRecurrence';
import { uid } from './id';

/** Real one-time alarm that rings at the start of the next full minute after now+~60s. */
export async function createQuickAlarm(): Promise<Alarm> {
  const now = Date.now();
  const target = new Date(now + 60_000);
  const settings = useSettingsStore.getState().settings ?? DEFAULT_SETTINGS;
  const alarm: Alarm = {
    id: uid(),
    hour: target.getHours(),
    minute: target.getMinutes(),
    label: 'Test alarm',
    enabled: true,
    repeatDays: [],
    soundId: settings.defaultSound,
    snoozeMinutes: settings.defaultSnooze,
    challenges: [],
    createdAt: now,
    updatedAt: now,
    nextOccurrence: null,
    lastTriggeredOccurrence: null,
  };
  alarm.nextOccurrence = computeNextOccurrence(alarm, now);
  await useAlarmStore.getState().save(alarm);
  return useAlarmStore.getState().alarms.find((a) => a.id === alarm.id) ?? alarm;
}
