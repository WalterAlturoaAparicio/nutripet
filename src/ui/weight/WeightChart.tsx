'use client';

import { CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts';
import { kgToDisplay, type WeightUnit } from '@/ui/format/units';

export interface WeightSeries {
  records: { date: string; weightKg: number }[];
  trend: { date: string; trendKg: number }[];
  targetKg: number;
}

const ts = (d: string) => Date.parse(`${d}T00:00:00Z`);
const fmt = (n: number) => new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(n));

/** Raw measurements as dots, the moving-average trend as a line, the target as a dashed line (FR-051). */
export function WeightChart({ data, unit }: { data: WeightSeries; unit: WeightUnit }) {
  const conv = (kg: number) => Math.round(kgToDisplay(kg, unit) * 10) / 10;
  const points = data.records.map((r) => ({ x: ts(r.date), weight: conv(r.weightKg) }));
  const trend = data.trend.map((p) => ({ x: ts(p.date), trend: conv(p.trendKg) }));
  const all = [...points.map((p) => p.weight), ...trend.map((p) => p.trend), conv(data.targetKg)];
  const min = Math.floor(Math.min(...all) - 1);
  const max = Math.ceil(Math.max(...all) + 1);
  return (
    <div className="h-56 w-full" role="img" aria-label="Gráfico de peso y tendencia">
      <ResponsiveContainer>
        <ComposedChart margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid stroke="#eee" vertical={false} />
          <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} scale="time" tickFormatter={fmt} fontSize={11} />
          <YAxis domain={[min, max]} fontSize={11} unit={` ${unit}`} width={64} />
          <Tooltip labelFormatter={(v) => fmt(Number(v))} formatter={(v, name) => [`${v} ${unit}`, name === 'trend' ? 'Tendencia' : 'Peso']} />
          <ReferenceLine y={conv(data.targetKg)} stroke="#4f5bd5" strokeDasharray="6 4" label={{ value: 'Objetivo', fontSize: 11, fill: '#4f5bd5', position: 'insideTopRight' }} />
          <Scatter data={points} dataKey="weight" fill="#8a9098" name="weight" />
          <Line data={trend} dataKey="trend" stroke="#0f9d76" strokeWidth={3} dot={false} type="monotone" name="trend" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
