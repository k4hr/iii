import {Prisma, PrismaClient, Locale} from '@prisma/client';
import {detectLanguage} from '../src/lib/ai/detect-language';
import {createCanonicalHypothesis} from '../src/lib/ai/create-canonical-hypothesis';
import {analyzeHypothesisMock} from '../src/lib/ai/analyze-hypothesis';

const prisma = new PrismaClient();

async function seedHypothesis(ownerId: string, projectId: string, title: string, text: string, domain?: string) {
  const originalLocale = detectLanguage(`${title}\n${text}`);
  const canonical = createCanonicalHypothesis({title, text, locale: originalLocale});
  const mock = analyzeHypothesisMock({title: canonical.canonicalTitleEn, text: canonical.canonicalTextEn, analysisLocale: Locale.EN});
  const h = await prisma.hypothesis.create({
    data: {
      ownerId,
      projectId,
      originalLocale,
      originalTitle: title,
      originalText: text,
      canonicalTitleEn: canonical.canonicalTitleEn,
      canonicalTextEn: canonical.canonicalTextEn,
      interfaceLocaleAtCreate: Locale.EN,
      analysisLocale: Locale.EN,
      domain,
      status: 'DONE',
      versions: {create: {versionNumber: 1, title, text, canonicalTextEn: canonical.canonicalTextEn, changeSummary: 'Seed version'}},
      analyses: {create: {
        canonicalJson: mock.canonicalJson,
        scale: mock.scale,
        verdictLevel: mock.verdictLevel,
        confidence: mock.confidence,
        researchProgress: mock.researchProgress,
        functionalityProgress: mock.functionalityProgress,
        testabilityProgress: mock.testabilityProgress,
        overallStatus: mock.overallStatus,
        realityGap: mock.realityGap,
        mainBlockersJson: mock.mainBlockersJson,
        progressBreakdownJson: mock.progressBreakdownJson,
        translations: {create: mock.translations}
      }}
    }, include: {analyses:true}
  });
  const analysisId = h.analyses[0].id;
  const conditionData: Prisma.HypothesisConditionCreateManyInput[] = mock.conditions.map(c => ({
    hypothesisId: h.id,
    analysisId,
    title: c.title,
    description: c.description,
    status: c.status,
    importance: c.importance,
    confidence: c.confidence,
    completionScore: c.completionScore,
    knownWhat: c.knownWhat,
    unknownWhat: c.unknownWhat,
    blockers: c.blockers,
    conflicts: c.conflicts,
    requiredEvidence: c.requiredEvidence,
    possibleWorkarounds: c.possibleWorkarounds,
    testMethod: c.testMethod,
    ifSolvedImpactJson: c.ifSolvedImpactJson as Prisma.InputJsonValue,
    progressImpactJson: c.progressImpactJson as Prisma.InputJsonValue
  }));
  await prisma.hypothesisCondition.createMany({data: conditionData});
  await prisma.visualScene.create({data: {
    hypothesisId: h.id,
    analysisId,
    sceneType: mock.visualScene.sceneType,
    scale: mock.visualScene.scale,
    objectsJson: mock.visualScene.objectsJson,
    variablesJson: mock.visualScene.variablesJson,
    constraintsJson: mock.visualScene.constraintsJson,
    measurementsJson: mock.visualScene.measurementsJson
  }});
  const experimentData: Prisma.ExperimentProposalCreateManyInput[] = mock.experiments.map(e => ({
    hypothesisId: h.id,
    title: e.title,
    description: e.description,
    experimentType: e.experimentType,
    difficulty: e.difficulty,
    safetyLevel: e.safetyLevel,
    requiredEquipmentJson: e.requiredEquipmentJson,
    expectedSignal: e.expectedSignal,
    falsificationCriteria: e.falsificationCriteria
  }));
  await prisma.experimentProposal.createMany({data: experimentData});
  const sourceData: Prisma.SourceReferenceCreateManyInput[] = mock.sources.map(s => ({
    hypothesisId: h.id,
    title: s.title,
    url: s.url,
    sourceType: s.sourceType,
    relationshipToHypothesis: s.relationshipToHypothesis,
    summary: s.summary
  }));
  await prisma.sourceReference.createMany({data: sourceData});
  const firstCondition = await prisma.hypothesisCondition.findFirst({where:{hypothesisId:h.id}, orderBy:{createdAt:'asc'}});
  if (firstCondition) {
    await prisma.breakthroughSession.create({data:{
      ownerId, projectId, hypothesisId:h.id, conditionId:firstCondition.id, title:firstCondition.title, problemStatement:firstCondition.description,
      whyItMatters:`Seed session for critical condition ${firstCondition.importance}.`, ifSolvedImpact:(firstCondition.ifSolvedImpactJson ?? {}) as Prisma.InputJsonValue,
      knownState:{knownWhat:firstCondition.knownWhat}, missingPieces:{unknownWhat:firstCondition.unknownWhat}, blockers:firstCondition.blockers as Prisma.InputJsonValue,
      conflicts:firstCondition.conflicts as Prisma.InputJsonValue, possiblePaths:firstCondition.possibleWorkarounds as Prisma.InputJsonValue, currentBestPath:firstCondition.testMethod,
      progressScore:firstCondition.completionScore, events:{create:{type:'STATUS_CHANGED', content:{message:'Seed breakthrough session created'} as Prisma.InputJsonValue}}
    }});
  }
}

async function main() {
  await prisma.breakthroughCheck.deleteMany();
  await prisma.breakthroughIdea.deleteMany();
  await prisma.breakthroughEvent.deleteMany();
  await prisma.breakthroughSession.deleteMany();
  await prisma.sourceReference.deleteMany();
  await prisma.simulationRun.deleteMany();
  await prisma.experimentProposal.deleteMany();
  await prisma.visualScene.deleteMany();
  await prisma.hypothesisCondition.deleteMany();
  await prisma.hypothesisAnalysisTranslation.deleteMany();
  await prisma.hypothesisAnalysis.deleteMany();
  await prisma.hypothesisVersion.deleteMany();
  await prisma.hypothesis.deleteMany();
  await prisma.project.deleteMany();
  await prisma.analysisPrompt.deleteMany();
  await prisma.physicalLaw.deleteMany();
  await prisma.unsolvedProblem.deleteMany();

  const user = await prisma.user.upsert({where:{email:'demo@theoryforge.local'}, update:{}, create:{email:'demo@theoryforge.local', name:'Demo Researcher', preferredLocale:Locale.EN}});
  const time = await prisma.project.create({data:{ownerId:user.id,title:'Time Manipulation',description:'Research direction for time dilation, spacetime engineering and causality-safe tests.'}});
  const energy = await prisma.project.create({data:{ownerId:user.id,title:'Compact Energy Systems',description:'Wearable high-density power, thermal constraints and materials.'}});
  const battery = await prisma.project.create({data:{ownerId:user.id,title:'Advanced Batteries',description:'Lithium-air, filtration and next-generation storage.'}});

  await seedHypothesis(user.id, time.id, 'Local time dilation field using rotating electromagnetic fields', 'Can a rotating electromagnetic field create a measurable local time dilation effect inside a chamber?', 'spacetime physics');
  await seedHypothesis(user.id, energy.id, 'Compact Iron Man-like power source', 'Can a wearable power source deliver extreme energy density safely enough for powered flight and armor systems?', 'energy systems');
  await seedHypothesis(user.id, battery.id, 'Lithium-air battery with advanced atmospheric filtration', 'Can a lithium-air battery use a smart filter that admits oxygen but blocks water, CO2 and contaminants?', 'battery chemistry');

  await prisma.physicalLaw.createMany({data:[
    {slug:'energy-conservation', title:'Conservation of Energy', description:'Energy cannot be created or destroyed in an isolated system.', domain:'physics'},
    {slug:'thermodynamics', title:'Thermodynamics', description:'Heat, entropy and energy transfer constraints.', domain:'physics'},
    {slug:'causality', title:'Causality', description:'Cause-effect ordering constraints used in physical theories.', domain:'spacetime'}
  ]});
  await prisma.unsolvedProblem.createMany({data:[
    {slug:'quantum-gravity', title:'Quantum Gravity', description:'A complete theory combining quantum mechanics and gravity.', domain:'physics'},
    {slug:'room-temperature-superconductivity', title:'Room-temperature Superconductivity', description:'Stable superconductors at ordinary temperature and pressure.', domain:'materials'},
    {slug:'navier-stokes', title:'Navier-Stokes Regularity', description:'Mathematical problem around fluid equation solutions.', domain:'mathematics'}
  ]});
  await prisma.analysisPrompt.create({data:{key:'hypothesis-analysis-v1',title:'Hypothesis Analysis v1',content:'Mock prompt placeholder. Later replace with OpenAI structured output prompt.'}});
}
main().finally(async()=>prisma.$disconnect());
