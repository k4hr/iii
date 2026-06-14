import {ConditionImportance, ConditionStatus} from '@prisma/client';
import {calculateProgress} from './progress-calculator';

export type MockCondition = {
  title: string;
  description: string;
  status: ConditionStatus;
  importance: ConditionImportance;
  confidence: number;
  completionScore: number;
  knownWhat: string;
  unknownWhat: string;
  blockers: string[];
  conflicts: string[];
  requiredEvidence: string[];
  possibleWorkarounds: string[];
  testMethod: string;
  ifSolvedImpactJson: Record<string, unknown>;
  progressImpactJson: Record<string, unknown>;
};

export function generateConditionTree(text: string): MockCondition[] {
  const lower = text.toLowerCase();
  if (/time|врем|spacetime|field|поле|quantum/.test(lower)) return timeConditions();
  if (/battery|лит|lithium|energy|power|батар|энерг/.test(lower)) return batteryConditions();
  return genericConditions();
}

function timeConditions(): MockCondition[] {
  return [
    cond('Physical mechanism for measurable time dilation','A mechanism must connect the proposed field to a measurable change in clock rate.','KNOWN_LIMITED','CRITICAL',82,18,'Energy and gravity affect time in established relativity; EM fields carry energy-momentum.','Whether a laboratory field geometry can create a measurable effect at useful scale.',['Ordinary EM energy density is far too small.'],[],['A clear mathematical estimate linking field energy density to expected clock drift.'],['Reduce target to precision clocks instead of humans.','Use natural gravitational references.'],'Estimate clock-rate difference for realistic field energy density.',{functionality:'+large if a measurable mechanism is demonstrated',testability:'+medium'},{research:+8,functionality:+20,testability:+18}),
    cond('Sufficient compact energy density','The system must concentrate enough energy without destroying the apparatus.','NEEDS_BREAKTHROUGH','CRITICAL',88,2,'High energy densities exist in extreme systems, not compact safe lab devices.','A safe compact way to reach required density.',['Energy gap may be many orders of magnitude.','Thermal and structural loads become extreme.'],[],['Order-of-magnitude energy budget.','Material stress estimates.'],['Reduce required effect.','Improve measurement sensitivity.','Explore non-macro targets.'],'Compare required energy density against available lab fields.',{functionality:'+very high; likely shifts main blocker to stability',testability:'+medium'},{research:+5,functionality:+35,testability:+12}),
    cond('Stable field geometry','The proposed field must remain stable long enough to measure or use.','UNKNOWN','HIGH',64,12,'Fields can be shaped and controlled in many systems.','Whether this geometry has the required stability and coupling.',['Instabilities','Control complexity','Heat dissipation'],[],['Stability model or simulation.'],['Pulsed operation','Smaller scale','Feedback control'],'Create a simplified field stability simulation.',{functionality:'+medium',testability:'+medium'},{research:+8,functionality:+16,testability:+12}),
    cond('Object safety inside the field','The object or observer must not be destroyed by fields, heat, radiation or acceleration.','ENGINEERING_BLOCKED','CRITICAL',78,8,'Safety constraints are measurable engineering constraints.','Whether any useful configuration stays below lethal/destructive thresholds.',['Heating','Radiation','Mechanical stress','Electrical breakdown'],[],['Thermal, EM exposure and material limits.'],['Use instruments instead of humans.','Remote measurement.'],'Calculate heat load and field exposure for a small test object.',{functionality:'+high for macro use',testability:'+small'},{research:+6,functionality:+18,testability:+6}),
    cond('Measurement method','A clear measurement must distinguish the effect from noise and known errors.','TESTABLE','MEDIUM',84,55,'Precision time measurement is a mature field.','Whether the predicted effect is above instrument noise.',['Signal may be below noise floor.'],[],['Predicted signal above systematic error.'],['Use the most sensitive available clock comparison.'],'Define inside/outside clock comparison protocol.',{functionality:'+small',testability:'+high'},{research:+10,functionality:+4,testability:+25}),
    cond('Causality and interpretation','The hypothesis must not require contradictions in cause and effect.','KNOWN_LIMITED','HIGH',70,22,'Future-directed time dilation is established; backward time travel is not.','Whether the claim implies closed causal loops.',['Past-directed claims create severe theoretical problems.'],['Potential causality conflicts if interpreted as backward travel.'],['A precise claim limited to rate differences or information constraints.'],['Reframe as time dilation, not travel to the past.'],'Classify whether claim is time dilation, information transfer, or past-directed travel.',{functionality:'+medium if reframed safely',testability:'+medium'},{research:+12,functionality:+8,testability:+10})
  ];
}
function batteryConditions(): MockCondition[] {
  return [
    cond('High-energy chemistry','Chemistry must offer higher theoretical energy density than lithium-ion.','KNOWN_LIMITED','CRITICAL',86,35,'Lithium-air and related systems have high theoretical energy density.','Practical usable energy density after losses and packaging.',['Side reactions','Low power','Inefficient cycling'],[],['Cell-level energy measurements.'],['Hybrid architectures','Protected electrodes'],'Compare theoretical and practical cell energy density.',{functionality:'+high'}, {research:+8,functionality:+18,testability:+10}),
    cond('Reaction reversibility','The discharge products must be reversible across many cycles.','ENGINEERING_BLOCKED','CRITICAL',82,12,'Rechargeability is a known central issue.','Long-life stable reversible chemistry.',['Electrode clogging','Parasitic reactions','Capacity fade'],[],['Cycle-life data.'],['Catalysts','Electrolyte redesign','Protected interfaces'],'Simulate and test charge/discharge cycles.',{functionality:'+very high'}, {research:+8,functionality:+25,testability:+12}),
    cond('Atmospheric filtration','The system must admit oxygen while blocking water, CO2 and contaminants.','TESTABLE','HIGH',80,45,'Membranes and sorbents exist, but trade off flow and purity.','A compact regenerable filter with low power loss.',['Flow restriction','Filter saturation','Maintenance'],[],['O2 flow rate, humidity/CO2 rejection, pressure drop.'],['Oxygen-selective membrane','Closed oxygen loop','Regenerable sorbent'],'Prototype membrane flow model.',{functionality:'+medium-high',testability:'+high'}, {research:+12,functionality:+15,testability:+22}),
    cond('Material stability','Electrodes, electrolyte and separators must survive operation.','ENGINEERING_BLOCKED','HIGH',78,20,'Many degradation mechanisms are known.','Stable materials under real air and cycling.',['Dendrites','Corrosion','Electrolyte breakdown'],[],['Post-cycle material analysis.'],['Solid electrolyte','Protective coatings'],'Run material degradation test.',{functionality:'+medium'}, {research:+8,functionality:+15,testability:+12}),
    cond('Safety and manufacturability','The design must be safe, manufacturable and not too expensive.','UNKNOWN','MEDIUM',65,18,'Battery safety engineering exists.','Whether this chemistry can be packaged safely.',['Lithium reactivity','Thermal runaway','Cost'],[],['Abuse tests and cost model.'],['Modular sealed cell','BMS limits'],'Create safety FMEA and cost estimate.',{functionality:'+medium'}, {research:+6,functionality:+10,testability:+8})
  ];
}
function genericConditions(): MockCondition[] {
  return [
    cond('Clear physical mechanism','The hypothesis needs a defined mechanism rather than only a desired outcome.','UNDEFINED','CRITICAL',55,10,'Some components may be known.','The exact mechanism is not yet formalized.',['Ambiguous claim.'],[],['Formal variables and predicted effect.'],['Narrow the claim.'],'Rewrite as a testable mechanism.',{functionality:'+medium'}, {research:+20,functionality:+8,testability:+15}),
    cond('Energy and material feasibility','Energy, materials and environment must be compatible with the target scale.','UNKNOWN','HIGH',60,15,'Basic engineering constraints can be estimated.','Specific numbers are missing.',['Unknown operating parameters.'],[],['Order-of-magnitude estimates.'],['Parameter sweep.'],'Estimate energy and material requirements.',{functionality:'+medium'}, {research:+10,functionality:+12,testability:+10}),
    cond('Minimal test exists','There must be a smaller version that can be tested.','TESTABLE','MEDIUM',70,40,'Most claims can be reduced to a smaller test.','The smallest test is not yet designed.',['No experiment definition.'],[],['Test protocol.'],['Thought experiment','Computer simulation'],'Define pass/fail experiment.',{testability:'+high'}, {research:+10,functionality:+4,testability:+25})
  ];
}
function cond(title:string, description:string, status:ConditionStatus, importance:ConditionImportance, confidence:number, completionScore:number, knownWhat:string, unknownWhat:string, blockers:string[], conflicts:string[], requiredEvidence:string[], possibleWorkarounds:string[], testMethod:string, ifSolvedImpactJson:Record<string,unknown>, progressImpactJson:Record<string,unknown>): MockCondition {
  return {title,description,status,importance,confidence,completionScore,knownWhat,unknownWhat,blockers,conflicts,requiredEvidence,possibleWorkarounds,testMethod,ifSolvedImpactJson,progressImpactJson};
}

export function conditionProgress(conditions: MockCondition[]) { return calculateProgress(conditions); }
