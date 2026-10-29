import { AlertTriangle, Bug, Camera, CheckCircle2, LifeBuoy, Loader2, RefreshCw, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { CONFIRMATION_FRAMES, DEFAULT_CONFIDENCE_THRESHOLD, SCANNER_CLOSER_HINT_AFTER_MS, SCANNER_HELP_AFTER_MS, objectLabel } from '../../constants';
import { useObjectDetection } from '../../hooks/useObjectDetection';
import { audioEngine } from '../../services/audioEngine';
import { setPreferredBackend } from '../../services/objectDetection';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/Dialog';
import { DebugBoxes, DebugPanel } from './DebugPanel';

const DEBUG_KEY = 'rise.scanDebug';
const readDebug = () => {
  try {
    return localStorage.getItem(DEBUG_KEY) === '1';
  } catch {
    return false;
  }
};

interface Props {
  target: string; // COCO class
  threshold: number;
  kicker: string;
  /** Called once, ~1s after the object was confirmed and the camera released. */
  onConfirmed: () => void;
  /** Present only inside a real alarm: unlocks the emergency math fallback. */
  onEmergency?: () => void;
  onClose?: () => void;
  testMode?: boolean;
  /** Test mode only: give up after this long with the camera running and report via onFailed. */
  timeoutMs?: number;
  onFailed?: (f: ScanFailure) => void;
}

export interface ScanFailure {
  reason: 'timeout' | 'camera' | 'model';
  message: string;
  /** Everything the model recognised instead (best confidence per label), for "here's what it saw". */
  seen: string;
}

export function ObjectScanner({ target, threshold, kicker, onConfirmed, onEmergency, onClose, testMode, timeoutMs, onFailed }: Props) {
  const name = objectLabel(target).toLowerCase();
  const firedRef = useRef(false);
  const doneTimer = useRef<number | undefined>(undefined);
  const [showHelp, setShowHelp] = useState(false);
  const [confirmHelp, setConfirmHelp] = useState(false);
  const [debug, setDebug] = useState(readDebug);
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const toggleDebug = () =>
    setDebug((d) => {
      try {
        localStorage.setItem(DEBUG_KEY, d ? '0' : '1');
      } catch {
        /* private mode */
      }
      return !d;
    });

  const { videoRef, phase, hits, confidence, cameraReady, seen, debugInfo, cameraStatus, error, retry, cameraErrorKind } = useObjectDetection({
    target,
    threshold,
    debug,
    onConfirmed: () => {
      if (firedRef.current) return;
      firedRef.current = true;
      audioEngine.cue('success');
      if (typeof navigator.vibrate === 'function') navigator.vibrate([40, 40, 80]);
      doneTimer.current = window.setTimeout(onConfirmed, 1100);
    },
  });

  useEffect(() => () => clearTimeout(doneTimer.current), []);

  // Test mode: report failure instead of scanning forever. The clock starts once the camera is live.
  const seenRef = useRef('');
  if (seen) seenRef.current = seen;
  const failedRef = useRef(false);
  const fail = (f: ScanFailure) => {
    if (failedRef.current || firedRef.current) return;
    failedRef.current = true;
    onFailed?.(f);
  };
  const failRef = useRef(fail);
  failRef.current = fail;
  useEffect(() => {
    if (!onFailed || !timeoutMs || !cameraReady) return;
    const t = window.setTimeout(
      () => failRef.current({ reason: 'timeout', message: `No ${name} detected within ${Math.round(timeoutMs / 1000)} seconds.`, seen: seenRef.current }),
      timeoutMs,
    );
    return () => clearTimeout(t);
  }, [onFailed, timeoutMs, cameraReady, name]);
  useEffect(() => {
    if (onFailed && error) failRef.current({ reason: error.kind, message: error.message, seen: seenRef.current });
  }, [onFailed, error]);
  useEffect(() => {
    if (!onEmergency) return;
    const t = window.setTimeout(() => setShowHelp(true), SCANNER_HELP_AFTER_MS);
    return () => clearTimeout(t);
  }, [onEmergency]);

  const confirmed = phase === 'confirmed';
  // Detections score very low when the object is far/small in frame (a small mug scores ~0.1,
  // the same mug close-up ~0.55), so coach the user toward filling the frame.
  const [showCloserHint, setShowCloserHint] = useState(false);
  useEffect(() => {
    if (confirmed) return;
    const t = window.setTimeout(() => setShowCloserHint(true), SCANNER_CLOSER_HINT_AFTER_MS);
    return () => clearTimeout(t);
  }, [confirmed]);
  const loading = !cameraReady && (phase === 'loading-model' || phase === 'starting-camera');
  const statusText = confirmed
    ? 'Object verified!'
    : phase === 'confirming'
      ? `${objectLabel(target)} found! Hold steady...`
      : phase === 'starting-camera'
        ? 'Starting camera...'
        : phase === 'loading-model'
          ? 'Loading object recognition...'
          : `Looking for a ${name}...`;
  const tipText = confirmed
    ? undefined
    : hits > 0
      ? 'Almost — hold the object steady in frame.'
      : showCloserHint
        ? 'No luck yet. Move closer so the object fills most of the frame.'
        : undefined;
  const progress = hits / CONFIRMATION_FRAMES;

  return (
    <div ref={boxRef} className="relative h-full w-full overflow-hidden bg-black">
      <video ref={videoRef} playsInline muted autoPlay className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${cameraReady && !confirmed ? 'opacity-100' : 'opacity-0'}`} />
      <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/10 to-black/90" />
      {debug && cameraReady && !confirmed && <DebugBoxes info={debugInfo} box={box} target={target} />}

      <div className="relative z-10 flex h-full flex-col px-5 pb-safe pt-safe">
        <div className="flex items-start justify-between pt-4">
          <div>
            <p className="text-[13px] font-medium text-muted">{kicker}</p>
            <h1 className="mt-1 text-[32px] font-extrabold leading-tight">Find a {name}.</h1>
            <p className="mt-1 max-w-[300px] text-[14px] text-white/70">Point your camera at a {name} to prove you’re awake.</p>
          </div>
          <div className="flex shrink-0 gap-2">
          <button type="button" aria-label="Toggle debug panel" aria-pressed={debug} onClick={toggleDebug} className={`flex h-12 w-12 items-center justify-center rounded-full hairline ${debug ? 'bg-accent text-black' : 'bg-black/50'}`}>
            <Bug size={20} />
          </button>
          {onClose && (
            <button type="button" aria-label="Close scanner" onClick={onClose} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-black/50 hairline">
              <X size={22} />
            </button>
          )}
          </div>
        </div>
        {debug && (
          <div className="mt-3">
            <DebugPanel info={debugInfo} cameraStatus={cameraStatus} target={target} accept={Math.min(threshold, DEFAULT_CONFIDENCE_THRESHOLD)}
              onSwitchBackend={() => { setPreferredBackend(debugInfo.backend === 'webgpu' ? 'wasm' : 'webgpu'); retry(); }} />
          </div>
        )}

        {/* Frame */}
        <div className="relative my-5 flex flex-1 items-center justify-center">
          <div className="relative aspect-[3/4] h-full max-h-[420px] max-w-full">
            {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
              <span
                key={c}
                className={`absolute h-12 w-12 border-[4px] transition-colors duration-300 ${confirmed || phase === 'confirming' ? 'border-accent' : 'border-white/80'} ${
                  c === 'tl' ? 'left-0 top-0 rounded-tl-3xl border-b-0 border-r-0' : ''
                } ${c === 'tr' ? 'right-0 top-0 rounded-tr-3xl border-b-0 border-l-0' : ''} ${
                  c === 'bl' ? 'bottom-0 left-0 rounded-bl-3xl border-r-0 border-t-0' : ''
                } ${c === 'br' ? 'bottom-0 right-0 rounded-br-3xl border-l-0 border-t-0' : ''}`}
              />
            ))}
            {cameraReady && !confirmed && (
              <div className="scanline absolute inset-x-3 h-[3px] rounded-full bg-accent" />
            )}
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="animate-spin text-accent" size={44} />
              </div>
            )}
            <AnimatePresence>
              {confirmed && (
                <motion.div initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="absolute inset-0 flex items-center justify-center">
                  <CheckCircle2 size={96} className="text-accent" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Status */}
        {!error && (
          <div className="mb-3 rounded-3xl bg-black/60 p-4 hairline backdrop-blur-xl" aria-live="polite">
            <div className="flex items-center justify-between gap-3">
              <p className={`text-[16px] font-semibold ${phase === 'confirming' || confirmed ? 'text-accent' : ''}`}>{statusText}</p>
              {!confirmed && phase !== 'starting-camera' && phase !== 'loading-model' && <span className="tnum text-[13px] text-white/60">{hits}/{CONFIRMATION_FRAMES}{confidence > 0 ? ` · ${Math.round(confidence * 100)}%` : ''}</span>}
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <motion.div className="h-full rounded-full bg-accent" animate={{ width: `${progress * 100}%` }} transition={{ duration: 0.25 }} />
            </div>
            {tipText && (
              <p className="mt-2 text-[13px] text-white/60" aria-live="off">{tipText}</p>
            )}
            {seen && !confirmed && <p className="mt-2 text-[12px] text-white/60">Seeing: {seen}</p>}
            <p className="mt-2 text-[12px] text-white/50">
              {testMode ? 'Test mode — this does not affect any alarm. ' : ''}AI runs on your device; nothing is recorded or uploaded.
            </p>
          </div>
        )}

        {error && (
          <div className="mb-3 rounded-3xl border border-danger/30 bg-black/80 p-5 backdrop-blur-xl" role="alert">
            <div className="flex items-start gap-3">
              {error.kind === 'camera' ? <Camera className="mt-0.5 shrink-0 text-danger" size={22} /> : <AlertTriangle className="mt-0.5 shrink-0 text-danger" size={22} />}
              <div>
                <p className="font-semibold">{error.kind === 'camera' ? 'Camera problem' : 'Scanner problem'}</p>
                <p className="mt-1 text-[14px] text-white/70">{error.message}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <Button full icon={<RefreshCw size={18} />} onClick={retry}>Try again</Button>
              {onEmergency && (
                <Button variant="secondary" full icon={<LifeBuoy size={18} />} onClick={onEmergency}>
                  Camera won’t work — use emergency math
                </Button>
              )}
            </div>
            {cameraErrorKind === 'denied' && <p className="mt-3 text-[12px] text-white/50">Tip: tap the lock icon in the address bar → Site settings → Camera → Allow.</p>}
          </div>
        )}

        {onEmergency && showHelp && !error && !confirmed && (
          <button type="button" onClick={() => setConfirmHelp(true)} className="mb-2 min-h-[44px] self-center px-4 text-[13px] text-white/50 underline underline-offset-4">
            Having trouble scanning?
          </button>
        )}
      </div>

      <ConfirmDialog
        open={confirmHelp}
        title="Use emergency math instead?"
        confirmLabel="Yes, use math"
        cancelLabel="Keep scanning"
        onCancel={() => setConfirmHelp(false)}
        onConfirm={() => {
          setConfirmHelp(false);
          onEmergency?.();
        }}
      >
        You’ll solve 5 hard math problems instead of scanning. This is recorded as an emergency fallback.
      </ConfirmDialog>
    </div>
  );
}
