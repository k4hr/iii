'use client';

import {Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';
import type {EngineeringMetric} from '@/lib/engineering/build-engineering-model';

export function EngineeringChartsPanel({metrics, labels}: {metrics: EngineeringMetric[]; labels: Record<EngineeringMetric['key'], string>}) {
  const data = metrics.map(metric => ({name: labels[metric.key], value: metric.value}));
  return (
    <div className="rounded-2xl border border-cyan-100/[0.08] bg-black/25 p-4">
      <div className="h-[230px] w-full">
        <ResponsiveContainer height="100%" width="100%">
          <BarChart data={data} layout="vertical" margin={{left: 6, right: 12, top: 8, bottom: 0}}>
            <defs>
              <linearGradient id="engineering-metric-fill" x1="0" x2="1">
                <stop offset="0" stopColor="#185f62" />
                <stop offset="1" stopColor="#58e6d8" />
              </linearGradient>
            </defs>
            <CartesianGrid horizontal={false} stroke="rgba(164,255,245,.06)" />
            <XAxis axisLine={false} domain={[0, 100]} tick={{fill: 'rgba(207,255,250,.35)', fontSize: 8}} tickLine={false} type="number" />
            <YAxis axisLine={false} dataKey="name" tick={{fill: 'rgba(207,255,250,.55)', fontSize: 9}} tickLine={false} type="category" width={92} />
            <Tooltip contentStyle={{background: '#031012', border: '1px solid rgba(164,255,245,.15)', borderRadius: 10, fontSize: 11}} cursor={{fill: 'rgba(87,230,216,.04)'}} formatter={(value) => [`${Number(value)}%`, '']} />
            <Bar dataKey="value" fill="url(#engineering-metric-fill)" isAnimationActive radius={[0, 5, 5, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
