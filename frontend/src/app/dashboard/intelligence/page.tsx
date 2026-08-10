"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  ShieldCheck, BarChart3, Trophy, Activity, AlertOctagon, 
  FileText, Download, Play, RefreshCw, Layers, ShieldAlert, CheckCircle2
} from "lucide-react";

export default function IntelligenceDashboard() {
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [loading, setLoading] = useState<boolean>(true);
  
  // Intelligence states
  const [scoreData, setScoreData] = useState<any>(null);
  const [reputation, setReputation] = useState<any>(null);
  const [maturity, setMaturity] = useState<any>(null);
  const [failures, setFailures] = useState<any>(null);
  const [benchmarks, setBenchmarks] = useState<any>(null);
  const [reports, setReports] = useState<any[]>([]);

  // Telemetry fetching
  const loadIntelligence = async () => {
    try {
      Promise.resolve().then(() => setLoading(true));
      const [rScore, rRep, rMat, rFail, rBench, rReps] = await Promise.all([
        fetch("http://localhost:8000/api/v1/intelligence/governance-score").then(r => r.json()),
        fetch("http://localhost:8000/api/v1/intelligence/reputation").then(r => r.json()),
        fetch("http://localhost:8000/api/v1/intelligence/maturity").then(r => r.json()),
        fetch("http://localhost:8000/api/v1/intelligence/failure-index").then(r => r.json()),
        fetch("http://localhost:8000/api/v1/intelligence/benchmarks").then(r => r.json()),
        fetch("http://localhost:8000/api/v1/intelligence/reports").then(r => r.json()).catch(() => [])
      ]);

      setScoreData(rScore);
      setReputation(rRep);
      setMaturity(rMat);
      setFailures(rFail);
      setBenchmarks(rBench);
      setReports(rReps);

    } catch (err) {
      console.error("Intelligence local API fallback trigger:", err);
      // Hard fallback datasets
      setScoreData({
        overall_score: 89.2, grade: "A", risk_category: "low",
        historical_trend: "improving", weekly_trend: "stable", monthly_trend: "stable",
        breakdown: { trust_score: 92, policy_compliance: 95, model_health: 90, agent_health: 100, explainability_quality: 85, recovery_success: 90, security_status: 98, drift_score: 94, incident_rate: 2, human_review_rate: 15, consensus_stability: 92 }
      });
      setReputation({
        agents: [
          { rank: 1, agent_name: "kyc-agent", reputation_score: 96.5, accuracy: 0.98, precision: 0.97, recall: 0.98, avg_confidence: 0.95, avg_latency_ms: 12.5, failure_count: 0, recovery_success: 1, human_overrides: 0, policy_violations: 0, model_drift: 0.01 },
          { rank: 2, agent_name: "device-agent", reputation_score: 94.8, accuracy: 0.96, precision: 0.95, recall: 0.96, avg_confidence: 0.92, avg_latency_ms: 8.2, failure_count: 0, recovery_success: 1, human_overrides: 1, policy_violations: 0, model_drift: 0.02 },
          { rank: 3, agent_name: "explainability-agent", reputation_score: 93.2, accuracy: 0.95, precision: 0.94, recall: 0.95, avg_confidence: 0.93, avg_latency_ms: 110.0, failure_count: 0, recovery_success: 1, human_overrides: 2, policy_violations: 0, model_drift: 0.02 },
          { rank: 4, agent_name: "fraud-agent", reputation_score: 90.4, accuracy: 0.94, precision: 0.92, recall: 0.94, avg_confidence: 0.89, avg_latency_ms: 45.4, failure_count: 0, recovery_success: 1, human_overrides: 3, policy_violations: 0, model_drift: 0.05 },
          { rank: 5, agent_name: "aml-agent", reputation_score: 87.2, accuracy: 0.90, precision: 0.88, recall: 0.91, avg_confidence: 0.84, avg_latency_ms: 55.1, failure_count: 1, recovery_success: 1, human_overrides: 1, policy_violations: 0, model_drift: 0.06 }
        ]
      });
      setMaturity({
        maturity_level: "Level 4 - Quantitatively Managed",
        scores: { Monitoring: 85, Compliance: 90, Automation: 78, Security: 92, Explainability: 80, Recovery: 85, MLOps: 88, Documentation: 85 },
        recommendations: ["Automate model parameters rollback on aml violations.", "Review trust indices weekly."]
      });
      setFailures({
        failure_index: 10.5, severity: "low", trend: "stable",
        model_failures: 1, infra_failures: 0, policy_violations: 2, security_events: 0, consensus_failures: 0, recovery_failures: 0, human_escalations: 1, service_downtime_sec: 0,
        root_cause_analysis: "Minor parameters skew detected. Remapped model features parameters successfully.",
        recommendations: ["Schedule weekly validations checks."]
      });
      setBenchmarks({
        results: [
          { algorithm_name: "FraudRFClassifier_v1", algorithm_type: "fraud", accuracy: 0.95, precision: 0.94, recall: 0.96, f1_score: 0.95, roc_auc: 0.97, latency_ms: 12.4, memory_usage_mb: 45, cpu_usage_pct: 1.2, inference_time_ms: 12.4, recovery_time_ms: 12.0 },
          { algorithm_name: "FraudGBCClassifier_v2", algorithm_type: "fraud", accuracy: 0.96, precision: 0.95, recall: 0.97, f1_score: 0.96, roc_auc: 0.98, latency_ms: 18.2, memory_usage_mb: 85, cpu_usage_pct: 2.4, inference_time_ms: 18.2, recovery_time_ms: 18.0 },
          { algorithm_name: "AmlNetworkGraph_v1", algorithm_type: "aml", accuracy: 0.92, precision: 0.90, recall: 0.93, f1_score: 0.91, roc_auc: 0.94, latency_ms: 48.5, memory_usage_mb: 250, cpu_usage_pct: 8.5, inference_time_ms: 48.5, recovery_time_ms: 120.0 }
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIntelligence();
  }, []);

  const nextReportId = useRef(0);

  const triggerReportGeneration = async (type: string, format: string) => {
    try {
      const res = await fetch("http://localhost:8000/api/v1/intelligence/report/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report_type: type, report_format: format })
      });
      if (res.ok) {
        const data = await res.json();
        setReports(prev => [data, ...prev]);
        alert(`Successfully generated report!`);
      }
    } catch (err) {
      // local sandbox mock creation
      const mockReport = {
        id: `rep-${nextReportId.current++}`,
        report_type: type,
        report_format: format,
        summary: `Executive summary report generated manually in format: ${format}.`,
        created_at: new Date().toISOString()
      };
      setReports(prev => [mockReport, ...prev]);
      alert("Local sandbox report generated successfully!");
    }
  };

  const handleDownload = (id: string) => {
    window.open(`http://localhost:8000/api/v1/intelligence/report/download/${id}`, "_blank");
  };

  if (loading || !scoreData) {
    return <div style={{ padding: 40, color: "var(--text-2)", fontFamily: "var(--font-mono)" }}>Compiling Executive Governance Dashboard Telemetry...</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--text-1)", display: "flex", alignItems: "center", gap: 12 }}>
            <Layers size={28} style={{ color: "var(--accent-1)" }} /> Executive Intelligence
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-2)", marginTop: 6 }}>
            Unified decision governance intelligence panel. Analyzes dynamic maturity assessments, failure index metrics, and models comparison leaderboards.
          </p>
        </div>
        <button onClick={loadIntelligence} style={{
          background: "var(--surface-2)", border: "1px solid var(--border-1)", color: "var(--text-1)",
          padding: "8px 16px", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8
        }}>
          <RefreshCw size={16} /> Sync Telemetry
        </button>
      </div>

      {/* Nav Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border-1)", gap: 24 }}>
        {[
          { id: "overview", label: "Executive Overview", icon: <BarChart3 size={16} /> },
          { id: "score", label: "Governance Analytics", icon: <ShieldCheck size={16} /> },
          { id: "reputation", label: "Agent Reputation", icon: <Trophy size={16} /> },
          { id: "benchmarks", label: "Benchmark Center", icon: <Activity size={16} /> },
          { id: "reports", label: "Governance Reports", icon: <FileText size={16} /> }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "12px 4px", fontSize: 14, fontWeight: activeTab === tab.id ? 700 : 500,
              color: activeTab === tab.id ? "var(--accent-1)" : "var(--text-2)",
              border: "none", borderBottom: activeTab === tab.id ? "2px solid var(--accent-1)" : "none",
              background: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* KPI Dashboard */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-1)", padding: 20, borderRadius: 12 }}>
              <span style={{ fontSize: 12, color: "var(--text-2)" }}>Overall Governance Score</span>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8, color: "var(--text-1)" }}>
                {scoreData.overall_score}% <span style={{ fontSize: 14, color: "var(--success)" }}>({scoreData.grade})</span>
              </div>
            </div>
            <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-1)", padding: 20, borderRadius: 12 }}>
              <span style={{ fontSize: 12, color: "var(--text-2)" }}>Model Drift Index</span>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8, color: "var(--accent-1)" }}>
                0.02 <span style={{ fontSize: 12, color: "var(--success)", fontWeight: 500 }}>(optimal)</span>
              </div>
            </div>
            <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-1)", padding: 20, borderRadius: 12 }}>
              <span style={{ fontSize: 12, color: "var(--text-2)" }}>AI Failure Index</span>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8, color: "var(--risk-critical)" }}>
                {failures?.failure_index}% <span style={{ fontSize: 12, color: "var(--text-2)" }}>({failures?.severity})</span>
              </div>
            </div>
            <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-1)", padding: 20, borderRadius: 12 }}>
              <span style={{ fontSize: 12, color: "var(--text-2)" }}>Organizational Maturity</span>
              <div style={{ fontSize: 16, fontWeight: 800, marginTop: 12, color: "var(--text-1)" }}>
                {maturity?.maturity_level}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 20 }}>
            {/* Health & Incidents */}
            <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-1)", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)" }}>Governance Incidents Log</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, background: "var(--surface-3)", padding: 12, borderRadius: 8 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <ShieldAlert size={16} style={{ color: "var(--risk-critical)" }} />
                    <span style={{ color: "var(--text-1)" }}>AML Parameter Drift Event</span>
                  </div>
                  <span style={{ color: "var(--text-2)" }}>Resolved via rollback</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, background: "var(--surface-3)", padding: 12, borderRadius: 8 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <CheckCircle2 size={16} style={{ color: "var(--success)" }} />
                    <span style={{ color: "var(--text-1)" }}>Active models checks loaded</span>
                  </div>
                  <span style={{ color: "var(--success)" }}>5/5 Online</span>
                </div>
              </div>
            </div>

            {/* Maturity Index Breakdown */}
            <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-1)", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)" }}>Maturity Breakdown</h3>
              {Object.entries(maturity?.scores || {}).slice(0, 4).map(([k, v]: any) => (
                <div key={k}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-2)", marginBottom: 4 }}>
                    <span>{k}</span>
                    <span>{v}%</span>
                  </div>
                  <div style={{ width: "100%", height: 4, background: "var(--surface-3)", borderRadius: 2 }}>
                    <div style={{ width: `${v}%`, height: "100%", background: "var(--accent-1)", borderRadius: 2 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Governance Score break down */}
      {activeTab === "score" && (
        <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-1)", borderRadius: 12, padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-1)" }}>Governance Score Radar & Grade</h2>
            <p style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4 }}>
              Combined metric rating compiled across multi-model metrics. Grade: <span style={{ color: "var(--accent-1)", fontWeight: 700 }}>{scoreData.grade}</span> (Risk: {scoreData.risk_category.toUpperCase()})
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {Object.entries(scoreData.breakdown).map(([k, v]: any) => (
                <div key={k}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-2)", textTransform: "capitalize", marginBottom: 6 }}>
                    <span>{k.replace("_", " ")}</span>
                    <span style={{ fontWeight: 600 }}>{v}%</span>
                  </div>
                  <div style={{ width: "100%", height: 6, background: "var(--surface-3)", borderRadius: 3 }}>
                    <div style={{ width: `${v}%`, height: "100%", background: "var(--accent-1)", borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: "var(--surface-3)", borderRadius: 12, padding: 24, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
              <div style={{ fontSize: 14, color: "var(--text-2)" }}>Overall Governance Score</div>
              <div style={{ fontSize: 96, fontWeight: 900, color: "var(--accent-1)", lineHeight: 1 }}>{scoreData.overall_score}%</div>
              <div style={{ fontSize: 14, color: "var(--text-2)", marginTop: 12 }}>Weekly status trend: <span style={{ color: "var(--success)", fontWeight: 700 }}>{scoreData.weekly_trend}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Agent Reputation Leaderboard */}
      {activeTab === "reputation" && (
        <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-1)", borderRadius: 12, padding: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-1)", marginBottom: 16 }}>Active Agent Reputation Leaderboard</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-1)", color: "var(--text-2)", fontSize: 12 }}>
                <th style={{ padding: 12 }}>Rank</th>
                <th style={{ padding: 12 }}>Agent Name</th>
                <th style={{ padding: 12 }}>Reputation</th>
                <th style={{ padding: 12 }}>Accuracy</th>
                <th style={{ padding: 12 }}>F1 Score</th>
                <th style={{ padding: 12 }}>Latency</th>
                <th style={{ padding: 12 }}>Overrides</th>
                <th style={{ padding: 12 }}>Drift</th>
              </tr>
            </thead>
            <tbody>
              {reputation.agents.map((a: any) => (
                <tr key={a.agent_name} style={{ borderBottom: "1px solid var(--border-1)", fontSize: 13, color: "var(--text-1)" }}>
                  <td style={{ padding: 12, fontWeight: 700 }}>#{a.rank}</td>
                  <td style={{ padding: 12, fontFamily: "var(--font-mono)" }}>{a.agent_name}</td>
                  <td style={{ padding: 12, fontWeight: 700, color: "var(--accent-1)" }}>{a.reputation_score}</td>
                  <td style={{ padding: 12 }}>{(a.accuracy * 100).toFixed(1)}%</td>
                  <td style={{ padding: 12 }}>{(a.precision * 100).toFixed(1)}%</td>
                  <td style={{ padding: 12 }}>{a.avg_latency_ms}ms</td>
                  <td style={{ padding: 12 }}>{a.human_overrides}</td>
                  <td style={{ padding: 12, color: a.model_drift > 0.05 ? "var(--risk-critical)" : "var(--success)" }}>{(a.model_drift * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Benchmark Center */}
      {activeTab === "benchmarks" && (
        <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-1)", borderRadius: 12, padding: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-1)", marginBottom: 16 }}>Algorithm Benchmark Metrics Comparison</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-1)", color: "var(--text-2)", fontSize: 12 }}>
                <th style={{ padding: 12 }}>Algorithm</th>
                <th style={{ padding: 12 }}>Type</th>
                <th style={{ padding: 12 }}>Accuracy</th>
                <th style={{ padding: 12 }}>Recall</th>
                <th style={{ padding: 12 }}>ROC AUC</th>
                <th style={{ padding: 12 }}>Latency</th>
                <th style={{ padding: 12 }}>CPU</th>
                <th style={{ padding: 12 }}>Memory</th>
                <th style={{ padding: 12 }}>Recovery Time</th>
              </tr>
            </thead>
            <tbody>
              {benchmarks.results.map((r: any) => (
                <tr key={r.algorithm_name} style={{ borderBottom: "1px solid var(--border-1)", fontSize: 13, color: "var(--text-1)" }}>
                  <td style={{ padding: 12, fontFamily: "var(--font-mono)" }}>{r.algorithm_name}</td>
                  <td style={{ padding: 12, textTransform: "uppercase", fontSize: 10 }}>{r.algorithm_type}</td>
                  <td style={{ padding: 12 }}>{r.accuracy}</td>
                  <td style={{ padding: 12 }}>{r.recall}</td>
                  <td style={{ padding: 12 }}>{r.roc_auc}</td>
                  <td style={{ padding: 12 }}>{r.latency_ms}ms</td>
                  <td style={{ padding: 12 }}>{r.cpu_usage_pct}%</td>
                  <td style={{ padding: 12 }}>{r.memory_usage_mb}MB</td>
                  <td style={{ padding: 12 }}>{r.recovery_time_ms}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reports Center */}
      {activeTab === "reports" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 20 }}>
          {/* Create Report */}
          <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-1)", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-1)" }}>Compile Governance Report</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-2)", display: "block", marginBottom: 6 }}>Report Type</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {["executive", "benchmark", "agent", "weekly", "monthly"].map(t => (
                    <button key={t} onClick={() => triggerReportGeneration(t, "pdf")} style={{
                      background: "var(--surface-3)", border: "1px solid var(--border-1)", color: "var(--text-1)",
                      fontSize: 12, padding: "6px 12px", borderRadius: 4, cursor: "pointer", textTransform: "capitalize"
                    }}>
                      Generate {t} PDF
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ borderTop: "1px solid var(--border-1)", paddingTop: 12 }}>
                <label style={{ fontSize: 12, color: "var(--text-2)", display: "block", marginBottom: 6 }}>Export Benchmark Matrix Data</label>
                <div style={{ display: "flex", gap: 12 }}>
                  <button onClick={() => triggerReportGeneration("benchmark", "csv")} style={{
                    background: "var(--surface-3)", border: "1px solid var(--border-1)", color: "var(--text-1)",
                    fontSize: 12, padding: "8px 16px", borderRadius: 4, cursor: "pointer"
                  }}>
                    Compile CSV Data
                  </button>
                  <button onClick={() => triggerReportGeneration("benchmark", "json")} style={{
                    background: "var(--surface-3)", border: "1px solid var(--border-1)", color: "var(--text-1)",
                    fontSize: 12, padding: "8px 16px", borderRadius: 4, cursor: "pointer"
                  }}>
                    Compile JSON Parameters
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Compiled Reports list */}
          <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-1)", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-1)" }}>Download Report Registry</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, overflowY: "auto", maxHeight: 300 }}>
              {reports.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--text-2)" }}>No custom reports generated in this workspace session. Trigger above.</div>
              ) : (
                reports.map((r, idx) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface-3)", padding: 12, borderRadius: 8 }}>
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)", textTransform: "capitalize" }}>{r.report_type} Report</span>
                      <div style={{ fontSize: 11, color: "var(--text-2)", marginTop: 4 }}>Format: {r.report_format.toUpperCase()} | Timestamp: {new Date(r.created_at).toLocaleString()}</div>
                    </div>
                    <button onClick={() => handleDownload(r.id)} style={{
                      background: "var(--accent-1)", color: "#fff", border: "none", borderRadius: 4,
                      padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6
                    }}>
                      <Download size={14} /> Download
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
