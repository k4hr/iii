import {Locale} from '@prisma/client';

export function createCanonicalHypothesis(input: {title: string; text: string; locale: Locale}) {
  if (input.locale === Locale.EN) {
    return {canonicalTitleEn: input.title, canonicalTextEn: input.text};
  }
  return {
    canonicalTitleEn: `Canonical scientific claim: ${input.title}`,
    canonicalTextEn: `Canonical English version for analysis: ${input.text}`
  };
}
