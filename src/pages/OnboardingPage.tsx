import { Camera, Check, ShieldCheck, Volume2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../components/ui/Button';
import { audioEngine } from '../services/audioEngine';
import { loadDetector } from '../services/objectDetection';

const KEY = 'rise.onboarded';
export const needsOnboarding = (): boolean => {
  try {
    return localStorage.getItem(KEY) !== '1';
  } catch {
    return false;
  }
};

type State = 'idle' | 'asking' | 'granted' | 'denied' | 'unavailable';

/** First-run screen: asks for the camera right away (from a tap, so browsers show the prompt) and arms sound. */
export function OnboardingPage({ onDone }: { onDone: () => void }) {
  const [state, setState] = useState<State>('idle');

  const finish = () => {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* private mode */
    }
    onDone();
  };

  const allow = async () => {
    void audioEngine.unlock();
    if (!navigator.mediaDevices?.getUserMedia) return setState('unavailable');
    setState('asking');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      stream.getTracks().forEach((t) => t.stop()); // permission is remembered; camera is released immediately
      setState('granted');
      void loadDetector().catch(() => undefined); // warm up + cache the AI model in the background
      setTimeout(finish, 900);
    } catch (e) {
      setState(e instanceof DOMException && e.name === 'NotFoundError' ? 'unavailable' : 'denied');
    }
  };

  return (
    <div className="flex h-full flex-col bg-bg px-6 pb-safe pt-safe">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-accent/10 text-accent shadow-glow">
          {state === 'granted' ? <Check size={46} strokeWidth={3} /> : <Camera size={44} />}
        </div>
        <h1 className="mt-8 text-[32px] font-extrabold leading-tight tracking-tight">Welcome to RISE.</h1>
        <p className="mt-3 max-w-[320px] text-[16px] leading-relaxed text-muted">
          Object-scan missions need your camera. Allow it now so your alarm never gets stuck on a permission prompt at 5 AM.
        </p>
        <div className="mt-8 w-full max-w-[340px] space-y-3 text-left text-[14px] text-muted">
          <p className="flex gap-3"><ShieldCheck size={20} className="shrink-0 text-accent" /> Scanning runs on your device. Nothing is recorded or uploaded.</p>
          <p className="flex gap-3"><Volume2 size={20} className="shrink-0 text-accent" /> This tap also unlocks alarm sound for this session.</p>
        </div>
        {state === 'denied' && (
          <p className="mt-6 max-w-[320px] rounded-2xl border border-danger/30 bg-danger/10 p-4 text-[14px] text-danger" role="alert">
            Camera is blocked. Tap the lock icon in the address bar → Permissions → Camera → Allow, then try again.
          </p>
        )}
        {state === 'unavailable' && (
          <p className="mt-6 max-w-[320px] rounded-2xl border border-danger/30 bg-danger/10 p-4 text-[14px] text-danger" role="alert">
            No camera available here (the camera needs HTTPS). You can still use math missions.
          </p>
        )}
      </div>
      <div className="mx-auto flex w-full max-w-[420px] flex-col gap-2 pb-2">
        <Button size="lg" full disabled={state === 'asking' || state === 'granted'} onClick={() => void allow()}>
          {state === 'asking' ? 'Waiting for permission…' : state === 'denied' ? 'Try again' : 'Allow camera & continue'}
        </Button>
        <Button variant="ghost" full onClick={finish}>Skip for now</Button>
      </div>
    </div>
  );
}
