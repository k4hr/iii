import Link from 'next/link';
import type {ButtonHTMLAttributes, ReactNode} from 'react';

type GlowButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  href?: string;
  variant?: 'primary' | 'secondary' | 'quiet';
};

export function GlowButton({children, href, variant = 'primary', className = '', ...props}: GlowButtonProps) {
  const classes = `glow-button glow-button--${variant} ${className}`;

  if (href) {
    return <Link className={classes} href={href}>{children}</Link>;
  }

  return <button className={classes} {...props}>{children}</button>;
}
