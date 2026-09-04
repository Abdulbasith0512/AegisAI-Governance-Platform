"use client";

import React, { useState, useEffect } from "react";
import { apiUrl } from "@/lib/api";

// Pre-seeded consensus configurations to display when backend isn't actively running
const SIMULATED_REPUTATIONS = [
  { agent: "Compliance Agent", rep: 0.98, weight: 0.26, color: "from-emerald-500 to-teal-400" },
  { agent: "Fraud Agent", rep: 0.95, weight: 0.21, color: "from-cyan-500 to-blue-400" },
  { agent: "AML Agent", rep: 0.88, weight: 0.14, color: "from-indigo-500 to-purple-400" },
  { agent: "KYC Agent", rep: 0.92, weight: 0.16, color: "from-violet-500 to-fuchsia-400" },
  { agent: "Device Agent", rep: 0.85, weight: 0.09, color: "from-pink-500 to-rose-400" },
  { agent: "Behavior Agent", rep: 0.90, weight: 0.10, color: "from-amber-500 to-orange-400" },
  { agent: "Explainability Agent", rep: 0.99, weight: 0.04, color: "from-yellow-500 to-lime-400" }
];

const SIMULATED_CONSENSUS_HISTORY = [
  {
    id: "con-1",
    tx_ref: "TX-99882",
    verdict: "approve",
    score: 0.9425,
    override: false,
    disagreed: ["Device Agent"],
    date: "Jul 15, 14:30"
  },
  {
    id: "con-2",
    tx_ref: "TX-99883",
    verdict: "decline",
    score: 0.8250,
    override: true, // Compliance veto check trigger
    disagreed: ["Fraud Agent", "Device Agent"],
    date: "Jul 15, 14:32"
  },
  {
    id: "con-3",
    tx_ref: "TX-99884",
    verdict: "decline",
    score: 0.9125,
    override: false,
    disagreed: ["KYC Agent"],
    date: "Jul 15, 14:35"
  }
];

function getAgentDisplayName(key: string): string {
  const mapping: Record<string, string> = {
    "compliance-agent": "Compliance Agent",
    "fraud-agent": "Fraud Agent",
    "aml-agent": "AML Agent",
    "kyc-agent": "KYC Agent",
    "device-agent": "Device Agent",
    "behavior-agent": "Behavior Agent",
    "explainability-agent": "Explainability Agent"
  };
  return mapping[key.toLowerCase()] || key;
}

function getAgentColor(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("compliance")) return "from-emerald-500 to-teal-400";
  if (lower.includes("fraud")) return "from-cyan-500 to-blue-400";
  if (lower.includes("aml")) return "from-indigo-500 to-purple-400";
  if (lower.includes("kyc")) return "from-violet-500 to-fuchsia-400";
  if (lower.includes("device")) return "from-pink-500 to-rose-400";
  if (lower.includes("behavior")) return "from-amber-500 to-orange-400";
  return "from-yellow-500 to-lime-400";
}

interface AgentReputation {
  agent: string;
  rep: number;
  weight: number;
  color: string;
}

interface ConsensusEntry {
  id: string;
  tx_ref: string;
  verdict: string;
  score: number;
  override: boolean;
  disagreed: string[];
  date: string;
}

interface ConsensusApiItem {
  id: string;
  transaction_id: string;
  decision_verdict: string;
  consensus_score: number;
  created_at: string;
  vote_details?: {
    disagreed_agents?: string[];
    compliance_override_triggered?: boolean;
    reputations?: Record<string, number>;
    normalized_weights?: Record<string, number>;
  };
}

export default function ConsensusDashboard() {
  const [reputations, setReputations] = useState<AgentReputation[]>(SIMULATED_REPUTATIONS);
  const [history, setHistory] = useState<ConsensusEntry[]>([]);
  const [selectedAudit, setSelectedAudit] = useState<ConsensusEntry | null>(null);
  const [_loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadConsensusData() {
      try {
        const res = await fetch(apiUrl("/api/v1/consensus/history"));
        if (res.ok) {
          const data = await res.json();
          const mappedHistory = data.map((item: ConsensusApiItem) => {
            const disagreed = item.vote_details?.disagreed_agents || [];
            return {
              id: item.id,
              tx_ref: `TX-${item.transaction_id.slice(0, 5).toUpperCase()}`,
              verdict: item.decision_verdict,
              score: item.consensus_score,
              override: item.vote_details?.compliance_override_triggered || false,
              disagreed: disagreed.map(getAgentDisplayName),
              date: new Date(item.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            };
          });
          if (mappedHistory.length > 0) {
            setHistory(mappedHistory);
            setSelectedAudit(mappedHistory[0]);

            if (data.length > 0) {
              const latest = data[0];
              const reps = latest.vote_details?.reputations || {};
              const weights = latest.vote_details?.normalized_weights || {};
              const mappedReps = Object.keys(reps).map(key => {
                const displayName = getAgentDisplayName(key);
                return {
                  agent: displayName,
                  rep: reps[key],
                  weight: weights[key] || 0.05,
                  color: getAgentColor(displayName)
                };
              });
              mappedReps.sort((a, b) => b.weight - a.weight);
              setReputations(mappedReps);
            }
          } else {
            // Fall back to simulated configurations when the backend ledger database has no logs
            setHistory(SIMULATED_CONSENSUS_HISTORY);
            setSelectedAudit(SIMULATED_CONSENSUS_HISTORY[0]);
            setReputations(SIMULATED_REPUTATIONS);
          }
        } else {
          throw new Error("API error");
        }
      } catch {
        setHistory(SIMULATED_CONSENSUS_HISTORY);
        setSelectedAudit(SIMULATED_CONSENSUS_HISTORY[0]);
        setReputations(SIMULATED_REPUTATIONS);
      } finally {
        setLoading(false);
      }
    }
    loadConsensusData();
  }, []);

  return (
    <div className="min-h-screen bg-[#0d0f14] text-[#e2e8f0] font-sans antialiased p-6 md:p-12 selection:bg-violet-500 selection:text-white">
      {/* Background glow effects */}
      <div className="absolute top-0 right-1/4 h-[350px] w-[350px] rounded-full bg-violet-500/5 blur-3xl"></div>

      {/* Page Header */}
      <header className="mb-10 border-b border-slate-800 pb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2.5 w-2.5 rounded-full bg-violet-500 animate-pulse"></span>
            <span className="text-xs uppercase tracking-wider text-violet-400 font-semibold font-mono">Consensus Panel</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            AI Consensus Engine
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Multi-agent consensus dashboard displaying dynamic weights, node reputation metrics, and veto logs.
          </p>
        </div>
      </header>

      {/* Main Content Grid */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Left Column: Reputation Gauges & Dynamic Weights */}
        <div className="xl:col-span-2 space-y-8">
          
          {/* Agent Reputation List */}
          <div className="rounded-xl border border-slate-800 bg-[#121620]/40 p-6 backdrop-blur-md">
            <h2 className="text-lg font-bold text-white tracking-tight mb-6">Agent Reputation & Voting Weights</h2>
            
            <div className="space-y-6">
              {reputations.map((r) => (
                <div key={r.agent} className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-300 font-bold">{r.agent}</span>
                    <div className="flex gap-4">
                      <span>Reputation: <strong className="text-white">{(r.rep * 100).toFixed(0)}%</strong></span>
                      <span>Weight: <strong className="text-violet-400">{(r.weight * 100).toFixed(0)}%</strong></span>
                    </div>
                  </div>
                  
                  {/* Dynamic Progress indicator bar */}
                  <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800/80">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${r.color}`}
                      style={{ width: `${r.rep * 100}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Historical Consensus list table */}
          <div className="rounded-xl border border-slate-800 bg-[#121620]/40 p-6 backdrop-blur-md">
            <h2 className="text-lg font-bold text-white tracking-tight mb-6">Consensus Evaluation Logs</h2>
            
            <div className="w-full overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 uppercase tracking-wider">
                    <th className="pb-3 font-semibold">Tx Ref</th>
                    <th className="pb-3 font-semibold">Verdict</th>
                    <th className="pb-3 font-semibold">Consensus Score</th>
                    <th className="pb-3 font-semibold">Audit checks</th>
                    <th className="pb-3 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {history.map((h) => (
                    <tr
                      key={h.id}
                      onClick={() => setSelectedAudit(h)}
                      className={`hover:bg-slate-900/40 cursor-pointer transition-colors duration-200 ${
                        selectedAudit?.id === h.id ? "bg-slate-900/50" : ""
                      }`}
                    >
                      <td className="py-4 font-bold text-white">{h.tx_ref}</td>
                      <td className="py-4">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                          h.verdict === "approve" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        }`}>
                          {h.verdict.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-4 text-slate-300">{(h.score * 100).toFixed(2)}%</td>
                      <td className="py-4">
                        {h.override ? (
                          <span className="inline-flex px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Veto Override
                          </span>
                        ) : (
                          <span className="text-slate-500">Standard Run</span>
                        )}
                      </td>
                      <td className="py-4 text-slate-500">{h.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Right Column: Conflict & Disagreement Diagnostics */}
        <div className="rounded-xl border border-slate-800 bg-[#121620]/40 p-6 backdrop-blur-md flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight mb-4">Conflict Resolution Panel</h2>
            
            {selectedAudit ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-xs text-slate-400 font-mono">Consensus Reference</span>
                  <span className="text-xs font-mono text-violet-400 font-semibold">{selectedAudit.id.toUpperCase()}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Weighted Agreement</span>
                  <span className="text-lg font-bold font-mono text-slate-200">
                    {(selectedAudit.score * 100).toFixed(2)}%
                  </span>
                </div>

                {/* Disagreement analysis */}
                <div>
                  <span className="text-xs text-slate-400 font-mono block mb-2">Disagreement Analysis</span>
                  {selectedAudit.disagreed.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedAudit.disagreed.map((agent: string) => (
                        <span key={agent} className="inline-flex px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          {agent} Diverged
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-emerald-400 font-mono">100% Agent Unanimity resolved.</p>
                  )}
                </div>

                {/* Overrides audit */}
                <div className="mt-4 p-3 bg-slate-900/60 rounded border border-slate-800 text-xs">
                  <span className="text-slate-300 font-bold block mb-1">Consensus Resolution Note</span>
                  {selectedAudit.override ? (
                    <span className="text-amber-400/90 font-mono">
                      VETO override: Regulatory compliance block detected. Decline verdict forced regardless of weighted sums.
                    </span>
                  ) : (
                    <span className="text-slate-400 font-mono">
                      No validation overrides occurred. Resolves standard weighted sum equations successfully.
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-slate-500">
                <p className="text-3xl mb-3">⚖️</p>
                <p className="text-xs">No audit selected.</p>
                <p className="text-xs mt-1">Select any item from the consensus table to inspect dynamic voting parameters.</p>
              </div>
            )}
          </div>

          <div className="border-t border-slate-800 pt-4 mt-6">
            <span className="text-[10px] text-slate-500 font-mono block">AegisAI OS Consensus Ledger</span>
            <span className="text-[10px] text-slate-500 font-mono block">Formula: Dynamic weighted voting v1.0.0</span>
          </div>
        </div>

      </section>
    </div>
  );
}