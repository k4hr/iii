import {getTranslations} from 'next-intl/server';
import {GlassPanel} from '@/components/ui/GlassPanel';
import {GlowButton} from '@/components/ui/GlowButton';
import {HeroNetworkVisual} from '@/components/ui/HeroNetworkVisual';

export default async function Landing({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  const t = await getTranslations('landing');
  const hypothesis = await getTranslations('hypothesis');
  const dashboard = await getTranslations('dashboard');
  const ru = locale === 'ru';

  const modules = [
    {index: '01', title: hypothesis('tabs.breakthrough'), text: hypothesis('conditions')},
    {index: '02', title: dashboard('research'), text: dashboard('functionality')},
    {index: '03', title: hypothesis('tabs.experiments'), text: dashboard('testability')},
  ];

  return (
    <div className="pb-12">
      <section className="relative grid min-h-[calc(100vh-7rem)] items-center gap-8 py-10 lg:grid-cols-[1.08fr_.92fr] lg:py-16">
        <div className="relative z-10 max-w-4xl">
          <div className="section-kicker">{t('labLabel')}</div>
          <h1 className="mt-7 text-[clamp(3.3rem,7vw,7.2rem)] font-semibold leading-[.91] tracking-[-.065em] text-white">
            {t('heroTitle')}
          </h1>
          <p className="mt-8 max-w-2xl text-base leading-8 text-[#9bb6b8] sm:text-lg">
            {t('heroText')}
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <GlowButton href={`/${locale}/hypotheses/new`}>{t('cta')}</GlowButton>
            <GlowButton href={`/${locale}/dashboard`} variant="secondary">{t('secondary')}</GlowButton>
          </div>
          <div className="mt-12 flex max-w-2xl items-start gap-4 border-l border-cyan-200/20 pl-5">
            <span className="mt-1 font-mono text-[10px] tracking-[.16em] text-cyan-300/55">{ru ? 'ПРОТОКОЛ' : 'PROTOCOL'}</span>
            <p className="text-sm leading-6 text-[#648789]">{t('principle')}</p>
          </div>
        </div>

        <div className="relative -mx-5 lg:mx-0">
          <HeroNetworkVisual />
        </div>
      </section>

      <section className="grid gap-4 border-t border-cyan-100/[0.07] pt-7 md:grid-cols-3">
        {modules.map(module => (
          <GlassPanel key={module.index} className="group min-h-44 p-6 transition duration-300 hover:-translate-y-1 hover:border-cyan-200/25">
            <div className="flex items-center justify-between">
              <span className="mono-label">{ru ? 'Модуль' : 'Module'} {module.index}</span>
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300/70 shadow-[0_0_9px_#43f1df]" />
            </div>
            <h2 className="mt-9 text-xl font-semibold tracking-tight text-cyan-50">{module.title}</h2>
            <p className="mt-2 text-sm text-[#6f9092]">{module.text}</p>
          </GlassPanel>
        ))}
      </section>
    </div>
  );
}
