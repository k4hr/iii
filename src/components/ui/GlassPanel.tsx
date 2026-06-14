import type {HTMLAttributes, ReactNode} from 'react';

type GlassPanelProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  glow?: boolean;
};

export function GlassPanel({children, className = '', glow = false, ...props}: GlassPanelProps) {
  return (
    <div className={`glass-panel ${glow ? 'glass-panel--glow' : ''} ${className}`} {...props}>
      {children}
    </div>
  );
}
