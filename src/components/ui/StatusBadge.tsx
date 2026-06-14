const criticalTerms = ['CRITICAL', 'EXTREME', 'BLOCKED', 'CONFLICT', 'DANGEROUS', 'FAILED'];
const positiveTerms = ['ACTIVE', 'TESTABLE', 'WORKING', 'POSSIBLE', 'READY', 'PROMISING', 'SAFE'];
const warningTerms = ['HIGH', 'CAUTION', 'REVIEW', 'UNKNOWN', 'LIMITED', 'MATH', 'EXPERIMENT'];

export function StatusBadge({value, label, locale = 'en'}: {value: string; label?: string; locale?: string}) {
  const normalized = value.toUpperCase();
  const tone = criticalTerms.some(term => normalized.includes(term))
    ? 'critical'
    : positiveTerms.some(term => normalized.includes(term))
      ? 'positive'
      : warningTerms.some(term => normalized.includes(term))
        ? 'warning'
        : 'neutral';

  return (
    <span className={`status-badge status-badge--${tone}`}>
      <span className="status-badge__dot" />
      {label ?? getEnumLabel(value, locale)}
    </span>
  );
}
import {getEnumLabel} from '@/lib/locale/enum-labels';
