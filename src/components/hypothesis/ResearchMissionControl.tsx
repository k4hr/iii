import type {ReactNode} from 'react';
import type {ResearchTaskPriority, ResearchTaskStatus, ResearchTaskType} from '@prisma/client';
import {GlassPanel} from '@/components/ui/GlassPanel';
import {GlowButton} from '@/components/ui/GlowButton';

export type ResearchMissionControlTask = {
  id: string;
  action?: ReactNode;
  actionLabel: string;
  description: string;
  href: string;
  priority: ResearchTaskPriority;
  status: ResearchTaskStatus;
  targetSection: string;
  title: string;
  type: ResearchTaskType;
};

type MissionStep = {
  key: string;
  label: string;
  status: ResearchTaskStatus;
};

const statusStyles: Record<ResearchTaskStatus, string> = {
  TODO: 'border-cyan-200/15 bg-cyan-300/[0.025] text-cyan-100/65',
  IN_PROGRESS: 'border-amber-200/20 bg-amber-300/[0.035] text-amber-100/75',
  DONE: 'border-emerald-200/15 bg-emerald-300/[0.03] text-emerald-100/75',
  SKIPPED: 'border-slate-200/10 bg-white/[0.025] text-slate-100/45',
};

const priorityStyles: Record<ResearchTaskPriority, string> = {
  LOW: 'text-cyan-100/35',
  MEDIUM: 'text-cyan-100/55',
  HIGH: 'text-amber-100/75',
  CRITICAL: 'text-rose-100/80',
};

export function ResearchMissionControl({
  completedCount,
  criticalTodoCount,
  currentTask,
  labels,
  nextTasks,
  progress,
  syncAction,
  totalCount,
}: {
  completedCount: number;
  criticalTodoCount: number;
  currentTask?: ResearchMissionControlTask;
  labels: {
    completed: string;
    criticalTask: string;
    currentObjective: string;
    done: string;
    inProgress: string;
    mission: string;
    nextSteps: string;
    openTask: string;
    pending: string;
    syncMission: string;
  };
  nextTasks: ResearchMissionControlTask[];
  progress: MissionStep[];
  syncAction: ReactNode;
  totalCount: number;
}) {
  return (
    <section className="relative overflow-hidden rounded-[1.6rem] border border-cyan-100/[0.1] bg-[linear-gradient(135deg,rgba(3,18,22,.94),rgba(0,0,0,.58))] p-5 shadow-[0_0_80px_rgba(20,184,166,.055)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(34,211,238,.14),transparent_38%)]" />
      <div className="relative">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <div className="section-kicker">{labels.mission}</div>
            <h2 className="mt-3 text-xl font-semibold tracking-[-.03em] text-cyan-50">{labels.currentObjective}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-xl border border-emerald-200/15 bg-emerald-300/[0.03] px-3 py-2 font-mono text-[9px] tracking-[.1em] text-emerald-100/70 uppercase">
              {labels.completed}: {completedCount}/{totalCount}
            </div>
            {criticalTodoCount > 0 && (
              <div className="rounded-xl border border-rose-200/25 bg-rose-300/[0.055] px-3 py-2 font-mono text-[9px] tracking-[.1em] text-rose-100/80 uppercase">
                {labels.criticalTask}: {criticalTodoCount}
              </div>
            )}
            {syncAction}
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <GlassPanel className="p-5">
            {currentTask ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2.5 py-1 font-mono text-[9px] tracking-[.08em] uppercase ${statusStyles[currentTask.status]}`}>
                    {statusLabel(currentTask.status, labels)}
                  </span>
                  <span className={`font-mono text-[9px] tracking-[.12em] uppercase ${priorityStyles[currentTask.priority]}`}>
                    {currentTask.priority}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-cyan-50">{currentTask.title}</h3>
                <p className="mt-2 max-w-3xl text-xs leading-6 text-[#8aa5a8]">{currentTask.description}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {currentTask.action || <GlowButton href={currentTask.href} variant="secondary">{currentTask.actionLabel || labels.openTask}</GlowButton>}
                  <GlowButton href={currentTask.href} variant="quiet">{labels.openTask}</GlowButton>
                </div>
              </>
            ) : (
              <p className="text-sm text-cyan-50/60">{labels.done}</p>
            )}
          </GlassPanel>

          <GlassPanel className="p-5">
            <div className="section-kicker">{labels.nextSteps}</div>
            <div className="mt-4 space-y-3">
              {nextTasks.length ? nextTasks.map(task => (
                <div className="rounded-xl border border-cyan-100/[0.07] bg-black/25 p-3" key={task.id}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-cyan-50">{task.title}</span>
                    <span className={`font-mono text-[8px] tracking-[.1em] uppercase ${priorityStyles[task.priority]}`}>{task.priority}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-cyan-50/45">{task.description}</p>
                </div>
              )) : <p className="text-xs text-cyan-50/45">{labels.done}</p>}
            </div>
          </GlassPanel>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          {progress.map(step => (
            <div className={`rounded-xl border px-3 py-2 ${statusStyles[step.status]}`} key={step.key}>
              <div className="font-mono text-[8px] tracking-[.12em] uppercase">{statusLabel(step.status, labels)}</div>
              <div className="mt-1 text-xs font-medium">{step.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function statusLabel(status: ResearchTaskStatus, labels: {done: string; inProgress: string; pending: string}) {
  if (status === 'DONE') return labels.done;
  if (status === 'IN_PROGRESS') return labels.inProgress;
  return labels.pending;
}
