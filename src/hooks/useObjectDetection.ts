import { useCallback, useEffect, useRef, useState } from 'react';
import { CONFIRMATION_FRAMES, CONFIRMATION_WINDOW, DEBUG_MIN_SCORE, DEFAULT_CONFIDENCE_THRESHOLD, INFERENCE_INTERVAL_MS } from '../constants';
import { DetectorError, loadDetector } from '../services/objectDetection';
import { ConfirmationTracker } from '../utils/detectionTracker';
import { useCamera } from './useCamera';

export type ScanPhase = 'starting-camera' | 'loading-model' | 'searching' | 'confirming' | 'confirmed' | 'error';
export interface ScanError {
  kind: 'model' | 'camera';
  message: string;
}

export interface DebugBox {
  label: string;
  score: number;
  x: number; // all in source-video pixels
  y: number;
  w: number;
  h: number;
}
export interface DebugInfo {
  model: 'loading' | 'loaded' | 'failed';
  tierId: string;
  backend: string;
  avgMs: number;
  fps: number;
  fallbackReason: string | null;
  recentErrors: string[];
  resolution: string;
  inference: 'waiting' | 'running' | 'failed';
  lastInferenceAt: number | null;
  lastMs: number | null;
  lastError: string | null;
  detections: DebugBox[]; // everything the model returned this pass, best first
  videoW: number;
  videoH: number;
}

const EMPTY_DEBUG: DebugInfo = {
  model: 'loading', tierId: 'none', backend: '—', avgMs: 0, fps: 0, fallbackReason: null, recentErrors: [], resolution: '—', inference: 'waiting',
  lastInferenceAt: null, lastMs: null, lastError: null, detections: [], videoW: 0, videoH: 0,
};

interface Options {
  target: string;
  threshold: number;
  /** When true, per-pass detection details are published for the debug panel (costs a re-render per pass). */
  debug?: boolean;
  onConfirmed: () => void;
}

/**
 * Camera -> video frame -> COCO-SSD -> predictions -> class match -> confirmation.
 * One throttled loop (never overlapping), the camera and model load in parallel, state only changes on
 * transitions (plus once per pass when debugging), and the camera is released as soon as the object is confirmed.
 */
export function useObjectDetection({ target, threshold, debug = false, onConfirmed }: Options) {
  const [phase, setPhase] = useState<ScanPhase>('starting-camera');
  const [hits, setHits] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [error, setError] = useState<ScanError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [seen, setSeen] = useState('');
  const [dbg, setDbg] = useState<DebugInfo>(EMPTY_DEBUG);

  const confirmedCb = useRef(onConfirmed);
  confirmedCb.current = onConfirmed;
  const debugRef = useRef(debug);
  debugRef.current = debug;
  const phaseRef = useRef<ScanPhase>('starting-camera');
  const setPhaseBoth = (p: ScanPhase) => {
    phaseRef.current = p;
    setPhase(p);
  };
  const patchDbg = (patch: Partial<DebugInfo>) => setDbg((d) => ({ ...d, ...patch }));

  const camera = useCamera(() => {
    if (phaseRef.current !== 'confirmed') {
      setError({ kind: 'camera', message: 'The camera stopped working. Try again.' });
      setPhaseBoth('error');
    }
  });
  const { videoRef, start: startCamera, stop: stopCamera } = camera;

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    let busy = false;
    const accept = Math.min(threshold, DEFAULT_CONFIDENCE_THRESHOLD);
    const tracker = new ConfirmationTracker(target, accept, CONFIRMATION_FRAMES, CONFIRMATION_WINDOW);
    // Partial verification reset: a mid-scan backend fallback must not blend the new tier's
    // inferences with the previous tier's committed streak (different models, different scores).
    let activeTierId = '';
    setError(null);
    setHits(0);
    setConfidence(0);
    setSeen('');
    setCameraReady(false);
    setDbg(EMPTY_DEBUG);
    setPhaseBoth('starting-camera');

    (async () => {
      // Fail fast: without a secure context there is no camera API at all, so don't waste time loading the model.
      if (!navigator.mediaDevices?.getUserMedia) {
        setError({
          kind: 'camera',
          message: window.isSecureContext
            ? 'This browser does not support camera access.'
            : 'The camera only works over HTTPS (or localhost). Open RISE from an https:// address.',
        });
        setPhaseBoth('error');
        return;
      }

      // Camera and model load in parallel so the preview appears immediately.
      const modelP = loadDetector();
      modelP.catch(() => undefined);
      const ok = await startCamera();
      if (cancelled) {
        stopCamera();
        return;
      }
      if (!ok) {
        setPhaseBoth('error'); // camera error is exposed via camera.error
        return;
      }
      setCameraReady(true);
      setPhaseBoth('loading-model');

      let model;
      try {
        model = await modelP;
      } catch (e) {
        if (cancelled) return;
        stopCamera();
        patchDbg({ model: 'failed', lastError: e instanceof Error ? e.message : String(e) });
        setError({ kind: 'model', message: e instanceof DetectorError ? e.message : 'The scanner model failed to load.' });
        setPhaseBoth('error');
        return;
      }
      if (cancelled) return;
      patchDbg({ model: 'loaded', backend: model.tier()?.backend ?? '—', tierId: model.tier()?.id ?? 'none' });
      setPhaseBoth('searching');

      const loop = async () => {
        if (cancelled) return;
        const video = videoRef.current;
        // Only infer from a video that is actually producing frames.
        if (!busy && !document.hidden && video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
          busy = true;
          const t0 = performance.now();
          try {
            if (debugRef.current) patchDbg({ inference: 'running' });
            const dets = await model.detect(video, 20, DEBUG_MIN_SCORE);
            if (cancelled) return;
            const ms = Math.round(performance.now() - t0);
            // A fallback just engaged? Reset the partially built verification streak.
            const tierId = model.tier()?.id ?? '';
            if (tierId !== activeTierId) {
              activeTierId = tierId;
              tracker.reset();
              setHits(0);
            }
            const r = tracker.update(dets);
            setConfidence((prev) => (Math.abs(prev - r.best) > 0.02 ? r.best : prev));
            const top = dets.reduce<(typeof dets)[number] | null>((a, d) => (!a || d.score > a.score ? d : a), null);
            const label = top && top.score >= 0.3 ? `${top.class} ${Math.round(top.score * 100)}%` : '';
            setSeen((prev) => (prev === label ? prev : label));
            if (debugRef.current) {
              patchDbg({
                inference: 'waiting',
                lastInferenceAt: Date.now(),
                lastMs: ms,
                lastError: null,
                resolution: `${video.videoWidth}×${video.videoHeight}`,
                videoW: video.videoWidth,
                videoH: video.videoHeight,
                avgMs: model.latency().avgMs,
                fps: model.latency().fps,
                fallbackReason: model.diagnosis() ? `${model.diagnosis()!.kind}: ${model.diagnosis()!.detail}` : null,
                recentErrors: [...model.recentErrors()],
                detections: [...dets]
                  .sort((a, b) => b.score - a.score)
                  .map((d) => ({ label: d.class, score: d.score, x: d.bbox[0], y: d.bbox[1], w: d.bbox[2], h: d.bbox[3] })),
              });
            }
            if (r.confirmed) {
              cancelled = true;
              stopCamera();
              setHits(CONFIRMATION_FRAMES);
              setPhaseBoth('confirmed');
              confirmedCb.current();
              return;
            }
            setHits(Math.min(CONFIRMATION_FRAMES, r.streak));
            const next: ScanPhase = r.streak > 0 ? 'confirming' : 'searching';
            if (phaseRef.current !== next) setPhaseBoth(next);
          } catch (e) {
            console.error('[detector] inference failed', e);
            patchDbg({ inference: 'failed', lastError: e instanceof Error ? e.message : String(e) });
            // Total failure: every backend exhausted. Only now surface a hard error — the alarm
            // keeps ringing and the user still gets the authorized emergency-math fallback.
            if (e instanceof DetectorError && e.kind === 'exhausted') {
              setError({ kind: 'model', message: e.message });
              setPhaseBoth('error');
              // Automatic recovery: once failed tiers leave cooldown, restart the scan pass
              // without user interaction (bounded to one attempt per interval, no infinite loop).
              const recoverAt = model.nextRecoverAt() ?? Date.now() + 30_000;
              const delay = Math.max(1000, recoverAt - Date.now());
              if (timer) clearTimeout(timer);
              timer = window.setTimeout(() => {
                if (!cancelled) setAttempt((a) => a + 1);
              }, delay);
              return;
            }
          } finally {
            busy = false;
          }
        }
        if (!cancelled) timer = window.setTimeout(loop, INFERENCE_INTERVAL_MS);
      };
      void loop();
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      stopCamera();
    };
  }, [target, threshold, attempt, startCamera, stopCamera, videoRef]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  const effectiveError: ScanError | null =
    phase === 'error' ? error ?? (camera.error ? { kind: 'camera', message: camera.error.message } : null) : null;

  return {
    videoRef, phase, hits, confidence, cameraReady, seen, debugInfo: dbg,
    cameraStatus: camera.status, error: effectiveError, cameraErrorKind: camera.error?.kind ?? null, retry,
  };
}
