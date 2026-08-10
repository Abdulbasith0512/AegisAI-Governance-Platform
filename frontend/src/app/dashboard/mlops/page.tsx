"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Cpu, GitBranch, RefreshCw, Plus, Activity, BarChart3, RotateCcw,
  Sliders, AlertTriangle, CheckCircle, XCircle, Loader2, Database,
  TrendingUp, Clock
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────────────────────
   Type Definitions
   ───────────────────────────────────────────────────────────────────────────── */

interface ModelVersion {
  id: string;
  version_string: string;
  parameters_hash: string;
  accuracy_benchmark: number;
  deployed_at: string;
  hyperparameters: Record<string, unknown>;
  metrics: Record<string, unknown>;
}

interface AgentProfile {
  id: string;
  name: string;
  description: string;
  status: string;
  version_count: number;
  latest_version: string;
  deployment_type: "production" | "canary" | "shadow" | "ab_testing";
  active_version_id: string | null;
  canary_version_id: string | null;
  canary_split: number;
  shadow_version_id: string | null;
  ab_version_a_id: string | null;
  ab_version_b_id: string | null;
  ab_split: number;
}

interface MLflowRun {
  id: string;
  run_name: string;
  parameters: Record<string, unknown>;
  metrics: Record<string, unknown>;
  status: string;
  created_at: string;
}

interface TelemetryPoint {
  timestamp: string;
  production_accuracy: number;
  production_latency: number;
  shadow_accuracy: number;
  shadow_latency: number;
  canary_accuracy: number;
  canary_latency: number;
}

interface DeploymentHistory {
  id: string;
  action: string;
  details: string;
  performed_by: string;
  timestamp: string;
}

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Mock Data Generators — used when backend is unreachable
   ───────────────────────────────────────────────────────────────────────────── */

function generateMockAgents(): AgentProfile[] {
  return [
    {
      id: "agent-1",
      name: "fraud-agent",
      description: "Supervised AegisAI FRAUD evaluation node.",
      status: "active",
      version_count: 3,
      latest_version: "v1.2.0",
      deployment_type: "production",
      active_version_id: "v-1",
      canary_version_id: null,
      canary_split: 100,
      shadow_version_id: null,
      ab_version_a_id: null,
      ab_version_b_id: null,
      ab_split: 50,
    },
    {
      id: "agent-2",
      name: "aml-agent",
      description: "Supervised AegisAI AML transaction checker.",
      status: "active",
      version_count: 2,
      latest_version: "v1.0.0",
      deployment_type: "canary",
      active_version_id: "v-3",
      canary_version_id: "v-4",
      canary_split: 15,
      shadow_version_id: null,
      ab_version_a_id: null,
      ab_version_b_id: null,
      ab_split: 50,
    },
    {
      id: "agent-3",
      name: "kyc-agent",
      description: "Supervised AegisAI KYC identity verification node.",
      status: "active",
      version_count: 1,
      latest_version: "v1.0.0",
      deployment_type: "shadow",
      active_version_id: "v-5",
      canary_version_id: null,
      canary_split: 100,
      shadow_version_id: "v-6",
      ab_version_a_id: null,
      ab_version_b_id: null,
      ab_split: 50,
    },
  ];
}

function generateMockVersions(): ModelVersion[] {
  return [
    {
      id: "v-1",
      version_string: "v1.2.0",
      parameters_hash: "sha256_a1b2c3d4e5f6",
      accuracy_benchmark: 0.968,
      deployed_at: new Date().toISOString(),
      hyperparameters: { lr: 0.0008, batch_size: 64, epochs: 25 },
      metrics: { f1: 0.961, precision: 0.972, recall: 0.950 },
    },
    {
      id: "v-2",
      version_string: "v1.1.0",
      parameters_hash: "sha256_d1e2f3g4h5i6",
      accuracy_benchmark: 0.954,
      deployed_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      hyperparameters: { lr: 0.001, batch_size: 32, epochs: 20 },
      metrics: { f1: 0.948, precision: 0.955, recall: 0.941 },
    },
    {
      id: "v-3",
      version_string: "v1.0.0",
      parameters_hash: "sha256_c7a8b9e0f1g2",
      accuracy_benchmark: 0.941,
      deployed_at: new Date(Date.now() - 86400000 * 7).toISOString(),
      hyperparameters: { lr: 0.002, batch_size: 64, epochs: 15 },
      metrics: { f1: 0.928, precision: 0.932, recall: 0.924 },
    },
  ];
}

function generateMockMLflowRuns(): MLflowRun[] {
  return [
    {
      id: "run-1",
      run_name: "grid_search_adam_v1.2",
      parameters: { lr: 0.0008, batch_size: 64, optimizer: "adam" },
      metrics: { accuracy: 0.968, loss: 0.035, f1: 0.961 },
      status: "FINISHED",
      created_at: new Date().toISOString(),
    },
    {
      id: "run-2",
      run_name: "baseline_sgd_v1.1",
      parameters: { lr: 0.001, batch_size: 32, optimizer: "sgd" },
      metrics: { accuracy: 0.954, loss: 0.048, f1: 0.948 },
      status: "FINISHED",
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: "run-3",
      run_name: "experimental_lr_sweep",
      parameters: { lr: 0.01, batch_size: 128, optimizer: "adam" },
      metrics: { accuracy: 0.912, loss: 0.089, f1: 0.901 },
      status: "FAILED",
      created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    },
  ];
}

function generateMockTelemetry(): TelemetryPoint[] {
  const points: TelemetryPoint[] = [];
  const now = Date.now();
  for (let i = 0; i < 12; i++) {
    const ts = new Date(now - (11 - i) * 3600000);
    points.push({
      timestamp: ts.toISOString(),
      production_accuracy: parseFloat((0.94 + (Math.random() * 0.04 - 0.02)).toFixed(4)),
      production_latency: parseFloat((42.5 + (Math.random() * 17 - 5)).toFixed(1)),
      shadow_accuracy: parseFloat((0.96 + (Math.random() * 0.025 - 0.01)).toFixed(4)),
      shadow_latency: parseFloat((38 + (Math.random() * 10 - 4)).toFixed(1)),
      canary_accuracy: parseFloat((0.95 + (Math.random() * 0.05 - 0.03)).toFixed(4)),
      canary_latency: parseFloat((48.2 + (Math.random() * 23 - 8)).toFixed(1)),
    });
  }
  return points;
}

function generateMockHistory(): DeploymentHistory[] {
  return [
    {
      id: "h-1",
      action: "promote",
      details: "Promoted version v1.2.0 to production active route",
      performed_by: "Administrator",
      timestamp: new Date().toISOString(),
    },
    {
      id: "h-2",
      action: "register_version",
      details: "Registered model version v1.2.0 (hash: sha256_a)",
      performed_by: "MLOps pipeline",
      timestamp: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: "h-3",
      action: "rollback",
      details: "Triggered safety rollback to version v1.0.0 after accuracy drift",
      performed_by: "Lead Administrator",
      timestamp: new Date(Date.now() - 86400000).toISOString(),
    },
  ];
}

/* ─────────────────────────────────────────────────────────────────────────────
   Shared Style Constants — referencing design token CSS vars
   ───────────────────────────────────────────────────────────────────────────── */

const PANEL_BG = "var(--surface-2, #0c0c12)";
const PANEL_BORDER = "1px solid var(--border-0, #1c1c24)";
const PANEL_RADIUS = "var(--radius-lg, 8px)";
const INPUT_BG = "var(--surface-1, #0d0d14)";
const INPUT_BORDER = "1px solid var(--border-1, #1c1c24)";
const TEXT_PRIMARY = "var(--gray-50, white)";
const TEXT_SECONDARY = "var(--gray-400, #71717a)";
const TEXT_MUTED = "var(--gray-500, #52525e)";
const TEXT_BODY = "var(--gray-200, #e2e8f0)";
const ACCENT = "var(--accent, #00d4ff)";
const ACCENT_DIM = "var(--accent-dim, rgba(0, 212, 255, 0.13))";
const INDIGO = "#6366f1";
const SUCCESS = "var(--status-success, #10b981)";
const SUCCESS_DIM = "var(--risk-low-dim, rgba(16, 185, 129, 0.1))";
const ERROR = "var(--status-error, #f43f5e)";
const ERROR_DIM = "var(--risk-critical-dim, rgba(244, 63, 94, 0.1))";
const WARNING = "var(--status-warning, #f59e0b)";
const FONT_MONO = "var(--font-mono, monospace)";

/* ─────────────────────────────────────────────────────────────────────────────
   Component: Toast Notification Bar
   ───────────────────────────────────────────────────────────────────────────── */

function ToastBar({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div style={{ position: "fixed", top: 16, right: 16, zIndex: 2000, display: "flex", flexDirection: "column", gap: 8, maxWidth: 400 }}>
      {toasts.map((t) => {
        const bg = t.type === "success" ? SUCCESS_DIM : t.type === "error" ? ERROR_DIM : ACCENT_DIM;
        const color = t.type === "success" ? SUCCESS : t.type === "error" ? ERROR : ACCENT;
        const Icon = t.type === "success" ? CheckCircle : t.type === "error" ? XCircle : Activity;
        return (
          <div
            key={t.id}
            style={{
              background: "var(--surface-3, #1c1c24)",
              border: `1px solid ${color}`,
              borderLeft: `3px solid ${color}`,
              borderRadius: "var(--radius-md, 6px)",
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 13,
              color: TEXT_BODY,
              animation: "toast-slide-in 300ms ease-out",
              boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
            }}
          >
            <Icon size={16} style={{ color, flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{t.message}</span>
            <button
              onClick={() => onDismiss(t.id)}
              style={{ background: "none", border: "none", color: TEXT_MUTED, cursor: "pointer", padding: 2, fontSize: 16, lineHeight: 1 }}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Component: Empty State
   ───────────────────────────────────────────────────────────────────────────── */

function EmptyState({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div style={{ padding: "32px 16px", textAlign: "center", color: TEXT_MUTED, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <Icon size={28} style={{ opacity: 0.4 }} />
      <span style={{ fontSize: 12, fontWeight: 500 }}>{label}</span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Component: Action Button with loading state
   ───────────────────────────────────────────────────────────────────────────── */

function ActionButton({
  label, onClick, loading, variant = "default", style: extraStyle,
}: {
  label: string;
  onClick: () => void;
  loading?: boolean;
  variant?: "default" | "primary" | "accent";
  style?: React.CSSProperties;
}) {
  const baseStyle: React.CSSProperties = {
    background: variant === "primary"
      ? `linear-gradient(135deg, ${INDIGO}, ${ACCENT})`
      : variant === "accent"
        ? ACCENT_DIM
        : "var(--surface-4, #27272a)",
    border: variant === "primary" ? "none" : `1px solid var(--border-2, #3f3f46)`,
    color: TEXT_PRIMARY,
    padding: "8px 14px",
    borderRadius: "var(--radius-md, 6px)",
    fontWeight: 600,
    fontSize: 12,
    cursor: loading ? "not-allowed" : "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    transition: "all var(--motion-fast, 150ms)",
    opacity: loading ? 0.7 : 1,
    ...extraStyle,
  };

  return (
    <button onClick={loading ? undefined : onClick} style={baseStyle} disabled={loading}>
      {loading && <Loader2 size={13} className="spin-animation" />}
      {label}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Main Component
   ───────────────────────────────────────────────────────────────────────────── */

export default function MLOpsPlatform() {
  /* ── Core Data State ── */
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentProfile | null>(null);
  const [versions, setVersions] = useState<ModelVersion[]>([]);
  const [mlflowRuns, setMlflowRuns] = useState<MLflowRun[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);
  const [history, setHistory] = useState<DeploymentHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);

  /* ── Ref to track selected agent ID without stale closures ── */
  const selectedAgentIdRef = useRef<string | null>(null);

  /* ── Toast Notification State ── */
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  /* ── Modal / Input State ── */
  const [newVersionOpen, setNewVersionOpen] = useState(false);
  const [versionString, setVersionString] = useState("");
  const [paramHash, setParamHash] = useState("");
  const [accBenchmark, setAccBenchmark] = useState(0.95);
  const [lr, setLr] = useState(0.001);
  const [batchSize, setBatchSize] = useState(32);
  const [f1Score, setF1Score] = useState(0.94);

  /* ── Deployment Config Form State ── */
  const [depType, setDepType] = useState<"production" | "canary" | "shadow" | "ab_testing">("production");
  const [activeVerId, setActiveVerId] = useState<string>("");
  const [canaryVerId, setCanaryVerId] = useState<string>("");
  const [canarySplit, setCanarySplit] = useState<number>(10);
  const [shadowVerId, setShadowVerId] = useState<string>("");
  const [abVerAId, setAbVerAId] = useState<string>("");
  const [abVerBId, setAbVerBId] = useState<string>("");
  const [abSplit, setAbSplit] = useState<number>(50);

  /* ── Action Loading States ── */
  const [deployLoading, setDeployLoading] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<string | null>(null);
  const [registerLoading, setRegisterLoading] = useState(false);

  /* ── Backend connectivity tracking ── */
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  /* ─────────────────────────────────────────────────────────────────────────
     Data Loading: Agent Profiles
     ───────────────────────────────────────────────────────────────────────── */

  const loadPlatformData = useCallback(async () => {
    try {
      const res = await fetch("http://localhost:8000/api/v1/agents");
      if (!res.ok) throw new Error("Failed to load agents");
      const data: AgentProfile[] = await res.json();
      setAgents(data);
      setBackendOnline(true);

      // Use ref to avoid stale closure — only auto-select if nothing is currently selected
      if (data.length > 0 && !selectedAgentIdRef.current) {
        selectedAgentIdRef.current = data[0].id;
        setSelectedAgent(data[0]);
      } else if (selectedAgentIdRef.current) {
        const updated = data.find((a) => a.id === selectedAgentIdRef.current);
        if (updated) setSelectedAgent(updated);
      }
    } catch {
      setBackendOnline(false);
      const mock = generateMockAgents();
      setAgents(mock);
      if (!selectedAgentIdRef.current) {
        selectedAgentIdRef.current = mock[0].id;
        setSelectedAgent(mock[0]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  /** Syncs the deployment configuration form inputs from an agent profile. */
  const syncFormFromAgent = useCallback((agent: AgentProfile): void => {
    setDepType(agent.deployment_type);
    setActiveVerId(agent.active_version_id || "");
    setCanaryVerId(agent.canary_version_id || "");
    setCanarySplit(agent.canary_split);
    setShadowVerId(agent.shadow_version_id || "");
    setAbVerAId(agent.ab_version_a_id || "");
    setAbVerBId(agent.ab_version_b_id || "");
    setAbSplit(agent.ab_split);
  }, []);

  /* ─────────────────────────────────────────────────────────────────────────
     Data Loading: Agent Details (versions, runs, telemetry, history)
     ───────────────────────────────────────────────────────────────────────── */

  const loadAgentDetails = useCallback(async (agent: AgentProfile) => {
    setDetailsLoading(true);
    try {
      const [vRes, runRes, telRes, histRes] = await Promise.all([
        fetch(`http://localhost:8000/api/v1/agents/${agent.id}/versions`),
        fetch(`http://localhost:8000/api/v1/agents/mlflow/runs?agent_id=${agent.id}`),
        fetch(`http://localhost:8000/api/v1/agents/performance/${agent.id}`),
        fetch(`http://localhost:8000/api/v1/agents/history/${agent.id}`),
      ]);

      if (!vRes.ok || !runRes.ok || !telRes.ok || !histRes.ok) {
        throw new Error("Details fetch failed");
      }

      setVersions(await vRes.json());
      setMlflowRuns(await runRes.json());
      setTelemetry(await telRes.json());
      setHistory(await histRes.json());

      syncFormFromAgent(agent);
    } catch {
      // Backend unreachable — load comprehensive mock data for all sections
      setVersions(generateMockVersions());
      setMlflowRuns(generateMockMLflowRuns());
      setTelemetry(generateMockTelemetry());
      setHistory(generateMockHistory());
      syncFormFromAgent(agent);
    } finally {
      setDetailsLoading(false);
    }
  }, [syncFormFromAgent]);

  /* ── Effects ── */

  useEffect(() => {
    Promise.resolve().then(() => {
      loadPlatformData();
    });
  }, [loadPlatformData]);

  useEffect(() => {
    if (selectedAgent) {
      selectedAgentIdRef.current = selectedAgent.id;
      Promise.resolve().then(() => {
        loadAgentDetails(selectedAgent);
      });
    }
  }, [selectedAgent, loadAgentDetails]);

  /* ─────────────────────────────────────────────────────────────────────────
     Handlers
     ───────────────────────────────────────────────────────────────────────── */

  const handleDeployConfig = async () => {
    if (!selectedAgent) return;
    setDeployLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/v1/agents/deployments/configure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: selectedAgent.id,
          deployment_type: depType,
          active_version_id: activeVerId || null,
          canary_version_id: canaryVerId || null,
          canary_split: canarySplit,
          shadow_version_id: shadowVerId || null,
          ab_version_a_id: abVerAId || null,
          ab_version_b_id: abVerBId || null,
          ab_split: abSplit,
        }),
      });
      if (!res.ok) throw new Error("Failed to configure deployment");
      addToast("success", `Deployment strategy updated to ${depType.toUpperCase()} for ${selectedAgent.name}`);
      await loadPlatformData();
    } catch {
      addToast("info", `Deployment configuration saved locally (backend offline)`);
    } finally {
      setDeployLoading(false);
    }
  };

  const handleRollback = async (targetVerId: string) => {
    if (!selectedAgent) return;
    setRollbackTarget(targetVerId);
    try {
      const res = await fetch("http://localhost:8000/api/v1/agents/deployments/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: selectedAgent.id,
          target_version_id: targetVerId,
        }),
      });
      if (!res.ok) throw new Error("Rollback failed");
      addToast("success", `Rollback to ${versions.find((v) => v.id === targetVerId)?.version_string || targetVerId} initiated successfully`);
      await loadPlatformData();
    } catch {
      addToast("info", `Rollback simulated locally (backend offline)`);
    } finally {
      setRollbackTarget(null);
    }
  };

  const handleRegisterVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgent || !versionString.trim() || !paramHash.trim()) return;
    setRegisterLoading(true);

    try {
      const res = await fetch(`http://localhost:8000/api/v1/agents/${selectedAgent.id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version_string: versionString,
          parameters_hash: paramHash,
          accuracy_benchmark: accBenchmark,
          hyperparameters: { learning_rate: lr, batch_size: batchSize },
          metrics: { f1_score: f1Score },
        }),
      });
      if (!res.ok) throw new Error("Failed to register version");
      addToast("success", `Version ${versionString} registered successfully for ${selectedAgent.name}`);
      setVersionString("");
      setParamHash("");
      setNewVersionOpen(false);
      await loadAgentDetails(selectedAgent);
    } catch {
      // Local mock addition
      setVersions((prev) => [
        {
          id: `v-new-${Date.now()}`,
          version_string: versionString,
          parameters_hash: paramHash,
          accuracy_benchmark: accBenchmark,
          deployed_at: new Date().toISOString(),
          hyperparameters: { lr, batch_size: batchSize },
          metrics: { f1: f1Score },
        },
        ...prev,
      ]);
      setNewVersionOpen(false);
      addToast("info", `Version ${versionString} registered locally (backend offline)`);
    } finally {
      setRegisterLoading(false);
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────
     Shared Sub-Styles
     ───────────────────────────────────────────────────────────────────────── */

  const labelStyle: React.CSSProperties = { fontSize: 11, color: TEXT_SECONDARY, fontWeight: 600 };
  const selectStyle: React.CSSProperties = {
    width: "100%", background: INPUT_BG, border: INPUT_BORDER, color: TEXT_PRIMARY,
    padding: 8, borderRadius: "var(--radius-md, 6px)", fontSize: 12, marginTop: 4,
    outline: "none",
  };
  const inputStyle: React.CSSProperties = {
    width: "100%", background: INPUT_BG, border: INPUT_BORDER, color: TEXT_PRIMARY,
    padding: 8, borderRadius: "var(--radius-md, 6px)", fontSize: 12, marginTop: 4,
    outline: "none",
  };

  /* ─────────────────────────────────────────────────────────────────────────
     Render: Deployment Strategy Selector (conditional panels)
     ───────────────────────────────────────────────────────────────────────── */

  function renderDeploymentInputs(): React.ReactNode {
    if (depType === "production") {
      return (
        <div>
          <label style={labelStyle}>Active Production Version</label>
          <select value={activeVerId} onChange={(e) => setActiveVerId(e.target.value)} style={selectStyle}>
            <option value="">-- Choose active version --</option>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>{v.version_string} (Benchmark: {(v.accuracy_benchmark * 100).toFixed(1)}%)</option>
            ))}
          </select>
        </div>
      );
    }

    if (depType === "canary") {
      return (
        <>
          <div>
            <label style={labelStyle}>Base Production Version</label>
            <select value={activeVerId} onChange={(e) => setActiveVerId(e.target.value)} style={selectStyle}>
              <option value="">-- Choose production base --</option>
              {versions.map((v) => <option key={v.id} value={v.id}>{v.version_string}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Target Canary Version</label>
            <select value={canaryVerId} onChange={(e) => setCanaryVerId(e.target.value)} style={selectStyle}>
              <option value="">-- Choose canary version --</option>
              {versions.map((v) => <option key={v.id} value={v.id}>{v.version_string}</option>)}
            </select>
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: TEXT_SECONDARY }}>
              <span>Canary Traffic split</span>
              <span style={{ color: ACCENT, fontWeight: 700 }}>{canarySplit}% Canary</span>
            </div>
            <input type="range" min="1" max="99" value={canarySplit} onChange={(e) => setCanarySplit(parseInt(e.target.value))} style={{ width: "100%", accentColor: ACCENT, marginTop: 4 }} />
          </div>
        </>
      );
    }

    if (depType === "shadow") {
      return (
        <>
          <div>
            <label style={labelStyle}>Base Production Version</label>
            <select value={activeVerId} onChange={(e) => setActiveVerId(e.target.value)} style={selectStyle}>
              <option value="">-- Choose production base --</option>
              {versions.map((v) => <option key={v.id} value={v.id}>{v.version_string}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Active Shadow Version (Silent Logs)</label>
            <select value={shadowVerId} onChange={(e) => setShadowVerId(e.target.value)} style={selectStyle}>
              <option value="">-- Choose shadow version --</option>
              {versions.map((v) => <option key={v.id} value={v.id}>{v.version_string}</option>)}
            </select>
          </div>
        </>
      );
    }

    if (depType === "ab_testing") {
      return (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={labelStyle}>Version A</label>
              <select value={abVerAId} onChange={(e) => setAbVerAId(e.target.value)} style={selectStyle}>
                <option value="">-- Choose A --</option>
                {versions.map((v) => <option key={v.id} value={v.id}>{v.version_string}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Version B</label>
              <select value={abVerBId} onChange={(e) => setAbVerBId(e.target.value)} style={selectStyle}>
                <option value="">-- Choose B --</option>
                {versions.map((v) => <option key={v.id} value={v.id}>{v.version_string}</option>)}
              </select>
            </div>
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: TEXT_SECONDARY }}>
              <span>A/B Split Ratio</span>
              <span style={{ color: INDIGO, fontWeight: 700 }}>{abSplit}% A / {100 - abSplit}% B</span>
            </div>
            <input type="range" min="1" max="99" value={abSplit} onChange={(e) => setAbSplit(parseInt(e.target.value))} style={{ width: "100%", accentColor: INDIGO, marginTop: 4 }} />
          </div>
        </>
      );
    }

    return null;
  }

  const strategyDescriptions: Record<string, string> = {
    production: "Standard deployment route directs 100% of API transaction loads straight to the active version.",
    canary: "Canary route lets you bleed a small subset of incoming traffic to your new experimental version to watch for memory drops or accuracy drifts.",
    shadow: "Shadow route runs predictions on BOTH models in parallel. It serves the production output to customers but stores the shadow output silently in background logs for offline evaluation.",
    ab_testing: "Directs a randomized percentage split of customer traffic to Model A and Model B respectively to compare live performance outcomes.",
  };

  /* ─────────────────────────────────────────────────────────────────────────
     Render: Main Layout
     ───────────────────────────────────────────────────────────────────────── */

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Scoped keyframes and animations */}
      <style>{`
        @keyframes mlops-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes toast-slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .spin-animation {
          animation: mlops-spin 1s linear infinite;
        }
      `}</style>

      {/* Toast notification layer */}
      <ToastBar toasts={toasts} onDismiss={dismissToast} />

      {/* ── Top Header Bar ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: TEXT_PRIMARY, display: "flex", alignItems: "center", gap: 10, fontFamily: "'Outfit', var(--font-sans, sans-serif)" }}>
            <Cpu size={24} style={{ color: ACCENT }} /> MLOps Registry &amp; Platform
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
            <p style={{ fontSize: 13, color: TEXT_SECONDARY }}>
              Control model promotions, canary releases, shadow deployments, A/B experiments, and MLflow run parameters.
            </p>
            {backendOnline !== null && (
              <span style={{
                fontSize: 10, padding: "2px 8px", borderRadius: 10, fontWeight: 600, fontFamily: FONT_MONO,
                background: backendOnline ? SUCCESS_DIM : ERROR_DIM,
                color: backendOnline ? SUCCESS : ERROR,
                display: "inline-flex", alignItems: "center", gap: 4,
              }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: backendOnline ? SUCCESS : ERROR }} />
                {backendOnline ? "API Connected" : "Offline Mode"}
              </span>
            )}
          </div>
        </div>
        <ActionButton
          label="Register Version"
          onClick={() => setNewVersionOpen(true)}
          variant="primary"
          style={{ padding: "8px 16px", fontSize: 13 }}
        />
      </div>

      {/* ── Loading State ── */}
      {loading ? (
        <div style={{ padding: 60, textAlign: "center", color: TEXT_MUTED, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <RefreshCw size={28} className="spin-animation" style={{ color: ACCENT }} />
          <span style={{ fontSize: 13, fontWeight: 500 }}>Loading model registry profiles...</span>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20 }}>
          {/* ── Sidebar: Agent Registry Profiles ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ background: PANEL_BG, border: PANEL_BORDER, borderRadius: PANEL_RADIUS, padding: 16 }}>
              <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: TEXT_SECONDARY, letterSpacing: "0.06em", marginBottom: 12 }}>
                Active Registry Profiles
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {agents.map((a) => {
                  const isSelected = selectedAgent?.id === a.id;
                  return (
                    <div
                      key={a.id}
                      onClick={() => setSelectedAgent(a)}
                      style={{
                        padding: 12, borderRadius: "var(--radius-md, 6px)",
                        background: isSelected ? "var(--surface-3, #1c1c28)" : "var(--surface-1, #0d0d14)",
                        border: "1px solid",
                        borderColor: isSelected ? ACCENT : "var(--border-0, #1c1c24)",
                        cursor: "pointer",
                        transition: "all var(--motion-fast, 150ms)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: isSelected ? ACCENT : TEXT_PRIMARY }}>
                          {a.name}
                        </span>
                        <span style={{
                          fontSize: 10, padding: "2px 6px", borderRadius: 10,
                          background: a.status === "active" ? SUCCESS_DIM : "var(--gray-700, rgba(113,113,122,0.1))",
                          color: a.status === "active" ? SUCCESS : TEXT_SECONDARY,
                        }}>
                          {a.status}
                        </span>
                      </div>
                      <p style={{ fontSize: 11, color: TEXT_SECONDARY, marginTop: 4, lineBreak: "anywhere" }}>
                        {a.description}
                      </p>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: TEXT_MUTED, marginTop: 8 }}>
                        <span>Versions: {a.version_count}</span>
                        <span>Latest: {a.latest_version}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Main Panel ── */}
          {selectedAgent && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20, position: "relative" }}>
              {/* Details loading overlay */}
              {detailsLoading && (
                <div style={{
                  position: "absolute", inset: 0, background: "rgba(9,9,11,0.6)", zIndex: 10,
                  display: "flex", alignItems: "center", justifyContent: "center", borderRadius: PANEL_RADIUS,
                }}>
                  <Loader2 size={28} className="spin-animation" style={{ color: ACCENT }} />
                </div>
              )}

              {/* ── Row 1: Deployment & Promotion Configurator ── */}
              <div style={{ background: PANEL_BG, border: PANEL_BORDER, borderRadius: PANEL_RADIUS, padding: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                  <Sliders size={16} style={{ color: ACCENT }} /> Live Deployment Control Node
                </h3>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, minHeight: 180 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Routing Strategy</label>
                      <select
                        value={depType}
                        onChange={(e) => setDepType(e.target.value as "production" | "canary" | "shadow" | "ab_testing")}
                        style={selectStyle}
                      >
                        <option value="production">Production-Only (100% standard route)</option>
                        <option value="canary">Canary Release (Splits to experimental branch)</option>
                        <option value="shadow">Shadow Deployment (Silent runs in background)</option>
                        <option value="ab_testing">A/B Traffic Testing</option>
                      </select>
                    </div>

                    {renderDeploymentInputs()}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", borderLeft: `1px solid var(--border-0, #1c1c24)`, paddingLeft: 20 }}>
                    <div style={{ fontSize: 12, color: "var(--gray-300, #a1a1aa)", lineHeight: "1.6" }}>
                      <div style={{ fontWeight: 700, color: TEXT_PRIMARY, marginBottom: 6 }}>Deployment Strategy Helper</div>
                      {strategyDescriptions[depType]}
                    </div>

                    <ActionButton
                      label="Update Traffic Configuration"
                      onClick={handleDeployConfig}
                      loading={deployLoading}
                      style={{ alignSelf: "flex-end", marginTop: 12 }}
                    />
                  </div>
                </div>
              </div>

              {/* ── Row 2: Registry Table + Promotion History ── */}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
                {/* Model Registry Versions */}
                <div style={{ background: PANEL_BG, border: PANEL_BORDER, borderRadius: PANEL_RADIUS, padding: 20 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                    <GitBranch size={16} style={{ color: ACCENT }} /> Model Registry Versions
                  </h3>

                  {versions.length === 0 ? (
                    <EmptyState icon={Database} label="No model versions registered yet" />
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr style={{ borderBottom: `1px solid var(--border-0, #1c1c24)`, color: TEXT_SECONDARY, textAlign: "left" }}>
                            <th style={{ padding: "8px 4px" }}>Version String</th>
                            <th style={{ padding: "8px 4px" }}>Benchmark Acc</th>
                            <th style={{ padding: "8px 4px" }}>F1 Score</th>
                            <th style={{ padding: "8px 4px" }}>Checksum</th>
                            <th style={{ padding: "8px 4px", textAlign: "right" }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {versions.map((v) => (
                            <tr key={v.id} style={{ borderBottom: `1px solid var(--surface-1, #0d0d14)`, color: TEXT_BODY }}>
                              <td style={{ padding: "10px 4px", fontWeight: 700, color: TEXT_PRIMARY }}>
                                {v.version_string}
                              </td>
                              <td style={{ padding: "10px 4px" }}>{(v.accuracy_benchmark * 100).toFixed(1)}%</td>
                              <td style={{ padding: "10px 4px" }}>
                                {String(v.metrics?.f1_score ?? v.metrics?.f1 ?? "—")}
                              </td>
                              <td style={{ padding: "10px 4px", fontFamily: FONT_MONO, color: TEXT_SECONDARY }}>
                                {v.parameters_hash.slice(0, 12)}…
                              </td>
                              <td style={{ padding: "10px 4px", textAlign: "right" }}>
                                <button
                                  onClick={() => handleRollback(v.id)}
                                  disabled={rollbackTarget === v.id}
                                  style={{
                                    background: "none", border: "none", color: ACCENT, cursor: rollbackTarget === v.id ? "not-allowed" : "pointer",
                                    fontSize: 11, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4,
                                    opacity: rollbackTarget === v.id ? 0.6 : 1,
                                  }}
                                >
                                  {rollbackTarget === v.id ? <Loader2 size={11} className="spin-animation" /> : <RotateCcw size={11} />}
                                  Rollback Here
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Promotion History Log */}
                <div style={{ background: PANEL_BG, border: PANEL_BORDER, borderRadius: PANEL_RADIUS, padding: 20 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                    <Activity size={16} style={{ color: INDIGO }} /> Promotion Log History
                  </h3>

                  {history.length === 0 ? (
                    <EmptyState icon={Clock} label="No deployment history recorded" />
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 200, overflowY: "auto", paddingRight: 4 }}>
                      {history.map((h) => (
                        <div key={h.id} style={{ fontSize: 11, borderLeft: `2px solid var(--border-2, #3f3f46)`, paddingLeft: 10, paddingBottom: 6 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", color: TEXT_SECONDARY }}>
                            <span style={{
                              fontWeight: 700, textTransform: "uppercase",
                              color: h.action === "rollback" ? ERROR : ACCENT,
                            }}>
                              {h.action}
                            </span>
                            <span>{new Date(h.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                          <p style={{ color: TEXT_BODY, marginTop: 2 }}>{h.details}</p>
                          <span style={{ color: TEXT_MUTED, fontSize: 10 }}>Actor: {h.performed_by}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Row 3: MLflow Experiment Runs ── */}
              <div style={{ background: PANEL_BG, border: PANEL_BORDER, borderRadius: PANEL_RADIUS, padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY, display: "flex", alignItems: "center", gap: 8 }}>
                    <BarChart3 size={16} style={{ color: ACCENT }} /> MLflow Experiments Tracking Runs
                  </h3>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: SUCCESS }} />
                    <span style={{ fontSize: 11, color: TEXT_SECONDARY }}>MLflow Integration active</span>
                  </div>
                </div>

                {mlflowRuns.length === 0 ? (
                  <EmptyState icon={BarChart3} label="No experiment runs logged yet" />
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid var(--border-0, #1c1c24)`, color: TEXT_SECONDARY, textAlign: "left" }}>
                          <th style={{ padding: "8px 4px" }}>Run ID</th>
                          <th style={{ padding: "8px 4px" }}>Run Name</th>
                          <th style={{ padding: "8px 4px" }}>Hyperparameters</th>
                          <th style={{ padding: "8px 4px" }}>Metrics Logs</th>
                          <th style={{ padding: "8px 4px" }}>Execution Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mlflowRuns.map((r) => (
                          <tr key={r.id} style={{ borderBottom: `1px solid var(--surface-1, #0d0d14)`, color: TEXT_BODY }}>
                            <td style={{ padding: "10px 4px", fontFamily: FONT_MONO, color: TEXT_SECONDARY }}>
                              {r.id.slice(0, 8)}…
                            </td>
                            <td style={{ padding: "10px 4px", fontWeight: 700 }}>
                              {r.run_name}
                            </td>
                            <td style={{ padding: "10px 4px", color: "var(--gray-300, #a1a1aa)" }}>
                              {Object.entries(r.parameters || {}).map(([k, v]) => `${k}=${String(v)}`).join(", ") || "—"}
                            </td>
                            <td style={{ padding: "10px 4px", color: SUCCESS, fontWeight: 600 }}>
                              {Object.entries(r.metrics || {}).map(([k, v]) => `${k}:${String(v)}`).join(", ") || "—"}
                            </td>
                            <td style={{ padding: "10px 4px" }}>
                              <span style={{
                                fontSize: 10, padding: "2px 8px", borderRadius: 4,
                                background: r.status === "FINISHED" ? SUCCESS_DIM : r.status === "FAILED" ? ERROR_DIM : ACCENT_DIM,
                                color: r.status === "FINISHED" ? SUCCESS : r.status === "FAILED" ? ERROR : ACCENT,
                              }}>
                                {r.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* ── Row 4: Performance Telemetry Charts ── */}
              <div style={{ background: PANEL_BG, border: PANEL_BORDER, borderRadius: PANEL_RADIUS, padding: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                  <TrendingUp size={16} style={{ color: ACCENT }} /> Accuracies &amp; Latencies Comparisons Timeseries
                </h3>

                {telemetry.length === 0 ? (
                  <EmptyState icon={TrendingUp} label="No telemetry data available — awaiting inference traffic" />
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                    {/* Accuracy chart */}
                    <div style={{ padding: 12, background: "var(--surface-1, #0d0d14)", borderRadius: "var(--radius-md, 6px)", border: INPUT_BORDER }}>
                      <span style={{ fontSize: 12, color: "var(--gray-300, #a1a1aa)", fontWeight: 600 }}>Model Accuracy Attributions</span>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
                        {telemetry.slice(-6).map((pt, idx) => (
                          <div key={idx} style={{ fontSize: 12, display: "flex", justifyContent: "space-between", borderBottom: `1px solid var(--border-0, #1c1c24)`, paddingBottom: 4 }}>
                            <span style={{ color: TEXT_SECONDARY }}>{new Date(pt.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                            <span style={{ color: SUCCESS }}>Prod: {(pt.production_accuracy * 100).toFixed(1)}%</span>
                            <span style={{ color: INDIGO }}>Shadow: {(pt.shadow_accuracy * 100).toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Latency chart */}
                    <div style={{ padding: 12, background: "var(--surface-1, #0d0d14)", borderRadius: "var(--radius-md, 6px)", border: INPUT_BORDER }}>
                      <span style={{ fontSize: 12, color: "var(--gray-300, #a1a1aa)", fontWeight: 600 }}>Model Latency Telemetries (ms)</span>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
                        {telemetry.slice(-6).map((pt, idx) => (
                          <div key={idx} style={{ fontSize: 12, display: "flex", justifyContent: "space-between", borderBottom: `1px solid var(--border-0, #1c1c24)`, paddingBottom: 4 }}>
                            <span style={{ color: TEXT_SECONDARY }}>{new Date(pt.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                            <span style={{ color: WARNING }}>Prod: {pt.production_latency}ms</span>
                            <span style={{ color: ACCENT }}>Shadow: {pt.shadow_latency}ms</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Modal: Register New Version Checkpoint ── */}
      {newVersionOpen && selectedAgent && (
        <div
          style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0, 0, 0, 0.75)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}
          onClick={(e) => { if (e.target === e.currentTarget) setNewVersionOpen(false); }}
        >
          <div style={{ background: PANEL_BG, border: PANEL_BORDER, padding: 24, borderRadius: PANEL_RADIUS, width: 450, boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: TEXT_PRIMARY, marginBottom: 16 }}>
              Register Version for {selectedAgent.name}
            </h3>

            <form onSubmit={handleRegisterVersion} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={labelStyle}>Version String</label>
                <input type="text" required placeholder="E.g., v1.2.0" value={versionString} onChange={(e) => setVersionString(e.target.value)} style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>Parameters Checksum Hash</label>
                <input type="text" required placeholder="sha256_checksum..." value={paramHash} onChange={(e) => setParamHash(e.target.value)} style={inputStyle} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={labelStyle}>Baseline Accuracy</label>
                  <input type="number" step="0.01" min="0" max="1" value={accBenchmark} onChange={(e) => setAccBenchmark(parseFloat(e.target.value))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>F1-Score Baseline</label>
                  <input type="number" step="0.01" min="0" max="1" value={f1Score} onChange={(e) => setF1Score(parseFloat(e.target.value))} style={inputStyle} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={labelStyle}>Learning Rate</label>
                  <input type="number" step="0.0001" value={lr} onChange={(e) => setLr(parseFloat(e.target.value))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Batch Size</label>
                  <input type="number" value={batchSize} onChange={(e) => setBatchSize(parseInt(e.target.value))} style={inputStyle} />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setNewVersionOpen(false)}
                  style={{ background: "var(--surface-4, #27272a)", border: "none", color: TEXT_PRIMARY, padding: "8px 14px", borderRadius: "var(--radius-md, 6px)", fontSize: 12, cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={registerLoading}
                  style={{
                    background: `linear-gradient(135deg, ${INDIGO}, ${ACCENT})`, border: "none", color: TEXT_PRIMARY,
                    padding: "8px 14px", borderRadius: "var(--radius-md, 6px)", fontSize: 12, cursor: registerLoading ? "not-allowed" : "pointer",
                    fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6,
                    opacity: registerLoading ? 0.7 : 1,
                  }}
                >
                  {registerLoading && <Loader2 size={13} className="spin-animation" />}
                  Register
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
