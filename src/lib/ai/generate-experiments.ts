import {ExperimentDifficulty, ExperimentType, SafetyLevel} from '@prisma/client';
import {localizeMockValue, MockLocale} from '@/lib/locale/mock-copy';

export function generateExperiments(text: string, locale: MockLocale = 'en') {
  const lower = text.toLowerCase();
  const experiments = /time|врем|field|поле/.test(lower) ? [
    {title:'Clock comparison thought experiment',description:'Define two reference clocks and estimate whether proposed field can create measurable drift.',experimentType:ExperimentType.THOUGHT_EXPERIMENT,difficulty:ExperimentDifficulty.LOW,safetyLevel:SafetyLevel.SAFE,requiredEquipmentJson:['paper model','known constants'],expectedSignal:'A predicted clock-rate difference above zero.',falsificationCriteria:'Prediction remains many orders below measurement noise.'},
    {title:'Energy-density order estimate',description:'Compare required energy density against realistic field systems.',experimentType:ExperimentType.COMPUTER_SIMULATION,difficulty:ExperimentDifficulty.MEDIUM,safetyLevel:SafetyLevel.SAFE,requiredEquipmentJson:['calculation notebook'],expectedSignal:'Feasibility gap measured in orders of magnitude.',falsificationCriteria:'No parameter window with measurable signal.'}
  ] : /battery|лит|lithium|батар/.test(lower) ? [
    {title:'Oxygen membrane flow model',description:'Estimate oxygen flow, humidity rejection and pressure drop for a protected lithium-air cell.',experimentType:ExperimentType.COMPUTER_SIMULATION,difficulty:ExperimentDifficulty.MEDIUM,safetyLevel:SafetyLevel.SAFE,requiredEquipmentJson:['flow model','membrane data'],expectedSignal:'High O2 flow with low H2O/CO2 ingress.',falsificationCriteria:'Flow loss makes power density unacceptable.'},
    {title:'Small filtration coupon test',description:'Bench test membrane/sorbent against humidity and CO2.',experimentType:ExperimentType.SMALL_LAB_TEST,difficulty:ExperimentDifficulty.MEDIUM,safetyLevel:SafetyLevel.LAB_ONLY,requiredEquipmentJson:['humidity sensor','CO2 sensor','membrane sample'],expectedSignal:'Stable filtration without major pressure drop.',falsificationCriteria:'Rapid saturation or high pressure drop.'}
  ] : [{title:'Minimal falsifiable test',description:'Reduce claim to one measurable prediction and one control.',experimentType:ExperimentType.THOUGHT_EXPERIMENT,difficulty:ExperimentDifficulty.LOW,safetyLevel:SafetyLevel.SAFE,requiredEquipmentJson:['written protocol'],expectedSignal:'A clear measurable effect.',falsificationCriteria:'No measurable difference versus control.'}];
  return localizeMockValue(experiments, locale);
}
