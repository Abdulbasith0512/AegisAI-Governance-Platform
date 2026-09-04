"use client";

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MOCK_AGENTS } from '@/lib/mockData';
import { ChartContainer, RiskBadge, SharedTooltip, CHART_COLORS, AXIS_PROPS, GRID_PROPS } from '@/components/ui';
import { Activity, Cpu, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { apiUrl } from "@/lib/api";

export default function Agents() {
  const [agents, setAgents] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadAgents() {
      try {
        const res = await fetch(apiUrl("/api/v1/agents"));
        if (res.ok) {
          const data = await res.json();
          const mapped = data.map((ba: any, idx: number) => {
            const matchingMock = MOCK_AGENTS[idx % MOCK_AGENTS.length];
            return {
              id: ba.id,
              name: ba.name,
              version: ba.latest_version,
              status: ba.status === 'active' || ba.status === 'healthy' ? 'healthy' : ba.status === 'degraded' ? 'degraded' : 'offline',
              accuracy: matchingMock.accuracy,
              precision: matchingMock.precision,
              recall: matchingMock.recall,
              trafficPct: ba.canary_split || ba.ab_split || matchingMock.trafficPct,
              requestsPerMin: matchingMock.requestsPerMin,
              latencyMs: matchingMock.latencyMs,
              driftScore: matchingMock.driftScore,
              accuracyHistory: matchingMock.accuracyHistory
            };
          });
          setAgents(mapped);
        } else {
          throw new Error("Backend error");
        }
      } catch {
        setAgents(MOCK_AGENTS);
      } finally {
        setLoading(false);
      }
    }
    loadAgents();
  }, []);

  return (
    <div style={{ maxWidth: 1600 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 'var(--text-20)', fontWeight: 700, color: 'var(--gray-50)' }}>Agents Registry</h1>
        <p style={{ fontSize: 'var(--text-13)', color: 'var(--gray-500)', marginTop: 4 }}>ML model agents, versions, accuracy trends, and drift indicators</p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200, color: 'var(--text-3)' }}>
          <Loader2 className="spin-animation" size={24} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 14 }}>
          {agents.map(agent => (
            <div key={agent.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {/* Agent header */}
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-0)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: agent.status === 'healthy' ? 'var(--status-success)' : agent.status === 'degraded' ? 'var(--risk-medium)' : 'var(--risk-critical)',
                    animation: agent.status === 'healthy' ? 'live-pulse 2s ease-in-out infinite' : 'none',
                  }} />
                  <span style={{ fontSize: 'var(--text-14)', fontWeight: 600, color: 'var(--gray-100)' }}>{agent.name}</span>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--gray-500)', background: 'var(--surface-3)', padding: '1px 6px', borderRadius: 3 }}>{agent.version}</span>
                </div>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
                  color: agent.status === 'healthy' ? 'var(--status-success)' : agent.status === 'degraded' ? 'var(--risk-medium-text)' : 'var(--risk-critical-text)' }}>
                  {agent.status}
                </span>
              </div>
              {/* Metrics */}
              <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, borderBottom: '1px solid var(--border-0)' }}>
                {[['Accuracy', `${(agent.accuracy * 100).toFixed(1)}%`], ['Precision', `${(agent.precision * 100).toFixed(1)}%`], ['Recall', `${(agent.recall * 100).toFixed(1)}%`], ['Drift', String(agent.driftScore.toFixed(4))]].map(([label, val]) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--gray-600)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 'var(--text-16)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: label === 'Drift' && agent.driftScore > 0.05 ? 'var(--risk-high-text)' : 'var(--gray-100)' }}>{val}</div>
                  </div>
                ))}
              </div>
              {/* Accuracy trend */}
              <div style={{ padding: '10px 8px 6px', height: 90 }}>
                <div style={{ fontSize: 10, color: 'var(--gray-600)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, paddingLeft: 8 }}>Accuracy (30 days)</div>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={agent.accuracyHistory} margin={{ top: 2, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid {...GRID_PROPS} />
                    <XAxis dataKey="ts" hide />
                    <YAxis {...AXIS_PROPS} domain={[0.85, 1.0]} width={32} tickFormatter={v => `${(v * 100).toFixed(0)}%`} />
                    <Tooltip content={<SharedTooltip />} />
                    <Line type="monotone" dataKey="value" stroke={agent.driftScore > 0.05 ? CHART_COLORS.high : CHART_COLORS.accent} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {/* Footer */}
              <div style={{ padding: '8px 16px', display: 'flex', gap: 14, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--gray-500)', borderTop: '1px solid var(--border-0)' }}>
                <span>Traffic: {agent.trafficPct}%</span>
                <span>{agent.requestsPerMin.toLocaleString()} req/min</span>
                <span>Latency: {agent.latencyMs}ms</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}