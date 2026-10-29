import { Brain, ScanLine } from 'lucide-react';
import { objectLabel } from '../../constants';
import type { ChallengeConfig } from '../../types';

export function ChallengeChips({ challenges }: { challenges: ChallengeConfig[] }) {
  const active = challenges.filter((c) => c.enabled);
  if (!active.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {active.map((c) => (
        <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1.5 text-[13px] font-semibold text-accent">
          {c.type === 'math' ? <Brain size={14} /> : <ScanLine size={14} />}
          {c.type === 'math' ? `Math ×${c.config.questionCount}` : `Scan ${objectLabel(c.config.targetClass).toLowerCase()}`}
        </span>
      ))}
    </div>
  );
}

export function missionSummary(challenges: ChallengeConfig[]): string {
  const active = challenges.filter((c) => c.enabled);
  if (!active.length) return 'No missions — a normal alarm.';
  return active
    .map((c) =>
      c.type === 'math'
        ? `${c.config.questionCount} ${c.config.difficulty} math ${c.config.questionCount === 1 ? 'problem' : 'problems'}`
        : `Scan a ${objectLabel(c.config.targetClass).toLowerCase()}`,
    )
    .join(' → ');
}
