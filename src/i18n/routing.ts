export const locales = ['en', 'ru', 'es', 'de', 'fr', 'zh', 'ja', 'ko', 'ar', 'pt', 'hi'] as const;
export type AppLocale = (typeof locales)[number];
export const defaultLocale: AppLocale = 'en';

export function isLocale(value: string): value is AppLocale {
  return (locales as readonly string[]).includes(value);
}

export function toPrismaLocale(locale: string) {
  return locale.toUpperCase();
}
