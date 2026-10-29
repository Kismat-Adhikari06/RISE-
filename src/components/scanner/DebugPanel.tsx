import { useEffect, useState } from 'react';
import type { DebugInfo } from '../../hooks/useObjectDetection';
import { normalizeClass } from '../../utils/detectionTracker';

const row = (k: string, v: string, bad = false) => (
  <div className="flex justify-between gap-3">
    <span className="text-white/50">{k}</span>
    <span className={`text-right font-semibold ${bad ? 'text-danger' : ''}`}>{v}</span>
  </div>
);

interface Props {
  info: DebugInfo;
  cameraStatus: string;
  target: string;
  accept: number;
  onSwitchBackend: () => void;
}

export function DebugPanel({ info, cameraStatus, target, accept, onSwitchBackend }: Props) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 500); // keep "last inference" age fresh
    return () => clearInterval(id);
  }, []);
  const age = info.lastInferenceAt ? `${((Date.now() - info.lastInferenceAt) / 1000).toFixed(1)}s ago` : 'never';
  const stalled = info.model === 'loaded' && (!info.lastInferenceAt || Date.now() - info.lastInferenceAt > 5000);
  return (
    <div className="pointer-events-auto max-h-[42vh] overflow-y-auto rounded-2xl bg-black/80 p-3 font-mono text-[11px] leading-[1.5] backdrop-blur">
      {row('MODEL', info.model === 'loaded' ? `${info.tierId}` : info.model, info.model === 'failed')}
      {row('BACKEND', info.backend)}
      {row('AVG/FPS', `${info.avgMs}ms · ${info.fps} fps`)}
      {row('CAMERA', cameraStatus, cameraStatus === 'error')}
      {row('VIDEO', info.resolution)}
      {row('INFERENCE', `${info.inference}${info.lastMs !== null ? ` · ${info.lastMs}ms` : ''}`, info.inference === 'failed' || stalled)}
      {row('LAST', age, stalled)}
      {info.fallbackReason && <p className="mt-1 text-yellow-300">fallback: {info.fallbackReason}</p>}
      {info.recentErrors.length > 0 && info.recentErrors.slice(-2).map((msg, i) => <p key={i} className="text-danger">{msg}</p>)}
      {info.lastError && <p className="mt-1 text-danger">{info.lastError}</p>}
      <p className="mt-2 text-white/50">TOP 5 (accept “{target}” ≥ {Math.round(accept * 100)}%)</p>
      {info.detections.length === 0 && <p className="text-white/40">nothing detected</p>}
      {info.detections.slice(0, 5).map((d, i) => {
        const match = normalizeClass(d.label) === normalizeClass(target);
        return (
          <div key={i} className={`flex justify-between ${match ? (d.score >= accept ? 'text-accent' : 'text-yellow-300') : ''}`}>
            <span>{d.label}</span>
            <span>{Math.round(d.score * 100)}%</span>
          </div>
        );
      })}
      <button type="button" onClick={onSwitchBackend} className="mt-2 min-h-[36px] w-full rounded-lg bg-white/10 px-2 font-semibold">
        Switch to {info.backend === 'webgpu' ? 'WASM (slower fallback)' : 'WebGPU'} & reload
      </button>
    </div>
  );
}

/** Boxes positioned for a video drawn with object-fit: cover inside `box` (handles crop + scale). */
export function DebugBoxes({ info, box, target }: { info: DebugInfo; box: { w: number; h: number }; target: string }) {
  if (!info.videoW || !box.w) return null;
  const scale = Math.max(box.w / info.videoW, box.h / info.videoH);
  const offX = (box.w - info.videoW * scale) / 2;
  const offY = (box.h - info.videoH * scale) / 2;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {info.detections.slice(0, 8).map((d, i) => {
        const match = normalizeClass(d.label) === normalizeClass(target);
        return (
          <div
            key={i}
            className={`absolute border-2 ${match ? 'border-accent' : 'border-white/50'}`}
            style={{ left: offX + d.x * scale, top: offY + d.y * scale, width: d.w * scale, height: d.h * scale }}
          >
            <span className={`absolute -top-5 left-0 whitespace-nowrap rounded px-1 text-[10px] font-bold ${match ? 'bg-accent text-black' : 'bg-black/70 text-white'}`}>
              {d.label} {Math.round(d.score * 100)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
