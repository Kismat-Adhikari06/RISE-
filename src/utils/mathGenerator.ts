import type { MathDifficulty, MathQuestion } from '../types';

export type Rng = () => number;

const int = (rng: Rng, min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;

type Gen = (rng: Rng) => MathQuestion;

const easy: Gen[] = [
  (r) => { const a = int(r, 3, 19), b = int(r, 3, 19); return { text: `${a} + ${b}`, answer: a + b }; },
  (r) => { const a = int(r, 8, 25), b = int(r, 2, a - 1); return { text: `${a} - ${b}`, answer: a - b }; },
  (r) => { const a = int(r, 2, 9), b = int(r, 2, 9); return { text: `${a} × ${b}`, answer: a * b }; },
];

const medium: Gen[] = [
  (r) => { const a = int(r, 12, 89), b = int(r, 12, 89); return { text: `${a} + ${b}`, answer: a + b }; },
  (r) => { const a = int(r, 40, 99), b = int(r, 11, a - 1); return { text: `${a} - ${b}`, answer: a - b }; },
  (r) => { const a = int(r, 11, 19), b = int(r, 3, 9); return { text: `${a} × ${b}`, answer: a * b }; },
  (r) => { const b = int(r, 3, 15), q = int(r, 3, 15); return { text: `${b * q} ÷ ${b}`, answer: q }; },
];

const hard: Gen[] = [
  (r) => { const a = int(r, 12, 29), b = int(r, 3, 9), c = int(r, 5, 60); return { text: `(${a} × ${b}) - ${c}`, answer: a * b - c }; },
  (r) => { const b = int(r, 4, 16), q = int(r, 4, 16), c = int(r, 3, 9); return { text: `(${b * q} ÷ ${b}) × ${c}`, answer: q * c }; },
  (r) => { const a = int(r, 20, 70), b = int(r, 20, 70), c = int(r, 2, 6); return { text: `(${a} + ${b}) × ${c}`, answer: (a + b) * c }; },
  (r) => { const a = int(r, 6, 15), b = int(r, 6, 15), c = int(r, 11, 40); return { text: `(${a} × ${b}) + ${c}`, answer: a * b + c }; },
  // Occasionally produces a negative answer, exercising the ± key.
  (r) => { const a = int(r, 10, 40), b = int(r, 41, 90), c = int(r, 2, 5); return { text: `(${a} - ${b}) × ${c}`, answer: (a - b) * c }; },
];

const pools: Record<MathDifficulty, Gen[]> = { easy, medium, hard };

/** Generates `count` distinct questions (distinct where the pool allows it). */
export function generateQuestions(difficulty: MathDifficulty, count: number, rng: Rng = Math.random): MathQuestion[] {
  const pool = pools[difficulty];
  const seen = new Set<string>();
  const out: MathQuestion[] = [];
  let guard = 0;
  while (out.length < count) {
    const q = pool[int(rng, 0, pool.length - 1)](rng);
    guard++;
    if (seen.has(q.text) && guard < count * 50) continue;
    seen.add(q.text);
    out.push(q);
  }
  return out;
}
