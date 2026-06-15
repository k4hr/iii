import Link from 'next/link';
import {GlassPanel} from '@/components/ui/GlassPanel';
import type {LabLogItem, LabLogSeverity, LabLogSourceType} from '@/lib/lab-log/build-lab-log';

type LabLogLabels = {
  title: string;
  workspaceTitle: string;
  events: string;
  details: string;
  noEvents: string;
  sourceTypes: Record<LabLogSourceType, string>;
  severity: Record<LabLogSeverity, string>;
};

type LabLogTimelineProps = {
  items: LabLogItem[];
  locale: string;
  labels: LabLogLabels;
};

const severityStyles: Record<LabLogSeverity, {border: string; dot: string; badge: string}> = {
  info: {
    border: 'border-cyan-200/[0.12]',
    dot: 'border-cyan-100 bg-cyan-300 shadow-[0_0_18px_rgba(67,241,223,.8)]',
    badge: 'border-cyan-200/20 bg-cyan-300/[0.06] text-cyan-100/70',
  },
  success: {
    border: 'border-emerald-300/[0.14]',
    dot: 'border-emerald-100 bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,.72)]',
    badge: 'border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-100/70',
  },
  warning: {
    border: 'border-amber-300/[0.16]',
    dot: 'border-amber-100 bg-amber-300 shadow-[0_0_18px_rgba(252,211,77,.72)]',
    badge: 'border-amber-300/20 bg-amber-300/[0.06] text-amber-100/70',
  },
  critical: {
    border: 'border-red-300/[0.18]',
    dot: 'border-red-100 bg-red-300 shadow-[0_0_18px_rgba(252,165,165,.72)]',
    badge: 'border-red-300/20 bg-red-300/[0.06] text-red-100/75',
  },
};

const sourceCodes: Record<LabLogSourceType, string> = {
  hypothesis: 'HYP',
  condition: 'COND',
  breakthrough: 'BRK',
  idea: 'IDEA',
  calculation: 'CALC',
  source: 'SRC',
  experiment: 'EXP',
  simulation: 'SIM',
  system: 'SYS',
};

export function LabLogTimeline({items, locale, labels}: LabLogTimelineProps) {
  const normalizedLocale = locale === 'ru' ? 'ru-RU' : 'en-US';
  const groups = groupByDate(items, normalizedLocale);

  return (
    <GlassPanel glow className="data-grid overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-cyan-100/[0.08] bg-black/25 px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-7">
        <div>
          <div className="section-kicker">{labels.workspaceTitle}</div>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-.025em] text-cyan-50">{labels.title}</h2>
        </div>
        <span className="font-mono text-[10px] tracking-[.14em] text-cyan-100/40 uppercase">{items.length} {labels.events.toLowerCase()}</span>
      </div>

      {!items.length ? (
        <div className="px-5 py-12 text-center text-sm text-[#78999b] sm:px-7">{labels.noEvents}</div>
      ) : (
        <div className="space-y-8 px-4 py-6 sm:px-7 sm:py-8">
          {groups.map(group => (
            <section key={group.key}>
              <div className="mb-4 flex items-center gap-3">
                <span className="h-px flex-1 bg-gradient-to-r from-cyan-300/30 to-transparent" />
                <h3 className="font-mono text-[10px] tracking-[.14em] text-cyan-100/45 uppercase">{group.label}</h3>
              </div>
              <div className="relative ml-2 space-y-4 border-l border-cyan-200/20 pl-6 sm:ml-3 sm:pl-8">
                {group.items.map(item => <TimelineItem item={item} locale={normalizedLocale} labels={labels} key={item.id} />)}
              </div>
            </section>
          ))}
        </div>
      )}
    </GlassPanel>
  );
}

function TimelineItem({item, locale, labels}: {item: LabLogItem; locale: string; labels: LabLogLabels}) {
  const style = severityStyles[item.severity];
  const metadata = Object.entries(item.metadata || {}).filter(([, value]) => value !== undefined && value !== null && value !== '');
  const content = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-cyan-100/[0.1] bg-cyan-100/[0.035] px-2 py-1 font-mono text-[9px] tracking-[.12em] text-cyan-100/55">{sourceCodes[item.sourceType]}</span>
          <span className="font-mono text-[9px] tracking-[.1em] text-cyan-100/40 uppercase">{labels.sourceTypes[item.sourceType]}</span>
        </div>
        <time className="font-mono text-[9px] text-cyan-100/35" dateTime={item.timestamp.toISOString()}>{formatTime(item.timestamp, locale)}</time>
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-sm font-semibold text-cyan-50">
            {item.href ? <Link className="transition-colors hover:text-cyan-200" href={item.href}>{item.title}</Link> : item.title}
          </h4>
          {item.description && <p className="mt-2 max-w-4xl text-xs leading-6 text-[#89a6a8]">{item.description}</p>}
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 font-mono text-[8px] tracking-[.12em] uppercase ${style.badge}`}>{labels.severity[item.severity]}</span>
      </div>
      {metadata.length > 0 && (
        <details className="mt-4 border-t border-cyan-100/[0.07] pt-3">
          <summary className="cursor-pointer font-mono text-[9px] tracking-[.1em] text-cyan-200/50 uppercase">{labels.details}</summary>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            {metadata.map(([key, value]) => (
              <div className="border-l border-cyan-200/15 pl-3" key={key}>
                <dt className="font-mono text-[8px] tracking-[.1em] text-cyan-100/35 uppercase">{key}</dt>
                <dd className="mt-1 text-xs leading-5 text-cyan-50/65">{formatMetadata(value, locale)}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </>
  );

  return (
    <article className={`relative rounded-2xl border bg-black/35 p-4 transition-colors hover:bg-cyan-100/[0.025] sm:p-5 ${style.border}`}>
      <span className={`absolute -left-[1.93rem] top-5 h-3 w-3 rounded-full border-2 sm:-left-[2.43rem] ${style.dot}`} />
      {content}
    </article>
  );
}

function groupByDate(items: LabLogItem[], locale: string) {
  const formatter = new Intl.DateTimeFormat(locale, {day: 'numeric', month: 'long', year: 'numeric'});
  const groups = new Map<string, {key: string; label: string; items: LabLogItem[]}>();
  for (const item of items) {
    const key = `${item.timestamp.getFullYear()}-${item.timestamp.getMonth()}-${item.timestamp.getDate()}`;
    const group = groups.get(key) || {key, label: formatter.format(item.timestamp), items: []};
    group.items.push(item);
    groups.set(key, group);
  }
  return Array.from(groups.values());
}

function formatTime(value: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {hour: '2-digit', minute: '2-digit'}).format(value);
}

function formatMetadata(value: unknown, locale: string): string {
  if (value instanceof Date) return new Intl.DateTimeFormat(locale, {dateStyle: 'medium', timeStyle: 'short'}).format(value);
  if (Array.isArray(value)) return value.map(item => formatMetadata(item, locale)).join(' · ');
  if (value && typeof value === 'object') return Object.values(value).map(item => formatMetadata(item, locale)).join(' · ');
  if (typeof value === 'boolean') return value ? (locale === 'ru-RU' ? 'Да' : 'Yes') : (locale === 'ru-RU' ? 'Нет' : 'No');
  return String(value ?? '—');
}
