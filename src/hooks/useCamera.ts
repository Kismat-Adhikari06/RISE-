import { useCallback, useEffect, useRef, useState } from 'react';

export type CameraErrorKind = 'unsupported' | 'insecure' | 'denied' | 'unavailable' | 'busy' | 'lost' | 'unknown';
export interface CameraError {
  kind: CameraErrorKind;
  message: string;
}

const MESSAGES: Record<CameraErrorKind, string> = {
  unsupported: 'This browser does not support camera access.',
  insecure: 'Camera access needs a secure (HTTPS) connection.',
  denied: 'Camera permission was denied. Allow camera access in your browser settings, then try again.',
  unavailable: 'No camera was found on this device.',
  busy: 'The camera is being used by another app. Close it and try again.',
  lost: 'The camera stopped working. Try again.',
  unknown: 'The camera could not be started.',
};
const err = (kind: CameraErrorKind): CameraError => ({ kind, message: MESSAGES[kind] });

/** Maps a getUserMedia/DOM exception onto a stable error kind. Exported for tests. */
export function classify(e: unknown): CameraError {
  const name = e instanceof DOMException ? e.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') return err('denied');
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') return err('unavailable');
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') return err('busy');
  return err('unknown');
}

/** Rear camera by default; falls back to any camera. Always releases tracks on stop/unmount. */
export function useCamera(onLost?: () => void) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lostRef = useRef(onLost);
  lostRef.current = onLost;
  const [status, setStatus] = useState<'idle' | 'starting' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<CameraError | null>(null);
  const runId = useRef(0);

  const stop = useCallback(() => {
    runId.current++;
    streamRef.current?.getTracks().forEach((t) => {
      t.onended = null;
      t.stop();
    });
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const start = useCallback(async () => {
    stop();
    const mine = ++runId.current;
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(window.isSecureContext === false ? err('insecure') : err('unsupported'));
      setStatus('error');
      return false;
    }
    setStatus('starting');
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
      } catch (e) {
        if (e instanceof DOMException && (e.name === 'OverconstrainedError' || e.name === 'NotFoundError')) {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } else throw e;
      }
      if (mine !== runId.current) {
        stream.getTracks().forEach((t) => t.stop());
        return false; // superseded or unmounted while permission prompt was open
      }
      streamRef.current = stream;
      stream.getVideoTracks().forEach((t) => {
        t.onended = () => {
          setError(err('lost'));
          setStatus('error');
          lostRef.current?.();
        };
      });
      const video = videoRef.current;
      if (!video) throw new Error('no video element');
      video.srcObject = stream;
      video.muted = true;
      await video.play();
      setStatus('ready');
      return true;
    } catch (e) {
      if (mine !== runId.current) return false;
      stop();
      setError(classify(e));
      setStatus('error');
      return false;
    }
  }, [stop]);

  useEffect(() => stop, [stop]);

  return { videoRef, status, error, start, stop };
}
