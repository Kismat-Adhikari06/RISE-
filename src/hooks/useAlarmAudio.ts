import { useEffect, useSyncExternalStore } from 'react';
import { audioEngine } from '../services/audioEngine';
import { useSessionStore } from '../stores/sessionStore';
import { useSettingsStore } from '../stores/settingsStore';

/** Whether the browser is currently blocking audio until a tap. */
export function useAudioBlocked(): boolean {
  return useSyncExternalStore(
    (cb) => audioEngine.subscribe(cb),
    () => audioEngine.blocked,
  );
}

/**
 * Keeps the audio engine in sync with the active session: loud while ringing, quieter during missions,
 * silent when snoozed/completed. The engine itself guarantees a single loop.
 */
export function useAlarmAudio(): void {
  const active = useSessionStore((s) => s.active);
  const { alarmVolume, missionVolumeRatio, vibrationEnabled } = useSettingsStore((s) => s.settings);
  const id = active?.id ?? null;
  const status = active?.status ?? null;
  const soundId = active?.soundId ?? null;

  useEffect(() => {
    if (!id || !soundId) {
      audioEngine.stop();
      return;
    }
    if (audioEngine.playing !== soundId) audioEngine.start(soundId, status === 'CHALLENGE_ACTIVE' ? alarmVolume * missionVolumeRatio : alarmVolume);
    else audioEngine.setVolume(status === 'CHALLENGE_ACTIVE' ? alarmVolume * missionVolumeRatio : alarmVolume);
  }, [id, status, soundId, alarmVolume, missionVolumeRatio]);

  useEffect(() => () => audioEngine.stop(0.05), []);

  useEffect(() => {
    if (!id || status !== 'RINGING' || !vibrationEnabled || typeof navigator.vibrate !== 'function') return;
    const buzz = () => navigator.vibrate([600, 300, 600]);
    buzz();
    const t = window.setInterval(buzz, 2500);
    return () => {
      clearInterval(t);
      navigator.vibrate(0);
    };
  }, [id, status, vibrationEnabled]);
}
