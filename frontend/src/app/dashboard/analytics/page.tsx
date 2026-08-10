"use client";

import React, { useState } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { ChartContainer, SharedTooltip, CHART_COLORS, AXIS_PROPS, GRID_PROPS } from '@/components/ui';
import { generateTimeSeriesData } from '@/lib/mockData';

const METRICS = ['Transaction Volume', 'Fraud Rate', 'Approval Rate', 'Avg Risk Score', 'Agent Accuracy'];
const DIMENSIONS = ['Merchant Category', 'Country', 'Agent', 'Risk Level'];
const CHART_TYPES = ['Line', 'Area', 'Bar'];

export default function Analytics() {
  const [metric, setMetric] = useState(METRICS[0]);
  const [chartType, setChartType] = useState('Area');
  const [days, setDays] = useState(30);

  const data = React.useMemo(() => {
    return generateTimeSeriesData(days, 60000, 10000).map((d, i) => {
      const sinVal = Math.sin(i + 1) * 10000;
      const pseudoRand = sinVal - Math.floor(sinVal);
      return {
        label: new Date(d.ts).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
        value: d.value,
        comparison: d.value * (0.85 + pseudoRand * 0.3),
      };
    });
  }, [days]);


  const ChartComp = chartType === 'Line' ? LineChart : chartType === 'Bar' ? BarChart : AreaChart;
  const DataComp = chartType === 'Line' ? Line : chartType === 'Bar' ? Bar : Area;

  return (
    <div style={{ maxWidth: 1400 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 'var(--text-20)', fontWeight: 700, color: 'var(--gray-50)' }}>Analytics</h1>
        <p style={{ fontSize: 'var(--text-13)', color: 'var(--gray-500)', marginTop: 4 }}>Flexible metric exploration across time</p>
      </div>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 'var(--text-11)', color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Metric</label>
          <select value={metric} onChange={e => setMetric(e.target.value)} className="input" style={{ width: 220 }}>
            {METRICS.map(m => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 'var(--text-11)', color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Chart Type</label>
          <div style={{ display: 'flex', gap: 4 }}>
            {CHART_TYPES.map(t => (
              <button key={t} className={`btn ${t === chartType ? 'btn-primary' : 'btn-outline'}`} onClick={() => setChartType(t)}>{t}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 'var(--text-11)', color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Time Range</label>
          <div style={{ display: 'flex', gap: 4 }}>
            {[7, 14, 30, 90].map(d => (
              <button key={d} className={`btn ${d === days ? 'btn-primary' : 'btn-outline'}`} onClick={() => setDays(d)}>{d}d</button>
            ))}
          </div>
        </div>
      </div>
      {/* Chart */}
      <ChartContainer title={metric} subtitle={`Last ${days} days`} height={360}>
        <ResponsiveContainer width="100%" height="100%">
          <ChartComp data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            {chartType === 'Area' && (
              <defs>
                <linearGradient id="analytics-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.accent} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={CHART_COLORS.accent} stopOpacity={0} />
                </linearGradient>
              </defs>
            )}
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="label" {...AXIS_PROPS} interval={Math.floor(days / 8)} />
            <YAxis {...AXIS_PROPS} width={40} />
            <Tooltip content={<SharedTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11, color: 'var(--gray-400)' }} />
            {chartType === 'Area' ? (
              <>
                <Area type="monotone" dataKey="value" stroke={CHART_COLORS.accent} fill="url(#analytics-gradient)" strokeWidth={1.5} dot={false} isAnimationActive={false} name={metric} />
                <Area type="monotone" dataKey="comparison" stroke={CHART_COLORS.high} fill="none" strokeWidth={1} strokeDasharray="4 4" dot={false} isAnimationActive={false} name="vs. prior period" />
              </>
            ) : chartType === 'Line' ? (
              <>
                <Line type="monotone" dataKey="value" stroke={CHART_COLORS.accent} strokeWidth={2} dot={false} isAnimationActive={false} name={metric} />
                <Line type="monotone" dataKey="comparison" stroke={CHART_COLORS.high} strokeWidth={1} strokeDasharray="4 4" dot={false} isAnimationActive={false} name="vs. prior period" />
              </>
            ) : (
              <>
                <Bar dataKey="value" fill={CHART_COLORS.accent} radius={[3, 3, 0, 0]} isAnimationActive={false} name={metric} />
                <Bar dataKey="comparison" fill={CHART_COLORS.high} radius={[3, 3, 0, 0]} isAnimationActive={false} name="vs. prior period" />
              </>
            )}
          </ChartComp>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}
