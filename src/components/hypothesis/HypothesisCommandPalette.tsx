'use client';

import {useEffect, useMemo, useState, useTransition} from 'react';
import {useRouter} from 'next/navigation';

type CommandAction = () => Promise<void> | void;

type CommandItem = {
  disabled?: boolean;
  id: string;
  label: string;
  run: () => void;
  tone?: 'info' | 'action';
};

export function HypothesisCommandPalette({
  actions,
  labels,
  links,
}: {
  actions: {
    discoverSources: CommandAction;
    generateExperiment: CommandAction;
    regenerateModel: CommandAction;
    runCalculation: CommandAction;
    startBreakthrough?: CommandAction;
    syncMission: CommandAction;
  };
  labels: {
    commandPalette: string;
    copied: string;
    copyLink: string;
    discoverSources: string;
    generateExperiment: string;
    openCalculations: string;
    openCurrentObjective: string;
    openEngineeringModel: string;
    openLabLog: string;
    pending: string;
    pressShortcut: string;
    regenerateModel: string;
    runCalculation: string;
    searchPlaceholder: string;
    startBreakthrough: string;
    syncMission: string;
  };
  links: {
    calculations: string;
    currentObjective: string;
    engineering: string;
    labLog: string;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const shortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
      if (!shortcut) return;
      event.preventDefault();
      setOpen(value => !value);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const runServerAction = (id: string, action: CommandAction) => {
    setPendingId(id);
    startTransition(async () => {
      try {
        await action();
        setOpen(false);
      } finally {
        setPendingId(null);
      }
    });
  };

  const openSection = (href: string) => {
    router.push(href);
    setOpen(false);
  };

  const copyLink = async () => {
    const url = window.location.href;
    await navigator.clipboard?.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const commands = useMemo<CommandItem[]>(() => [
    {id: 'open-current-objective', label: labels.openCurrentObjective, run: () => openSection(links.currentObjective)},
    {id: 'open-engineering', label: labels.openEngineeringModel, run: () => openSection(links.engineering)},
    {id: 'open-calculations', label: labels.openCalculations, run: () => openSection(links.calculations)},
    {id: 'run-calculation', label: labels.runCalculation, tone: 'action', run: () => runServerAction('run-calculation', actions.runCalculation)},
    {id: 'discover-sources', label: labels.discoverSources, tone: 'action', run: () => runServerAction('discover-sources', actions.discoverSources)},
    {id: 'generate-experiment', label: labels.generateExperiment, tone: 'action', run: () => runServerAction('generate-experiment', actions.generateExperiment)},
    {
      id: 'start-breakthrough',
      label: labels.startBreakthrough,
      tone: 'action',
      disabled: !actions.startBreakthrough,
      run: () => actions.startBreakthrough && runServerAction('start-breakthrough', actions.startBreakthrough),
    },
    {id: 'regenerate-model', label: labels.regenerateModel, tone: 'action', run: () => runServerAction('regenerate-model', actions.regenerateModel)},
    {id: 'sync-mission', label: labels.syncMission, tone: 'action', run: () => runServerAction('sync-mission', actions.syncMission)},
    {id: 'open-lab-log', label: labels.openLabLog, run: () => openSection(links.labLog)},
    {id: 'copy-link', label: copied ? labels.copied : labels.copyLink, run: () => void copyLink()},
  ], [actions, copied, labels, links]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredCommands = normalizedQuery
    ? commands.filter(command => command.label.toLowerCase().includes(normalizedQuery))
    : commands;

  return (
    <>
      <button
        className="rounded-xl border border-cyan-100/[0.1] bg-black/35 px-3 py-2 font-mono text-[9px] tracking-[.1em] text-cyan-100/55 uppercase transition hover:border-cyan-100/25 hover:text-cyan-50"
        onClick={() => setOpen(true)}
        type="button"
      >
        {labels.pressShortcut}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-start bg-black/70 px-4 pt-24 backdrop-blur-sm sm:place-items-center sm:pt-0" role="dialog" aria-modal="true">
          <div className="w-full max-w-2xl overflow-hidden rounded-[1.5rem] border border-cyan-100/[0.14] bg-[#020708] shadow-[0_0_90px_rgba(34,211,238,.13)]">
            <div className="border-b border-cyan-100/[0.08] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="section-kicker">{labels.commandPalette}</div>
                <button className="font-mono text-[10px] text-cyan-100/40 hover:text-cyan-50" onClick={() => setOpen(false)} type="button">ESC</button>
              </div>
              <input
                autoFocus
                className="w-full rounded-2xl border border-cyan-100/[0.1] bg-black/45 px-4 py-3 text-sm text-cyan-50 outline-none placeholder:text-cyan-100/25 focus:border-cyan-200/35"
                onChange={event => setQuery(event.target.value)}
                placeholder={labels.searchPlaceholder}
                value={query}
              />
            </div>
            <div className="max-h-[26rem] overflow-y-auto p-3">
              {filteredCommands.map(command => {
                const pending = isPending && pendingId === command.id;
                return (
                  <button
                    className={`flex w-full items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-left transition ${
                      command.tone === 'action'
                        ? 'border-emerald-200/10 bg-emerald-300/[0.025] hover:border-emerald-100/25'
                        : 'border-cyan-100/[0.07] bg-cyan-300/[0.018] hover:border-cyan-100/22'
                    } disabled:cursor-not-allowed disabled:opacity-40`}
                    disabled={command.disabled || pending}
                    key={command.id}
                    onClick={command.run}
                    type="button"
                  >
                    <span className="text-sm font-medium text-cyan-50">{command.label}</span>
                    {pending && <span className="font-mono text-[9px] tracking-[.1em] text-cyan-100/45 uppercase">{labels.pending}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
