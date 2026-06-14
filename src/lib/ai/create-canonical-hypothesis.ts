import {Locale} from '@prisma/client';

export function createCanonicalHypothesis(input: {title: string; text: string; locale: Locale}) {
  // Keep the original text internally until a verified translation step is available.
  return {
    canonicalTitleEn: input.title,
    canonicalTextEn: input.text,
  };
}
