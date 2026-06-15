import Link from 'next/link';
import {getTranslations} from 'next-intl/server';
import {redirect} from 'next/navigation';
import {GlassPanel} from '@/components/ui/GlassPanel';
import {GlowButton} from '@/components/ui/GlowButton';
import {getCurrentUser} from '@/lib/auth/current-user';
import {loginAction} from '@/server/actions/auth';

export default async function LoginPage({params, searchParams}: {params: Promise<{locale: string}>; searchParams: Promise<{error?: string; registered?: string}>}) {
  const {locale} = await params;
  const query = await searchParams;
  const uiLocale = locale === 'ru' ? 'ru' : 'en';
  const t = await getTranslations({locale: uiLocale, namespace: 'auth'});
  if (await getCurrentUser()) redirect(`/${locale}/dashboard`);
  const error = authError(query.error, t);

  return (
    <div className="mx-auto grid min-h-[calc(100vh-10rem)] max-w-5xl place-items-center py-8">
      <GlassPanel glow className="data-grid w-full max-w-lg p-6 sm:p-9">
        <div className="section-kicker">{t('secureWorkspace')}</div>
        <h1 className="section-heading mt-4">{t('login')}</h1>
        <p className="mt-3 text-sm leading-6 text-[#78999b]">{t('loginDescription')}</p>
        {query.registered === '1' && <Notice tone="success">{t('registrationComplete')}</Notice>}
        {error && <Notice tone="error">{error}</Notice>}

        <form action={loginAction.bind(null, locale)} className="mt-7 space-y-5">
          <AuthField autoComplete="email" label={t('email')} name="email" type="email" />
          <AuthField autoComplete="current-password" label={t('password')} minLength={8} name="password" type="password" />
          <GlowButton className="w-full justify-center" type="submit">{t('signIn')}</GlowButton>
        </form>

        <p className="mt-6 text-center text-xs text-cyan-100/45">
          {t('noAccount')} <Link className="text-cyan-200/75 hover:text-cyan-100" href={`/${locale}/register`}>{t('register')}</Link>
        </p>
      </GlassPanel>
    </div>
  );
}

function AuthField(props: {label: string; name: string; type: string; autoComplete: string; minLength?: number}) {
  return <label className="block"><span className="mono-label">{props.label}</span><input {...props} className="lab-input mt-2 w-full" required /></label>;
}

function Notice({children, tone}: {children: React.ReactNode; tone: 'success' | 'error'}) {
  return <div className={`mt-5 rounded-xl border px-4 py-3 text-xs ${tone === 'success' ? 'border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-100/75' : 'border-rose-300/25 bg-rose-300/[0.06] text-rose-100/80'}`}>{children}</div>;
}

function authError(code: string | undefined, t: Awaited<ReturnType<typeof getTranslations>>): string | null {
  if (code === 'invalid_input') return t('invalidInput');
  if (code === 'invalid_credentials') return t('invalidCredentials');
  return null;
}
