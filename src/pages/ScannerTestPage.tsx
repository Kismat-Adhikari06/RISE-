import { CheckCircle2, RefreshCw, ScanLine, XCircle } from 'lucide-react';
import { useState } from 'react';
import { ObjectScanner, type ScanFailure } from '../components/scanner/ObjectScanner';
import { Button } from '../components/ui/Button';
import { ObjectIcon } from '../components/ui/ObjectIcon';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { OBJECT_OPTIONS, objectLabel } from '../constants';
import { useUIStore } from '../stores/uiStore';
import type { ObjectScanConfig } from '../types';

const TEST_TIMEOUT_MS = 20_000;

type Step = { name: 'pick' } | { name: 'scan'; run: number } | { name: 'pass' } | { name: 'fail'; failure: ScanFailure };

/** Standalone camera check: pick an object, scan, get a clear detected / failed result. Touches no alarm or session state. */
export function ScannerTestPage({ config }: { config: ObjectScanConfig }) {
  const close = useUIStore((s) => s.close);
  const [target, setTarget] = useState(config.targetClass);
  const [step, setStep] = useState<Step>({ name: 'pick' });
  const label = objectLabel(target);
  const start = () => setStep((s) => ({ name: 'scan', run: s.name === 'scan' ? s.run + 1 : 1 }));

  if (step.name === 'scan') {
    return (
      <div className="h-full">
        <ObjectScanner
          key={step.run}
          testMode
          target={target}
          threshold={config.confidenceThreshold}
          kicker="CAMERA TEST"
          timeoutMs={TEST_TIMEOUT_MS}
          onClose={() => setStep({ name: 'pick' })}
          onConfirmed={() => setStep({ name: 'pass' })}
          onFailed={(failure) => setStep({ name: 'fail', failure })}
        />
      </div>
    );
  }

  if (step.name === 'pass' || step.name === 'fail') {
    const ok = step.name === 'pass';
    const failure = step.name === 'fail' ? step.failure : null;
    const title = ok ? 'Detected' : failure?.reason === 'timeout' ? 'Not detected' : failure?.reason === 'camera' ? 'Camera failed' : 'Scanner failed';
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center pt-safe pb-safe">
        {ok ? <CheckCircle2 size={96} className="text-accent" /> : <XCircle size={96} className="text-danger" />}
        <h1 className="mt-5 text-[34px] font-extrabold">{title}</h1>
        <p className="mt-2 max-w-[320px] text-[15px] text-white/70">
          {ok ? `Your camera and the AI recognised a ${label.toLowerCase()}. Scanning works.` : failure?.message}
        </p>
        {failure?.seen && <p className="mt-2 text-[13px] text-white/50">It saw: {failure.seen}</p>}
        {failure?.reason === 'timeout' && <p className="mt-2 max-w-[320px] text-[13px] text-white/50">The camera works, but try better light, move closer, or use the bug icon during a scan to see live predictions.</p>}
        <div className="mt-8 flex w-full max-w-[320px] flex-col gap-2">
          <Button full icon={<RefreshCw size={18} />} onClick={start}>Scan again</Button>
          <Button variant="secondary" full onClick={() => setStep({ name: 'pick' })}>Pick another object</Button>
          <Button variant="ghost" full onClick={close}>Done</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <ScreenHeader title="Test camera" onBack={close} />
      <div className="px-5 pb-10 pt-3">
        <p className="text-[16px] font-semibold">Choose an object to scan</p>
        <p className="mb-4 mt-0.5 text-[13px] text-muted">Hold it up to the camera. You’ll get a clear Detected or Not detected result. No alarm is set.</p>
        <div className="grid grid-cols-3 gap-2">
          {OBJECT_OPTIONS.map((o) => {
            const on = target === o.cocoClass;
            return (
              <button key={o.cocoClass} type="button" aria-pressed={on} onClick={() => setTarget(o.cocoClass)}
                className={`flex min-h-[84px] flex-col items-center justify-center gap-1.5 rounded-2xl px-1 text-[12px] font-semibold transition-all active:scale-95 ${on ? 'bg-accent text-black' : 'bg-elevated text-fg hairline'}`}>
                <ObjectIcon name={o.icon} size={24} />
                {o.label}
              </button>
            );
          })}
        </div>
        <Button full className="mt-5" icon={<ScanLine size={18} />} onClick={start}>Start scan for {label.toLowerCase()}</Button>
        <p className="mt-2 text-[12px] text-muted">Runs on your device. Nothing is recorded or uploaded. Times out after {TEST_TIMEOUT_MS / 1000}s.</p>
      </div>
    </div>
  );
}
