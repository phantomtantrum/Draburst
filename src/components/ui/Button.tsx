import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const base =
  'label inline-flex items-center justify-center gap-2 border select-none whitespace-nowrap ' +
  'transition-[background-color,color,border-color] duration-[var(--dur-micro)] ease-[var(--ease-mech)] ' +
  'disabled:opacity-40 disabled:pointer-events-none';

const variants: Record<Variant, string> = {
  primary: 'bg-fg text-bg border-fg hover:bg-bg hover:text-fg',
  secondary: 'bg-transparent text-fg border-rule-strong hover:border-fg',
  ghost: 'bg-transparent text-muted border-transparent hover:text-fg',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 max-md:min-h-11',
  md: 'h-10 px-4 max-md:min-h-11',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className, type = 'button', ...rest },
  ref,
) {
  return <button ref={ref} type={type} className={cn(base, variants[variant], sizes[size], className)} {...rest} />;
});

/** Square icon-only button — aria-label is mandatory. */
export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-8 items-center justify-center border border-transparent text-muted max-md:size-11',
        'transition-colors duration-[var(--dur-micro)] hover:border-rule-strong hover:text-fg',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
