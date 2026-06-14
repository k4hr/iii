import createMiddleware from 'next-intl/middleware';
import {defaultLocale, locales} from './i18n/routing';

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always'
});

export const config = {
  matcher: ['/', '/(en|ru|es|de|fr|zh|ja|ko|ar|pt|hi)/:path*']
};
