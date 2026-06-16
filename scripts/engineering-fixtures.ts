import {buildEngineeringRenderModules, buildEngineeringRenderPrimitives} from '@/lib/engineering/build-engineering-model';
import {engineeringModelFixtures} from '@/lib/engineering/engineering-model.fixtures';
import {isRenderableEngineeringModel} from '@/lib/engineering/engineering-model-schema';
import {synthesizeEngineeringModelFallback} from '@/lib/engineering/generate-engineering-model';

const summaries: string[] = [];

for (const fixture of engineeringModelFixtures) {
  const model = synthesizeEngineeringModelFallback(fixture.input);
  if (!isRenderableEngineeringModel(model)) throw new Error(`${fixture.name}: canonical model is not renderable.`);
  if (model.materiality !== 'material' && model.materiality !== 'hybrid') throw new Error(`${fixture.name}: expected material or hybrid materiality, received ${model.materiality}.`);
  if (model.physicalModules.length < 2) throw new Error(`${fixture.name}: expected at least two physical modules.`);
  if (!model.interfaces.length) throw new Error(`${fixture.name}: expected at least one physical interface.`);
  if (!model.researchOverlays.length) throw new Error(`${fixture.name}: expected research overlays.`);
  if (!model.geometryPlan) throw new Error(`${fixture.name}: geometryPlan is missing.`);
  if (model.geometryPlan.primitives.length <= 3) throw new Error(`${fixture.name}: expected more than three geometry primitives.`);

  const forbidden = model.physicalModules.some(module => /механизм|услови|blocker|constraint|огранич/i.test(module.name));
  if (forbidden) throw new Error(`${fixture.name}: research blocker leaked into physical modules.`);
  const meaningfulModules = model.physicalModules.filter(module => module.name.trim().length > 4 && module.role.trim().length > 16);
  if (meaningfulModules.length < Math.min(4, model.physicalModules.length)) throw new Error(`${fixture.name}: physical modules are too generic.`);

  const allBoxes = model.geometryPlan.primitives.every(primitive => primitive.shape === 'box' || primitive.shape === 'rounded_box');
  if (allBoxes) throw new Error(`${fixture.name}: geometryPlan uses only box primitives.`);
  if (model.geometryPlan.primitives.length === 1 && model.geometryPlan.primitives[0]?.shape === 'box') throw new Error(`${fixture.name}: model fell back to a blank cube.`);

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
