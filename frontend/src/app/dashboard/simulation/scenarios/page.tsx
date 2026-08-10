"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Settings, Database, ServerCrash } from "lucide-react";
import { ToastBar } from "@/components/ui/ToastBar";

interface Toast {
  id: string;
  type: string;
  message: string;
}

export default function ScenarioBuilder() {
  const router = useRouter();
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  const [formData, setFormData] = useState({
    name: "New Stress Test",
    description: "Evaluating model drift impacts on false positive rates.",
    simulation_type: "normal",
    num_transactions: 100000,
    fraud_percentage: 2.5,
    aml_risk_level: "medium",
    drift_percentage: 15,
    target_tps: 50,
    injected_failures: [] as string[]
  });

  const toggleFailure = (failure: string) => {
    setFormData(prev => ({
      ...prev,
      injected_failures: prev.injected_failures.includes(failure)
        ? prev.injected_failures.filter(f => f !== failure)
        : [...prev.injected_failures, failure]
    }));
  };

  const handleSave = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/v1/simulation/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          fraud_percentage: formData.fraud_percentage / 100,
          drift_percentage: formData.drift_percentage / 100
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        setToasts([{ id: "1", type: "success", message: "Scenario saved successfully." }]);
        setTimeout(() => router.push(`/dashboard/simulation/runs/${data.id}`), 1000);
      } else {
        throw new Error("Failed to save");
      }
    } catch (_err: unknown) {
      setToasts([{ id: "err", type: "error", message: "Failed to save scenario." }]);
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", paddingBottom: 60 }}>
      <ToastBar toasts={toasts} onDismiss={(id) => setToasts(t => t.filter(x => x.id !== id))} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-1)" }}>Scenario Builder</h1>
          <p style={{ fontSize: 14, color: "var(--text-2)", marginTop: 4 }}>Configure your Digital Twin environment parameters.</p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={() => router.push("/dashboard/simulation")} style={{
            background: "none", color: "var(--text-1)", border: "1px solid var(--border-1)", borderRadius: "6px",
            padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer"
          }}>
            Cancel
          </button>
          <button onClick={handleSave} style={{
            background: "var(--accent-1)", color: "#fff", border: "none", borderRadius: "6px",
            padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8
          }}>
            <Save size={16} /> Save Scenario
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        
        {/* Basic Info */}
        <Section title="Basic Information" icon={<Settings />}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Input label="Scenario Name" value={formData.name} onChange={(v: string) => setFormData({...formData, name: v})} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>Simulation Type</label>
              <select 
                value={formData.simulation_type} 
                onChange={(e) => setFormData({...formData, simulation_type: e.target.value})}
                style={{ background: "var(--surface-1)", border: "1px solid var(--border-1)", color: "var(--text-1)", padding: "10px", borderRadius: "6px" }}
              >
                <option value="normal">Normal Banking Day</option>
                <option value="high_fraud_day">High Fraud Day</option>
                <option value="festival_spike">Festival Load Spike</option>
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <Input label="Description" value={formData.description} onChange={(v: string) => setFormData({...formData, description: v})} />
            </div>
          </div>
        </Section>

        {/* Load & Data Generation */}
        <Section title="Traffic & Load Profile" icon={<Database />}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            <Input label="Transactions to Generate" type="number" value={formData.num_transactions} onChange={(v: string) => setFormData({...formData, num_transactions: Number(v)})} />
            <Input label="Target TPS (Load)" type="number" value={formData.target_tps} onChange={(v: string) => setFormData({...formData, target_tps: Number(v)})} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>AML Background Risk</label>
              <select 
                value={formData.aml_risk_level} 
                onChange={(e) => setFormData({...formData, aml_risk_level: e.target.value})}
                style={{ background: "var(--surface-1)", border: "1px solid var(--border-1)", color: "var(--text-1)", padding: "10px", borderRadius: "6px" }}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          
          <div style={{ marginTop: 24 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", display: "flex", justifyContent: "space-between" }}>
              <span>Fraud Injection Rate (%)</span>
              <span>{formData.fraud_percentage}%</span>
            </label>
            <input 
              type="range" min="0" max="20" step="0.1" 
              value={formData.fraud_percentage} 
              onChange={(e) => setFormData({...formData, fraud_percentage: Number(e.target.value)})}
              style={{ width: "100%", marginTop: 12 }} 
            />
          </div>
        </Section>

        {/* Failure Injection */}
        <Section title="Chaos & Failure Injection" icon={<ServerCrash />}>
          <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 16 }}>Select systems to deliberately degrade or fail during the simulation to test governance resilience.</p>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Checkbox label="Fraud Agent Complete Outage" checked={formData.injected_failures.includes("fraud_agent_crash")} onChange={() => toggleFailure("fraud_agent_crash")} />
            <Checkbox label="Database Query Latency (+500ms)" checked={formData.injected_failures.includes("db_latency")} onChange={() => toggleFailure("db_latency")} />
            <Checkbox label="Kafka Message Queue Delay" checked={formData.injected_failures.includes("kafka_delay")} onChange={() => toggleFailure("kafka_delay")} />
            <Checkbox label="Human Review SLA Breach" checked={formData.injected_failures.includes("human_review_breach")} onChange={() => toggleFailure("human_review_breach")} />
          </div>

          <div style={{ marginTop: 24, paddingTop: 24, borderTop: "1px solid var(--border-1)" }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", display: "flex", justifyContent: "space-between" }}>
              <span>AI Model Drift (Accuracy Degradation %)</span>
              <span>{formData.drift_percentage}%</span>
            </label>
            <input 
              type="range" min="0" max="50" step="1" 
              value={formData.drift_percentage} 
              onChange={(e) => setFormData({...formData, drift_percentage: Number(e.target.value)})}
              style={{ width: "100%", marginTop: 12 }} 
            />
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactElement<{ size?: number; color?: string }>; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-1)", borderRadius: "12px", padding: 24 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-1)", display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        {React.cloneElement(icon, { size: 18, color: "var(--text-3)" })} {title}
      </h2>
      {children}
    </div>
  );
}

function Input({ label, value, onChange, type = "text" }: { label: string; value: string | number; onChange: (v: string) => void; type?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>{label}</label>
      <input 
        type={type} 
        value={value} 
        onChange={(e) => onChange(e.target.value)} 
        style={{ background: "var(--surface-1)", border: "1px solid var(--border-1)", color: "var(--text-1)", padding: "10px", borderRadius: "6px", fontSize: 13 }} 
      />
    </div>
  );
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label style={{ 
      display: "flex", alignItems: "center", gap: 12, padding: "12px", 
      background: checked ? "var(--surface-3)" : "var(--surface-1)", 
      border: `1px solid ${checked ? "var(--accent-1)" : "var(--border-1)"}`, 
      borderRadius: "8px", cursor: "pointer", transition: "all 0.2s"
    }}>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ width: 16, height: 16 }} />
      <span style={{ fontSize: 13, color: "var(--text-1)", fontWeight: 500 }}>{label}</span>
    </label>
  );
}
