import {getTranslations} from 'next-intl/server';
import {getCurrentUser} from '@/lib/auth/current-user';
import {prisma} from '@/lib/db/prisma';
import {GlassPanel} from '@/components/ui/GlassPanel';

export default async function AccountPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  const t = await getTranslations({locale: locale === 'ru' ? 'ru' : 'en', namespace: 'account'});
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl py-8">
        <GlassPanel glow className="p-7 sm:p-9">
          <div className="section-kicker">{t('privateWorkspace')}</div>
          <h1 className="section-heading mt-4">{t('title')}</h1>
          <p className="mt-4 text-sm leading-7 text-[#89a6a8]">{t('authRequired')}</p>
        </GlassPanel>
      </div>
    );
  }

  const [projectCount, hypothesisCount, breakthroughCount] = await Promise.all([
    prisma.project.count({where: {ownerId: user.id}}),
    prisma.hypothesis.count({where: {ownerId: user.id}}),
    prisma.breakthroughSession.count({where: {ownerId: user.id, status: 'ACTIVE'}}),
  ]);

  return (
    <div className="space-y-6 py-3">
      <header className="border-b border-cyan-100/[0.08] pb-7">
        <div className="section-kicker">{t('privateWorkspace')}</div>
        <h1 className="section-heading mt-4">{t('title')}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#78999b]">{t('description')}</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
        <GlassPanel glow className="p-6 sm:p-7">
          <div className="mono-label">{t('profile')}</div>
          <dl className="mt-6 grid gap-5 sm:grid-cols-2">
            <AccountField label={t('name')} value={user.name || t('notSet')} />
            <AccountField label={t('email')} value={user.email || t('notSet')} />
            <AccountField label={t('selectedLocale')} value={localeName(user.preferredLocale, locale)} />
            <AccountField label={t('workspaceId')} value={user.id} />
          </dl>
        </GlassPanel>

        <GlassPanel className="data-grid p-6 sm:p-7">
          <div className="mono-label">{t('workspaceInfo')}</div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <WorkspaceMetric label={t('projects')} value={projectCount} />
            <WorkspaceMetric label={t('hypotheses')} value={hypothesisCount} />
            <WorkspaceMetric label={t('breakthroughs')} value={breakthroughCount} />
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}

function AccountField({label, value}: {label: string; value: string}) {
  return <div className="border-l border-cyan-200/15 pl-4"><dt className="mono-label">{label}</dt><dd className="mt-2 break-all text-sm text-cyan-50/75">{value}</dd></div>;
}

function WorkspaceMetric({label, value}: {label: string; value: number}) {
  return <div className="flex items-center justify-between rounded-xl border border-cyan-100/[0.08] bg-black/30 p-4"><span className="text-xs text-cyan-50/60">{label}</span><span className="font-mono text-2xl text-cyan-200/75">{String(value).padStart(2, '0')}</span></div>;
}

function localeName(value: string, locale: string): string {
  const code = value.toLowerCase();
  try {
    return new Intl.DisplayNames([locale === 'ru' ? 'ru' : 'en'], {type: 'language'}).of(code) || code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}
