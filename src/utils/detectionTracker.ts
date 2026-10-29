/** Compares class names case/whitespace-insensitively. */
export const normalizeClass = (v: unknown): string => String(v).trim().toLowerCase();

export interface Detection {
  class: string;
  score: number;
}

/**
 * Confirms when the target class cleared the threshold in `required` of the last `window` inference passes.
 * Other classes never count, so a bottle can't pass for a cup; the window tolerates frame-to-frame flicker.
 */
export class ConfirmationTracker {
  private recent: boolean[] = [];
  constructor(
    private readonly target: string,
    private readonly threshold: number,
    private readonly required: number,
    private readonly window = required,
  ) {}

  update(detections: Detection[]): { streak: number; confirmed: boolean; best: number } {
    let best = 0;
    const target = normalizeClass(this.target);
    for (const d of detections) if (normalizeClass(d.class) === target && d.score > best) best = d.score;
    this.recent.push(best >= this.threshold);
    if (this.recent.length > this.window) this.recent.shift();
    const streak = this.recent.filter(Boolean).length;
    return { streak, confirmed: streak >= this.required, best };
  }
  reset(): void {
    this.recent = [];
  }
}
