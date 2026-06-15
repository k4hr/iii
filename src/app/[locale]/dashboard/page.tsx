import Link from 'next/link';
import {getTranslations} from 'next-intl/server';
import {prisma} from '@/lib/db/prisma';
import {GlassPanel} from '@/components/ui/GlassPanel';
import {GlowButton} from '@/components/ui/GlowButton';
import {LabMetricCard} from '@/components/ui/LabMetricCard';
import {StatusBadge} from '@/components/ui/StatusBadge';
import {getEnumLabel} from '@/lib/locale/enum-labels';
import {getCurrentUser} from '@/lib/auth/current-user';
import {buildLabLog} from '@/lib/lab-log/build-lab-log';
import {LabLogTimeline} from '@/components/lab-log/LabLogTimeline';
import {redirect} from 'next/navigation';

export default async function Dashboard({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  const t = await getTranslations({locale: locale === 'ru' ? 'ru' : 'en', namespace: 'dashboard'});
  const c = await getTranslations('common');
  const labT = await getTranslations({locale: locale === 'ru' ? 'ru' : 'en', namespace: 'labLog'});
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/account`);
  const [projects, hypotheses, sessions, calculations, labLogItems] = await Promise.all([
    prisma.project.findMany({where: {ownerId: user.id}, take: 3, orderBy: {createdAt: 'desc'}}),
    prisma.hypothesis.findMany({where: {ownerId: user.id}, take: 4, orderBy: {createdAt: 'desc'}, include: {analyses: {take: 1, orderBy: {createdAt: 'desc'}}}}),
    prisma.breakthroughSession.findMany({where: {ownerId: user.id, status: 'ACTIVE', hypothesis: {ownerId: user.id}}, take: 3, orderBy: {createdAt: 'desc'}, include: {hypothesis: true}}),
    prisma.calculationRun.findMany({where: {hypothesis: {ownerId: user.id}}, take: 4, orderBy: {createdAt: 'desc'}, include: {hypothesis: true}}),
    buildLabLog({locale: locale === 'ru' ? 'ru' : 'en'}),
  ]);
  const avg = hypotheses[0]?.analyses[0] || {researchProgress: 0, functionalityProgress: 0, testabilityProgress: 0};
  const ru = locale === 'ru';
  const labLogLabels = {
    title: labT('title'), workspaceTitle: labT('workspaceTitle'), events: labT('events'), details: labT('details'), noEvents: labT('noEvents'),
    sourceTypes: {
      hypothesis: labT('sourceTypes.hypothesis'), condition: labT('sourceTypes.condition'), breakthrough: labT('sourceTypes.breakthrough'), idea: labT('sourceTypes.idea'),
      calculation: labT('sourceTypes.calculation'), source: labT('sourceTypes.source'), experiment: labT('sourceTypes.experiment'), simulation: labT('sourceTypes.simulation'), system: labT('sourceTypes.system'),
    },
    severity: {info: labT('severity.info'), success: labT('severity.success'), warning: labT('severity.warning'), critical: labT('severity.critical')},
  };

  return (
    <div className="space-y-10 py-3">
      <header className="flex flex-col justify-between gap-6 border-b border-cyan-100/[0.08] pb-8 md:flex-row md:items-end">
        <div>
          <div className="section-kicker">{ru ? 'Центр управления исследованиями' : 'Research control center'}</div>
          <h1 className="section-heading mt-4">{t('title')}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#78999b]">{t('subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <GlowButton href={`/${locale}/projects`} variant="secondary">{c('createProject')}</GlowButton>
          <GlowButton href={`/${locale}/hypotheses/new`}>{c('newHypothesis')}</GlowButton>
        </div>
      </header>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <span className="mono-label">{ru ? 'Телеметрия модели' : 'Live model telemetry'}</span>
          <StatusBadge value="ACTIVE" locale={locale} label={ru ? 'Поток анализа' : 'Analysis feed'} />
        </div>
        <GlassPanel glow className="data-grid grid gap-3 p-3 md:grid-cols-3">
          <LabMetricCard label={t('research')} value={avg.researchProgress} detail={ru ? 'Полнота доказательств и определения модели' : 'Evidence coverage and model definition'} />
          <LabMetricCard label={t('functionality')} value={avg.functionalityProgress} detail={ru ? 'Расстояние от модели до работающей системы' : 'Distance from modeled effect to usable system'} />
          <LabMetricCard label={t('testability')} value={avg.testabilityProgress} detail={ru ? 'Готовность к измеримому опровержению' : 'Readiness for measurable falsification'} />
        </GlassPanel>
      </section>

      <DashboardGrid locale={locale} title={t('myProjects')} index="01" items={projects.map(project => ({title: project.title, href: `/${locale}/projects/${project.id}`, meta: project.description || ''}))} />
      <DashboardGrid locale={locale} title={t('myHypotheses')} index="02" items={hypotheses.map(hypothesis => ({title: hypothesis.originalTitle, href: `/${locale}/hypotheses/${hypothesis.id}`, meta: getEnumLabel(hypothesis.status, locale)}))} />
      <DashboardGrid locale={locale} title={t('activeBreakthroughs')} index="03" items={sessions.map(session => ({title: session.title, href: `/${locale}/breakthroughs/${session.id}`, meta: session.hypothesis.originalTitle, status: session.status}))} />
      <DashboardGrid locale={locale} title={t('recentCalculations')} index="04" items={calculations.map(calculation => ({title: calculation.title, href: `/${locale}/hypotheses/${calculation.hypothesisId}#calculations`, meta: calculation.hypothesis.originalTitle}))} />
      <section>
        <LabLogTimeline items={labLogItems.slice(0, 12)} locale={locale} labels={labLogLabels} />
      </section>
    </div>
  );
}

function DashboardGrid({title, index, items, locale}: {title: string; index: string; locale: string; items: {title: string; href: string; meta: string; status?: string}[]}) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-4">
        <span className="mono-label">{index}</span>
        <h2 className="text-xl font-semibold tracking-tight text-cyan-50">{title}</h2>
        <span className="h-px flex-1 bg-gradient-to-r from-cyan-200/15 to-transparent" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {items.length ? items.map(item => (
          <Link href={item.href} key={item.href} className="group">
            <GlassPanel className="h-full min-h-36 p-5 transition duration-300 group-hover:-translate-y-1 group-hover:border-cyan-200/25">
              <div className="flex items-start justify-between gap-4">
                <span className="mono-label">{locale === 'ru' ? 'Исследовательский узел' : 'Research node'}</span>
                {item.status && <StatusBadge value={item.status} locale={locale} />}
              </div>
              <h3 className="mt-7 font-semibold text-cyan-50 transition group-hover:text-[#7cf8e8]">{item.title}</h3>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#668789]">{item.meta}</p>
            </GlassPanel>
          </Link>
        )) : (
          <GlassPanel className="p-5 text-sm text-[#668789]">{locale === 'ru' ? 'Исследовательских узлов пока нет.' : 'No research nodes yet.'}</GlassPanel>
        )}
      </div>
    </section>
  );
}
