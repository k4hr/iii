import 'server-only';

import {ResearchTaskPriority, ResearchTaskStatus, ResearchTaskType} from '@prisma/client';
import {prisma} from '@/lib/db/prisma';
import {parseEngineeringModel} from '@/lib/engineering/engineering-model-schema';
import {toPrismaJsonObject} from '@/lib/prisma/safe-json';

export type ResearchMissionLocale = 'en' | 'ru';

export type ResearchMissionTask = {
  id: string;
  type: ResearchTaskType;
  status: ResearchTaskStatus;
  priority: ResearchTaskPriority;
  title: string;
  description: string;
  actionLabel: string;
  targetSection: string;
  conditionId?: string | null;
  breakthroughSessionId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date | null;
};

export type ResearchMission = {
  tasks: ResearchMissionTask[];
  currentTask?: ResearchMissionTask;
  nextTasks: ResearchMissionTask[];
  completedCount: number;
  criticalTodoCount: number;
  progress: Array<{key: string; label: string; status: ResearchTaskStatus}>;
};

type SyncInput = {
  hypothesisId: string;
  locale: string;
  ownerId: string;
  createEvent?: boolean;
};

type LoadedHypothesis = NonNullable<Awaited<ReturnType<typeof loadMissionHypothesis>>>;

type DesiredTask = {
  actionLabel: string;
  breakthroughSessionId?: string | null;
  conditionId?: string | null;
  description: string;
  priority: ResearchTaskPriority;
  status: ResearchTaskStatus;
  targetSection: string;
  title: string;
  type: ResearchTaskType;
};

const priorityWeight: Record<ResearchTaskPriority, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

const statusWeight: Record<ResearchTaskStatus, number> = {
  IN_PROGRESS: 4,
  TODO: 3,
  SKIPPED: 2,
  DONE: 1,
};

export async function syncResearchTasksForHypothesis(input: SyncInput): Promise<ResearchMission> {
  const locale = input.locale === 'ru' ? 'ru' : 'en';
  const hypothesis = await loadMissionHypothesis(input.hypothesisId, input.ownerId);
  if (!hypothesis) throw new Error('Hypothesis not found in the current workspace.');

  const desiredTasks = buildDesiredTasks(hypothesis, locale);
  const existingTasks = hypothesis.researchTasks;
  const createdCriticalTasks: ResearchMissionTask[] = [];

  for (const desired of desiredTasks) {
    const existing = existingTasks.find(task => taskKey(task) === desiredTaskKey(desired));
    if (!existing) {
      const created = await prisma.researchTask.create({
        data: {
          hypothesisId: hypothesis.id,
          ...(desired.conditionId ? {conditionId: desired.conditionId} : {}),
          ...(desired.breakthroughSessionId ? {breakthroughSessionId: desired.breakthroughSessionId} : {}),
          type: desired.type,
          status: desired.status,
          priority: desired.priority,
          title: desired.title,
          description: desired.description,
          actionLabel: desired.actionLabel,
          targetSection: desired.targetSection,
          ...(desired.status === 'DONE' ? {completedAt: new Date()} : {}),
        },
      });
      if (created.priority === 'CRITICAL' && created.status !== 'DONE') createdCriticalTasks.push(created);
      continue;
    }

    const nextStatus = nextTaskStatus(existing.status, desired.status, desired.type);
    const changed = existing.status !== nextStatus
      || existing.priority !== desired.priority
      || existing.title !== desired.title
      || existing.description !== desired.description
      || existing.actionLabel !== desired.actionLabel
      || existing.targetSection !== desired.targetSection;
    if (!changed) continue;

    await prisma.researchTask.update({
      where: {id: existing.id},
      data: {
        status: nextStatus,
        priority: desired.priority,
        title: desired.title,
        description: desired.description,
        actionLabel: desired.actionLabel,
        targetSection: desired.targetSection,
        completedAt: nextStatus === 'DONE' ? existing.completedAt ?? new Date() : null,
      },
    });
    if (existing.priority !== 'CRITICAL' && desired.priority === 'CRITICAL' && nextStatus !== 'DONE') {
      createdCriticalTasks.push({...existing, ...desired, status: nextStatus});
    }
  }

  if (input.createEvent && createdCriticalTasks.length) await createCriticalMissionEvent(hypothesis, createdCriticalTasks, locale);

  const tasks = await prisma.researchTask.findMany({
    where: {hypothesisId: hypothesis.id, hypothesis: {ownerId: input.ownerId}},
    orderBy: [{status: 'asc'}, {priority: 'desc'}, {updatedAt: 'desc'}],
  });
  return buildMission(tasks, locale);
}

export async function completeResearchTaskForHypothesis(input: {hypothesisId: string; ownerId: string; type: ResearchTaskType; conditionId?: string | null; breakthroughSessionId?: string | null}) {
  await prisma.researchTask.updateMany({
    where: {
      hypothesisId: input.hypothesisId,
      hypothesis: {ownerId: input.ownerId},
      type: input.type,
      ...(input.conditionId ? {conditionId: input.conditionId} : {}),
      ...(input.breakthroughSessionId ? {breakthroughSessionId: input.breakthroughSessionId} : {}),
      status: {not: 'DONE'},
    },
    data: {status: 'DONE', completedAt: new Date()},
  });
}

function buildMission(tasks: ResearchMissionTask[], locale: ResearchMissionLocale): ResearchMission {
  const sorted = [...tasks].sort(compareTasks);
  const actionable = sorted.filter(task => task.status === 'TODO' || task.status === 'IN_PROGRESS');
  return {
    tasks: sorted,
    currentTask: actionable[0],
    nextTasks: actionable.slice(0, 3),
    completedCount: tasks.filter(task => task.status === 'DONE').length,
    criticalTodoCount: tasks.filter(task => task.priority === 'CRITICAL' && task.status !== 'DONE').length,
    progress: buildProgress(tasks, locale),
  };
}

function buildDesiredTasks(hypothesis: LoadedHypothesis, locale: ResearchMissionLocale): DesiredTask[] {
  const labels = missionCopy(locale);
  const analysis = hypothesis.analyses[0];
  const criticalCondition = hypothesis.conditions.find(condition => condition.importance === 'CRITICAL');
  const criticalSession = criticalCondition
    ? hypothesis.breakthroughSessions.find(session => session.conditionId === criticalCondition.id)
    : null;
  const latestScene = hypothesis.visualScenes[0];
  const engineeringModel = parseEngineeringModel(latestScene?.engineeringModelJson);
  const material = engineeringModel?.materiality
    ? engineeringModel.materiality !== 'abstract'
    : inferMateriality(`${hypothesis.originalTitle} ${hypothesis.originalText}`) !== 'abstract';
  const hasEngineeringModel = Boolean(engineeringModel);
  const latestEvidenceDate = latestDate([
    ...hypothesis.calculationRuns.map(run => run.createdAt),
    ...hypothesis.sources.map(source => source.createdAt),
  ]);
  const engineeringStale = Boolean(hasEngineeringModel && latestEvidenceDate && latestScene?.createdAt && latestEvidenceDate > latestScene.createdAt);
  const hasCalculation = hypothesis.calculationRuns.length > 0;
  const hasSources = hypothesis.sources.length > 0;
  const hasExperiment = hypothesis.experiments.length > 0;

  const tasks: DesiredTask[] = [
    task({
      type: 'FORMALIZE',
      status: analysis ? 'DONE' : 'TODO',
      priority: analysis ? 'LOW' : 'CRITICAL',
      targetSection: 'overview',
      ...labels.tasks.FORMALIZE,
    }),
    task({
      type: 'BUILD_MAP',
      status: hypothesis.conditions.length ? 'DONE' : 'TODO',
      priority: hypothesis.conditions.length ? 'LOW' : 'HIGH',
      targetSection: 'map',
      ...labels.tasks.BUILD_MAP,
    }),
  ];

  if (material) {
    tasks.push(task({
      type: 'BUILD_ENGINEERING_MODEL',
      status: hasEngineeringModel ? 'DONE' : 'TODO',
      priority: hasEngineeringModel ? 'LOW' : 'HIGH',
      targetSection: 'engineering',
      ...labels.tasks.BUILD_ENGINEERING_MODEL,
    }));
  }

  tasks.push(
    task({
      type: 'RUN_CALCULATION',
      status: hasCalculation ? 'DONE' : 'TODO',
      priority: hasCalculation ? 'LOW' : 'HIGH',
      targetSection: 'calculations',
      ...labels.tasks.RUN_CALCULATION,
    }),
    task({
      type: 'DISCOVER_SOURCES',
      status: hasSources ? 'DONE' : 'TODO',
      priority: hasSources ? 'LOW' : 'HIGH',
      targetSection: 'sources',
      ...labels.tasks.DISCOVER_SOURCES,
    })
  );

  if (criticalCondition) {
    tasks.push(task({
      type: 'START_BREAKTHROUGH',
      status: criticalSession ? 'DONE' : 'TODO',
      priority: criticalSession ? 'LOW' : 'CRITICAL',
      targetSection: 'breakthroughs',
      conditionId: criticalCondition.id,
      title: template(labels.tasks.START_BREAKTHROUGH.title, {condition: criticalCondition.title}),
      description: labels.tasks.START_BREAKTHROUGH.description,
      actionLabel: labels.tasks.START_BREAKTHROUGH.actionLabel,
    }));
  }

  if (hasCalculation || hasSources) {
    tasks.push(task({
      type: 'DESIGN_EXPERIMENT',
      status: hasExperiment ? 'DONE' : 'TODO',
      priority: hasExperiment ? 'LOW' : 'MEDIUM',
      targetSection: 'experiments',
      ...labels.tasks.DESIGN_EXPERIMENT,
    }));
  }

  if (material && hasEngineeringModel && (hasCalculation || hasSources)) {
    tasks.push(task({
      type: 'UPDATE_MODEL',
      status: engineeringStale ? 'TODO' : 'DONE',
      priority: engineeringStale ? 'HIGH' : 'LOW',
      targetSection: 'engineering',
      ...labels.tasks.UPDATE_MODEL,
    }));
  }

  if (hasEngineeringModel && hasCalculation && hasSources && hasExperiment && (!criticalCondition || criticalSession)) {
    tasks.push(task({
      type: 'REVIEW_RESULTS',
      status: 'TODO',
      priority: 'MEDIUM',
      targetSection: 'lab-log',
      ...labels.tasks.REVIEW_RESULTS,
    }));
  }

  return tasks;
}

function task(input: DesiredTask): DesiredTask {
  return input;
}

function nextTaskStatus(current: ResearchTaskStatus, desired: ResearchTaskStatus, type: ResearchTaskType): ResearchTaskStatus {
  if (type === 'UPDATE_MODEL') return desired;
  if (current === 'DONE' && desired !== 'TODO') return current;
  return desired;
}

async function createCriticalMissionEvent(hypothesis: LoadedHypothesis, tasks: ResearchMissionTask[], locale: ResearchMissionLocale) {
  const latestSession = hypothesis.breakthroughSessions[0];
  if (!latestSession) return;
  await prisma.breakthroughEvent.create({
    data: {
      sessionId: latestSession.id,
      type: 'AI_REASONING_STEP',
      content: toPrismaJsonObject({
        eventKey: 'RESEARCH_MISSION_CRITICAL_TASK',
        message: locale === 'ru' ? 'Создана критическая задача миссии исследования.' : 'A critical research mission task was created.',
        hypothesisId: hypothesis.id,
        taskIds: tasks.map(task => task.id),
        taskTitles: tasks.map(task => task.title),
      }),
    },
  });
}

function loadMissionHypothesis(hypothesisId: string, ownerId: string) {
  return prisma.hypothesis.findFirst({
    where: {id: hypothesisId, ownerId},
    include: {
      analyses: {orderBy: {createdAt: 'desc'}, take: 1},
      conditions: {orderBy: [{importance: 'asc'}, {createdAt: 'asc'}]},
      visualScenes: {take: 1, orderBy: {createdAt: 'desc'}},
      experiments: {orderBy: {createdAt: 'desc'}},
      sources: {orderBy: {createdAt: 'desc'}},
      calculationRuns: {orderBy: {createdAt: 'desc'}},
      breakthroughSessions: {where: {ownerId}, orderBy: {createdAt: 'desc'}},
      researchTasks: {orderBy: [{status: 'asc'}, {priority: 'desc'}, {updatedAt: 'desc'}]},
    },
  });
}

function taskKey(task: {type: ResearchTaskType; conditionId?: string | null; breakthroughSessionId?: string | null}) {
  return [task.type, task.conditionId || 'none', task.breakthroughSessionId || 'none'].join(':');
}

function desiredTaskKey(task: DesiredTask) {
  return [task.type, task.conditionId || 'none', task.breakthroughSessionId || 'none'].join(':');
}

function compareTasks(left: ResearchMissionTask, right: ResearchMissionTask): number {
  return statusWeight[right.status] - statusWeight[left.status]
    || priorityWeight[right.priority] - priorityWeight[left.priority]
    || right.updatedAt.getTime() - left.updatedAt.getTime();
}

function buildProgress(tasks: ResearchMissionTask[], locale: ResearchMissionLocale) {
  const labels = missionCopy(locale);
  return [
    {key: 'intake', label: labels.steps.intake, status: statusFor(tasks, 'FORMALIZE')},
    {key: 'map', label: labels.steps.map, status: statusFor(tasks, 'BUILD_MAP')},
    {key: 'model', label: labels.steps.model, status: statusFor(tasks, 'BUILD_ENGINEERING_MODEL')},
    {key: 'calculate', label: labels.steps.calculate, status: statusFor(tasks, 'RUN_CALCULATION')},
    {key: 'sources', label: labels.steps.sources, status: statusFor(tasks, 'DISCOVER_SOURCES')},
    {key: 'breakthrough', label: labels.steps.breakthrough, status: statusFor(tasks, 'START_BREAKTHROUGH')},
    {key: 'experiment', label: labels.steps.experiment, status: statusFor(tasks, 'DESIGN_EXPERIMENT')},
    {key: 'review', label: labels.steps.review, status: statusFor(tasks, 'REVIEW_RESULTS')},
  ];
}

function statusFor(tasks: ResearchMissionTask[], type: ResearchTaskType): ResearchTaskStatus {
  const task = tasks.find(item => item.type === type);
  return task?.status ?? 'TODO';
}

function latestDate(values: Date[]): Date | null {
  if (!values.length) return null;
  return values.reduce((latest, value) => value > latest ? value : latest, values[0]);
}

function inferMateriality(text: string): 'material' | 'abstract' | 'hybrid' {
  const normalized = text.toLowerCase();
  const abstractHints = ['ethics', 'consciousness', 'justice', 'belief', 'идея', 'сознание', 'справедливость', 'ценность'];
  const materialHints = ['device', 'machine', 'material', 'battery', 'reactor', 'vehicle', 'engine', 'sensor', 'bridge', 'shield', 'устройство', 'машина', 'материал', 'батарея', 'реактор', 'двигатель', 'мост', 'щит'];
  const abstract = abstractHints.some(hint => normalized.includes(hint));
  const material = materialHints.some(hint => normalized.includes(hint));
  if (material && abstract) return 'hybrid';
  if (material) return 'material';
  return abstract ? 'abstract' : 'material';
}

function template(value: string, variables: Record<string, string>): string {
  return Object.entries(variables).reduce((result, [key, replacement]) => result.replace(`{${key}}`, replacement), value);
}

function missionCopy(locale: ResearchMissionLocale) {
  if (locale === 'ru') return {
    steps: {
      intake: 'Ввод',
      map: 'Карта',
      model: 'Модель',
      calculate: 'Расчёт',
      sources: 'Источники',
      breakthrough: 'Прорыв',
      experiment: 'Эксперимент',
      review: 'Обзор',
    },
    tasks: {
      FORMALIZE: {title: 'Формализовать гипотезу', description: 'Сохранить каноническое описание и первичный научный разбор.', actionLabel: 'Открыть обзор'},
      BUILD_MAP: {title: 'Построить карту условий', description: 'Разложить гипотезу на условия, зависимости и блокеры.', actionLabel: 'Открыть карту'},
      BUILD_ENGINEERING_MODEL: {title: 'Собрать инженерную модель', description: 'Построить физическую архитектуру объекта и geometryPlan.', actionLabel: 'Пересобрать модель'},
      RUN_CALCULATION: {title: 'Запустить грубый расчёт', description: 'Получить численный ориентир по порядкам величин и разрывам.', actionLabel: 'Запустить расчёт'},
      DISCOVER_SOURCES: {title: 'Найти источники', description: 'Добавить кандидаты источников для проверки научных ограничений.', actionLabel: 'Найти источники'},
      START_BREAKTHROUGH: {title: 'Начать прорыв: {condition}', description: 'Открыть фокусную сессию для критического блокера.', actionLabel: 'Начать прорыв'},
      DESIGN_EXPERIMENT: {title: 'Спроектировать эксперимент', description: 'Связать расчёты и источники с проверяемым экспериментом.', actionLabel: 'Открыть эксперименты'},
      REVIEW_RESULTS: {title: 'Проверить результаты', description: 'Просмотреть журнал, выбрать следующий блокер и уточнить модель.', actionLabel: 'Открыть журнал'},
      UPDATE_MODEL: {title: 'Обновить инженерную модель', description: 'Новые расчёты или источники появились после последней модели.', actionLabel: 'Пересобрать модель'},
    },
  } as const;
  return {
    steps: {
      intake: 'Intake',
      map: 'Map',
      model: 'Model',
      calculate: 'Calculate',
      sources: 'Sources',
      breakthrough: 'Breakthrough',
      experiment: 'Experiment',
      review: 'Review',
    },
    tasks: {
      FORMALIZE: {title: 'Formalize hypothesis', description: 'Persist the canonical description and first scientific analysis.', actionLabel: 'Open overview'},
      BUILD_MAP: {title: 'Build condition map', description: 'Decompose the hypothesis into conditions, dependencies and blockers.', actionLabel: 'Open map'},
      BUILD_ENGINEERING_MODEL: {title: 'Build engineering model', description: 'Create the physical architecture and geometryPlan for the artifact.', actionLabel: 'Regenerate model'},
      RUN_CALCULATION: {title: 'Run rough calculation', description: 'Create a numerical order-of-magnitude baseline and gap estimate.', actionLabel: 'Run calculation'},
      DISCOVER_SOURCES: {title: 'Discover sources', description: 'Attach source candidates for checking scientific constraints.', actionLabel: 'Discover sources'},
      START_BREAKTHROUGH: {title: 'Start breakthrough: {condition}', description: 'Open a focused session for the critical blocker.', actionLabel: 'Start breakthrough'},
      DESIGN_EXPERIMENT: {title: 'Design experiment', description: 'Connect calculations and sources to a testable experiment path.', actionLabel: 'Open experiments'},
      REVIEW_RESULTS: {title: 'Review results', description: 'Inspect the Lab Log, choose the next blocker and refine the model.', actionLabel: 'Open Lab Log'},
      UPDATE_MODEL: {title: 'Update engineering model', description: 'New calculations or sources appeared after the last model build.', actionLabel: 'Regenerate model'},
    },
  } as const;
}
