"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, ServerCrash, Play, Settings, Activity, Database, Users, ShieldAlert, Cpu } from "lucide-react";
import { ToastBar } from "@/components/ui/ToastBar";
import { apiUrl } from "@/lib/api";

export default function SimulationDashboard() {
  const router = useRouter();
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<any[]>([]);

  useEffect(() => {
    fetch(apiUrl("/api/v1/simulation/scenarios"))
      .then(res => res.json())
      .then(data => setScenarios(data))
      .catch(() => {
        // Mock fallback
        setScenarios([
          { id: "s-1", name: "High Fraud Attack Vector", description: "Simulates a coordinated fraud ring attack (5% fraud rate) during normal banking hours.", simulation_type: "high_fraud_day", num_transactions: 100000 },
          { id: "s-2", name: "Agent Outage Drill", description: "Simulates an AML agent crash leading to policy fallback rules kicking in.", simulation_type: "agent_failure", num_transactions: 50000 },
          { id: "s-3", name: "Retail Black Friday Spike", description: "Massive transaction volume to test load limits and latency degradations.", simulation_type: "festival_spike", num_transactions: 1000000 },
        ]);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleRunNow = async (scenario: any) => {
    try {
      const res = await fetch(apiUrl(`/api/v1/simulation/scenarios/${scenario.id}/runs`), {
        method: "POST",
      });
      if (!res.ok) throw new Error("Not OK");
      const data = await res.json();
      router.push(`/dashboard/simulation/runs/${data.id}`);
    } catch (err) {
      // Offline fallback: navigate using a mock run ID
      const mockRunId = "r-" + Math.random().toString(36).substring(2, 9);
      router.push(`/dashboard/simulation/runs/${mockRunId}`);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, paddingBottom: 40 }}>
      <ToastBar toasts={toasts} onDismiss={(id) => setToasts(t => t.filter(x => x.id !== id))} />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--text-1)", display: "flex", alignItems: "center", gap: 12 }}>
            <ServerCrash size={28} style={{ color: "var(--accent-1)" }} /> Digital Twin Simulation
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-2)", marginTop: 6, maxWidth: 600 }}>
            Safely execute governance workflows against synthetic banking traffic. Inject failures, simulate high load, and test policy resilience before deploying to production.
          </p>
        </div>
        
        <button
          onClick={() => router.push("/dashboard/simulation/scenarios")}
          style={{
            background: "var(--accent-1)", color: "#fff", border: "none", borderRadius: "8px",
            padding: "10px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 8, transition: "opacity 0.2s"
          }}
        >
          <Plus size={16} /> New Scenario
        </button>
      </div>

      {/* Stats Overview */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        <StatCard icon={<Database />} label="Total Simulated Tx" value="1.4M" trend="+12% this week" />
        <StatCard icon={<ShieldAlert />} label="Fraud Scenarios Run" value="24" trend="3 critical failures found" />
        <StatCard icon={<Users />} label="Synthetic Customers" value="850K" trend="Active in twin" />
        <StatCard icon={<Activity />} label="Avg Twin Latency" value="12ms" trend="Optimal" />
      </div>

      {/* Scenario Library */}
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-1)", marginBottom: 16 }}>Scenario Library</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: 16 }}>
          {scenarios.map(scenario => (
            <div key={scenario.id} style={{ 
              background: "var(--surface-2)", border: "1px solid var(--border-1)", 
              borderRadius: "12px", padding: 20, display: "flex", flexDirection: "column", gap: 16 
            }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-1)" }}>{scenario.name}</h3>
                <span style={{ 
                  display: "inline-block", fontSize: 11, padding: "2px 8px", borderRadius: 12, marginTop: 8,
                  background: "var(--surface-3)", color: "var(--text-2)" 
                }}>
                  {scenario.num_transactions.toLocaleString()} TXs
                </span>
              </div>
              <p style={{ fontSize: 13, color: "var(--text-2)", flex: 1, lineHeight: 1.5 }}>
                {scenario.description}
              </p>
              
              <div style={{ display: "flex", gap: 12, borderTop: "1px solid var(--border-1)", paddingTop: 16 }}>
                <button onClick={() => router.push(`/dashboard/simulation/scenarios?edit=${scenario.id}`)} style={{ 
                  flex: 1, background: "var(--surface-1)", border: "1px solid var(--border-1)", color: "var(--text-1)", 
                  padding: "8px", borderRadius: "6px", fontSize: 13, fontWeight: 500, cursor: "pointer", display: "flex", justifyContent: "center", gap: 6 
                }}>
                  <Settings size={16} /> Configure
                </button>
                <button onClick={() => handleRunNow(scenario)} style={{ 
                  flex: 1, background: "var(--success-dim)", border: "1px solid var(--success)", color: "var(--success)", 
                  padding: "8px", borderRadius: "6px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", justifyContent: "center", gap: 6 
                }}>
                  <Play size={16} /> Run Now
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, trend }: any) {
  return (
    <div style={{ 
      background: "var(--surface-2)", border: "1px solid var(--border-1)", 
      borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: 12 
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--text-2)" }}>
        <div style={{ padding: 8, background: "var(--surface-3)", borderRadius: 8 }}>
          {icon}
        </div>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      </div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-1)" }}>{value}</div>
        <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>{trend}</div>
      </div>
    </div>
  );
}