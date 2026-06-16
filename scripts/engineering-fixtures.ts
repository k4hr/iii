import {buildEngineeringRenderModules, buildEngineeringRenderPrimitives} from '@/lib/engineering/build-engineering-model';
import {engineeringModelFixtures} from '@/lib/engineering/engineering-model.fixtures';
import {isRenderableEngineeringModel} from '@/lib/engineering/engineering-model-schema';
import {synthesizeEngineeringModelFallback} from '@/lib/engineering/generate-engineering-model';

const summaries: string[] = [];

for (const fixture of engineeringModelFixtures) {
  const model = synthesizeEngineeringModelFallback(fixture.input);
  if (!isRenderableEngineeringModel(model)) throw new Error(`${fixture.name}: canonical model is not renderable.`);
  if (model.artifactClass !== fixture.expectedClass) throw new Error(`${fixture.name}: expected ${fixture.expectedClass}, received ${model.artifactClass}.`);
  if (model.physicalModules.length < 2) throw new Error(`${fixture.name}: expected at least two physical modules.`);
  if (!model.interfaces.length) throw new Error(`${fixture.name}: expected at least one physical interface.`);
  if (!model.researchOverlays.length) throw new Error(`${fixture.name}: expected research overlays.`);
  if (!model.geometryPlan) throw new Error(`${fixture.name}: geometryPlan is missing.`);
  if (model.geometryPlan.primitives.length <= 3) throw new Error(`${fixture.name}: expected more than three geometry primitives.`);

  const forbidden = model.physicalModules.some(module => /механизм|услови|blocker|constraint|огранич/i.test(module.name));
  if (forbidden) throw new Error(`${fixture.name}: research blocker leaked into physical modules.`);

  const allBoxes = model.geometryPlan.primitives.every(primitive => primitive.shape === 'box' || primitive.shape === 'rounded_box');
  if (allBoxes) throw new Error(`${fixture.name}: geometryPlan uses only box primitives.`);

  const primitiveModuleIds = new Set(model.geometryPlan.primitives.map(primitive => primitive.moduleId));
  const missingPrimitiveModules = model.physicalModules.filter(module => !primitiveModuleIds.has(module.id));
  if (missingPrimitiveModules.length) throw new Error(`${fixture.name}: missing primitives for modules ${missingPrimitiveModules.map(module => module.name).join(', ')}.`);

  const layout = buildEngineeringRenderModules(model);
  if (layout.length !== model.physicalModules.length) throw new Error(`${fixture.name}: frontend layout omitted physical modules.`);
  if (layout.some(module => module.position.some(value => !Number.isFinite(value)))) throw new Error(`${fixture.name}: frontend layout contains invalid coordinates.`);

  const renderPrimitives = buildEngineeringRenderPrimitives(model);
  if (renderPrimitives.length !== model.geometryPlan.primitives.length) throw new Error(`${fixture.name}: frontend omitted geometry primitives.`);
  if (renderPrimitives.some(primitive => primitive.position.some(value => !Number.isFinite(value)))) throw new Error(`${fixture.name}: primitive layout contains invalid coordinates.`);

  summaries.push(`${fixture.name}: ${model.artifactLabel}, ${model.physicalModules.length} modules, ${model.geometryPlan.primitives.length} primitives, ${model.researchOverlays.length} overlays`);
}

console.log('TheoryForge Engineering Synthesis Fixtures: PASSED');
for (const summary of summaries) console.log(`- ${summary}`);
