import {buildEngineeringRenderModules} from '@/lib/engineering/build-engineering-model';
import {engineeringModelFixtures} from '@/lib/engineering/engineering-model.fixtures';
import {isRenderableEngineeringModel} from '@/lib/engineering/engineering-model-schema';
import {synthesizeEngineeringModelFallback} from '@/lib/engineering/generate-engineering-model';

const expectedPhysicalNames: Record<string, string[]> = {
  'Летающая машина': ['Несущий корпус', 'Кабина', 'Подъёмная система', 'Тяговые модули', 'Энергетический модуль', 'Контур управления', 'Система безопасности'],
  'Костюм железного человека': ['Шлем', 'Торс', 'Руки', 'Ноги', 'Энергетическое ядро', 'Реактивные сопла', 'Броня', 'Охлаждение', 'Стабилизация'],
  'Литий-воздушная батарея': ['Корпус', 'Ячейки', 'Анод', 'Воздушный катод', 'Фильтр воздуха', 'Электролит', 'Контакты', 'Тепловой контур'],
};

const summaries: string[] = [];

for (const fixture of engineeringModelFixtures) {
  const model = synthesizeEngineeringModelFallback(fixture.input);
  if (!isRenderableEngineeringModel(model)) throw new Error(`${fixture.name}: canonical model is not renderable.`);
  if (model.artifactClass !== fixture.expectedClass) throw new Error(`${fixture.name}: expected ${fixture.expectedClass}, received ${model.artifactClass}.`);
  if (model.physicalModules.length < 2) throw new Error(`${fixture.name}: expected at least two physical modules.`);
  if (!model.interfaces.length) throw new Error(`${fixture.name}: expected at least one physical interface.`);
  if (!model.researchOverlays.length) throw new Error(`${fixture.name}: expected research overlays.`);
  const forbidden = model.physicalModules.some(module => /механизм|услови|blocker|constraint|огранич/i.test(module.name));
  if (forbidden) throw new Error(`${fixture.name}: research blocker leaked into physical modules.`);

  const expectedNames = expectedPhysicalNames[fixture.name];
  if (expectedNames) {
    const actual = new Set(model.physicalModules.map(module => module.name));
    const missing = expectedNames.filter(name => !actual.has(name));
    if (missing.length) throw new Error(`${fixture.name}: missing physical modules ${missing.join(', ')}.`);
  }

  const layout = buildEngineeringRenderModules(model);
  if (layout.length !== model.physicalModules.length) throw new Error(`${fixture.name}: frontend layout omitted physical modules.`);
  if (layout.some(module => module.position.some(value => !Number.isFinite(value)))) throw new Error(`${fixture.name}: frontend layout contains invalid coordinates.`);
  summaries.push(`${fixture.name}: ${model.artifactLabel}, ${model.physicalModules.length} physical modules, ${model.researchOverlays.length} overlays, ${model.interfaces.length} interfaces`);
}

console.log('TheoryForge Engineering Synthesis Fixtures: PASSED');
for (const summary of summaries) console.log(`- ${summary}`);
