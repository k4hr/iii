'use client';

import {useFormStatus} from 'react-dom';

export function RegenerateEngineeringModelButton({idleLabel, pendingLabel}: {idleLabel: string; pendingLabel: string}) {
  const {pending} = useFormStatus();
  return (
    <button
      className="glow-button glow-button--secondary disabled:cursor-wait disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
