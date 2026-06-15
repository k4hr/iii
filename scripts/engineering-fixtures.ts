import {buildEngineeringRenderModules} from '@/lib/engineering/build-engineering-model';
import {engineeringModelFixtures} from '@/lib/engineering/engineering-model.fixtures';
import {isRenderableEngineeringModel} from '@/lib/engineering/engineering-model-schema';
import {synthesizeEngineeringModelFallback} from '@/lib/engineering/generate-engineering-model';

const summaries: string[] = [];

for (const fixture of engineeringModelFixtures) {
  const model = synthesizeEngineeringModelFallback(fixture.input);
  if (!isRenderableEngineeringModel(model)) throw new Error(`${fixture.name}: canonical model is not renderable.`);
  if (model.artifactClass !== fixture.expectedClass) throw new Error(`${fixture.name}: expected ${fixture.expectedClass}, received ${model.artifactClass}.`);
  if (model.modules.length < 2) throw new Error(`${fixture.name}: expected at least two modules.`);
  if (!model.interfaces.length) throw new Error(`${fixture.name}: expected at least one interface.`);
  const layout = buildEngineeringRenderModules(model);
  if (layout.length !== model.modules.length) throw new Error(`${fixture.name}: frontend layout omitted modules.`);
  if (layout.some(module => module.position.some(value => !Number.isFinite(value)))) throw new Error(`${fixture.name}: frontend layout contains invalid coordinates.`);
  summaries.push(`${fixture.name}: ${model.artifactClass}, ${model.modules.length} modules, ${model.interfaces.length} interfaces`);
}

console.log('TheoryForge Engineering Synthesis Fixtures: PASSED');
for (const summary of summaries) console.log(`- ${summary}`);
