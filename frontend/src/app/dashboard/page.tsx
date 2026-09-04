"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import {
  AlertTriangle, ArrowUpRight, ArrowDownRight, Activity,
  ShieldAlert, CheckCircle2, Clock, Zap,
} from 'lucide-react';
import { StatCard, ChartContainer, RiskBadge, SharedTooltip, CHART_COLORS, AXIS_PROPS, GRID_PROPS } from '@/components/ui';
import {
  MOCK_KPI, MOCK_TRANSACTIONS, generateSparkline, generateTimeSeriesData,
  type Transaction, type KpiSnapshot,
} from '@/lib/mockData';
import { eventStream } from '@/lib/eventStream';
import type { StreamEvent, KpiDeltaPayload, RiskAlertPayload } from '@/lib/eventStream';

// ── Activity Feed Item ─────────────────────────────────────────────────────
interface FeedItem {
  id: string;
  type: 'risk_alert' | 'new_tx' | 'agent_status';
  message: string;
  level?: 'critical' | 'high' | 'medium' | 'low' | 'safe';
  ts: string;
}

// ── Risk heatmap cells (mock data for D3-style SVG grid) ──────────────────
const HEATMAP_SEGMENTS = ['Crypto', 'E-Commerce', 'Travel', 'Food', 'SaaS', 'Retail', 'FinServ', 'Gaming'];
const HEATMAP_HOURS = ['00', '03', '06', '09', '12', '15', '18', '21'];

function generateHeatmapData() {
  return HEATMAP_SEGMENTS.map(seg => ({
    segment: seg,
    cells: HEATMAP_HOURS.map(h => ({
      hour: h,
      value: Math.round(Math.random() * 100),
    })),
  }));
}

function heatColor(value: number): string {
  if (value > 80) return CHART_COLORS.critical;
  if (value > 60) return CHART_COLORS.high;
  if (value > 40) return CHART_COLORS.medium;
  if (value > 20) return CHART_COLORS.low;
  return CHART_COLORS.safe;
}

// ── Volume + Fraud Rate time-series ────────────────────────────────────────
const volumeData = generateTimeSeriesData(30, 62000, 8000).map(d => ({
  ...d,
  label: new Date(d.ts).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
}));

const fraudData = generateTimeSeriesData(30, 1.8, 0.4).map((d, i) => ({
  ...d,
  label: new Date(d.ts).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
}));

const riskDistData = [
  { name: 'Safe', value: 58, color: CHART_COLORS.safe },
  { name: 'Low', value: 22, color: CHART_COLORS.low },
  { name: 'Medium', value: 12, color: CHART_COLORS.medium },
  { name: 'High', value: 6, color: CHART_COLORS.high },
  { name: 'Critical', value: 2, color: CHART_COLORS.critical },
];

// ── Overview Component ─────────────────────────────────────────────────────
export default function Overview() {
  const [kpi, setKpi] = useState<KpiSnapshot>(MOCK_KPI);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [heatmapData] = useState(generateHeatmapData);

  const txSparkline  = generateSparkline(14, 65000, 8000);
  const fraudSparkline = generateSparkline(14, 1.8, 0.3);
  const approvalSparkline = generateSparkline(14, 96, 1);
  const accuracySparkline = generateSparkline(14, 95, 1);

  const addFeedItem = useCallback((item: Omit<FeedItem, 'id'>) => {
    setFeedItems(prev => [{ ...item, id: `feed-${Date.now()}-${Math.random()}` }, ...prev].slice(0, 50));
  }, []);

  useEffect(() => {
    const unsubAlert = eventStream.on('risk_alert', (e: StreamEvent) => {
      const p = e.payload as RiskAlertPayload;
      addFeedItem({
        type: 'risk_alert',
        message: `${p.riskLevel === 'critical' ? 'Critical' : 'High'} risk: ${p.customerName} — $${p.amount.toFixed(2)} · ${p.reason}`,
        level: p.riskLevel,
        ts: new Date().toLocaleTimeString(),
      });
    });

    const unsubKpi = eventStream.on('kpi_delta', (e: StreamEvent) => {
      const p = e.payload as KpiDeltaPayload;
      setKpi(prev => ({ ...prev, [p.field]: p.value }));
    });

    const unsubTx = eventStream.on('new_transaction', (e: StreamEvent) => {
      const tx = e.payload as Transaction;
      if (tx.riskLevel === 'low' || tx.riskLevel === 'safe') {
        addFeedItem({
          type: 'new_tx',
          message: `Approved: ${tx.customerName} — $${tx.amount.toFixed(2)} at ${tx.merchantName}`,
          level: 'safe',
          ts: new Date().toLocaleTimeString(),
        });
      }
    });

    return () => { unsubAlert(); unsubKpi(); unsubTx(); };
  }, [addFeedItem]);

  const activeIncidents = MOCK_TRANSACTIONS.filter(t => t.riskLevel === 'critical').length;

  return (
    <div style={{ maxWidth: 1600 }}>
      {/* Page header */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-20)', fontWeight: 700, color: 'var(--gray-50)', lineHeight: 1 }}>
            Operations Overview
          </h1>
          <p style={{ fontSize: 'var(--text-13)', color: 'var(--gray-500)', marginTop: 4 }}>
            {new Date().toLocaleDateString('en', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 10px', borderRadius: 'var(--radius-md)',
            background: 'var(--surface-2)', border: '1px solid var(--border-1)',
            fontSize: 'var(--text-12)', fontFamily: 'var(--font-mono)',
            color: 'var(--status-success)',
          }}>
            <span className="live-dot" style={{ width: 6, height: 6 }} />
            Live stream active
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard
          label="Tx Volume (24h)"
          value={`${(kpi.txVolume / 1000).toFixed(1)}K`}
          delta={kpi.txVolumeDelta}
          deltaLabel="%"
          sparkline={txSparkline}
          sparklineColor={CHART_COLORS.accent}
          live
        />
        <StatCard
          label="Fraud Rate"
          value={`${kpi.fraudRate.toFixed(2)}%`}
          delta={kpi.fraudRateDelta}
          deltaLabel="%"
          sparkline={fraudSparkline}
          sparklineColor={CHART_COLORS.high}
          live
        />
        <StatCard
          label="Approval Rate"
          value={`${kpi.approvalRate.toFixed(1)}%`}
          delta={kpi.approvalRateDelta}
          deltaLabel="%"
          sparkline={approvalSparkline}
          sparklineColor={CHART_COLORS.low}
          live
        />
        <StatCard
          label="Active Incidents"
          value={kpi.activeIncidents}
          sparkline={undefined}
          sparklineColor={CHART_COLORS.critical}
          live
        />
        <StatCard
          label="Agent Accuracy"
          value={`${(kpi.agentAccuracy * 100).toFixed(2)}%`}
          delta={parseFloat((kpi.agentAccuracyDelta * 100).toFixed(2))}
          deltaLabel="%"
          sparkline={accuracySparkline}
          sparklineColor={CHART_COLORS.safe}
          live
        />
      </div>

      {/* Main grid: charts + activity feed */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 340px', gap: 14, marginBottom: 14 }}>

        {/* Transaction Volume chart */}
        <ChartContainer title="Transaction Volume" subtitle="Last 30 days" height={200}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={volumeData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="vol-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.accent} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={CHART_COLORS.accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey="label" {...AXIS_PROPS} interval={4} />
              <YAxis {...AXIS_PROPS} tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} width={38} />
              <Tooltip content={<SharedTooltip />} />
              <Area
                type="monotone" dataKey="value" stroke={CHART_COLORS.accent}
                strokeWidth={1.5} fill="url(#vol-gradient)" dot={false} isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>

        {/* Fraud Rate chart */}
        <ChartContainer title="Fraud Rate" subtitle="Last 30 days" height={200}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={fraudData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="fraud-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.high} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={CHART_COLORS.high} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey="label" {...AXIS_PROPS} interval={4} />
              <YAxis {...AXIS_PROPS} tickFormatter={(v) => `${v}%`} width={32} />
              <Tooltip content={<SharedTooltip />} />
              <Area
                type="monotone" dataKey="value" stroke={CHART_COLORS.high}
                strokeWidth={1.5} fill="url(#fraud-gradient)" dot={false} isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>

        {/* Risk Distribution donut */}
        <ChartContainer title="Risk Distribution" subtitle="Today" height={200}>
          <div style={{ display: 'flex', alignItems: 'center', height: '100%', gap: 8 }}>
            <ResponsiveContainer width="50%" height="100%">
              <PieChart>
                <Pie data={riskDistData} dataKey="value" innerRadius={40} outerRadius={64} strokeWidth={2} stroke="var(--surface-2)">
                  {riskDistData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<SharedTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {riskDistData.map((entry) => (
                <div key={entry.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, fontSize: 'var(--text-12)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: entry.color, flexShrink: 0 }} />
                    <span style={{ color: 'var(--gray-400)' }}>{entry.name}</span>
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--gray-200)' }}>{entry.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </ChartContainer>
      </div>

      {/* Heatmap + Activity feed */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 14 }}>

        {/* Risk Heatmap */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border-0)' }}>
            <div className="text-title" style={{ fontSize: 'var(--text-14)' }}>Segment Risk Heatmap</div>
            <div className="text-caption" style={{ marginTop: 2 }}>Risk score by segment × hour (UTC)</div>
          </div>
          <div style={{ padding: '16px', overflowX: 'auto' }}>
            <svg width="100%" viewBox="0 0 600 220" preserveAspectRatio="none" style={{ minWidth: 400 }}>
              {/* Hour labels */}
              {HEATMAP_HOURS.map((h, hi) => (
                <text
                  key={h} x={80 + hi * 65 + 24} y={14}
                  textAnchor="middle" fill="var(--gray-500)" fontSize={10} fontFamily="var(--font-mono)"
                >
                  {h}:00
                </text>
              ))}
              {heatmapData.map((seg, si) => (
                <g key={seg.segment}>
                  {/* Segment label */}
                  <text x={72} y={30 + si * 24 + 13} textAnchor="end" fill="var(--gray-400)" fontSize={11} fontFamily="var(--font-sans)">
                    {seg.segment}
                  </text>
                  {seg.cells.map((cell, ci) => (
                    <g key={cell.hour}>
                      <rect
                        x={80 + ci * 65} y={30 + si * 24} width={60} height={20}
                        rx={3} fill={heatColor(cell.value)} opacity={0.75}
                      />
                      <text
                        x={80 + ci * 65 + 30} y={30 + si * 24 + 14}
                        textAnchor="middle" fill="rgba(255,255,255,0.85)" fontSize={9} fontFamily="var(--font-mono)" fontWeight="600"
                      >
                        {cell.value}
                      </text>
                    </g>
                  ))}
                </g>
              ))}
            </svg>
            {/* Legend */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, justifyContent: 'flex-end' }}>
              {['Safe', 'Low', 'Medium', 'High', 'Critical'].map((label, i) => {
                const colors = [CHART_COLORS.safe, CHART_COLORS.low, CHART_COLORS.medium, CHART_COLORS.high, CHART_COLORS.critical];
                return (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--gray-500)' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: colors[i], opacity: 0.75 }} />
                    {label}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border-0)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div className="text-title" style={{ fontSize: 'var(--text-14)' }}>Live Activity</div>
              <div className="text-caption" style={{ marginTop: 2 }}>Real-time event stream</div>
            </div>
            <span className="live-dot" />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: 280 }}>
            {feedItems.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--gray-500)', fontSize: 'var(--text-13)' }}>
                Waiting for events…
              </div>
            ) : (
              feedItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    padding: '8px 14px',
                    borderBottom: '1px solid var(--border-0)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  <span style={{
                    fontSize: 'var(--text-12)',
                    color: item.level === 'critical' ? 'var(--risk-critical-text)'
                      : item.level === 'high' ? 'var(--risk-high-text)'
                      : 'var(--gray-300)',
                    lineHeight: 1.4,
                  }}>
                    {item.message}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--gray-600)', fontFamily: 'var(--font-mono)' }}>
                    {item.ts}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
