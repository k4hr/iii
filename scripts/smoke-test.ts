import {
  BreakthroughEventType,
  BreakthroughStatus,
  Locale,
  PrismaClient,
  Scale,
} from '@prisma/client';
import {loadEnvConfig} from '@next/env';
import {runOrderOfMagnitudeCalculation} from '../src/lib/calculations/order-of-magnitude';
import {createHypothesisRecord} from '../src/lib/hypotheses/create-hypothesis-record';
import {toPrismaJson, toPrismaJsonObject} from '../src/lib/prisma/safe-json';

loadEnvConfig(process.cwd());
process.env.AI_MODE = 'mock';

const prisma = new PrismaClient();
const TEST_EMAIL = 'runtime-smoke@theoryforge.local';
const TEST_TITLE = '[SMOKE] Носимый аккумуляторный исследовательский костюм';

async function main() {
  ensureDatabaseUrl();

  const user = await prisma.user.upsert({
    where: {email: TEST_EMAIL},
    update: {name: 'Runtime Smoke Test', locale: Locale.RU},
    create: {email: TEST_EMAIL, name: 'Runtime Smoke Test', locale: Locale.RU},
    select: {id: true, email: true},
  });

  const project = await prisma.project.findFirst({where: {ownerId: user.id, title: '[SMOKE] Runtime Core Flow'}, select: {id: true}})
    ?? await prisma.project.create({data: {ownerId: user.id, title: '[SMOKE] Runtime Core Flow'}, select: {id: true}});

  await prisma.hypothesis.deleteMany({where: {ownerId: user.id, originalTitle: TEST_TITLE}});

  const created = await createHypothesisRecord(prisma, {
    ownerId: user.id,
    projectId: project.id,
    title: TEST_TITLE,
    rawText: 'Проверить компактный литиевый аккумулятор для носимого инженерного костюма с безопасным тепловым контуром.',
    domain: 'materials-engineering',
    locale: 'ru',
  });

  const hypothesis = await prisma.hypothesis.findFirst({
    where: {id: created.hypothesisId, ownerId: user.id},
    include: {
      analyses: {where: {id: created.analysisId}, include: {translations: true}},
      visualScenes: true,
      conditions: {orderBy: {createdAt: 'asc'}},
    },
  });
  assert(hypothesis, 'Private hypothesis was not created.');

  const analysis = hypothesis.analyses[0];
  assert(analysis, 'HypothesisAnalysis was not created.');
  assert(Object.values(Scale).includes(analysis.scale), 'HypothesisAnalysis.scale is invalid.');
  assert(analysis.canonicalJson !== null, 'HypothesisAnalysis.canonicalJson is missing.');
  assert(analysis.translations.some(item => item.locale === Locale.RU), 'Russian analysis translation is missing.');

  const visualScene = hypothesis.visualScenes[0];
  assert(visualScene, 'VisualScene was not created.');
  assert(/^[a-z][a-z0-9_]*$/.test(visualScene.sceneType), 'VisualScene.sceneType must remain a non-translated service key.');
  assert(Object.values(Scale).includes(visualScene.scale), 'VisualScene.scale is invalid.');
  assert(Array.isArray(visualScene.objectsJson), 'VisualScene.objectsJson must be an array.');
  assert(Array.isArray(visualScene.variablesJson), 'VisualScene.variablesJson must be an array.');
  assert(Array.isArray(visualScene.constraintsJson), 'VisualScene.constraintsJson must be an array.');
  assert(Array.isArray(visualScene.measurementsJson), 'VisualScene.measurementsJson must be an array.');
  assert(hypothesis.conditions.length > 0, 'No hypothesis conditions were created.');

  const condition = hypothesis.conditions[0];
  const estimate = runOrderOfMagnitudeCalculation({
    locale: 'ru',
    hypothesisTitle: hypothesis.originalTitle,
    hypothesisText: hypothesis.originalText,
    scale: analysis.scale || Scale.UNKNOWN,
    realityGap: analysis.realityGap,
    conditionTitle: condition.title,
    conditionDescription: condition.description,
    conditionStatus: condition.status,
    conditionImportance: condition.importance,
    completionScore: condition.completionScore,
  });

  const result = await prisma.$transaction(async tx => {
    const session = await tx.breakthroughSession.create({
      data: {
        ownerId: user.id,
        projectId: project.id,
        hypothesisId: hypothesis.id,
        conditionId: condition.id,
        title: condition.title,
        status: BreakthroughStatus.ACTIVE,
        problemStatement: condition.description,
        ifSolvedImpact: toPrismaJsonObject(condition.ifSolvedImpactJson),
        knownState: toPrismaJsonObject({known: condition.knownWhat}),
        missingPieces: toPrismaJsonObject({unknown: condition.unknownWhat, requiredEvidence: condition.requiredEvidence}),
        blockers: toPrismaJson(condition.blockers, []),
        conflicts: toPrismaJson(condition.conflicts, []),
        possiblePaths: toPrismaJson(condition.possibleWorkarounds, []),
        ...(condition.testMethod ? {currentBestPath: condition.testMethod} : {}),
        progressScore: Number.isFinite(condition.completionScore) ? condition.completionScore : 0,
      },
      select: {id: true},
    });

    const calculation = await tx.calculationRun.create({
      data: {
        hypothesisId: hypothesis.id,
        conditionId: condition.id,
        breakthroughSessionId: session.id,
        title: estimate.title,
        calculationType: estimate.calculationType,
        inputJson: toPrismaJsonObject(estimate.input),
        resultJson: toPrismaJsonObject(estimate.result),
        explanation: estimate.explanation,
      },
      select: {id: true},
    });

    const event = await tx.breakthroughEvent.create({
      data: {
        sessionId: session.id,
        type: BreakthroughEventType.CALCULATION_RUN,
        content: toPrismaJsonObject({
          message: 'Расчёт smoke-теста выполнен.',
          calculationRunId: calculation.id,
          hypothesisId: hypothesis.id,
          gapOrders: estimate.result.gapOrders,
          gapLevel: estimate.result.gapLevel,
        }),
      },
      select: {id: true, type: true},
    });

    return {session, calculation, event};
  });

  const verifiedEvent = await prisma.breakthroughEvent.findFirst({
    where: {id: result.event.id, session: {ownerId: user.id, hypothesisId: hypothesis.id}},
  });
  assert(verifiedEvent, 'BreakthroughEvent/Lab Log source was not created.');
  assert(verifiedEvent.type === BreakthroughEventType.CALCULATION_RUN, 'BreakthroughEvent has the wrong type.');

  console.log('TheoryForge Runtime Smoke Test: SUCCESS');
  console.log(`user=${user.email}`);
  console.log(`hypothesis=${hypothesis.id}`);
  console.log(`analysis=${analysis.id} scale=${analysis.scale}`);
  console.log(`visualScene=${visualScene.id} sceneType=${visualScene.sceneType} scale=${visualScene.scale}`);
  console.log(`conditions=${hypothesis.conditions.length}`);
  console.log(`calculation=${result.calculation.id} gap=${estimate.result.gapOrders} OOM`);
  console.log(`breakthrough=${result.session.id}`);
  console.log(`labLogEvent=${verifiedEvent.id} type=${verifiedEvent.type}`);
}

function ensureDatabaseUrl() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required to run smoke:test.');
}

function assert<T>(value: T, message: string): asserts value is NonNullable<T> {
  if (!value) throw new Error(message);
}

main()
  .catch(error => {
    console.error('TheoryForge Runtime Smoke Test: FAILED');
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
