import type {EngineeringSynthesisInput} from '@/lib/engineering/generate-engineering-model';

type Fixture = {
  name: string;
  expectedClass: EngineeringSynthesisInput extends never ? never : string;
  input: EngineeringSynthesisInput;
};

function fixture(title: string, text: string, expectedClass: string, conditions: Array<[string, string]>): Fixture {
  return {
    name: title,
    expectedClass,
    input: {
      locale: 'ru',
      hypothesis: {id: `fixture-${expectedClass}-${title.length}`, title, text},
      analysis: {summary: text, formalizedClaim: title, researchProgress: 28, functionalityProgress: 16, testabilityProgress: 42, confidence: 35},
      conditions: conditions.map(([conditionTitle, description], index) => ({
        id: `condition-${expectedClass}-${index + 1}-${title.length}`,
        title: conditionTitle,
        description,
        status: index === 0 ? 'NEEDS_BREAKTHROUGH' : 'ENGINEERING_BLOCKED',
        importance: index === 0 ? 'CRITICAL' : 'HIGH',
        completionScore: 18 + index * 9,
        blockers: [description],
      })),
      calculations: [{id: `calculation-${expectedClass}-${title.length}`, conditionId: `condition-${expectedClass}-1-${title.length}`, title: 'Оценка основного энергетического разрыва', gapOrders: 4.2, resultJson: {gapOrders: 4.2}}],
      sources: [{id: `source-${expectedClass}-${title.length}`, conditionId: `condition-${expectedClass}-2-${title.length}`, title: 'Кандидат источника для проверки', relationship: 'ENGINEERING_LIMIT'}],
      experiments: [{id: `experiment-${expectedClass}-${title.length}`, conditionId: `condition-${expectedClass}-3-${title.length}`, title: 'Минимальный стендовый тест'}],
      breakthroughSessions: [],
    },
  };
}

export const engineeringModelFixtures: Fixture[] = [
  fixture('Летающий мотоцикл', 'Компактный летающий мотоцикл с кольцевыми роторами, задней тягой и энергетическим модулем.', 'vehicle', [
    ['Подъёмная система', 'Кольцевые роторы должны создавать подъёмную силу при малом диаметре.'],
    ['Энергетический модуль', 'Блок питания должен выдерживать пиковую мощность взлёта.'],
    ['Контур управления', 'Стабилизация должна удерживать аппарат при наклоне и порывах ветра.'],
  ]),
  fixture('Антифизический бумеранг', 'Материальное устройство в форме бумеранга с управляемыми лопастями, датчиками и центральной массой.', 'device', [
    ['Несущий профиль', 'Изогнутые лопасти должны выдерживать вращение и ударные нагрузки.'],
    ['Контур управления', 'Нужны датчики и коррекция траектории без фантастических допущений.'],
    ['Энергетическое ядро', 'Внутренний источник энергии должен быть измеримым и безопасным.'],
  ]),
  fixture('Щит капитана америки', 'Круглый защитный щит с многослойным материалом, датчиками нагрузки и контролируемой отдачей.', 'device', [
    ['Материальные слои', 'Слои должны распределять ударную энергию без разрушения.'],
    ['Сенсоры нагрузки', 'Нужны маркеры деформации и пикового импульса.'],
    ['Система безопасности', 'Края и крепления не должны создавать вторичные риски.'],
  ]),
  fixture('Летающая машина', 'Персональный летающий автомобиль вертикального взлёта с корпусом, кабиной, роторами и тягой.', 'vehicle', [
    ['Подъёмная и тяговая система', 'Роторы и двигатели создают подъёмную силу и горизонтальную тягу.'],
    ['Несущий корпус', 'Корпус выдерживает аэродинамические и посадочные нагрузки.'],
    ['Навигация и стабилизация', 'Система управления удерживает аппарат в устойчивом полёте.'],
  ]),
  fixture('Костюм железного человека', 'Носимый силовой экзоскелет с автономным питанием, бронёй, охлаждением и маневровой тягой.', 'wearable', [
    ['Энергетическое ядро', 'Компактный источник энергии должен питать приводы и тяговые модули.'],
    ['Силовой каркас', 'Каркас распределяет нагрузку и защищает пользователя.'],
    ['Система управления и датчики', 'Контур управления стабилизирует движение и измеряет положение тела.'],
  ]),
  fixture('Литий-воздушная батарея', 'Перезаряжаемая литий-воздушная батарея высокой удельной энергии с фильтром воздуха и тепловым контуром.', 'battery', [
    ['Электрохимические ячейки', 'Электроды и электролит обеспечивают обратимую реакцию лития и кислорода.'],
    ['Воздушный фильтр', 'Мембрана исключает воду и углекислый газ из воздушного потока.'],
    ['Тепловая безопасность', 'Корпус и охлаждение предотвращают перегрев и короткое замыкание.'],
  ]),
];
