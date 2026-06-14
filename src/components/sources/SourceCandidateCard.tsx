import type {SourceRelationship, SourceType} from '@prisma/client';
import {GlassPanel} from '@/components/ui/GlassPanel';
import {StatusBadge} from '@/components/ui/StatusBadge';
import {getSourceRelationshipLabel} from '@/lib/locale/enum-labels';

type SourceCandidateCardProps = {
  source: {
    title: string;
    url: string | null;
    sourceType: SourceType;
    relationshipToHypothesis: SourceRelationship;
  };
  summary: string;
  locale: string;
  labels: {
    candidate: string;
    openSearch: string;
  };
};

export function SourceCandidateCard({source, summary, locale, labels}: SourceCandidateCardProps) {
  return (
    <GlassPanel className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge
          value={source.relationshipToHypothesis}
          locale={locale}
          label={getSourceRelationshipLabel(source.relationshipToHypothesis, locale)}
        />
        {source.sourceType === 'MOCK' && <span className="status-badge status-badge--neutral">{labels.candidate}</span>}
      </div>
      <h3 className="mt-5 text-base font-semibold leading-6 text-cyan-50">{source.title}</h3>
      <p className="mt-3 text-xs leading-6 text-[#78999b]">{summary}</p>
      {source.url && (
        <a
          className="mt-5 inline-flex font-mono text-[10px] tracking-[.1em] text-cyan-200/65 uppercase transition hover:text-cyan-100"
          href={source.url}
          target="_blank"
          rel="noreferrer noopener nofollow"
        >
          {labels.openSearch} -&gt;
        </a>
      )}
    </GlassPanel>
  );
}
