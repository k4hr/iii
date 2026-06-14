import {getRequestConfig} from 'next-intl/server';
import {defaultLocale, locales, type AppLocale} from './routing';

export default getRequestConfig(async ({requestLocale}) => {
  const requestedLocale = await requestLocale;
  const safeLocale = requestedLocale && (locales as readonly string[]).includes(requestedLocale)
    ? requestedLocale as AppLocale
    : defaultLocale;
  return {
    locale: safeLocale,
    messages: (await import(`../messages/${safeLocale}.json`).catch(async () => import('../messages/en.json'))).default
  };
});
