interface Props {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}

export function Toggle({ checked, onChange, label }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={`relative h-[32px] w-[54px] shrink-0 rounded-full transition-colors duration-200 ${checked ? 'bg-accent' : 'bg-white/15'}`}
    >
      <span
        className={`absolute top-[3px] h-[26px] w-[26px] rounded-full shadow-md transition-all duration-200 ${
          checked ? 'left-[25px] bg-black' : 'left-[3px] bg-white'
        }`}
      />
    </button>
  );
}
