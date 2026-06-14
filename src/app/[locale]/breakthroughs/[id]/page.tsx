import {getTranslations} from 'next-intl/server';
import {prisma} from '@/lib/db/prisma';
import {addIdeaAction, addUserNoteAction} from '@/server/actions/breakthroughs';
import {GlassPanel} from '@/components/ui/GlassPanel';
import {GlowButton} from '@/components/ui/GlowButton';
import {ProgressRing} from '@/components/ui/ProgressRing';
import {StatusBadge} from '@/components/ui/StatusBadge';

export default async function BreakthroughPage({params}: {params: Promise<{locale: string; id: string}>}) {
  const {locale, id} = await params;
  const t = await getTranslations('breakthrough');
  const session = await prisma.breakthroughSession.findUnique({
    where: {id},
    include: {condition: true, hypothesis: true, ideas: {orderBy: {createdAt: 'desc'}, include: {checks: true}}, events: {orderBy: {createdAt: 'desc'}}},
  });

  if (!session) return <div>Not found</div>;

  return (
    <div className="space-y-10 py-3">
      <GlassPanel glow className="data-grid grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2"><StatusBadge value={session.status} /><span className="mono-label">{t('title')}</span></div>
          <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-[-.045em] text-white sm:text-5xl">{session.title}</h1>
          <p className="mt-5 max-w-4xl text-sm leading-7 text-[#91adaf]">{session.problemStatement}</p>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[10px] tracking-[.1em] text-cyan-100/35 uppercase">
            <span>Hypothesis: {session.hypothesis.originalTitle}</span>
            <span>Condition: {session.condition.importance}</span>
            <span>Ideas: {session.ideas.length}</span>
          </div>
        </div>
        <div className="flex justify-center border-cyan-100/[0.08] lg:border-l lg:pl-10">
          <ProgressRing value={session.progressScore} label="Condition progress" size={164} />
        </div>
      </GlassPanel>

      <section>
        <CockpitHeader code="CTX-01" title={t('problem')} status="Context loaded" />
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <DiagnosticPanel title={t('why')} data={session.whyItMatters} />
          <DiagnosticPanel title={t('ifSolved')} data={session.ifSolvedImpact} tone="positive" />
          <DiagnosticPanel title={t('known')} data={session.knownState} />
          <DiagnosticPanel title={t('missing')} data={session.missingPieces} tone="warning" />
          <DiagnosticPanel title={t('paths')} data={session.possiblePaths} tone="positive" />
          <DiagnosticPanel title={t('bestPath')} data={session.currentBestPath} />
        </div>
      </section>

      <GlassPanel glow className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-cyan-100/[0.08] bg-black/35 px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-300/70" />
            <span className="h-2 w-2 rounded-full bg-amber-300/70" />
            <span className="h-2 w-2 rounded-full bg-emerald-300/70" />
          </div>
          <span className="font-mono text-[9px] tracking-[.15em] text-cyan-200/35">THEORY INPUT CONSOLE</span>
        </div>
        <form action={addIdeaAction.bind(null, locale, session.id)} className="p-5 sm:p-7">
          <label className="section-kicker" htmlFor="rawText">{t('yourTheory')}</label>
          <div className="relative mt-5">
            <span className="terminal-text absolute left-4 top-4 text-xs text-cyan-300/45">researcher@theoryforge:~$</span>
            <textarea id="rawText" className="lab-input terminal-text min-h-40 resize-y pt-12 text-sm leading-7" name="rawText" placeholder={t('yourTheoryPlaceholder')} required />
          </div>
          <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <p className="font-mono text-[9px] tracking-[.1em] text-[#527376] uppercase">Input is evaluated against physics, engineering constraints and testability.</p>
            <GlowButton>{t('checkIdea')}</GlowButton>
          </div>
        </form>
      </GlassPanel>

      <section>
        <CockpitHeader code="BRN-02" title={t('ideas')} status={`${session.ideas.length} diagnostic branches`} />
        <div className="mt-5 space-y-4">
          {session.ideas.map((idea, index) => (
            <GlassPanel className="p-5 sm:p-6" key={idea.id}>
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                <div className="flex gap-4">
                  <span className="font-mono text-[10px] tracking-[.14em] text-cyan-200/35">IDEA {String(index + 1).padStart(2, '0')}</span>
                  <div><h3 className="font-semibold text-cyan-50">{idea.title}</h3><p className="mt-2 max-w-4xl text-sm leading-6 text-[#91adaf]">{idea.formalizedText}</p></div>
                </div>
                <div className="flex flex-wrap gap-2"><StatusBadge value={idea.status} /><StatusBadge value={idea.authorType} /></div>
              </div>
              <div className="mt-6 grid gap-3 border-t border-cyan-100/[0.07] pt-5 md:grid-cols-2 xl:grid-cols-4">
                <DiagnosticPanel title={t('impact')} data={idea.impactJson} tone="positive" compact />
                <DiagnosticPanel title={t('newBlockers')} data={idea.newBlockersJson} tone="critical" compact />
                <DiagnosticPanel title="AI diagnostic review" data={idea.reviewJson} compact />
                <DiagnosticPanel title="Calculation checks" data={idea.checks.map(check => check.resultJson)} compact />
              </div>
            </GlassPanel>
          ))}
        </div>
      </section>

      <GlassPanel className="p-5 sm:p-6">
        <CockpitHeader code="LOG-03" title={t('labLog')} status={`${session.events.length} events`} />
        <form action={addUserNoteAction.bind(null, locale, session.id)} className="mt-5 flex flex-col gap-3 sm:flex-row">
          <input className="lab-input" name="note" placeholder="Add research note" />
          <GlowButton variant="secondary">Add note</GlowButton>
        </form>
        <div className="relative mt-6 space-y-3 border-l border-cyan-200/15 pl-6">
          {session.events.map((event, index) => (
            <div className="relative rounded-xl border border-cyan-100/[0.07] bg-black/30 p-4" key={event.id}>
              <span className="absolute -left-[1.72rem] top-5 h-2.5 w-2.5 rounded-full border-2 border-[#071315] bg-cyan-300 shadow-[0_0_10px_#43f1df]" />
              <div className="flex flex-wrap items-center justify-between gap-3"><StatusBadge value={event.type} /><span className="font-mono text-[9px] text-cyan-100/25">EVENT {String(session.events.length - index).padStart(3, '0')}</span></div>
              <div className="terminal-text mt-3 text-xs leading-5 text-[#78999b]">{formatDiagnostic(event.content)}</div>
            </div>
          ))}
        </div>
      </GlassPanel>
    </div>
  );
}

function CockpitHeader({code, title, status}: {code: string; title: string; status: string}) {
  return <div className="flex flex-wrap items-end justify-between gap-4"><div><div className="mono-label">{code}</div><h2 className="section-heading mt-2">{title}</h2></div><span className="font-mono text-[9px] tracking-[.12em] text-cyan-200/35 uppercase">{status}</span></div>;
}

function DiagnosticPanel({title, data, tone = 'neutral', compact = false}: {title: string; data: unknown; tone?: 'neutral' | 'positive' | 'warning' | 'critical'; compact?: boolean}) {
  const tones = {neutral: 'border-cyan-100/[0.08] bg-black/30', positive: 'border-emerald-300/[0.12] bg-emerald-300/[0.025]', warning: 'border-amber-300/[0.12] bg-amber-300/[0.025]', critical: 'border-red-300/[0.12] bg-red-300/[0.025]'};
  return <div className={`rounded-2xl border ${tones[tone]} ${compact ? 'p-4' : 'min-h-40 p-5'}`}><div className="mono-label">{title}</div><div className="terminal-text mt-4 space-y-2 text-[11px] leading-5 text-[#9ab4b6]">{renderDiagnostic(data)}</div></div>;
}

function renderDiagnostic(data: unknown): React.ReactNode {
  if (data === null || data === undefined || data === '') return <span>—</span>;
  if (Array.isArray(data)) return data.length ? <ul className="space-y-2">{data.map((value, index) => <li key={index} className="flex gap-2"><span className="text-cyan-300/40">›</span><span>{formatDiagnostic(value)}</span></li>)}</ul> : <span>—</span>;
  if (typeof data === 'object') {
    const entries = Object.entries(data as Record<string, unknown>);
    return entries.length ? <dl className="space-y-2">{entries.map(([key, value]) => <div key={key} className="border-l border-cyan-200/10 pl-3"><dt className="text-[9px] tracking-[.1em] text-cyan-200/40 uppercase">{key.replaceAll('_', ' ')}</dt><dd className="mt-1 text-[#a7bfc0]">{formatDiagnostic(value)}</dd></div>)}</dl> : <span>—</span>;
  }
  return <span>{String(data)}</span>;
}

function formatDiagnostic(data: unknown): string {
  if (data === null || data === undefined) return '—';
  if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') return String(data);
  if (Array.isArray(data)) return data.map(formatDiagnostic).join(' · ');
  return Object.entries(data as Record<string, unknown>).map(([key, value]) => `${key.replaceAll('_', ' ')}: ${formatDiagnostic(value)}`).join(' · ');
}
