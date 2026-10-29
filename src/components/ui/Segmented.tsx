interface Props<T extends string | number> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}

export function Segmented<T extends string | number>({ value, options, onChange, label }: Props<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-2xl bg-bg p-1 hairline">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`min-h-[44px] flex-1 rounded-xl px-2 text-[14px] font-semibold transition-all ${
              on ? 'bg-accent text-black shadow-sm' : 'text-muted active:text-fg'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
