'use client';

import {Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';
import type {CanonicalEngineeringModel} from '@/lib/engineering/engineering-model-schema';

export function EngineeringChartsPanel({model}: {model: CanonicalEngineeringModel}) {
  const charts = model.charts.length ? model.charts.slice(0, 3) : [{id: 'metrics', title: 'Metrics', type: 'feasibility' as const, data: model.metrics.map(metric => ({label: metric.label, value: metric.value}))}];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {charts.map(chart => (
        <div className="rounded-2xl border border-cyan-100/[0.08] bg-black/25 p-4" key={chart.id}>
          <div className="mb-3 font-mono text-[9px] tracking-[.09em] text-cyan-100/45 uppercase">{chart.title}</div>
          <div className="h-[230px] w-full">
            <ResponsiveContainer height="100%" width="100%">
              <BarChart data={chart.data} layout="vertical" margin={{left: 6, right: 12, top: 8, bottom: 0}}>
                <defs><linearGradient id={`engineering-${chart.id}`} x1="0" x2="1"><stop offset="0" stopColor="#185f62" /><stop offset="1" stopColor="#58e6d8" /></linearGradient></defs>
                <CartesianGrid horizontal={false} stroke="rgba(164,255,245,.06)" />
                <XAxis axisLine={false} tick={{fill: 'rgba(207,255,250,.35)', fontSize: 8}} tickLine={false} type="number" />
                <YAxis axisLine={false} dataKey="label" tick={{fill: 'rgba(207,255,250,.55)', fontSize: 9}} tickLine={false} type="category" width={105} />
                <Tooltip contentStyle={{background: '#031012', border: '1px solid rgba(164,255,245,.15)', borderRadius: 10, fontSize: 11}} cursor={{fill: 'rgba(87,230,216,.04)'}} />
                <Bar dataKey="value" fill={`url(#engineering-${chart.id})`} isAnimationActive radius={[0, 5, 5, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ))}
    </div>
  );
}
