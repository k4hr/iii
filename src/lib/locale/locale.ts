import {Locale} from '@prisma/client';
import {AppLocale, defaultLocale, isLocale} from '@/i18n/routing';

export function routeLocaleToPrisma(locale: string): Locale {
  const safe = isLocale(locale) ? locale : defaultLocale;
  return safe.toUpperCase() as Locale;
}

export function prismaLocaleToRoute(locale: Locale): AppLocale {
  const lower = locale.toLowerCase();
  return isLocale(lower) ? lower : defaultLocale;
}
