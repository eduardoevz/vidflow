import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-accent text-white shadow-sm hover:bg-accent-hover',
  secondary: 'border border-border/80 bg-surface-sunken/80 text-content hover:bg-border/60',
  ghost: 'bg-transparent text-content-muted hover:bg-surface-sunken hover:text-content',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700',
};

export function Button({ variant = 'primary', className, ...props }: ButtonProps): JSX.Element {
  return (
    <button
      className={[
        'focus-ring inline-flex items-center justify-center gap-2 rounded-card px-3.5 py-2 text-sm font-medium transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100',
        VARIANT_CLASSES[variant],
        className ?? '',
      ].join(' ')}
      {...props}
    />
  );
}
