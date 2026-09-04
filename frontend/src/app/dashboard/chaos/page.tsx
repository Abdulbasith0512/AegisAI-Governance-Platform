"use client";

import React, { useState, useEffect, useRef } from 'react';
import ReactFlow, {
  Background, Controls,
  useNodesState, useEdgesState,
  Node, Edge, MarkerType,
  BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Play, Square, AlertTriangle, CheckCircle2, Clock, Zap, RefreshCw } from 'lucide-react';
import { RiskBadge, ChartContainer, SharedTooltip, CHART_COLORS, AXIS_PROPS, GRID_PROPS } from '@/components/ui';
import { ToastBar } from '@/components/ui/ToastBar';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import type { RiskLevel } from '@/lib/mockData';

// ── Experiment types ───────────────────────────────────────────────────────
interface Experiment {
  id: string;
  name: string;
  type: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  blastRadius: number;
  recoveryTimeMs?: number;
  trustDrop?: number;
  lastRunAt?: string;
}

const EXPERIMENTS: Experiment[] = [
  { id: 'exp-1', name: 'Kill Fraud Agent', type: 'Agent Kill', status: 'completed', blastRadius: 45, recoveryTimeMs: 4200, trustDrop: 12, lastRunAt: '2026-07-14T09:00:00Z' },
  { id: 'exp-2', name: 'Database Failure', type: 'Infrastructure', status: 'idle', blastRadius: 90, recoveryTimeMs: undefined, trustDrop: undefined },
  { id: 'exp-3', name: 'Redis Cache Miss', type: 'Cache Failure', status: 'completed', blastRadius: 30, recoveryTimeMs: 1800, trustDrop: 5, lastRunAt: '2026-07-13T14:00:00Z' },
  { id: 'exp-4', name: 'High Latency Injection', type: 'Network Delay', status: 'running', blastRadius: 60, recoveryTimeMs: undefined, trustDrop: undefined },
  { id: 'exp-5', name: 'Prompt Injection Test', type: 'Adversarial', status: 'idle', blastRadius: 20, recoveryTimeMs: undefined, trustDrop: undefined },
  { id: 'exp-6', name: 'Model Drift Simulation', type: 'ML Chaos', status: 'completed', blastRadius: 75, recoveryTimeMs: 9600, trustDrop: 28, lastRunAt: '2026-07-12T11:00:00Z' },
  { id: 'exp-7', name: 'API Gateway Failure', type: 'Infrastructure', status: 'idle', blastRadius: 85, recoveryTimeMs: undefined, trustDrop: undefined },
  { id: 'exp-8', name: 'Data Poisoning Attack', type: 'Adversarial', status: 'failed', blastRadius: 55, recoveryTimeMs: undefined, trustDrop: undefined, lastRunAt: '2026-07-11T08:00:00Z' },
];

// ── Recovery comparison data ───────────────────────────────────────────────
const beforeAfterData = [
  { name: 'Latency (ms)', before: 180, after: 22 },
  { name: 'Error Rate %', before: 34, after: 0.8 },
  { name: 'Trust Score', before: 61, after: 94 },
  { name: 'Approval Rate', before: 72, after: 97 },
];

const recoveryTimeline = [
  { t: '00:00', trust: 95 },
  { t: '00:30', trust: 70 },
  { t: '01:00', trust: 48 },
  { t: '01:30', trust: 55 },
  { t: '02:00', trust: 68 },
  { t: '02:30', trust: 80 },
  { t: '03:00', trust: 90 },
  { t: '03:30', trust: 94 },
  { t: '04:00', trust: 95 },
];

// ── Service Dependency React Flow ──────────────────────────────────────────
type HealthState = 'healthy' | 'degraded' | 'failed';

function healthColor(h: HealthState): string {
  return h === 'healthy' ? '#22c55e' : h === 'degraded' ? '#f59e0b' : '#ff3b3b';
}

function serviceNode(id: string, label: string, x: number, y: number, health: HealthState, isBlast: boolean = false): Node {
  const color = healthColor(health);
  return {
    id,
    position: { x, y },
    data: { label: `${health === 'failed' ? 'Down —' : health === 'degraded' ? 'Degraded —' : ''} ${label}` },
    style: {
      background: `${color}18`,
      border: `1.5px solid ${color}88`,
      borderRadius: 8,
      color,
      fontSize: 11,
      fontFamily: 'var(--font-mono)',
      fontWeight: 600,
      padding: '6px 14px',
      boxShadow: isBlast ? `0 0 20px ${color}44` : 'none',
    },
  };
}

function serviceEdge(id: string, src: string, tgt: string, health: HealthState): Edge {
  const color = healthColor(health);
  return {
    id, source: src, target: tgt,
    style: { stroke: color, strokeWidth: health === 'failed' ? 2 : 1.2 },
    animated: health === 'failed',
    markerEnd: { type: MarkerType.ArrowClosed, color },
  };
}

const [DEP_NODES, DEP_EDGES] = (() => {
  const nodes: Node[] = [
    serviceNode('gateway', 'API Gateway', 200, 40, 'healthy'),
    serviceNode('fraud', 'Fraud Engine', 50, 160, 'degraded', true),
    serviceNode('rule', 'Rule Evaluator', 350, 160, 'healthy'),
    serviceNode('ml', 'ML Inference', 50, 280, 'failed', true),
    serviceNode('identity', 'Identity Svc', 350, 280, 'healthy'),
    serviceNode('db', 'PostgreSQL', 200, 400, 'healthy'),
    serviceNode('redis', 'Redis Cache', 500, 280, 'healthy'),
    serviceNode('audit', 'Audit Ledger', 500, 400, 'healthy'),
  ];
  const edges: Edge[] = [
    serviceEdge('se1', 'gateway', 'fraud', 'degraded'),
    serviceEdge('se2', 'gateway', 'rule', 'healthy'),
    serviceEdge('se3', 'fraud', 'ml', 'failed'),
    serviceEdge('se4', 'fraud', 'db', 'degraded'),
    serviceEdge('se5', 'rule', 'identity', 'healthy'),
    serviceEdge('se6', 'rule', 'db', 'healthy'),
    serviceEdge('se7', 'identity', 'redis', 'healthy'),
    serviceEdge('se8', 'db', 'audit', 'healthy'),
  ];
  return [nodes, edges];
})();

// ── Chaos Engineering Page ─────────────────────────────────────────────────
export default function ChaosEngineering() {
  const [experiments, setExperiments] = useState(EXPERIMENTS);
  const [nodes, setNodes, onNodesChange] = useNodesState(DEP_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(DEP_EDGES);
  const [runningId, setRunningId] = useState<string | null>('exp-4');
  const [toasts, setToasts] = useState<any[]>([]);

  const nextToastId = useRef(0);

  const runExperiment = (id: string) => {
    const exp = experiments.find(e => e.id === id);
    if (!exp) return;

    setRunningId(id);
    setExperiments(prev =>
      prev.map(e => e.id === id ? { ...e, status: 'running' } : e)
    );

    // Toast feedback
    const toastId = `toast-${nextToastId.current++}`;
    setToasts(prev => [...prev, {
      id: toastId,
      type: "info",
      message: `Injected fault: "${exp.name}". Check dependency map for live node failures...`
    }]);

    setTimeout(() => {
      setRunningId(null);
      const recoveryTime = Math.round(2000 + Math.random() * 8000);
      const trustDrop = Math.round(5 + Math.random() * 30);
      
      setExperiments(prev =>
        prev.map(e => e.id === id ? {
          ...e,
          status: 'completed',
          recoveryTimeMs: recoveryTime,
          trustDrop: trustDrop,
          lastRunAt: new Date().toISOString(),
        } : e)
      );

      setToasts(prev => [...prev, {
        id: Math.random().toString(),
        type: "success",
        message: `Self-Healing completed! Bypassed/recovered "${exp.name}" in ${(recoveryTime / 1000).toFixed(1)}s.`
      }]);
    }, 4000);
  };

  const stopExperiment = (id: string) => {
    setRunningId(null);
    setExperiments(prev =>
      prev.map(e => e.id === id ? { ...e, status: 'idle' } : e)
    );
    setToasts(prev => [...prev, {
      id: Math.random().toString(),
      type: "error",
      message: "Chaos experiment manually stopped."
    }]);
  };

  useEffect(() => {
    let fraudHealth: HealthState = 'healthy';
    let dbHealth: HealthState = 'healthy';
    let redisHealth: HealthState = 'healthy';
    let mlHealth: HealthState = 'healthy';

    if (runningId === 'exp-1') fraudHealth = 'failed';
    else if (runningId === 'exp-2') dbHealth = 'failed';
    else if (runningId === 'exp-3') redisHealth = 'failed';
    else if (runningId === 'exp-4') mlHealth = 'degraded';
    else if (runningId === 'exp-6') mlHealth = 'failed';
    else if (runningId === 'exp-7') fraudHealth = 'degraded';

    const updatedNodes: Node[] = [
      serviceNode('gateway', 'API Gateway', 200, 40, 'healthy'),
      serviceNode('fraud', 'Fraud Engine', 50, 160, fraudHealth, runningId === 'exp-1'),
      serviceNode('rule', 'Rule Evaluator', 350, 160, 'healthy'),
      serviceNode('ml', 'ML Inference', 50, 280, mlHealth, runningId === 'exp-4' || runningId === 'exp-6'),
      serviceNode('identity', 'Identity Svc', 350, 280, 'healthy'),
      serviceNode('db', 'PostgreSQL', 200, 400, dbHealth, runningId === 'exp-2'),
      serviceNode('redis', 'Redis Cache', 500, 280, redisHealth, runningId === 'exp-3'),
      serviceNode('audit', 'Audit Ledger', 500, 400, 'healthy'),
    ];

    const updatedEdges: Edge[] = [
      serviceEdge('se1', 'gateway', 'fraud', fraudHealth === 'healthy' ? 'healthy' : 'degraded'),
      serviceEdge('se2', 'gateway', 'rule', 'healthy'),
      serviceEdge('se3', 'fraud', 'ml', mlHealth === 'healthy' ? 'healthy' : 'failed'),
      serviceEdge('se4', 'fraud', 'db', dbHealth === 'healthy' ? 'healthy' : 'degraded'),
      serviceEdge('se5', 'rule', 'identity', 'healthy'),
      serviceEdge('se6', 'rule', 'db', 'healthy'),
      serviceEdge('se7', 'identity', 'redis', 'healthy'),
      serviceEdge('se8', 'db', 'audit', 'healthy'),
    ];

    setNodes(updatedNodes);
    setEdges(updatedEdges);
  }, [runningId, setNodes, setEdges]);

  const STATUS_ICON: Record<Experiment['status'], React.ReactNode> = {
    idle: <Clock size={13} color="var(--gray-500)" />,
    running: <RefreshCw size={13} color="var(--risk-medium-text)" className="animate-spin" />,
    completed: <CheckCircle2 size={13} color="var(--status-success)" />,
    failed: <AlertTriangle size={13} color="var(--risk-critical-text)" />,
  };

  const STATUS_COLOR: Record<Experiment['status'], string> = {
    idle: 'var(--gray-500)',
    running: 'var(--risk-medium-text)',
    completed: 'var(--status-success)',
    failed: 'var(--risk-critical-text)',
  };

  return (
    <div style={{ maxWidth: 1600 }}>
      <ToastBar toasts={toasts} onDismiss={(id) => setToasts(t => t.filter(x => x.id !== id))} />

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 'var(--text-20)', fontWeight: 700, color: 'var(--gray-50)', lineHeight: 1 }}>Chaos Engineering</h1>
        <p style={{ fontSize: 'var(--text-13)', color: 'var(--gray-500)', marginTop: 4 }}>
          Fault injection experiments, dependency maps, and recovery analytics
        </p>
      </div>

      {/* Informational Guidance Banner */}
      <div style={{
        background: "rgba(59, 130, 246, 0.08)",
        border: "1px solid rgba(59, 130, 246, 0.2)",
        borderRadius: 12,
        padding: "16px 20px",
        marginBottom: 20,
        display: "flex",
        alignItems: "start",
        gap: 16
      }}>
        <Zap size={20} style={{ color: "#3b82f6", marginTop: 2, flexShrink: 0 }} />
        <div>
          <h4 style={{ fontSize: 14, fontWeight: 700, color: "#93c5fd", marginBottom: 4 }}>How Chaos Engineering Works</h4>
          <p style={{ fontSize: 13, color: "var(--gray-300)", lineHeight: 1.5 }}>
            Use the <strong>Experiment Catalog</strong> to simulate live production faults. Clicking <strong>Run</strong> will inject that failure (e.g. killing the Fraud agent, slowing down DB queries) into the network. 
            Watch the <strong>Service Dependency Map</strong> to see affected nodes turn amber (degraded) or red (failed) in real-time. After a brief duration, AegisAI's automated <strong>Self-Healing Engine</strong> will bypass or recover the service, restoring metrics to healthy states.
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Experiments', value: experiments.length, color: 'var(--accent)' },
          { label: 'Running Now', value: experiments.filter(e => e.status === 'running').length, color: 'var(--risk-medium-text)' },
          { label: 'Completed', value: experiments.filter(e => e.status === 'completed').length, color: 'var(--status-success)' },
          { label: 'Failed', value: experiments.filter(e => e.status === 'failed').length, color: 'var(--risk-critical-text)' },
        ].map(stat => (
          <div key={stat.label} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div className="text-label">{stat.label}</div>
              <div style={{ fontSize: 'var(--text-28)', fontWeight: 700, color: stat.color, fontFamily: 'var(--font-mono)', lineHeight: 1.2, marginTop: 4 }}>
                {stat.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main grid: catalog + dependency map */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 14, marginBottom: 14 }}>

        {/* Experiment catalog */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border-0)' }}>
            <div className="text-title" style={{ fontSize: 'var(--text-14)' }}>Experiment Catalog</div>
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 460 }}>
            {experiments.map(exp => (
              <div
                key={exp.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 14px',
                  borderBottom: '1px solid var(--border-0)',
                  transition: 'background var(--motion-fast)',
                }}
              >
                {/* Status icon */}
                <div style={{ flexShrink: 0 }}>{STATUS_ICON[exp.status]}</div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontSize: 'var(--text-13)', fontWeight: 500, color: 'var(--gray-100)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exp.name}</span>
                    <span style={{
                      fontSize: 10, fontFamily: 'var(--font-mono)',
                      background: 'var(--surface-3)', border: '1px solid var(--border-2)',
                      borderRadius: 3, padding: '1px 5px', color: 'var(--gray-400)',
                      whiteSpace: 'nowrap', flexShrink: 0,
                    }}>{exp.type}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--gray-500)' }}>
                    <span>Blast: <span style={{ color: exp.blastRadius > 70 ? 'var(--risk-critical-text)' : exp.blastRadius > 40 ? 'var(--risk-medium-text)' : 'var(--gray-400)' }}>{exp.blastRadius}%</span></span>
                    {exp.recoveryTimeMs && <span>Recovery: {(exp.recoveryTimeMs / 1000).toFixed(1)}s</span>}
                    {exp.trustDrop && <span style={{ color: 'var(--risk-high-text)' }}>↓{exp.trustDrop}% trust</span>}
                  </div>
                </div>

                {/* Run / Stop */}
                <button
                  className={`btn ${exp.status === 'running' ? 'btn-danger' : 'btn-outline'}`}
                  style={{ flexShrink: 0, padding: '4px 10px', fontSize: 11 }}
                  onClick={() => {
                    if (exp.status === 'running') {
                      stopExperiment(exp.id);
                    } else {
                      runExperiment(exp.id);
                    }
                  }}
                  disabled={exp.status === 'running' && exp.id !== runningId}
                >
                  {exp.status === 'running' ? <><Square size={11} /> Stop</> : <><Play size={11} /> Run</>}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Dependency map */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border-0)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div className="text-title" style={{ fontSize: 'var(--text-14)' }}>Service Dependency Map</div>
              <div className="text-caption" style={{ marginTop: 2 }}>Live health state · Blast radius highlighted</div>
            </div>
            <div style={{ display: 'flex', gap: 10, fontSize: 10, fontFamily: 'var(--font-mono)' }}>
              {([['healthy', '#22c55e'], ['degraded', '#f59e0b'], ['failed', '#ff3b3b']] as const).map(([label, color]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--gray-500)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />{label}
                </div>
              ))}
            </div>
          </div>
          <div style={{ height: 440 }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              fitView
              style={{ background: 'var(--surface-0)' }}
              nodesDraggable={false}
              zoomOnScroll={false}
              panOnDrag={false}
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--gray-800)" />
              <Controls showInteractive={false} style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-md)' }} />
            </ReactFlow>
          </div>
        </div>
      </div>

      {/* Before/After metrics + Recovery timeline */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <ChartContainer title="Before vs After Recovery" subtitle="Last completed experiment: Kill Fraud Agent" height={180}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={beforeAfterData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey="name" {...AXIS_PROPS} />
              <YAxis {...AXIS_PROPS} width={30} />
              <Tooltip content={<SharedTooltip />} />
              <Bar dataKey="before" fill={CHART_COLORS.critical} radius={[3, 3, 0, 0]} isAnimationActive={false} name="Before" />
              <Bar dataKey="after" fill={CHART_COLORS.low} radius={[3, 3, 0, 0]} isAnimationActive={false} name="After" />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
        <ChartContainer title="Trust Score — Recovery Timeline" subtitle="During Kill Fraud Agent experiment" height={180}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={recoveryTimeline} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey="t" {...AXIS_PROPS} />
              <YAxis {...AXIS_PROPS} domain={[40, 100]} width={30} />
              <Tooltip content={<SharedTooltip />} />
              <Line type="monotone" dataKey="trust" stroke={CHART_COLORS.accent} strokeWidth={2} dot={false} isAnimationActive={false} name="Trust Score" />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>
    </div>
  );
}
