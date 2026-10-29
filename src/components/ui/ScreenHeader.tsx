import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

export function ScreenHeader({ title, onBack, right }: { title: string; onBack: () => void; right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between bg-bg/85 px-4 pb-3 pt-safe backdrop-blur-xl">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-card hairline active:scale-95"
      >
        <ArrowLeft size={22} />
      </button>
      <h1 className="text-[17px] font-semibold">{title}</h1>
      <div className="flex h-12 min-w-12 items-center justify-end">{right}</div>
    </header>
  );
}
