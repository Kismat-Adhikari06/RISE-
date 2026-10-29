import type { ReactNode } from 'react';

export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="mb-7">
      <h2 className="mb-1 px-1 text-[13px] font-medium text-muted">{title}</h2>
      {hint && <p className="mb-3 px-1 text-[13px] text-muted/80">{hint}</p>}
      {!hint && <div className="mb-2" />}
      {children}
    </section>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl bg-card hairline shadow-soft ${className}`}>{children}</div>;
}
