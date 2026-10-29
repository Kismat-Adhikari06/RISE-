import { useEffect, useRef } from 'react';

const ITEM_H = 56;
const VISIBLE = 5;

interface Props {
  items: { label: string; value: number }[];
  value: number;
  onChange: (v: number) => void;
  label: string;
  width?: string;
  small?: boolean;
}

/** Scroll-snap wheel. Accessible as a spinbutton (arrow keys, Home/End, tap on a row). */
export function WheelColumn({ items, value, onChange, label, width = 'w-24', small }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const settle = useRef<number | undefined>(undefined);
  const idx = Math.max(0, items.findIndex((i) => i.value === value));
  const lastEmitted = useRef(idx);

  // Sync scroll position when the value changes from outside (or on mount).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    lastEmitted.current = idx;
    if (Math.abs(el.scrollTop - idx * ITEM_H) > 2) el.scrollTo({ top: idx * ITEM_H, behavior: 'auto' });
  }, [idx]);

  const onScroll = () => {
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const i = Math.min(items.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM_H)));
      if (i !== lastEmitted.current) {
        lastEmitted.current = i;
        onChange(items[i].value);
        if (typeof navigator.vibrate === 'function') navigator.vibrate(4);
      }
    }, 90);
  };
  useEffect(() => () => window.clearTimeout(settle.current), []);

  const goto = (i: number) => {
    const c = Math.min(items.length - 1, Math.max(0, i));
    ref.current?.scrollTo({ top: c * ITEM_H, behavior: 'smooth' });
    lastEmitted.current = c;
    onChange(items[c].value);
  };

  return (
    <div
      ref={ref}
      role="spinbutton"
      tabIndex={0}
      aria-label={label}
      aria-valuenow={value}
      aria-valuetext={items[idx]?.label}
      onScroll={onScroll}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp') { e.preventDefault(); goto(idx - 1); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); goto(idx + 1); }
        else if (e.key === 'Home') { e.preventDefault(); goto(0); }
        else if (e.key === 'End') { e.preventDefault(); goto(items.length - 1); }
      }}
      className={`no-scrollbar relative snap-y snap-mandatory overflow-y-scroll overscroll-contain ${width}`}
      style={{ height: ITEM_H * VISIBLE, scrollSnapType: 'y mandatory' }}
    >
      <div style={{ height: ITEM_H * 2 }} />
      {items.map((it, i) => {
        const d = Math.abs(i - idx);
        return (
          <div
            key={it.value}
            onClick={() => goto(i)}
            aria-hidden
            className={`tnum flex snap-center items-center justify-center font-bold transition-all duration-150 ${
              small
                ? d === 0 ? 'text-[28px] text-accent' : 'text-[20px] text-muted/50'
                : d === 0 ? 'text-[44px] text-fg' : d === 1 ? 'text-[30px] text-muted/70' : 'text-[24px] text-muted/30'
            }`}
            style={{ height: ITEM_H }}
          >
            {it.label}
          </div>
        );
      })}
      <div style={{ height: ITEM_H * 2 }} />
    </div>
  );
}
