import { Check, Delete } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { audioEngine } from '../../services/audioEngine';
import type { QuestionRun } from '../../types';

interface Props {
  kicker: string; // e.g. "MISSION 01"
  title: string;
  run: QuestionRun;
  /** Called once per correct answer with the index that was answered. */
  onCorrect: (index: number) => void;
  /** Called once after the final correct answer has been shown. */
  onComplete: () => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '±', '0', '⌫'];
const buzz = (ms: number | number[]) => {
  if (typeof navigator.vibrate === 'function') navigator.vibrate(ms);
};

export function MathChallenge({ kicker, title, run, onCorrect, onComplete }: Props) {
  const total = run.questions.length;
  const done = run.index >= total;
  const q = run.questions[Math.min(run.index, total - 1)];
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState<'idle' | 'wrong' | 'right'>('idle');
  const locked = useRef(false);
  const completed = useRef(false);

  // New question (or restored progress): clear the input.
  useEffect(() => {
    setInput('');
    setFeedback('idle');
    locked.current = false;
  }, [run.index]);

  useEffect(() => {
    if (!done || completed.current) return;
    completed.current = true;
    const t = window.setTimeout(onComplete, 1100);
    return () => {
      clearTimeout(t);
      completed.current = false; // allow StrictMode remount to re-arm the timer
    };
  }, [done, onComplete]);

  const press = (k: string) => {
    if (locked.current || done) return;
    setFeedback('idle');
    if (k === '⌫') return setInput((v) => v.slice(0, -1));
    if (k === '±') return setInput((v) => (v.startsWith('-') ? v.slice(1) : v ? `-${v}` : '-'));
    setInput((v) => (v.replace('-', '').length >= 6 ? v : v === '0' ? k : v + k));
  };

  const submit = () => {
    if (locked.current || done || !/^-?\d+$/.test(input)) return;
    if (Number(input) === q.answer) {
      locked.current = true;
      setFeedback('right');
      buzz(25);
      audioEngine.cue('success');
      const idx = run.index;
      window.setTimeout(() => onCorrect(idx), 520);
    } else {
      setFeedback('wrong');
      buzz([60, 40, 60]);
      audioEngine.cue('error');
      window.setTimeout(() => setInput(''), 380);
    }
  };

  if (done) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-8 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 12 }} className="flex h-28 w-28 items-center justify-center rounded-full bg-accent text-black shadow-glow">
          <Check size={56} strokeWidth={3} />
        </motion.div>
        <p className="mt-6 text-[28px] font-extrabold">Brain online.</p>
        <p className="mt-1 text-muted">Math mission complete.</p>
      </div>
    );
  }

  const ok = feedback === 'right';
  return (
    <div className="flex h-full flex-col px-5 pb-safe pt-safe">
      <div className="pt-4">
        <p className="text-[13px] font-medium text-muted">{kicker}</p>
        <h1 className="mt-1 text-[30px] font-extrabold leading-tight">{title}</h1>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex flex-1 gap-1.5" aria-hidden>
            {run.questions.map((_, i) => (
              <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < run.index ? 'bg-accent' : i === run.index ? 'bg-accent/50' : 'bg-white/10'}`} />
            ))}
          </div>
          <p className="text-[13px] font-semibold text-muted" aria-live="polite">Question {run.index + 1} of {total}</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-center">
        <p className="tnum text-center text-[44px] font-extrabold leading-tight tracking-tight sm:text-[52px]" aria-label={`${q.text} equals what?`}>
          {q.text} = ?
        </p>
        <div
          className={`mx-auto mt-5 flex h-[76px] w-full max-w-[320px] items-center justify-center rounded-3xl border-2 bg-card transition-colors ${
            ok ? 'border-accent bg-accent/15' : feedback === 'wrong' ? 'shake border-danger bg-danger/10' : 'border-white/10'
          }`}
        >
          <span className={`tnum text-[40px] font-bold ${ok ? 'text-accent' : feedback === 'wrong' ? 'text-danger' : ''}`}>
            {input || <span className="text-white/20">—</span>}
          </span>
        </div>
        <p className={`mt-3 h-6 text-center text-[15px] font-semibold ${ok ? 'text-accent' : 'text-danger'}`} role="status">
          {feedback === 'wrong' ? 'Not quite. Try again.' : ok ? 'Correct!' : ''}
        </p>
      </div>

      <div className="mx-auto grid w-full max-w-[360px] grid-cols-3 gap-2.5 pb-3">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            aria-label={k === '⌫' ? 'Backspace' : k === '±' ? 'Toggle negative' : k}
            onClick={() => press(k)}
            className="flex h-[clamp(52px,8.5vh,66px)] items-center justify-center rounded-2xl bg-card text-[26px] font-semibold hairline transition-all active:scale-95 active:bg-elevated"
          >
            {k === '⌫' ? <Delete size={26} /> : k}
          </button>
        ))}
        <button
          type="button"
          onClick={submit}
          disabled={!/^-?\d+$/.test(input)}
          className="col-span-3 flex h-[clamp(54px,8.5vh,66px)] items-center justify-center rounded-2xl bg-accent text-[18px] font-bold text-black shadow-glow transition-all active:scale-[0.98] disabled:opacity-35 disabled:shadow-none"
        >
          Submit
        </button>
      </div>
    </div>
  );
}
