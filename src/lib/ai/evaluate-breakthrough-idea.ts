import {IdeaStatus} from '@prisma/client';
import {isRu, MockLocale} from '@/lib/locale/mock-copy';

export function evaluateBreakthroughIdea(rawText: string, locale: MockLocale = 'en') {
  const ru = isRu(locale);
  const promising = /scale|small|micro|measure|измер|уменьш|меньш|filter|membrane|мембран|резонанс|resonance/i.test(rawText);

  return {
    title: rawText.slice(0, 70) || (ru ? 'Идея пользователя' : 'User idea'),
    formalizedText: ru ? `Формализованная ветвь пользовательской гипотезы: ${rawText}` : `Formalized user hypothesis branch: ${rawText}`,
    status: promising ? IdeaStatus.PROMISING : IdeaStatus.NEEDS_FORMALIZATION,
    impactJson: {
      [ru ? 'изменение прогресса исследования' : 'research progress delta']: promising ? 4 : 2,
      [ru ? 'изменение работоспособности' : 'functionality progress delta']: promising ? 1 : 0,
      [ru ? 'изменение проверяемости' : 'testability progress delta']: promising ? 9 : 3,
      [ru ? 'примечание' : 'note']: promising
        ? (ru ? 'Идея может повысить проверяемость за счёт уменьшения масштаба цели или уточнения измерения.' : 'This idea may improve testability by narrowing the target or measurement.')
        : (ru ? 'Нужно точнее определить механизм и переменные, прежде чем идея повлияет на прогресс.' : 'The idea needs sharper mechanism and variables before it can move progress.'),
    },
    reviewJson: {
      [ru ? 'установленные знания' : 'established knowledge']: [ru ? 'Нужно отделить идею от предположений и проверить её по известным ограничениям.' : 'Must be separated from speculation and measured against known constraints.'],
      [ru ? 'гипотеза пользователя' : 'user hypothesis']: rawText,
      [ru ? 'расчётная оценка' : 'calculated estimate']: ru ? 'Предварительная оценка требует проверки параметров и расчётов.' : 'The preliminary estimate requires parameter and calculation validation.',
      [ru ? 'неизвестная область' : 'unknown area']: [ru ? 'Точные параметры пока не определены.' : 'Exact parameters are not defined yet.'],
      [ru ? 'противоречия' : 'contradiction']: [],
      [ru ? 'необходимые доказательства' : 'required evidence']: [ru ? 'Определить переменные, предсказанный эффект и критерии опровержения.' : 'Define variables, predicted effect and falsification criteria.'],
    },
    assumptionsJson: ru ? ['Предлагаемый механизм можно описать параметрами.', 'Можно определить измеримый сигнал.'] : ['The proposed mechanism can be parameterized.', 'A measurable signal can be defined.'],
    newBlockersJson: promising
      ? [ru ? 'Нужны значения параметров и оценка чувствительности.' : 'Requires parameter values and sensitivity estimate.']
      : [ru ? 'Механизм остаётся неоднозначным.' : 'Mechanism remains ambiguous.'],
  };
}
