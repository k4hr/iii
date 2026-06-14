const ruLabels: Record<string, string> = {
  UNDEFINED: 'Не определено',
  UNDER_REVIEW: 'На проверке',
  THEORETICALLY_CONFLICTED: 'Есть теоретические противоречия',
  PHYSICS_PLAUSIBLE_ENGINEERING_BLOCKED: 'Физически правдоподобно, но инженерно заблокировано',
  NEEDS_BREAKTHROUGH: 'Нужен прорыв',
  TESTABLE_MICRO_VERSION: 'Можно проверить в уменьшенном масштабе',
  PROTOTYPE_READY: 'Готово к прототипированию',
  WORKING_IN_LIMITED_SCOPE: 'Работает в ограниченном масштабе',
  FUNDAMENTALLY_FORBIDDEN: 'Фундаментально невозможно',
  MATHEMATICALLY_POSSIBLE_NOT_PROVEN: 'Математически возможно, но не доказано',
  PHYSICALLY_POSSIBLE_ENGINEERING_BLOCKED: 'Физически возможно, но инженерно заблокировано',
  ENGINEERING_POSSIBLE_EXPENSIVE_OR_DANGEROUS: 'Инженерно возможно, но дорого или опасно',
  TESTABLE_WITH_SMALL_EXPERIMENTS: 'Можно проверить малыми экспериментами',
  INSUFFICIENTLY_DEFINED: 'Недостаточно определено',
  LOW: 'Низкий',
  MEDIUM: 'Средний',
  HIGH: 'Высокая важность',
  EXTREME: 'Экстремальный разрыв',
  UNKNOWN: 'Неизвестно',
  KNOWN_WORKING: 'Подтверждённо работает',
  KNOWN_LIMITED: 'Работает с ограничениями',
  CONFLICTS_WITH_KNOWN_SCIENCE: 'Противоречит известной науке',
  ENGINEERING_BLOCKED: 'Инженерный блокер',
  TESTABLE: 'Можно проверить',
  CRITICAL: 'Критично',
  THOUGHT_EXPERIMENT: 'Мысленный эксперимент',
  COMPUTER_SIMULATION: 'Компьютерная симуляция',
  SMALL_LAB_TEST: 'Малый лабораторный тест',
  PRECISION_MEASUREMENT: 'Высокоточное измерение',
  MATERIAL_TEST: 'Испытание материала',
  SAFETY_TEST: 'Испытание безопасности',
  SAFE: 'Безопасно',
  CAUTION: 'Требует осторожности',
  LAB_ONLY: 'Только в лаборатории',
  DANGEROUS: 'Опасно',
  THEORETICAL_ONLY: 'Только теоретически',
  SUPPORTS_PART: 'Частично подтверждает',
  CONTRADICTS: 'Противоречит',
  BACKGROUND: 'Научный контекст',
  ANALOGY: 'Аналогия',
  ENGINEERING_LIMIT: 'Инженерное ограничение',
  MATHEMATICAL_BASIS: 'Математическая основа',
  ACTIVE: 'Активно',
  PAUSED: 'Приостановлено',
  SOLVED_THEORETICALLY: 'Теоретически решено',
  SOLVED_EXPERIMENTALLY: 'Экспериментально решено',
  BLOCKED: 'Заблокировано',
  ABANDONED: 'Закрыто',
  NEEDS_REVIEW: 'Нужна проверка',
  NEEDS_FORMALIZATION: 'Нужна формализация',
  PROMISING: 'Перспективно',
  WEAK: 'Слабая идея',
  CONTRADICTED: 'Есть противоречия',
  NEEDS_MATH: 'Нужны расчёты',
  NEEDS_EXPERIMENT: 'Нужен эксперимент',
  ARCHIVED: 'В архиве',
  QUEUED: 'В очереди',
  ANALYZING: 'Анализируется',
  DONE: 'Анализ завершён',
  FAILED: 'Ошибка анализа',
  USER: 'Пользователь',
  AI: 'ИИ',
  TEAM_MEMBER: 'Участник команды',
  QUANTUM: 'Квантовый масштаб',
  ATOMIC: 'Атомный масштаб',
  MOLECULAR: 'Молекулярный масштаб',
  NANO: 'Наномасштаб',
  MICRO: 'Микромасштаб',
  HUMAN: 'Масштаб человека',
  PLANETARY: 'Планетарный масштаб',
  STELLAR: 'Звёздный масштаб',
  COSMOLOGICAL: 'Космологический масштаб',
};

const enLabels: Record<string, string> = {
  PHYSICS_PLAUSIBLE_ENGINEERING_BLOCKED: 'Physically plausible, engineering blocked',
  PHYSICALLY_POSSIBLE_ENGINEERING_BLOCKED: 'Physically possible, engineering blocked',
  ENGINEERING_POSSIBLE_EXPENSIVE_OR_DANGEROUS: 'Engineering possible, expensive or dangerous',
  TESTABLE_WITH_SMALL_EXPERIMENTS: 'Testable with small experiments',
  MATHEMATICALLY_POSSIBLE_NOT_PROVEN: 'Mathematically possible, not proven',
  CONFLICTS_WITH_KNOWN_SCIENCE: 'Conflicts with known science',
  NEEDS_BREAKTHROUGH: 'Needs breakthrough',
  ENGINEERING_BLOCKED: 'Engineering blocker',
  KNOWN_WORKING: 'Known working',
  KNOWN_LIMITED: 'Known with limitations',
  TESTABLE_MICRO_VERSION: 'Testable at reduced scale',
  SOLVED_THEORETICALLY: 'Solved theoretically',
  SOLVED_EXPERIMENTALLY: 'Solved experimentally',
};

export function isRussianLocale(locale: string) {
  return locale.toLowerCase() === 'ru';
}

export function getEnumLabel(value: string, locale: string) {
  const labels = isRussianLocale(locale) ? ruLabels : enLabels;
  return labels[value] ?? value.replaceAll('_', ' ').toLowerCase().replace(/^./, character => character.toUpperCase());
}

type LabelMap = Record<string, string>;

function scopedLabel(value: string, locale: string, russian: LabelMap, english: LabelMap = {}) {
  if (isRussianLocale(locale)) return russian[value] ?? getEnumLabel(value, locale);
  return english[value] ?? getEnumLabel(value, locale);
}

export const getHypothesisOverallStatusLabel = (value: string, locale: string) => scopedLabel(value, locale, {
  UNDEFINED: 'Не определено', UNDER_REVIEW: 'На проверке', THEORETICALLY_CONFLICTED: 'Есть теоретические противоречия', PHYSICS_PLAUSIBLE_ENGINEERING_BLOCKED: 'Физически правдоподобно, но инженерно заблокировано', NEEDS_BREAKTHROUGH: 'Нужен прорыв', TESTABLE_MICRO_VERSION: 'Можно проверить в уменьшенном масштабе', PROTOTYPE_READY: 'Готово к прототипированию', WORKING_IN_LIMITED_SCOPE: 'Работает в ограниченном масштабе',
});

export const getVerdictLevelLabel = (value: string, locale: string) => scopedLabel(value, locale, {
  FUNDAMENTALLY_FORBIDDEN: 'Фундаментально невозможно', MATHEMATICALLY_POSSIBLE_NOT_PROVEN: 'Математически возможно, но не доказано', PHYSICALLY_POSSIBLE_ENGINEERING_BLOCKED: 'Физически возможно, но инженерно заблокировано', ENGINEERING_POSSIBLE_EXPENSIVE_OR_DANGEROUS: 'Инженерно возможно, но дорого или опасно', TESTABLE_WITH_SMALL_EXPERIMENTS: 'Можно проверить малыми экспериментами', INSUFFICIENTLY_DEFINED: 'Недостаточно определено',
});

export const getRealityGapLevelLabel = (value: string, locale: string) => scopedLabel(value, locale, {
  LOW: 'Небольшой разрыв', MEDIUM: 'Средний разрыв', HIGH: 'Большой разрыв', EXTREME: 'Экстремальный разрыв', UNKNOWN: 'Разрыв неизвестен',
});

export const getConditionStatusLabel = (value: string, locale: string) => scopedLabel(value, locale, {
  KNOWN_WORKING: 'Подтверждённо работает', KNOWN_LIMITED: 'Работает с ограничениями', UNKNOWN: 'Неизвестно', CONFLICTS_WITH_KNOWN_SCIENCE: 'Противоречит известной науке', ENGINEERING_BLOCKED: 'Инженерный блокер', NEEDS_BREAKTHROUGH: 'Нужен прорыв', TESTABLE: 'Можно проверить', UNDEFINED: 'Не определено',
});

export const getConditionImportanceLabel = (value: string, locale: string) => scopedLabel(value, locale, {
  LOW: 'Низкая важность', MEDIUM: 'Средняя важность', HIGH: 'Высокая важность', CRITICAL: 'Критично',
});

export const getExperimentTypeLabel = (value: string, locale: string) => scopedLabel(value, locale, {
  THOUGHT_EXPERIMENT: 'Мысленный эксперимент', COMPUTER_SIMULATION: 'Компьютерная симуляция', SMALL_LAB_TEST: 'Малый лабораторный тест', PRECISION_MEASUREMENT: 'Высокоточное измерение', MATERIAL_TEST: 'Испытание материала', SAFETY_TEST: 'Испытание безопасности',
});

export const getExperimentDifficultyLabel = (value: string, locale: string) => scopedLabel(value, locale, {
  LOW: 'Низкая сложность', MEDIUM: 'Средняя сложность', HIGH: 'Высокая сложность', EXTREME: 'Экстремальная сложность',
});

export const getSafetyLevelLabel = (value: string, locale: string) => scopedLabel(value, locale, {
  SAFE: 'Безопасно', CAUTION: 'Требует осторожности', LAB_ONLY: 'Только в лаборатории', DANGEROUS: 'Опасно', THEORETICAL_ONLY: 'Только теоретически',
});

export const getSourceRelationshipLabel = (value: string, locale: string) => scopedLabel(value, locale, {
  SUPPORTS_PART: 'Частично подтверждает', CONTRADICTS: 'Противоречит', BACKGROUND: 'Научный контекст', ANALOGY: 'Аналогия', ENGINEERING_LIMIT: 'Инженерное ограничение', MATHEMATICAL_BASIS: 'Математическая основа',
});

export const getBreakthroughStatusLabel = (value: string, locale: string) => scopedLabel(value, locale, {
  ACTIVE: 'Активно', PAUSED: 'Приостановлено', SOLVED_THEORETICALLY: 'Теоретически решено', SOLVED_EXPERIMENTALLY: 'Экспериментально решено', BLOCKED: 'Заблокировано', ABANDONED: 'Закрыто',
});

export const getIdeaStatusLabel = (value: string, locale: string) => scopedLabel(value, locale, {
  NEEDS_REVIEW: 'Нужна проверка', NEEDS_FORMALIZATION: 'Нужна формализация', PROMISING: 'Перспективно', WEAK: 'Слабая идея', CONTRADICTED: 'Есть противоречия', NEEDS_MATH: 'Нужны расчёты', NEEDS_EXPERIMENT: 'Нужен эксперимент', BLOCKED: 'Заблокировано', ARCHIVED: 'В архиве',
});
