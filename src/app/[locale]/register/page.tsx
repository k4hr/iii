import Link from 'next/link';
import {getTranslations} from 'next-intl/server';
import {redirect} from 'next/navigation';
import {GlassPanel} from '@/components/ui/GlassPanel';
import {GlowButton} from '@/components/ui/GlowButton';
import {getCurrentUser} from '@/lib/auth/current-user';
import {registerAction} from '@/server/actions/auth';

export default async function RegisterPage({params, searchParams}: {params: Promise<{locale: string}>; searchParams: Promise<{error?: string}>}) {
  const {locale} = await params;
  const {error} = await searchParams;
  const t = await getTranslations({locale: locale === 'ru' ? 'ru' : 'en', namespace: 'auth'});
  if (await getCurrentUser()) redirect(`/${locale}/dashboard`);
  const errorMessage = error === 'email_exists' ? t('emailExists') : error === 'invalid_input' ? t('invalidInput') : null;

  return (
    <div className="mx-auto grid min-h-[calc(100vh-10rem)] max-w-5xl place-items-center py-8">
      <GlassPanel glow className="data-grid w-full max-w-lg p-6 sm:p-9">
        <div className="section-kicker">{t('privateResearch')}</div>
        <h1 className="section-heading mt-4">{t('register')}</h1>
        <p className="mt-3 text-sm leading-6 text-[#78999b]">{t('registerDescription')}</p>
        {errorMessage && <div className="mt-5 rounded-xl border border-rose-300/25 bg-rose-300/[0.06] px-4 py-3 text-xs text-rose-100/80">{errorMessage}</div>}

        <form action={registerAction.bind(null, locale)} className="mt-7 space-y-5">
          <AuthField autoComplete="name" label={t('name')} name="name" type="text" />
          <AuthField autoComplete="email" label={t('email')} name="email" type="email" />
          <AuthField autoComplete="new-password" help={t('passwordHelp')} label={t('password')} minLength={8} name="password" type="password" />
          <GlowButton className="w-full justify-center" type="submit">{t('createAccount')}</GlowButton>
        </form>

        <p className="mt-6 text-center text-xs text-cyan-100/45">
          {t('alreadyAccount')} <Link className="text-cyan-200/75 hover:text-cyan-100" href={`/${locale}/login`}>{t('login')}</Link>
        </p>
      </GlassPanel>
    </div>
  );
}

function AuthField(props: {label: string; name: string; type: string; autoComplete: string; minLength?: number; help?: string}) {
  const {label, help, ...inputProps} = props;
  return <label className="block"><span className="mono-label">{label}</span><input {...inputProps} className="lab-input mt-2 w-full" required={inputProps.name !== 'name'} />{help && <span className="mt-2 block text-[10px] leading-4 text-cyan-100/35">{help}</span>}</label>;
}
