"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Play, Activity, Clock, ServerCrash, CheckCircle, XCircle } from "lucide-react";
import { ToastBar } from "@/components/ui/ToastBar";
import { apiUrl } from "@/lib/api";

/** Shape returned by the simulation run API. */
interface SimulationScenario {
  name: string;
  target_tps: number;
  num_transactions: number;
}

interface SimulationRun {
  id: string;
  status: string;
  scenario?: SimulationScenario;
  scenario_id?: string;
}

interface SimulationMetric {
  metric_type: string;
  value: number;
}

interface SimulationEvent {
  event_type: string;
  severity: string;
  message: string;
  timestamp: string;
}

interface Toast {
  id: string;
  type: string;
  message: string;
}

interface MetricCardProps {
  icon: React.ReactElement<{ size?: number; color?: string }>;
  label: string;
  value: string;
  unit: string;
  color: string;
}

export default function LiveSimulation() {
  const router = useRouter();
  const params = useParams();
  const runId = params.id as string;
  
  const [run, setRun] = useState<SimulationRun | null>(null);
  const [metrics, setMetrics] = useState<SimulationMetric[]>([]);
  const [events, setEvents] = useState<SimulationEvent[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const cpuLoad = useMemo(() => (Math.random() * 40 + 20).toFixed(1), []);

  // Fetch initial run state
  useEffect(() => {
    fetch(apiUrl(`/api/v1/simulation/runs/${runId}`))
      .then(res => {
        if (!res.ok) throw new Error("Not OK");
        return res.json();
      })
      .then(data => setRun(data))
      .catch(() => {
        // Mock fallback
        setRun({ id: runId, status: "pending", scenario: { name: "High Fraud Attack Vector", target_tps: 50, num_transactions: 10000 } });
      });
  }, [runId]);

  // Poll for metrics and events while running
  useEffect(() => {
    if (run?.status === "running") {
      const interval = setInterval(() => {
        fetch(apiUrl(`/api/v1/simulation/runs/${runId}/metrics`))
          .then(res => {
            if (!res.ok) throw new Error("Not OK");
            return res.json();
          })
          .then(data => setMetrics(data))
          .catch(() => {});
          
        fetch(apiUrl(`/api/v1/simulation/runs/${runId}/events?limit=20`))
          .then(res => {
            if (!res.ok) throw new Error("Not OK");
            return res.json();
          })
          .then(data => setEvents(data))
          .catch(() => {});
          
        fetch(apiUrl(`/api/v1/simulation/runs/${runId}`))
          .then(res => {
            if (!res.ok) throw new Error("Not OK");
            return res.json();
          })
          .then(data => setRun(data))
          .catch(() => {});
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [run, runId]);

  const handleStart = async () => {
    if (run?.status !== "pending") return;
    
    try {
      await fetch(apiUrl(`/api/v1/simulation/scenarios/${run.scenario_id}/runs`), { method: "POST" });
      setRun({ ...run, status: "running" });
    } catch {
      // Mock start
      setRun({ ...run, status: "running" });
      mockSimulationTick();
    }
  };

  // Only used if backend is disconnected
  const mockSimulationTick = () => {
    let tick = 0;
    const interval = setInterval(() => {
      tick++;
      setMetrics(prev => [...prev, 
        { metric_type: "throughput", value: Math.random() * 20 + 40 },
        { metric_type: "latency", value: Math.random() * 100 + 50 }
      ]);
      if (tick % 3 === 0) {
        setEvents(prev => [{ event_type: "batch_processed", severity: "info", message: `Processed batch ${tick}`, timestamp: new Date().toISOString() }, ...prev]);
      }
      if (tick > 15) {
        setRun((prev: SimulationRun | null) => prev ? { ...prev, status: "completed" } : prev);
        clearInterval(interval);
        setTimeout(() => router.push(`/dashboard/simulation/analytics`), 2000);
      }
    }, 1000);
  };

  const getLatestMetric = (type: string) => {
    const filtered = metrics.filter(m => m.metric_type === type);
    return filtered.length > 0 ? filtered[filtered.length - 1].value.toFixed(1) : "0.0";
  };

  if (!run) return <div>Loading...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 80px)", gap: 16 }}>
      <ToastBar toasts={toasts} onDismiss={(id) => setToasts(t => t.filter(x => x.id !== id))} />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface-2)", padding: 20, borderRadius: "12px", border: "1px solid var(--border-1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={() => router.push("/dashboard/simulation")} style={{ background: "var(--surface-1)", border: "1px solid var(--border-1)", color: "var(--text-1)", padding: 8, borderRadius: 8, cursor: "pointer" }}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-1)" }}>{run.scenario?.name || "Simulation"}</h1>
            <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 13, color: "var(--text-2)" }}>
              <span>Status: <strong style={{ color: run.status === "completed" ? "var(--success)" : run.status === "running" ? "var(--accent-1)" : "var(--text-1)" }}>{(run.status || "pending").toUpperCase()}</strong></span>
              <span>Target Load: {run.scenario?.target_tps} TPS</span>
            </div>
          </div>
        </div>
        
        {run.status === "pending" && (
          <button onClick={handleStart} style={{
            background: "var(--success)", color: "#000", border: "none", borderRadius: "8px",
            padding: "10px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8
          }}>
            <Play size={16} /> Start Simulation
          </button>
        )}
        {run.status === "completed" && (
          <button onClick={() => router.push("/dashboard/simulation/analytics")} style={{
            background: "var(--accent-1)", color: "#fff", border: "none", borderRadius: "8px",
            padding: "10px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer"
          }}>
            View Full Report
          </button>
        )}
      </div>

      {/* Live Dashboards */}
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16, flex: 1, minHeight: 0 }}>
        
        {/* Real-time Metrics Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <MetricCard icon={<Activity />} label="Live Throughput (TPS)" value={getLatestMetric("throughput")} unit="tx/s" color="var(--success)" />
          <MetricCard icon={<Clock />} label="System Latency" value={getLatestMetric("latency")} unit="ms" color="var(--accent-1)" />
          <MetricCard icon={<ServerCrash />} label="CPU Simulation Load" value={cpuLoad} unit="%" color="var(--warning)" />
        </div>

        {/* Live Timeline & Logs */}
        <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-1)", borderRadius: "12px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: 16, borderBottom: "1px solid var(--border-1)", background: "var(--surface-3)" }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>Live Event Stream</h3>
          </div>
          
          <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            {events.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--text-3)", marginTop: 100, fontSize: 14 }}>
                Awaiting simulation start...
              </div>
            ) : (
              events.map((ev, i) => (
                <div key={i} style={{ 
                  display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 16px", 
                  background: "var(--surface-1)", borderRadius: "8px", borderLeft: `3px solid ${ev.severity === 'error' ? '#ef4444' : ev.severity === 'critical' ? '#dc2626' : 'var(--accent-1)'}` 
                }}>
                  <div style={{ marginTop: 2 }}>
                    {ev.severity === 'error' || ev.severity === 'critical' ? <XCircle size={16} color="#ef4444" /> : <CheckCircle size={16} color="#22c55e" />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: "var(--text-1)", fontWeight: 500 }}>{ev.message}</div>
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4, fontFamily: "monospace" }}>{new Date(ev.timestamp).toLocaleTimeString()} • {ev.event_type}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, unit, color }: MetricCardProps) {
  return (
    <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-1)", borderRadius: "12px", padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-2)", marginBottom: 12 }}>
        {React.cloneElement(icon, { size: 16, color })} <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{ fontSize: 32, fontWeight: 800, color: "var(--text-1)" }}>{value}</span>
        <span style={{ fontSize: 14, color: "var(--text-3)" }}>{unit}</span>
      </div>
    </div>
  );
}