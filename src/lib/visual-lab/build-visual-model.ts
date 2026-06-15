export type VisualNodeType = 'hypothesis' | 'condition' | 'blocker' | 'calculation' | 'source' | 'breakthrough';
export type VisualSeverity = 'info' | 'success' | 'warning' | 'critical';
export type VisualEdgeType = 'depends_on' | 'blocks' | 'supports' | 'calculates' | 'investigates';

export type VisualLabNode = {
  id: string;
  type: VisualNodeType;
  label: string;
  value?: number;
  severity?: VisualSeverity;
  href?: string;
  metadata?: Record<string, unknown>;
};

export type VisualLabEdge = {
  id: string;
  from: string;
  to: string;
  type: VisualEdgeType;
};

export type VisualLabModel = {
  nodes: VisualLabNode[];
  edges: VisualLabEdge[];
  omittedCount: number;
};

export type VisualHypothesisInput = {
  id: string;
  title: string;
  progress: number;
  confidence: number;
  href?: string;
};

export type VisualConditionInput = {
  id: string;
  parentId?: string | null;
  title: string;
  status: string;
  importance: string;
  confidence: number;
  completionScore: number;
  href?: string;
};

export type VisualCalculationInput = {
  id: string;
  conditionId?: string | null;
  title: string;
  gapOrders?: number | null;
  gapLevel?: string | null;
  href?: string;
};

export type VisualSourceInput = {
  id: string;
  conditionId?: string | null;
  title: string;
  relationship: string;
  href?: string;
};

export type VisualBreakthroughInput = {
  id: string;
  conditionId: string;
  title: string;
  progressScore: number;
  href?: string;
};

export type BuildVisualModelInput = {
  locale: string;
  hypothesis: VisualHypothesisInput;
  conditions: VisualConditionInput[];
  calculations: VisualCalculationInput[];
  sources: VisualSourceInput[];
  breakthroughSessions: VisualBreakthroughInput[];
  maxNodes?: number;
};

const importanceRank: Record<string, number> = {CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3};

export function buildVisualModel(input: BuildVisualModelInput): VisualLabModel {
  const maxNodes = Math.min(20, Math.max(12, input.maxNodes ?? 18));
  const coreId = `hypothesis:${input.hypothesis.id}`;
  const nodes: VisualLabNode[] = [{
    id: coreId,
    type: 'hypothesis',
    label: input.hypothesis.title,
    value: clampPercent(input.hypothesis.progress),
    severity: input.hypothesis.progress >= 60 ? 'success' : input.hypothesis.progress >= 25 ? 'info' : 'warning',
    href: input.hypothesis.href,
    metadata: {confidence: clampPercent(input.hypothesis.confidence)},
  }];
  const edges: VisualLabEdge[] = [];

  const sortedConditions = [...input.conditions].sort((a, b) => {
    const importance = (importanceRank[a.importance] ?? 4) - (importanceRank[b.importance] ?? 4);
    return importance || a.completionScore - b.completionScore;
  });
  const conditionLimit = Math.min(10, maxNodes - 1);
  const visibleConditions = sortedConditions.slice(0, conditionLimit);
  const visibleConditionIds = new Set(visibleConditions.map(condition => condition.id));

  for (const condition of visibleConditions) {
    const blocker = condition.importance === 'CRITICAL' || condition.status === 'CONFLICTS_WITH_KNOWN_SCIENCE' || condition.status === 'NEEDS_BREAKTHROUGH';
    const nodeId = `condition:${condition.id}`;
    nodes.push({
      id: nodeId,
      type: blocker ? 'blocker' : 'condition',
      label: condition.title,
      value: clampPercent(condition.completionScore),
      severity: blocker ? 'critical' : condition.completionScore >= 70 ? 'success' : condition.completionScore >= 30 ? 'info' : 'warning',
      href: condition.href,
      metadata: {confidence: clampPercent(condition.confidence)},
    });
    const parentId = condition.parentId && visibleConditionIds.has(condition.parentId)
      ? `condition:${condition.parentId}`
      : coreId;
    edges.push({id: `edge:${parentId}:${nodeId}`, from: parentId, to: nodeId, type: blocker ? 'blocks' : 'depends_on'});
  }

  const remainingSlots = () => Math.max(0, maxNodes - nodes.length);
  for (const calculation of input.calculations.slice(0, Math.min(3, remainingSlots()))) {
    const nodeId = `calculation:${calculation.id}`;
    const target = calculation.conditionId && visibleConditionIds.has(calculation.conditionId) ? `condition:${calculation.conditionId}` : coreId;
    const orders = finiteNumber(calculation.gapOrders);
    nodes.push({
      id: nodeId,
      type: 'calculation',
      label: calculation.title,
      value: orders,
      severity: gapSeverity(calculation.gapLevel, orders),
      href: calculation.href,
      metadata: {gapOrders: orders},
    });
    edges.push({id: `edge:${nodeId}:${target}`, from: nodeId, to: target, type: 'calculates'});
  }

  for (const session of input.breakthroughSessions.slice(0, Math.min(3, remainingSlots()))) {
    const nodeId = `breakthrough:${session.id}`;
    const target = visibleConditionIds.has(session.conditionId) ? `condition:${session.conditionId}` : coreId;
    nodes.push({
      id: nodeId,
      type: 'breakthrough',
      label: session.title,
      value: clampPercent(session.progressScore),
      severity: session.progressScore >= 60 ? 'success' : 'warning',
      href: session.href,
    });
    edges.push({id: `edge:${nodeId}:${target}`, from: nodeId, to: target, type: 'investigates'});
  }

  for (const source of input.sources.slice(0, Math.min(3, remainingSlots()))) {
    const nodeId = `source:${source.id}`;
    const target = source.conditionId && visibleConditionIds.has(source.conditionId) ? `condition:${source.conditionId}` : coreId;
    nodes.push({
      id: nodeId,
      type: 'source',
      label: source.title,
      severity: source.relationship === 'CONTRADICTS' ? 'warning' : 'info',
      href: source.href,
    });
    edges.push({id: `edge:${nodeId}:${target}`, from: nodeId, to: target, type: 'supports'});
  }

  const totalCandidates = 1 + input.conditions.length + input.calculations.length + input.sources.length + input.breakthroughSessions.length;
  return {nodes, edges, omittedCount: Math.max(0, totalCandidates - nodes.length)};
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const normalized = value <= 1 ? value * 100 : value;
  return Math.round(Math.min(100, Math.max(0, normalized)));
}

function finiteNumber(value: number | null | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 10) / 10 : undefined;
}

function gapSeverity(level?: string | null, orders?: number): VisualSeverity {
  if (level === 'EXTREME' || (orders ?? 0) > 6) return 'critical';
  if (level === 'HIGH' || (orders ?? 0) > 3) return 'warning';
  if (level === 'LOW' || (orders ?? 0) <= 1) return 'success';
  return 'info';
}
