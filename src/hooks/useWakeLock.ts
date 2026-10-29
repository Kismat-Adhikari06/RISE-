import { useEffect, useState } from 'react';

export type WakeLockStatus = 'unsupported' | 'inactive' | 'active' | 'failed';

/** Holds a screen wake lock while `enabled`, re-acquiring after the page becomes visible again. */
export function useWakeLock(enabled: boolean): WakeLockStatus {
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;
  const [status, setStatus] = useState<WakeLockStatus>(supported ? 'inactive' : 'unsupported');

  useEffect(() => {
    if (!supported || !enabled) {
      setStatus(supported ? 'inactive' : 'unsupported');
      return;
    }
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (cancelled || document.hidden || (sentinel && !sentinel.released)) return;
      try {
        sentinel = await navigator.wakeLock.request('screen');
        if (cancelled) {
          void sentinel.release().catch(() => undefined);
          return;
        }
        setStatus('active');
        sentinel.addEventListener('release', () => {
          if (!cancelled) setStatus('inactive');
        });
      } catch {
        if (!cancelled) setStatus('failed');
      }
    };
    void acquire();
    const onVisible = () => {
      if (!document.hidden) void acquire();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release().catch(() => undefined);
    };
  }, [enabled, supported]);

  return status;
}
