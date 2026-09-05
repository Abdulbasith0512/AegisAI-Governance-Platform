"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { ChartContainer, SharedTooltip, CHART_COLORS, AXIS_PROPS, GRID_PROPS } from '@/components/ui';
import { ApiError, getTransactionsHistory } from '@/lib/api';

type MetricKey = 'volume' | 'approval' | 'declined' | 'review';

const METRICS: { key: MetricKey; label: string; format: 'count' | 'pct' }[] = [
  { key: 'volume', label: 'Transaction Volume', format: 'count' },
  { key: 'approval', label: 'Approval Rate', format: 'pct' },
  { key: 'declined', label: 'Declined Rate', format: 'pct' },
  { key: 'review', label: 'Review Rate', format: 'pct' },
];
const CHART_TYPES = ['Line', 'Area', 'Bar'];
const HISTORY_LIMIT = 200;

interface DayBucket {
  key: string;
  label: string;
  total: number;
  approved: number;
  declined: number;
  review: number;
}

function dayKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function dayLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en', {
    month: 'short', day: 'numeric', timeZone: 'UTC',
  });
}

function seriesValue(bucket: DayBucket, metric: MetricKey): number {
  if (metric === 'volume') return bucket.total;
  if (bucket.total === 0) return 0;
  if (metric === 'approval') return (bucket.approved / bucket.total) * 100;
  if (metric === 'declined') return (bucket.declined / bucket.total) * 100;
  return (bucket.review / bucket.total) * 100;
}

export default function Analytics() {
  const [metric, setMetric] = useState<MetricKey>('volume');
  const [chartType, setChartType] = useState('Area');
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState<{ initiated_at: string; status: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTransactionsHistory(HISTORY_LIMIT);
      setRows(data.map((t) => ({ initiated_at: t.initiated_at, status: t.status })));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load transaction history.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function initial() { await load(); }
    void initial();
  }, [load]);

  const metricMeta = METRICS.find((m) => m.key === metric) ?? METRICS[0];

  // Bucket live rows by UTC calendar day: current window + prior window
  // for an honest previous-period comparison.
  const { current, priorAvailable } = useMemo(() => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const startCurrent = new Date(today.getTime() - (days - 1) * 86400000).getTime();
    const startPrior = startCurrent - days * 86400000;

    const byDay = new Map<string, DayBucket>();
    const bucketFor = (ts: number): DayBucket | null => {
      if (Number.isNaN(ts)) return null;
      const d = new Date(ts);
      d.setUTCHours(0, 0, 0, 0);
      const key = dayKey(d);
      let b = byDay.get(key);
      if (!b) {
        b = { key, label: dayLabel(key), total: 0, approved: 0, declined: 0, review: 0 };
        byDay.set(key, b);
      }
      return b;
    };

    for (const row of rows) {
      const ts = new Date(row.initiated_at).getTime();
      if (Number.isNaN(ts) || ts < startPrior) continue;
      const b = bucketFor(ts);
      if (!b) continue;
      b.total += 1;
      if (row.status === 'approved') b.approved += 1;
      else if (row.status === 'declined') b.declined += 1;
      else if (row.status === 'under_review') b.review += 1;
    }

    const cur: { label: string; value: number; comparison: number | null }[] = [];
    let priorCovered = true;
    for (let i = 0; i < days; i++) {
      const day = new Date(startCurrent + i * 86400000);
      const key = dayKey(day);
      const b = byDay.get(key) ?? { key, label: dayLabel(key), total: 0, approved: 0, declined: 0, review: 0 };
      const priorDay = new Date(startPrior + i * 86400000);
      const pb = byDay.get(dayKey(priorDay));
      if (!pb) priorCovered = false;
      cur.push({
        label: b.label,
        value: Math.round(seriesValue(b, metric) * 100) / 100,
        comparison: pb ? Math.round(seriesValue(pb, metric) * 100) / 100 : null,
      });
    }
    return { current: cur, priorAvailable: priorCovered };
  }, [rows, days, metric]);

  const hasData = current.some((d) => d.value > 0);
  const ChartComp = chartType === 'Line' ? LineChart : chartType === 'Bar' ? BarChart : AreaChart;

  return (
    <div style={{ maxWidth: 1400 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 'var(--text-20)', fontWeight: 700, color: 'var(--gray-50)' }}>Analytics</h1>
        <p style={{ fontSize: 'var(--text-13)', color: 'var(--gray-500)', marginTop: 4 }}>
          Live ledger metrics bucketed by day (UTC){metricMeta.format === 'pct' ? ' · shown as % of daily volume' : ''}
        </p>
      </div>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 'var(--text-11)', color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Metric</label>
          <select value={metric} onChange={e => setMetric(e.target.value as MetricKey)} className="input" style={{ width: 220 }}>
            {METRICS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
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
      {loading ? (
        <div className="card" style={{ padding: 48, textAlign: 'center', fontSize: 'var(--text-13)', color: 'var(--gray-500)' }}>
          Loading live metrics…
        </div>
      ) : error ? (
        <div className="card" style={{ padding: 32, textAlign: 'center', fontSize: 'var(--text-13)', color: 'var(--risk-critical-text)' }}>
          <p>Could not reach the transaction API: {error}</p>
          <button className="btn btn-outline" style={{ marginTop: 12 }} onClick={() => void load()}>Retry</button>
        </div>
      ) : !hasData ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <p style={{ fontSize: 'var(--text-14)', fontWeight: 600, color: 'var(--gray-100)', marginBottom: 6 }}>No transactions in range</p>
          <p style={{ fontSize: 'var(--text-13)', color: 'var(--gray-500)', marginBottom: 14 }}>
            Analytics are computed from the live ledger — run an interception to populate them.
          </p>
          <Link href="/dashboard/transactions" className="btn btn-primary" style={{ textDecoration: 'none' }}>
            Go to Transactions
          </Link>
        </div>
      ) : (
        <ChartContainer
          title={metricMeta.label}
          subtitle={`Last ${days} days${priorAvailable ? ' · dashed: prior period' : ' · prior period unavailable'}`}
          height={360}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ChartComp data={current} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
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
                  <Area type="monotone" dataKey="value" stroke={CHART_COLORS.accent} fill="url(#analytics-gradient)" strokeWidth={1.5} dot={false} isAnimationActive={false} name={metricMeta.label} connectNulls />
                  {priorAvailable && (
                    <Area type="monotone" dataKey="comparison" stroke={CHART_COLORS.high} fill="none" strokeWidth={1} strokeDasharray="4 4" dot={false} isAnimationActive={false} name="Prior period" connectNulls />
                  )}
                </>
              ) : chartType === 'Line' ? (
                <>
                  <Line type="monotone" dataKey="value" stroke={CHART_COLORS.accent} strokeWidth={2} dot={false} isAnimationActive={false} name={metricMeta.label} connectNulls />
                  {priorAvailable && (
                    <Line type="monotone" dataKey="comparison" stroke={CHART_COLORS.high} strokeWidth={1} strokeDasharray="4 4" dot={false} isAnimationActive={false} name="Prior period" connectNulls />
                  )}
                </>
              ) : (
                <>
                  <Bar dataKey="value" fill={CHART_COLORS.accent} radius={[3, 3, 0, 0]} isAnimationActive={false} name={metricMeta.label} />
                  {priorAvailable && (
                    <Bar dataKey="comparison" fill={CHART_COLORS.high} radius={[3, 3, 0, 0]} isAnimationActive={false} name="Prior period" />
                  )}
                </>
              )}
            </ChartComp>
          </ResponsiveContainer>
        </ChartContainer>
      )}
    </div>
  );
}
