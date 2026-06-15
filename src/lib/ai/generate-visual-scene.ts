import {Scale} from '@prisma/client';
import {localizeMockValue, MockLocale} from '@/lib/locale/mock-copy';

type VisualObject = {
  id: string;
  type: string;
  label: string;
};

type VisualSceneMock = {
  sceneType: string;
  scale: Scale;
  objectsJson: VisualObject[];
  variablesJson: string[];
  constraintsJson: string[];
  measurementsJson: string[];
};

function localizeScene(scene: VisualSceneMock, locale: MockLocale): VisualSceneMock {
  return {
    sceneType: scene.sceneType,
    scale: scene.scale,
    objectsJson: scene.objectsJson.map(object => ({
      id: object.id,
      type: object.type,
      label: localizeMockValue(object.label, locale),
    })),
    variablesJson: localizeMockValue(scene.variablesJson, locale),
    constraintsJson: localizeMockValue(scene.constraintsJson, locale),
    measurementsJson: localizeMockValue(scene.measurementsJson, locale),
  };
}

export function generateVisualScene(text: string, locale: MockLocale = 'en'): VisualSceneMock {
  const lower = text.toLowerCase();

  if (/time|врем|spacetime|field|поле/.test(lower)) {
    return localizeScene({
      sceneType: 'field_chamber',
      scale: Scale.HUMAN,
      objectsJson: [
        {id: 'capsule', type: 'chamber', label: 'Target chamber'},
        {id: 'clock-inside', type: 'measurement', label: 'Inside clock'},
        {id: 'clock-outside', type: 'measurement', label: 'Outside reference clock'},
      ],
      variablesJson: ['field_strength', 'energy_density', 'radius', 'clock_drift', 'heat_load'],
      constraintsJson: ['energy density gap', 'field stability', 'thermal safety', 'causality interpretation'],
      measurementsJson: ['inside/outside clock drift', 'field energy density', 'temperature rise'],
    }, locale);
  }

  if (/battery|лит|lithium|батар/.test(lower)) {
    return localizeScene({
      sceneType: 'electrochemical_cell',
      scale: Scale.MICRO,
      objectsJson: [
        {id: 'anode', type: 'electrode', label: 'Lithium anode'},
        {id: 'air-filter', type: 'membrane', label: 'Oxygen-selective filter'},
        {id: 'cathode', type: 'electrode', label: 'Air cathode'},
      ],
      variablesJson: ['oxygen_flow', 'humidity_rejection', 'co2_rejection', 'cycle_life', 'energy_density'],
      constraintsJson: ['water contamination', 'CO2 poisoning', 'dendrites', 'pressure drop'],
      measurementsJson: ['voltage curve', 'cycle capacity', 'filter pressure drop', 'gas purity'],
    }, locale);
  }

  return localizeScene({
    sceneType: 'generic_model',
    scale: Scale.UNKNOWN,
    objectsJson: [{id: 'system', type: 'unknown', label: 'Proposed system'}],
    variablesJson: ['input_energy', 'target_effect', 'scale', 'safety_margin'],
    constraintsJson: ['mechanism definition', 'energy budget', 'testability'],
    measurementsJson: ['predicted effect', 'control comparison'],
  }, locale);
}
