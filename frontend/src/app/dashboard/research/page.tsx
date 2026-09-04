"use client";

import React, { useState, useEffect } from "react";
import { 
  Beaker, Trophy, Activity, AlertTriangle, ShieldCheck, 
  BarChart2, Play, Settings, Plus, Download, RefreshCw, FileText
} from "lucide-react";
import { apiUrl } from "@/lib/api";

export default function ResearchDashboard() {
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [loading, setLoading] = useState<boolean>(true);
  
  // States populated from backend APIs
  const [govReport, setGovReport] = useState<any>(null);
  const [reputation, setReputation] = useState<any[]>([]);
  const [failureReport, setFailureReport] = useState<any>(null);
  const [maturity, setMaturity] = useState<any>(null);
  const [benchmarks, setBenchmarks] = useState<any[]>([]);
  
  // Form states for creating experiments
  const [expName, setExpName] = useState("");
  const [expDesc, setExpDesc] = useState("");
  const [expConfig, setExpConfig] = useState('{"fraud_weight": 0.40, "kyc_weight": 0.20}');
  const [createdExps, setCreatedExps] = useState<any[]>([]);
  
  // Consensus V2 simulation inputs
  const [agentVotes, setAgentVotes] = useState<any[]>([
    { agent_name: "fraud-agent", decision: "approve", confidence: 0.92, is_healthy: true, has_drift: false },
    { agent_name: "kyc-agent", decision: "approve", confidence: 0.98, is_healthy: true, has_drift: false },
    { agent_name: "device-agent", decision: "decline", confidence: 0.45, is_healthy: true, has_drift: false },
    { agent_name: "aml-agent", decision: "approve", confidence: 0.94, is_healthy: true, has_drift: false },
    { agent_name: "explainability-agent", decision: "approve", confidence: 0.95, is_healthy: true, has_drift: false }
  ]);
  const [consensusResult, setConsensusResult] = useState<any>(null);

  // Fetch telemetry datasets
  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [rGov, rRep, rFail, rMat, rBench] = await Promise.all([
        fetch(apiUrl("/api/v1/research/governance-score")).then(r => r.json()),
        fetch(apiUrl("/api/v1/research/reputation")).then(r => r.json()),
        fetch(apiUrl("/api/v1/research/failure-index")).then(r => r.json()),
        fetch(apiUrl("/api/v1/research/maturity")).then(r => r.json()),
        fetch(apiUrl("/api/v1/research/benchmarks")).then(r => r.json())
      ]);

      setGovReport(rGov);
      setReputation(rRep);
      setFailureReport(rFail);
      setMaturity(rMat);
      setBenchmarks(rBench);

    } catch (err) {
      console.error("Research API fetch fallback trigger:", err);
      // Seed high fidelity local fallbacks for development / standalone loads
      setGovReport({
        score: 87.5,
        grade: "B",
        trend: "improving",
        metrics: {
          trust_score: 89.0, policy_compliance: 95.0, explainability_score: 88.0,
          model_health: 90.0, agent_health: 100.0, drift_score: 95.0,
          security_score: 98.0, recovery_score: 90.0, incident_frequency: 1.0, human_review_rate: 14.5
        }
      });
      setReputation([
        { rank: 1, agent_name: "kyc-agent", reputation_score: 96.4, accuracy: 0.98, avg_confidence: 0.95, latency_ms: 15.1, incidents: 0, drift_events: 0 },
        { rank: 2, agent_name: "device-agent", reputation_score: 95.0, accuracy: 0.96, avg_confidence: 0.92, latency_ms: 8.4, incidents: 0, drift_events: 0 },
        { rank: 3, agent_name: "explainability-agent", reputation_score: 94.2, accuracy: 0.95, avg_confidence: 0.94, latency_ms: 115.0, incidents: 0, drift_events: 0 },
        { rank: 4, agent_name: "fraud-agent", reputation_score: 92.5, accuracy: 0.94, avg_confidence: 0.90, latency_ms: 42.5, incidents: 2, drift_events: 1 },
        { rank: 5, agent_name: "aml-agent", reputation_score: 88.0, accuracy: 0.89, avg_confidence: 0.85, latency_ms: 58.2, incidents: 1, drift_events: 1 }
      ]);
      setFailureReport({
        failure_index: 12.4,
        severity: "low",
        breakdown: { model_failures: 1, infra_failures: 0, policy_violations: 2, agent_failures: 0, consensus_failures: 0, recovery_failures: 0, drift_events: 1, security_events: 0 },
        summary: "No major outages. Slight parameters drift verified on payments model."
      });
      setMaturity({
        level: "Quantitatively Managed",
        scores: { Monitoring: 85, Security: 90, Compliance: 88, Observability: 85, Explainability: 80, Automation: 75, Recovery: 82, "Policy Coverage": 90, "Human Oversight": 85 },
        recommendations: [
          "Increase explainability logging attributes metrics.",
          "Add automatic threshold rollback to the AML node rules."
        ]
      });
      setBenchmarks([
        { algorithm_name: "FraudRFClassifier_v1", algorithm_type: "fraud", accuracy: 0.95, precision: 0.94, recall: 0.96, f1_score: 0.95, roc_auc: 0.97, latency_ms: 12.4, throughput: 4500, cpu_usage: 1.2, memory_usage: 45 },
        { algorithm_name: "FraudGBCClassifier_v2", algorithm_type: "fraud", accuracy: 0.96, precision: 0.95, recall: 0.97, f1_score: 0.96, roc_auc: 0.98, latency_ms: 18.2, throughput: 3200, cpu_usage: 2.4, memory_usage: 85 },
        { algorithm_name: "AmlNetworkGraph_v1", algorithm_type: "aml", accuracy: 0.92, precision: 0.90, recall: 0.93, f1_score: 0.91, roc_auc: 0.94, latency_ms: 48.5, throughput: 800, cpu_usage: 8.5, memory_usage: 250 },
        { algorithm_name: "ConsensusV2_ReputationWeighted", algorithm_type: "consensus", accuracy: 0.97, precision: 0.96, recall: 0.98, f1_score: 0.97, roc_auc: 0.99, latency_ms: 2.8, throughput: 18000, cpu_usage: 0.2, memory_usage: 8 }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchData();
    });
  }, []);

  // Simulate dynamic V2 consensus
  useEffect(() => {
    if (reputation.length > 0) {
      const reps: Record<string, number> = {};
      reputation.forEach(a => {
        reps[a.agent_name] = a.reputation_score;
      });

      let totalWeight = 0;
      let approval_weighted_sum = 0;
      const confidence_matrix: Record<string, any> = {};
      const weighted_votes = [];

      agentVotes.forEach(vote => {
        const name = vote.agent_name;
        const decision = vote.decision;
        const confidence = parseFloat(vote.confidence);
        const is_healthy = vote.is_healthy;
        const has_drift = vote.has_drift;

        const base_rep = reps[name] || 85.0;
        let weight = base_rep / 100.0;
        if (!is_healthy) weight *= 0.20;
        if (has_drift) weight *= 0.60;
        weight *= confidence;

        totalWeight += weight;
        const vote_val = decision === "approve" ? 1.0 : 0.0;
        approval_weighted_sum += vote_val * weight;

        confidence_matrix[name] = {
          decision,
          confidence,
          reputation_applied: base_rep,
          effective_weight: parseFloat(weight.toFixed(3))
        };

        weighted_votes.push({
          agent_name: name,
          decision,
          weight: parseFloat(weight.toFixed(3))
        });
      });

      const consensus_confidence = totalWeight > 0 ? approval_weighted_sum / totalWeight : 1.0;
      const stability = 1.0 - Math.abs(consensus_confidence - 0.5) * 2.0;

      Promise.resolve().then(() => {
        setConsensusResult({
          verdict: consensus_confidence >= 0.5 ? "approve" : "decline",
          consensus_confidence: parseFloat(consensus_confidence.toFixed(4)),
          decision_stability: parseFloat((1.0 - stability).toFixed(3)),
          confidence_matrix
        });
      });
    }
  }, [agentVotes, reputation]);

  // Handler for creating a research experiment
  const handleCreateExperiment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expName) return;
    try {
      const parsedConfig = JSON.parse(expConfig);
      const res = await fetch(apiUrl("/api/v1/research/experiment"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: "00000000-0000-0000-0000-000000000000", // default/mock
          name: expName,
          description: expDesc,
          tags: ["research-lab", "governance-twin"],
          version_string: "1.0.0",
          config_data: parsedConfig
        })
      });
      if (res.ok) {
        const data = await res.json();
        setCreatedExps(prev => [data, ...prev]);
        setExpName("");
        setExpDesc("");
        alert("Research experiment successfully saved!");
      }
    } catch (err) {
      // Mock validation addition
      const mockExp = {
        id: `exp-${Math.random().toString(36).slice(2, 6)}`,
        name: expName,
        description: expDesc,
        tags: ["research-lab", "governance-twin"],
        version_string: "1.0.0",
        config_data: JSON.parse(expConfig),
        created_at: new Date().toISOString()
      };
      setCreatedExps(prev => [mockExp, ...prev]);
      setExpName("");
      setExpDesc("");
      alert("Local sandbox research experiment created!");
    }
  };

  const handleDownloadCSV = () => {
    window.open(apiUrl("/api/v1/research/download/csv"), "_blank");
  };

  if (loading || !govReport) {
    return <div style={{ padding: 40, color: "var(--text-2)", fontFamily: "var(--font-mono)" }}>Synchronizing AI Governance Intelligence metrics...</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--text-1)", display: "flex", alignItems: "center", gap: 12 }}>
            <Beaker size={28} style={{ color: "var(--accent-1)" }} /> AI Research Lab
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-2)", marginTop: 6 }}>
            Exploratory modeling console to design, benchmark, and evaluate dynamic governance algorithms, consensus matrices, and agent reputation weights.
          </p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={fetchData} style={{
            background: "var(--surface-2)", border: "1px solid var(--border-1)", color: "var(--text-1)",
            padding: "8px 16px", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8
          }}>
            <RefreshCw size={16} /> Sync Metrics
          </button>
          <button onClick={handleDownloadCSV} style={{
            background: "var(--accent-1)", color: "#fff", border: "none",
            padding: "8px 16px", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8
          }}>
            <Download size={16} /> Export Benchmarks
          </button>
        </div>
      </div>

      {/* Nav Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border-1)", gap: 24 }}>
        {[
          { id: "overview", label: "Overview", icon: <BarChart2 size={16} /> },
          { id: "score", label: "Governance Score", icon: <ShieldCheck size={16} /> },
          { id: "reputation", label: "Agent Reputation", icon: <Trophy size={16} /> },
          { id: "benchmarks", label: "Benchmark Center", icon: <Activity size={16} /> },
          { id: "consensus", label: "Dynamic Consensus V2", icon: <Settings size={16} /> },
          { id: "maturity", label: "Maturity index", icon: <FileText size={16} /> },
          { id: "failures", label: "Failure analysis", icon: <AlertTriangle size={16} /> },
          { id: "experiments", label: "Experiments", icon: <Play size={16} /> }
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
          {/* Top KPI Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-1)", padding: 20, borderRadius: 12 }}>
              <span style={{ fontSize: 12, color: "var(--text-2)" }}>Overall Governance Score</span>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8, color: "var(--text-1)" }}>
                {govReport.score}% <span style={{ fontSize: 14, color: "var(--success)" }}>({govReport.grade})</span>
              </div>
            </div>
            <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-1)", padding: 20, borderRadius: 12 }}>
              <span style={{ fontSize: 12, color: "var(--text-2)" }}>System Failure Index</span>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8, color: "var(--risk-critical)" }}>
                {failureReport?.failure_index}% <span style={{ fontSize: 14, color: "var(--text-2)" }}>({failureReport?.severity})</span>
              </div>
            </div>
            <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-1)", padding: 20, borderRadius: 12 }}>
              <span style={{ fontSize: 12, color: "var(--text-2)" }}>Maturity Level</span>
              <div style={{ fontSize: 20, fontWeight: 800, marginTop: 12, color: "var(--text-1)" }}>
                {maturity?.level}
              </div>
            </div>
            <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-1)", padding: 20, borderRadius: 12 }}>
              <span style={{ fontSize: 12, color: "var(--text-2)" }}>Benchmark Algorithms</span>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8, color: "var(--accent-1)" }}>
                {benchmarks.length} Active
              </div>
            </div>
          </div>

          {/* Quick Info Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* Agent Reputation Leaderboard Summary */}
            <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-1)", borderRadius: 12, padding: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-1)", marginBottom: 16 }}>Agent Reputation Rankings</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {reputation.slice(0, 3).map(a => (
                  <div key={a.agent_name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: 12 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-2)" }}>#{a.rank}</span>
                      <span style={{ fontSize: 14, color: "var(--text-1)", fontFamily: "var(--font-mono)" }}>{a.agent_name}</span>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--accent-1)" }}>{a.reputation_score} / 100</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Strategic Recommendations */}
            <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-1)", borderRadius: 12, padding: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-1)", marginBottom: 16 }}>Maturity Recommendations</h2>
              <ul style={{ display: "flex", flexDirection: "column", gap: 10, paddingLeft: 16, fontSize: 13, color: "var(--text-2)" }}>
                {maturity?.recommendations.map((r: string, idx: number) => (
                  <li key={idx}>{r}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Governance Score breakdown */}
      {activeTab === "score" && (
        <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-1)", borderRadius: 12, padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-1)" }}>Governance Index Breakdown</h2>
            <p style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4 }}>
              Combined metric rating analyzing multiple risk vectors and compliance rates.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {Object.entries(govReport.metrics).map(([key, val]: any) => (
                <div key={key}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-2)", textTransform: "capitalize", marginBottom: 6 }}>
                    <span>{key.replace("_", " ")}</span>
                    <span style={{ fontWeight: 600 }}>{val}%</span>
                  </div>
                  <div style={{ width: "100%", height: 6, background: "var(--surface-3)", borderRadius: 3 }}>
                    <div style={{ width: `${val}%`, height: "100%", background: "var(--accent-1)", borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: "var(--surface-3)", borderRadius: 12, padding: 24, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
              <div style={{ fontSize: 14, color: "var(--text-2)" }}>Overall Governance Grade</div>
              <div style={{ fontSize: 96, fontWeight: 900, color: "var(--accent-1)", lineHeight: 1 }}>{govReport.grade}</div>
              <div style={{ fontSize: 14, color: "var(--text-2)", marginTop: 12 }}>Trend Status: <span style={{ color: "var(--success)", fontWeight: 700 }}>{govReport.trend}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Agent Reputation Leaderboard */}
      {activeTab === "reputation" && (
        <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-1)", borderRadius: 12, padding: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-1)", marginBottom: 16 }}>Agent Reputation Index Leaderboard</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-1)", color: "var(--text-2)", fontSize: 12 }}>
                <th style={{ padding: 12 }}>Rank</th>
                <th style={{ padding: 12 }}>Agent Name</th>
                <th style={{ padding: 12 }}>Reputation Score</th>
                <th style={{ padding: 12 }}>Accuracy</th>
                <th style={{ padding: 12 }}>Avg Confidence</th>
                <th style={{ padding: 12 }}>Latency</th>
                <th style={{ padding: 12 }}>Incidents</th>
              </tr>
            </thead>
            <tbody>
              {reputation.map(a => (
                <tr key={a.agent_name} style={{ borderBottom: "1px solid var(--border-1)", fontSize: 13, color: "var(--text-1)" }}>
                  <td style={{ padding: 12, fontWeight: 700 }}>#{a.rank}</td>
                  <td style={{ padding: 12, fontFamily: "var(--font-mono)" }}>{a.agent_name}</td>
                  <td style={{ padding: 12, fontWeight: 700, color: "var(--accent-1)" }}>{a.reputation_score}</td>
                  <td style={{ padding: 12 }}>{(a.accuracy * 100).toFixed(1)}%</td>
                  <td style={{ padding: 12 }}>{(a.avg_confidence * 100).toFixed(1)}%</td>
                  <td style={{ padding: 12 }}>{a.latency_ms}ms</td>
                  <td style={{ padding: 12, color: a.incidents > 0 ? "var(--risk-critical)" : "var(--success)" }}>{a.incidents}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Benchmark Center */}
      {activeTab === "benchmarks" && (
        <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-1)", borderRadius: 12, padding: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-1)", marginBottom: 16 }}>Algorithm Benchmark Metrics Matrix</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-1)", color: "var(--text-2)", fontSize: 12 }}>
                  <th style={{ padding: 12 }}>Algorithm</th>
                  <th style={{ padding: 12 }}>Type</th>
                  <th style={{ padding: 12 }}>Accuracy</th>
                  <th style={{ padding: 12 }}>Precision</th>
                  <th style={{ padding: 12 }}>Recall</th>
                  <th style={{ padding: 12 }}>F1 Score</th>
                  <th style={{ padding: 12 }}>ROC-AUC</th>
                  <th style={{ padding: 12 }}>Latency</th>
                  <th style={{ padding: 12 }}>TPS</th>
                </tr>
              </thead>
              <tbody>
                {benchmarks.map(b => (
                  <tr key={b.algorithm_name} style={{ borderBottom: "1px solid var(--border-1)", fontSize: 13, color: "var(--text-1)" }}>
                    <td style={{ padding: 12, fontFamily: "var(--font-mono)" }}>{b.algorithm_name}</td>
                    <td style={{ padding: 12, textTransform: "uppercase", fontSize: 10 }}>{b.algorithm_type}</td>
                    <td style={{ padding: 12 }}>{b.accuracy}</td>
                    <td style={{ padding: 12 }}>{b.precision}</td>
                    <td style={{ padding: 12 }}>{b.recall}</td>
                    <td style={{ padding: 12 }}>{b.f1_score}</td>
                    <td style={{ padding: 12 }}>{b.roc_auc}</td>
                    <td style={{ padding: 12 }}>{b.latency_ms}ms</td>
                    <td style={{ padding: 12 }}>{b.throughput.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dynamic Consensus V2 */}
      {activeTab === "consensus" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-1)", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-1)" }}>Simulate Votes Weights</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {agentVotes.map((vote, idx) => (
                <div key={vote.agent_name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontFamily: "var(--font-mono)" }}>{vote.agent_name}</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <select
                      value={vote.decision}
                      onChange={(e) => {
                        const newVotes = [...agentVotes];
                        newVotes[idx].decision = e.target.value;
                        setAgentVotes(newVotes);
                      }}
                      style={{ background: "var(--surface-3)", color: "var(--text-1)", border: "1px solid var(--border-1)", borderRadius: 4, padding: 4 }}
                    >
                      <option value="approve">Approve</option>
                      <option value="decline">Decline</option>
                    </select>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max="1"
                      value={vote.confidence}
                      onChange={(e) => {
                        const newVotes = [...agentVotes];
                        newVotes[idx].confidence = e.target.value;
                        setAgentVotes(newVotes);
                      }}
                      style={{ width: 60, background: "var(--surface-3)", color: "var(--text-1)", border: "1px solid var(--border-1)", borderRadius: 4, padding: 4 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-1)", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-1)" }}>Consensus Outcome</h2>
            {consensusResult && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <span style={{ fontSize: 12, color: "var(--text-2)" }}>Consensus Verdict</span>
                  <div style={{ fontSize: 24, fontWeight: 800, textTransform: "uppercase", color: consensusResult.verdict === "approve" ? "var(--success)" : "var(--risk-critical)" }}>
                    {consensusResult.verdict}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: 12, color: "var(--text-2)" }}>Consensus Confidence Score</span>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-1)" }}>{(consensusResult.consensus_confidence * 100).toFixed(1)}%</div>
                </div>
                <div>
                  <span style={{ fontSize: 12, color: "var(--text-2)" }}>Decision Stability index</span>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "var(--accent-1)" }}>{(consensusResult.decision_stability * 100).toFixed(1)}%</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Maturity Index */}
      {activeTab === "maturity" && (
        <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-1)", borderRadius: 12, padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-1)" }}>Organizational Governance Maturity Index</h2>
            <p style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4 }}>
              Active maturity standing determined across categories. Current Standing: <span style={{ color: "var(--accent-1)", fontWeight: 700 }}>{maturity?.level}</span>
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {Object.entries(maturity?.scores || {}).map(([key, val]: any) => (
                <div key={key}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-2)", marginBottom: 4 }}>
                    <span>{key}</span>
                    <span>{val}%</span>
                  </div>
                  <div style={{ width: "100%", height: 6, background: "var(--surface-3)", borderRadius: 3 }}>
                    <div style={{ width: `${val}%`, height: "100%", background: "var(--accent-1)", borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: "var(--surface-3)", padding: 20, borderRadius: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)", marginBottom: 12 }}>Strategic Recommendations List</h3>
              <ul style={{ display: "flex", flexDirection: "column", gap: 10, paddingLeft: 16, fontSize: 13, color: "var(--text-2)", lineHeight: 1.5 }}>
                {maturity?.recommendations.map((rec: string, i: number) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Failure Analysis */}
      {activeTab === "failures" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-1)", borderRadius: 12, padding: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-1)", marginBottom: 16 }}>Anomalies & Failures breakdown</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
              {Object.entries(failureReport?.breakdown || {}).map(([key, val]: any) => (
                <div key={key} style={{ background: "var(--surface-3)", padding: 16, borderRadius: 8 }}>
                  <span style={{ fontSize: 11, color: "var(--text-2)", textTransform: "uppercase" }}>{key.replace("_", " ")}</span>
                  <div style={{ fontSize: 24, fontWeight: 800, color: val > 0 ? "var(--risk-critical)" : "var(--text-1)", marginTop: 6 }}>{val}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-1)", borderRadius: 12, padding: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-1)", marginBottom: 10 }}>Root Cause Summary Log</h2>
            <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.5 }}>
              {failureReport?.summary}
            </p>
          </div>
        </div>
      )}

      {/* Experiment Manager */}
      {activeTab === "experiments" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 20 }}>
          {/* Create Experiment */}
          <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-1)", borderRadius: 12, padding: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-1)", marginBottom: 16 }}>Create Governance Experiment</h2>
            <form onSubmit={handleCreateExperiment} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, color: "var(--text-2)" }}>Experiment Name</label>
                <input
                  type="text"
                  placeholder="e.g. Fraud weights optimization study"
                  value={expName}
                  onChange={(e) => setExpName(e.target.value)}
                  style={{ background: "var(--surface-3)", color: "var(--text-1)", border: "1px solid var(--border-1)", borderRadius: 6, padding: "8px 12px" }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, color: "var(--text-2)" }}>Description</label>
                <textarea
                  placeholder="Goals and targets of the experiment study"
                  value={expDesc}
                  onChange={(e) => setExpDesc(e.target.value)}
                  style={{ height: 60, background: "var(--surface-3)", color: "var(--text-1)", border: "1px solid var(--border-1)", borderRadius: 6, padding: "8px 12px" }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, color: "var(--text-2)" }}>Parameters Configuration (JSON)</label>
                <textarea
                  value={expConfig}
                  onChange={(e) => setExpConfig(e.target.value)}
                  style={{ height: 60, fontFamily: "var(--font-mono)", background: "var(--surface-3)", color: "var(--text-1)", border: "1px solid var(--border-1)", borderRadius: 6, padding: "8px 12px" }}
                />
              </div>
              <button type="submit" style={{
                background: "var(--accent-1)", color: "#fff", border: "none", borderRadius: 6,
                padding: "10px", fontSize: 13, fontWeight: 600, cursor: "pointer", marginTop: 8
              }}>
                Save and Initialize Run
              </button>
            </form>
          </div>

          {/* Experiments Library */}
          <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-1)", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-1)" }}>Active Experiments List</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, overflowY: "auto", maxHeight: 300 }}>
              {createdExps.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--text-2)" }}>No custom experiments created in this session. Use form to create one.</div>
              ) : (
                createdExps.map((e, idx) => (
                  <div key={idx} style={{ background: "var(--surface-3)", border: "1px solid var(--border-1)", padding: 12, borderRadius: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>{e.name}</span>
                      <span style={{ fontSize: 10, background: "var(--accent-1-dim)", color: "var(--accent-1)", padding: "2px 6px", borderRadius: 4 }}>ACTIVE</span>
                    </div>
                    <p style={{ fontSize: 12, color: "var(--text-2)", marginTop: 6 }}>{e.description}</p>
                    <div style={{ fontSize: 10, color: "var(--text-2)", fontFamily: "var(--font-mono)", marginTop: 6 }}>Version: {e.version_string} | Config: {JSON.stringify(e.config_data)}</div>
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