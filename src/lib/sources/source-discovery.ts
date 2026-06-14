import 'server-only';

import {SourceRelationship, SourceType} from '@prisma/client';
import {zodTextFormat} from 'openai/helpers/zod';
import {z} from 'zod';
import {getOpenAIClient} from '@/lib/ai/openai-client';

const relationshipValues = [
  'SUPPORTS_PART',
  'CONTRADICTS',
  'BACKGROUND',
  'ANALOGY',
  'ENGINEERING_LIMIT',
  'MATHEMATICAL_BASIS',
] as const;

const discoverySchema = z.object({
  candidates: z.array(z.object({
    title: z.string().min(5).max(180),
    searchQuery: z.string().min(8).max(300),
    relationship: z.enum(relationshipValues),
    summary: z.string().min(20).max(500),
  })).min(3).max(7),
});

export type SourceDiscoveryInput = {
  locale: string;
  hypothesisTitle: string;
  hypothesisText: string;
  conditionTitle?: string | null;
  conditionDescription?: string | null;
  knownState?: string | null;
  blockers?: unknown;
};

export type SourceCandidate = {
  title: string;
  url: string;
  sourceType: SourceType;
  relationshipToHypothesis: SourceRelationship;
  summary: string;
  searchQuery: string;
};

export async function discoverSourceCandidates(input: SourceDiscoveryInput): Promise<SourceCandidate[]> {
  const client = getOpenAIClient();
  if (!client) return createDeterministicSourceCandidates(input);

  const ru = isRussian(input.locale);
  const response = await client.responses.parse({
    model: process.env.OPENAI_MODEL?.trim() || 'gpt-5.5',
    instructions: [
      'Create a scholarly source-search plan, not a bibliography.',
      'Do not claim that any paper, author, DOI, journal, dataset or result was verified or fetched.',
      'Candidate titles must describe research directions, not pretend to be exact publication titles.',
      'Search queries should be suitable for scholarly indexes and may use precise English scientific terminology.',
      `Write human-readable summaries in ${ru ? 'Russian' : 'English'}.`,
      'Classify every candidate with exactly one allowed relationship.',
    ].join(' '),
    input: JSON.stringify({
      hypothesis: {title: input.hypothesisTitle, description: input.hypothesisText.slice(0, 4000)},
      condition: input.conditionTitle ? {
        title: input.conditionTitle,
        description: input.conditionDescription,
        knownState: input.knownState,
        blockers: input.blockers,
      } : null,
      requestedCandidates: 6,
    }),
    text: {format: zodTextFormat(discoverySchema, 'theoryforge_source_candidates')},
  });

  if (!response.output_parsed) throw new Error('OpenAI source discovery returned no structured candidates.');
  return response.output_parsed.candidates.map(candidate => normalizeCandidate(candidate, input.locale));
}

export function createDeterministicSourceCandidates(input: SourceDiscoveryInput): SourceCandidate[] {
  const ru = isRussian(input.locale);
  const topic = compactTopic(input.conditionTitle || input.hypothesisTitle);
  const context = `${input.conditionTitle ?? ''} ${input.conditionDescription ?? ''} ${input.hypothesisTitle} ${input.hypothesisText}`.toLowerCase();
  const focus = detectResearchFocus(context, topic);

  const candidates: Array<{
    relationship: SourceRelationship;
    titleEn: string;
    titleRu: string;
    query: string;
    summaryEn: string;
    summaryRu: string;
  }> = [
    {
      relationship: SourceRelationship.BACKGROUND,
      titleEn: `Scientific background for ${topic}`,
      titleRu: `Научная основа: ${topic}`,
      query: `${focus} review current scientific understanding`,
      summaryEn: 'Source candidate to verify. Look for review literature that defines the accepted mechanisms, terminology and current evidence base.',
      summaryRu: 'Кандидат источника для проверки. Следует найти обзорные материалы об общепринятых механизмах, терминах и текущей доказательной базе.',
    },
    {
      relationship: SourceRelationship.SUPPORTS_PART,
      titleEn: `Evidence for mechanisms related to ${topic}`,
      titleRu: `Данные о механизмах, связанных с темой «${topic}»`,
      query: `${focus} experimental evidence mechanism validation`,
      summaryEn: 'Source candidate to verify. Search for experiments that support only the relevant mechanism or subsystem, without treating the full hypothesis as established.',
      summaryRu: 'Кандидат источника для проверки. Нужны эксперименты, подтверждающие только относящийся к теме механизм или подсистему, без признания всей гипотезы доказанной.',
    },
    {
      relationship: SourceRelationship.CONTRADICTS,
      titleEn: `Falsification and contrary evidence for ${topic}`,
      titleRu: `Опровержения и противоречащие данные: ${topic}`,
      query: `${focus} limitations null results contradictory evidence falsification`,
      summaryEn: 'Source candidate to verify. Prioritize null results, boundary conditions and evidence that could contradict the proposed mechanism.',
      summaryRu: 'Кандидат источника для проверки. В приоритете нулевые результаты, граничные условия и данные, способные опровергнуть предложенный механизм.',
    },
    {
      relationship: SourceRelationship.ENGINEERING_LIMIT,
      titleEn: `Engineering limits affecting ${topic}`,
      titleRu: `Инженерные пределы для темы «${topic}»`,
      query: `${focus} engineering limits energy materials stability safety scaling`,
      summaryEn: 'Source candidate to verify. Look for quantified limits involving energy, materials, stability, safety, manufacturability or scale-up.',
      summaryRu: 'Кандидат источника для проверки. Нужны количественные пределы по энергии, материалам, стабильности, безопасности, производству или масштабированию.',
    },
    {
      relationship: SourceRelationship.MATHEMATICAL_BASIS,
      titleEn: `Mathematical models for ${topic}`,
      titleRu: `Математические модели для темы «${topic}»`,
      query: `${focus} mathematical model governing equations parameter bounds`,
      summaryEn: 'Source candidate to verify. Search for governing equations, parameter bounds and models that can turn the claim into a testable calculation.',
      summaryRu: 'Кандидат источника для проверки. Следует найти уравнения, границы параметров и модели, превращающие утверждение в проверяемый расчёт.',
    },
    {
      relationship: SourceRelationship.ANALOGY,
      titleEn: `Analog systems relevant to ${topic}`,
      titleRu: `Аналогичные системы для темы «${topic}»`,
      query: `${focus} analogous systems experimental methods transferable measurement`,
      summaryEn: 'Source candidate to verify. Look for adjacent systems where similar mechanisms, measurements or engineering constraints are already studied.',
      summaryRu: 'Кандидат источника для проверки. Нужны смежные системы, где похожие механизмы, измерения или инженерные ограничения уже исследованы.',
    },
  ];

  return candidates.map(candidate => normalizeCandidate({
    title: ru ? candidate.titleRu : candidate.titleEn,
    searchQuery: candidate.query,
    relationship: candidate.relationship,
    summary: ru ? candidate.summaryRu : candidate.summaryEn,
  }, input.locale));
}

export function getLocalizedSourceSummary(
  source: {sourceType: SourceType; relationshipToHypothesis: SourceRelationship; summary: string},
  locale: string
): string {
  if (source.sourceType !== SourceType.MOCK) return source.summary;
  const ru = isRussian(locale);
  const summaryIsRussian = /[А-Яа-яЁё]/.test(source.summary);
  if (summaryIsRussian === ru) return source.summary;

  const fallback: Record<SourceRelationship, [string, string]> = {
    SUPPORTS_PART: ['Source candidate to verify. It may support a mechanism or subsystem, but not the complete hypothesis.', 'Кандидат источника для проверки. Он может подтверждать отдельный механизм или подсистему, но не всю гипотезу.'],
    CONTRADICTS: ['Source candidate to verify. Check it for null results, limitations and contrary evidence.', 'Кандидат источника для проверки. Следует проверить нулевые результаты, ограничения и противоречащие данные.'],
    BACKGROUND: ['Source candidate to verify. Use it to establish accepted terminology and scientific background.', 'Кандидат источника для проверки. Он нужен для уточнения терминов и научной основы.'],
    ANALOGY: ['Source candidate to verify. It points to an analogous system with potentially transferable methods.', 'Кандидат источника для проверки. Он указывает на аналогичную систему с потенциально применимыми методами.'],
    ENGINEERING_LIMIT: ['Source candidate to verify. It targets quantified engineering and scaling limits.', 'Кандидат источника для проверки. Он посвящён количественным инженерным ограничениям и масштабированию.'],
    MATHEMATICAL_BASIS: ['Source candidate to verify. It targets equations, parameter bounds and formal models.', 'Кандидат источника для проверки. Он посвящён уравнениям, границам параметров и формальным моделям.'],
  };
  return fallback[source.relationshipToHypothesis][ru ? 1 : 0];
}

function normalizeCandidate(candidate: z.infer<typeof discoverySchema>['candidates'][number], locale: string): SourceCandidate {
  const ru = isRussian(locale);
  const summary = candidate.summary.trim();
  const notice = ru ? 'Кандидат источника для проверки.' : 'Source candidate to verify.';
  return {
    title: candidate.title.trim(),
    url: `https://scholar.google.com/scholar?q=${encodeURIComponent(candidate.searchQuery.trim())}`,
    sourceType: SourceType.MOCK,
    relationshipToHypothesis: candidate.relationship as SourceRelationship,
    summary: summary.toLowerCase().startsWith(notice.toLowerCase()) ? summary : `${notice} ${summary}`,
    searchQuery: candidate.searchQuery.trim(),
  };
}

function compactTopic(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 120) || 'proposed mechanism';
}

function detectResearchFocus(text: string, topic: string): string {
  if (/time|spacetime|causality|врем|пространств|причинност/.test(text)) {
    return `${topic} spacetime metrics quantum inequalities causality precision clocks`;
  }
  if (/battery|electrochem|lithium|батар|литий|электрохим/.test(text)) {
    return `${topic} electrochemical reversibility membrane selectivity degradation cycle life`;
  }
  if (/material|stress|strength|материал|прочност|напряжен/.test(text)) {
    return `${topic} material properties stress limits failure mechanisms`;
  }
  if (/measurement|sensitivity|signal|измер|чувствитель|сигнал/.test(text)) {
    return `${topic} measurement sensitivity signal noise precision experiment`;
  }
  return `${topic} physical mechanism experimental evidence engineering feasibility`;
}

function isRussian(locale: string): boolean {
  return locale.toLowerCase() === 'ru';
}
