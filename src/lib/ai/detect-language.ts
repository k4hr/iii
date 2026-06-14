import {Locale} from '@prisma/client';

export function detectLanguage(text: string): Locale {
  return /[а-яё]/i.test(text) ? Locale.RU : Locale.EN;
}
