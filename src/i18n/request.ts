import {getRequestConfig} from 'next-intl/server';
import {defaultLocale, isLocale} from './routing';

export default getRequestConfig(async ({locale}) => {
  const safeLocale = locale && isLocale(locale) ? locale : defaultLocale;
  return {
    locale: safeLocale,
    messages: (await import(`../messages/${safeLocale}.json`).catch(async () => import('../messages/en.json'))).default
  };
});
