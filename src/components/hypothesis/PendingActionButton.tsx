'use client';

import {useFormStatus} from 'react-dom';

export function PendingActionButton({
  className = 'glow-button glow-button--secondary',
  idleLabel,
  pendingLabel,
}: {
  className?: string;
  idleLabel: string;
  pendingLabel: string;
}) {
  const {pending} = useFormStatus();
  return (
    <button className={`${className} disabled:cursor-wait disabled:opacity-60`} disabled={pending} type="submit">
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
