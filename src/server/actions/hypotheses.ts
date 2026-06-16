'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {Scale} from '@prisma/client';
import {prisma} from '@/lib/db/prisma';
import {createHypothesisRecord} from '@/lib/hypotheses/create-hypothesis-record';
import {getOpenAIClient} from '@/lib/ai/openai-client';
import {generateEngineeringModel} from '@/lib/engineering/generate-engineering-model';
import {
  engineeringModelSchema,
  engineeringPhysicalModuleSchema,
  parseEngineeringModel,
  type CanonicalEngineeringGeometryPrimitive,
  type CanonicalEngineeringModel,
  type CanonicalEngineeringPhysicalModule,
} from '@/lib/engineering/engineering-model-schema';
import {getConditionImportanceLabel} from '@/lib/locale/enum-labels';
import {routeLocaleToPrisma} from '@/lib/locale/locale';
import {localizeMockValue} from '@/lib/locale/mock-copy';
import {toPrismaJson, toPrismaJsonObject} from '@/lib/prisma/safe-json';
import {requireCurrentUser} from '@/lib/auth/current-user';

export async function createProjectAction(locale: string, formData: FormData) {
  const user = await requireCurrentUser();
  const title = String(formData.get('title') || '').trim();
  const description = String(formData.get('description') || '').trim();
  if (!title) return;
  await prisma.project.create({data: {ownerId: user.id, title, ...(description ? {description} : {})}});
  redirect(`/${locale}/projects`);
}

export async function createHypothesisAction(locale: string, formData: FormData) {
  const user = await requireCurrentUser();
  const title = String(formData.get('title') || '').trim();
  const rawText = String(formData.get('rawText') || '').trim();
  const domain = String(formData.get('domain') || '').trim();
  const projectId = String(formData.get('projectId') || '').trim();
  if (!title || !rawText) return;

  const project = projectId
    ? await prisma.project.findFirst({where: {id: projectId, ownerId: user.id}, select: {id: true}})
    : null;
  if (projectId && !project) throw new Error('Project not found in the current workspace.');

  getOpenAIClient();
  const hypothesis = await createHypothesisRecord(prisma, {
    ownerId: user.id,
    ...(project?.id ? {projectId: project.id} : {}),
    title,
    rawText,
    ...(domain ? {domain} : {}),
    locale,
  });

  redirect(`/${locale}/hypotheses/${hypothesis.hypothesisId}`);
}

export async function startBreakthroughAction(locale: string, conditionId: string) {
  const user = await requireCurrentUser();
  const condition = await prisma.hypothesisCondition.findFirst({
    include: {hypothesis: true},
    where: {id: conditionId, hypothesis: {ownerId: user.id}},
  });
  if (!condition) return;

  const localized = localizeMockValue(condition, locale);
  const session = await prisma.breakthroughSession.create({
    data: {
      ownerId: user.id,
      ...(condition.hypothesis.projectId ? {projectId: condition.hypothesis.projectId} : {}),
      hypothesisId: condition.hypothesisId,
      conditionId: condition.id,
      title: localized.title,
      problemStatement: localized.description,
      whyItMatters: locale === 'ru'
        ? `Это условие имеет уровень «${getConditionImportanceLabel(condition.importance, locale)}» и необходимо для работоспособности гипотезы.`
        : `This condition is marked ${getConditionImportanceLabel(condition.importance, locale)} and is required for the hypothesis to work.`,
      ifSolvedImpact: toPrismaJsonObject(localizeMockValue(condition.ifSolvedImpactJson, locale)),
      knownState: toPrismaJsonObject(locale === 'ru' ? {известно: localized.knownWhat} : {known: localized.knownWhat}),
      missingPieces: toPrismaJsonObject(locale === 'ru'
        ? {неизвестно: localized.unknownWhat, необходимые_данные: localized.requiredEvidence}
        : {unknown: localized.unknownWhat, requiredEvidence: localized.requiredEvidence}),
      blockers: toPrismaJson(localizeMockValue(condition.blockers, locale), []),
      conflicts: toPrismaJson(localizeMockValue(condition.conflicts, locale), []),
      possiblePaths: toPrismaJson(localizeMockValue(condition.possibleWorkarounds, locale), []),
      ...(localized.testMethod ? {currentBestPath: localized.testMethod} : {}),
      progressScore: Number.isFinite(condition.completionScore) ? condition.completionScore : 0,
      events: {
        create: {
          type: 'STATUS_CHANGED',
          content: toPrismaJsonObject({message: locale === 'ru' ? 'Сессия поиска прорыва начата.' : 'Breakthrough session started.'}),
        },
      },
    },
  });
  redirect(`/${locale}/breakthroughs/${session.id}`);
}

export async function regenerateEngineeringModelAction(locale: string, hypothesisId: string) {
  const user = await requireCurrentUser();
  const routeLocale = locale === 'ru' ? 'ru' : 'en';
  const analysisLocale = routeLocaleToPrisma(routeLocale);
  const hypothesis = await prisma.hypothesis.findFirst({
    where: {id: hypothesisId, ownerId: user.id},
    include: {
      analyses: {orderBy: {createdAt: 'desc'}, take: 1, include: {translations: true}},
      conditions: {orderBy: [{importance: 'asc'}, {createdAt: 'asc'}]},
      calculationRuns: {orderBy: {createdAt: 'desc'}},
      sources: {orderBy: {createdAt: 'desc'}},
      experiments: {orderBy: {createdAt: 'desc'}},
      breakthroughSessions: {where: {ownerId: user.id}, orderBy: {updatedAt: 'desc'}},
      visualScenes: {take: 1, orderBy: {createdAt: 'desc'}},
    },
  });
  const analysis = hypothesis?.analyses[0];
  if (!hypothesis || !analysis) throw new Error('Hypothesis not found in the current workspace.');

  const translation = analysis.translations.find(item => item.locale === analysisLocale)
    ?? analysis.translations.find(item => item.locale === hypothesis.analysisLocale)
    ?? analysis.translations[0];
  const conditions = hypothesis.conditions.map(condition => localizeMockValue(condition, routeLocale));
  const sources = hypothesis.sources.map(source => localizeMockValue(source, routeLocale));
  const experiments = hypothesis.experiments.map(experiment => localizeMockValue(experiment, routeLocale));
  const breakthroughSessions = hypothesis.breakthroughSessions.map(session => localizeMockValue(session, routeLocale));

  const model = await generateEngineeringModel({
    locale: routeLocale,
    hypothesis: {id: hypothesis.id, title: hypothesis.originalTitle, text: hypothesis.originalText},
    analysis: {
      summary: translation?.summary,
      formalizedClaim: translation?.formalizedClaim,
      knownScience: translation?.knownScience,
      physicalConstraints: translation?.physicalConstraints,
      engineeringConstraints: translation?.engineeringConstraints,
      contradictions: translation?.contradictions,
      unknowns: translation?.unknowns,
      mainBlockers: analysis.mainBlockersJson,
      researchProgress: analysis.researchProgress,
      functionalityProgress: analysis.functionalityProgress,
      testabilityProgress: analysis.testabilityProgress,
      confidence: analysis.confidence,
    },
    conditions: conditions.map(condition => ({
      id: condition.id,
      title: condition.title,
      description: condition.description,
      status: condition.status,
      importance: condition.importance,
      completionScore: condition.completionScore,
      blockers: condition.blockers,
      parentId: condition.parentId,
    })),
    calculations: hypothesis.calculationRuns.map(calculation => ({
      id: calculation.id,
      conditionId: calculation.conditionId,
      title: calculation.title,
      resultJson: calculation.resultJson,
      gapOrders: jsonNumber(jsonRecord(calculation.resultJson).gapOrders),
    })),
    sources: sources.map(source => ({
      id: source.id,
      conditionId: source.conditionId,
      title: source.title,
      relationship: source.relationshipToHypothesis,
    })),
    experiments: experiments.map(experiment => ({
      id: experiment.id,
      conditionId: experiment.conditionId,
      title: experiment.title,
    })),
    breakthroughSessions: breakthroughSessions.map(session => ({
      id: session.id,
      conditionId: session.conditionId,
      title: session.title,
      progressScore: session.progressScore,
    })),
  });

  const latestScene = hypothesis.visualScenes[0];
  const latestSession = hypothesis.breakthroughSessions[0];
  await prisma.$transaction(async tx => {
    const scene = latestScene
      ? await tx.visualScene.update({
          where: {id: latestScene.id},
          data: {engineeringModelJson: toPrismaJson(model)},
          select: {id: true},
        })
      : await tx.visualScene.create({
          data: {
            hypothesisId: hypothesis.id,
            analysisId: analysis.id,
            sceneType: 'generic_model',
            scale: analysis.scale || Scale.UNKNOWN,
            objectsJson: [],
            variablesJson: [],
            constraintsJson: [],
            measurementsJson: [],
            engineeringModelJson: toPrismaJson(model),
          },
          select: {id: true},
        });

    if (latestSession) {
      await tx.breakthroughEvent.create({
        data: {
          sessionId: latestSession.id,
          type: 'AI_REASONING_STEP',
          content: toPrismaJsonObject({
            eventKey: 'ENGINEERING_MODEL_REGENERATED',
            message: routeLocale === 'ru' ? 'Инженерная модель пересобрана.' : 'Engineering model regenerated.',
            hypothesisId: hypothesis.id,
            visualSceneId: scene.id,
            physicalModules: model.physicalModules.length,
            researchOverlays: model.researchOverlays.length,
          }),
        },
      });
    }
  });

  revalidatePath(`/${routeLocale}/hypotheses/${hypothesis.id}`);
  if (latestSession) revalidatePath(`/${routeLocale}/breakthroughs/${latestSession.id}`);
}

export async function updateEngineeringModelAction(locale: string, hypothesisId: string, patch: unknown) {
  const user = await requireCurrentUser();
  const routeLocale = locale === 'ru' ? 'ru' : 'en';
  const parsed = engineeringModelSchema.safeParse(patch);
  if (!parsed.success) throw new Error('Invalid engineering model patch.');
  const context = await loadEngineeringEditContext(user.id, hypothesisId, parsed.data);
  validateEngineeringModelIntegrity(parsed.data);
  assertProtectedModulesPreserved(context.previousModel, parsed.data);
  await persistEngineeringModelUpdate({locale: routeLocale, ...context, model: parsed.data});
}

export async function addEngineeringModuleAction(locale: string, hypothesisId: string, module: unknown) {
  const user = await requireCurrentUser();
  const routeLocale = locale === 'ru' ? 'ru' : 'en';
  const context = await loadEngineeringEditContext(user.id, hypothesisId);
  const parsed = engineeringPhysicalModuleSchema.safeParse(module);
  if (!parsed.success) throw new Error('Invalid engineering module.');
  const newModule = ensureUserModuleId(parsed.data);
  if (context.currentModel.physicalModules.some(item => item.id === newModule.id)) throw new Error('Engineering module already exists.');
  const primitive = defaultPrimitiveForModule(newModule, context.currentModel.geometryPlan.primitives);
  const model: CanonicalEngineeringModel = {
    ...context.currentModel,
    physicalModules: [...context.currentModel.physicalModules, newModule],
    geometryPlan: {
      ...context.currentModel.geometryPlan,
      primitives: [...context.currentModel.geometryPlan.primitives, primitive],
      connectors: context.currentModel.geometryPlan.primitives[0]
        ? [...context.currentModel.geometryPlan.connectors, {fromPrimitiveId: context.currentModel.geometryPlan.primitives[0].id, toPrimitiveId: primitive.id, type: 'structural'}]
        : context.currentModel.geometryPlan.connectors,
    },
  };
  validateEngineeringModelIntegrity(model);
  await persistEngineeringModelUpdate({locale: routeLocale, ...context, model});
}

export async function deleteEngineeringModuleAction(locale: string, hypothesisId: string, moduleId: string) {
  const user = await requireCurrentUser();
  const routeLocale = locale === 'ru' ? 'ru' : 'en';
  const context = await loadEngineeringEditContext(user.id, hypothesisId);
  if (!moduleId.startsWith('user-')) throw new Error('Only user-added modules can be deleted.');
  if (!context.currentModel.physicalModules.some(module => module.id === moduleId)) return;
  const removedPrimitiveIds = new Set(context.currentModel.geometryPlan.primitives.filter(primitive => primitive.moduleId === moduleId).map(primitive => primitive.id));
  const model: CanonicalEngineeringModel = {
    ...context.currentModel,
    physicalModules: context.currentModel.physicalModules.filter(module => module.id !== moduleId),
    interfaces: context.currentModel.interfaces.filter(link => link.fromModuleId !== moduleId && link.toModuleId !== moduleId),
    researchOverlays: context.currentModel.researchOverlays.filter(overlay => overlay.linkedModuleId !== moduleId),
    geometryPlan: {
      ...context.currentModel.geometryPlan,
      primitives: context.currentModel.geometryPlan.primitives.filter(primitive => primitive.moduleId !== moduleId),
      connectors: context.currentModel.geometryPlan.connectors.filter(connector => !removedPrimitiveIds.has(connector.fromPrimitiveId) && !removedPrimitiveIds.has(connector.toPrimitiveId)),
    },
  };
  validateEngineeringModelIntegrity(model);
  await persistEngineeringModelUpdate({locale: routeLocale, ...context, model});
}

export async function resetEngineeringModelAction(locale: string, hypothesisId: string) {
  await regenerateEngineeringModelAction(locale, hypothesisId);
}

type EngineeringEditContext = {
  hypothesis: LoadedEngineeringHypothesis;
  analysisId: string;
  analysisScale: Scale;
  visualSceneId?: string;
  latestSessionId?: string;
  currentModel: CanonicalEngineeringModel;
  previousModel: CanonicalEngineeringModel | null;
};

type LoadedEngineeringHypothesis = NonNullable<Awaited<ReturnType<typeof loadEngineeringHypothesis>>>;

async function loadEngineeringEditContext(userId: string, hypothesisId: string, fallbackModel?: CanonicalEngineeringModel): Promise<EngineeringEditContext> {
  const hypothesis = await loadEngineeringHypothesis(userId, hypothesisId);
  const analysis = hypothesis?.analyses[0];
  const scene = hypothesis?.visualScenes[0];
  const previousModel = parseEngineeringModel(scene?.engineeringModelJson);
  const currentModel = previousModel ?? fallbackModel ?? null;
  if (!hypothesis || !analysis || !currentModel) throw new Error('Engineering model not found in the current workspace.');
  return {
    hypothesis,
    analysisId: analysis.id,
    analysisScale: analysis.scale || Scale.UNKNOWN,
    visualSceneId: scene?.id,
    latestSessionId: hypothesis.breakthroughSessions[0]?.id,
    currentModel,
    previousModel,
  };
}

async function loadEngineeringHypothesis(userId: string, hypothesisId: string) {
  return prisma.hypothesis.findFirst({
    where: {id: hypothesisId, ownerId: userId},
    include: {
      analyses: {orderBy: {createdAt: 'desc'}, take: 1},
      visualScenes: {take: 1, orderBy: {createdAt: 'desc'}},
      breakthroughSessions: {where: {ownerId: userId}, orderBy: {updatedAt: 'desc'}, take: 1},
    },
  });
}

async function persistEngineeringModelUpdate(input: EngineeringEditContext & {locale: 'en' | 'ru'; model: CanonicalEngineeringModel}) {
  const message = input.locale === 'ru' ? 'Инженерная модель изменена' : 'Engineering model updated';
  const scene = await prisma.$transaction(async tx => {
    const savedScene = input.visualSceneId
      ? await tx.visualScene.update({
          where: {id: input.visualSceneId},
          data: {engineeringModelJson: toPrismaJson(input.model)},
          select: {id: true},
        })
      : await tx.visualScene.create({
          data: {
            hypothesisId: input.hypothesis.id,
            analysisId: input.analysisId,
            sceneType: 'generic_model',
            scale: input.analysisScale,
            objectsJson: [],
            variablesJson: [],
            constraintsJson: [],
            measurementsJson: [],
            engineeringModelJson: toPrismaJson(input.model),
          },
          select: {id: true},
        });

    const latestVersion = await tx.hypothesisVersion.aggregate({
      where: {hypothesisId: input.hypothesis.id},
      _max: {versionNumber: true},
    });
    await tx.hypothesisVersion.create({
      data: {
        hypothesisId: input.hypothesis.id,
        versionNumber: (latestVersion._max.versionNumber ?? 0) + 1,
        title: input.hypothesis.originalTitle,
        text: input.hypothesis.originalText,
        canonicalTextEn: input.hypothesis.canonicalTextEn,
        changeSummary: 'ENGINEERING_MODEL_UPDATED',
      },
    });

    if (input.latestSessionId) {
      await tx.breakthroughEvent.create({
        data: {
          sessionId: input.latestSessionId,
          type: 'AI_REASONING_STEP',
          content: toPrismaJsonObject({
            eventKey: 'ENGINEERING_MODEL_UPDATED',
            message,
            hypothesisId: input.hypothesis.id,
            visualSceneId: savedScene.id,
            physicalModules: input.model.physicalModules.length,
            primitives: input.model.geometryPlan.primitives.length,
            previousEngineeringModelJson: input.previousModel,
          }),
        },
      });
    }
    return savedScene;
  });

  revalidatePath(`/${input.locale}/hypotheses/${input.hypothesis.id}`);
  if (input.latestSessionId) revalidatePath(`/${input.locale}/breakthroughs/${input.latestSessionId}`);
  return scene;
}

function validateEngineeringModelIntegrity(model: CanonicalEngineeringModel) {
  const moduleIds = new Set(model.physicalModules.map(module => module.id));
  const primitiveIds = new Set(model.geometryPlan.primitives.map(primitive => primitive.id));
  const duplicatePrimitiveIds = model.geometryPlan.primitives.length !== primitiveIds.size;
  if (duplicatePrimitiveIds || model.physicalModules.length !== moduleIds.size) throw new Error('Engineering model contains duplicate ids.');
  for (const primitive of model.geometryPlan.primitives) if (!moduleIds.has(primitive.moduleId)) throw new Error('Geometry primitive is linked to an unknown module.');
  for (const overlay of model.researchOverlays) if (!moduleIds.has(overlay.linkedModuleId)) throw new Error('Research overlay is linked to an unknown module.');
  for (const link of model.interfaces) if (!moduleIds.has(link.fromModuleId) || !moduleIds.has(link.toModuleId)) throw new Error('Engineering interface is linked to an unknown module.');
  for (const connector of model.geometryPlan.connectors) if (!primitiveIds.has(connector.fromPrimitiveId) || !primitiveIds.has(connector.toPrimitiveId)) throw new Error('Geometry connector is linked to an unknown primitive.');
}

function assertProtectedModulesPreserved(previousModel: CanonicalEngineeringModel | null, nextModel: CanonicalEngineeringModel) {
  if (!previousModel) return;
  const nextIds = new Set(nextModel.physicalModules.map(module => module.id));
  for (const module of previousModel.physicalModules) {
    if (!module.id.startsWith('user-') && !nextIds.has(module.id)) throw new Error('AI-generated modules cannot be deleted from the editor.');
  }
}

function ensureUserModuleId(module: CanonicalEngineeringPhysicalModule): CanonicalEngineeringPhysicalModule {
  const id = module.id.startsWith('user-') ? module.id : `user-${module.id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 70)}`;
  return {...module, id};
}

function defaultPrimitiveForModule(module: CanonicalEngineeringPhysicalModule, primitives: CanonicalEngineeringGeometryPrimitive[]): CanonicalEngineeringGeometryPrimitive {
  const base = primitives.find(primitive => primitive.moduleId === module.id)?.position ?? [0, 0, 0] as [number, number, number];
  return {
    id: `user-primitive-${module.id}`,
    moduleId: module.id,
    shape: module.category === 'energy' ? 'cell_stack' : module.category === 'propulsion' || module.category === 'lift' ? 'cylinder' : module.category === 'sensor' || module.category === 'measurement' ? 'sphere' : 'rounded_box',
    position: [Math.max(-20, Math.min(20, base[0] + 0.35)), base[1], base[2]],
    rotation: [0, 0, 0],
    scale: [.55, .34, .45],
    materialRole: module.category === 'energy' ? 'energy' : module.category === 'propulsion' || module.category === 'lift' ? 'propulsion' : module.category === 'control' ? 'control' : module.category === 'thermal' ? 'thermal' : module.category === 'sensor' || module.category === 'measurement' ? 'sensor' : module.category === 'safety' ? 'shield' : 'structure',
    opacity: .78,
  };
}

function jsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function jsonNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
