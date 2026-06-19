import type {ReactNode} from 'react';
import {GlassPanel} from '@/components/ui/GlassPanel';

export function HypothesisQuickActions({actions, title}: {actions: ReactNode; title: string}) {
  return (
    <GlassPanel className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="section-kicker">{title}</div>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </GlassPanel>
  );
}
