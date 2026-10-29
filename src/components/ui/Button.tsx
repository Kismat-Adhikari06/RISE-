import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'md' | 'lg';
  icon?: ReactNode;
  full?: boolean;
}

const styles: Record<Variant, string> = {
  primary: 'bg-accent text-black active:brightness-90',
  secondary: 'bg-elevated text-fg hairline active:bg-card',
  ghost: 'bg-transparent text-muted active:text-fg',
  danger: 'bg-danger/15 text-danger border border-danger/30 active:bg-danger/25',
};

export function Button({ variant = 'primary', size = 'md', icon, full, className = '', children, ...rest }: Props) {
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition-all duration-150 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none ${
        size === 'lg' ? 'min-h-[58px] px-6 text-[17px]' : 'min-h-[48px] px-5 text-[15px]'
      } ${full ? 'w-full' : ''} ${styles[variant]} ${className}`}
    >
      {icon}
      {children}
    </button>
  );
}
