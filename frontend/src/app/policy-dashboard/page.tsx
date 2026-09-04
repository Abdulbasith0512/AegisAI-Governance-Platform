"use client";

import React, { useState } from "react";

// Pre-seeded compliance rules history to display when backend isn't actively running
const SIMULATED_POLICIES = [
  {
    id: "POL-RBI-101",
    type: "RBI",
    version: "1.0.0",
    name: "Foreign Outward Remittance Limit",
    description: "Limits foreign currency transfer transactions under Liberalised Remittance Scheme rules without specific tax checks.",
    rules: [
      { field: "currency", operator: "equals", value: "USD" },
      { field: "amount", operator: "less_than_or_equal", value: 10000.00 }
    ]
  },
  {
    id: "POL-AML-202",
    type: "AML",
    version: "1.0.0",
    name: "Structuring Protection",
    description: "Flags transactions that fall immediately below reporting thresholds (smurfing limits).",
    rules: [
      { field: "amount", operator: "not_between", value: [4500.00, 4999.99] }
    ]
  },
  {
    id: "POL-KYC-303",
    type: "KYC",
    version: "1.0.0",
    name: "Active Account Enforcements",
    description: "Enforces active and fully verified customer verification profiles.",
    rules: [
      { field: "account.status", operator: "equals", value: "active" }
    ]
  },
  {
    id: "POL-GOV-404",
    type: "AI_GOVERNANCE",
    version: "1.0.0",
    name: "AI Decision Trust Score Baseline",
    description: "Ensures AI supervisor recommendations match safety confidence indexes.",
    rules: [
      { field: "trust_score", operator: "greater_than_or_equal", value: 75 }
    ]
  }
];

const SIMULATED_VIOLATIONS = [
  { id: "v-1", tx_ref: "TX-99883", rule_id: "POL-GOV-404", status: "fail", date: "Jul 15, 14:32", details: "trust_score (72) less than expected (75)" },
  { id: "v-2", tx_ref: "TX-99884", rule_id: "POL-RBI-101", status: "fail", date: "Jul 15, 14:35", details: "currency (EUR) not equal to expected (USD)" },
  { id: "v-3", tx_ref: "TX-99801", rule_id: "POL-AML-202", status: "fail", date: "Jul 14, 11:20", details: "amount (4800.0) is between structured smurfing limits" }
];

interface SimulationPolicyResult {
  id: string;
  name: string;
  status: string;
  details: string;
}

interface SimulationResult {
  overall_status: string;
  policies_checked: SimulationPolicyResult[];
}

export default function PolicyDashboard() {
  const [activePolicies] = useState(SIMULATED_POLICIES);
  const [violations] = useState(SIMULATED_VIOLATIONS);
  
  // Simulator states
  const [simTxAmount, setSimTxAmount] = useState("250.00");
  const [simTxCurrency, setSimTxCurrency] = useState("USD");
  const [simTxStatus, setSimTxStatus] = useState("active");
  const [simTrustScore, setSimTrustScore] = useState("90");
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);

  const handleSimulate = (e: React.FormEvent) => {
    e.preventDefault();
    
    const amt = parseFloat(simTxAmount);
    const score = parseInt(simTrustScore);
    
    // Run simple client-side emulation of the YAML rules
    const results = [
      {
        id: "POL-RBI-101",
        name: "Foreign Outward Remittance Limit",
        status: (simTxCurrency === "USD" && amt <= 10000.0) ? "pass" : "fail",
        details: `currency: ${simTxCurrency} (expected USD), amount: ${amt} (expected <= 10000.0)`
      },
      {
        id: "POL-AML-202",
        name: "Structuring Protection",
        status: (amt < 4500.0 || amt > 4999.99) ? "pass" : "fail",
        details: `amount: ${amt} (expected not between 4500 and 5000)`
      },
      {
        id: "POL-KYC-303",
        name: "Active Account Enforcements",
        status: (simTxStatus === "active") ? "pass" : "fail",
        details: `account.status: ${simTxStatus} (expected active)`
      },
      {
        id: "POL-GOV-404",
        name: "AI Decision Trust Score Baseline",
        status: (score >= 75) ? "pass" : "fail",
        details: `trust_score: ${score} (expected >= 75)`
      }
    ];

    const overallPass = results.every(r => r.status === "pass") ? "pass" : "fail";
    setSimulationResult({ overall_status: overallPass, policies_checked: results });
  };

  return (
    <div className="min-h-screen bg-[#0d0f14] text-[#e2e8f0] font-sans antialiased p-6 md:p-12 selection:bg-emerald-500 selection:text-white">
      {/* Background glow effects */}
      <div className="absolute top-0 right-1/4 h-[350px] w-[350px] rounded-full bg-emerald-500/5 blur-3xl"></div>
      
      {/* Page Header */}
      <header className="mb-10 border-b border-slate-800 pb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs uppercase tracking-wider text-emerald-400 font-semibold font-mono">Compliance Console</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            Compliance Policy Engine
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Deterministic rules parser enforcing Reserve Bank guidelines, AML vectors, and model drift boundaries.
          </p>
        </div>
      </header>

      {/* Grid Layout */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Left Column: Active Policies YAML rules list */}
        <div className="xl:col-span-2 space-y-6">
          <h2 className="text-lg font-bold text-white tracking-tight">Active Rules Configuration</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {activePolicies.map((p) => (
              <div key={p.id} className="rounded-xl border border-slate-800 bg-[#121620]/40 p-6 backdrop-blur-md hover:border-emerald-500/60 transition-all duration-300 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-mono font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                      {p.type}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">v{p.version}</span>
                  </div>
                  <h3 className="text-md font-bold text-white mb-2">{p.name}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed mb-4">{p.description}</p>
                </div>
                
                <div className="border-t border-slate-800/80 pt-3">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-2 font-mono">YAML Rules</span>
                  {p.rules.map((rule, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs font-mono mb-1">
                      <span className="text-slate-500">{rule.field}</span>
                      <span className="text-slate-300">
                        {rule.operator.replace(/_/g, " ")}: {JSON.stringify(rule.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Simulator & Violations Logs */}
        <div className="space-y-8">
          
          {/* Simulation Tool Panel */}
          <div className="rounded-xl border border-slate-800 bg-[#121620]/40 p-6 backdrop-blur-md">
            <h2 className="text-lg font-bold text-white tracking-tight mb-4">Transaction Policy Simulator</h2>
            
            <form onSubmit={handleSimulate} className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1 font-mono">Amount (USD)</label>
                <input
                  type="number"
                  value={simTxAmount}
                  onChange={(e) => setSimTxAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1 font-mono">Currency</label>
                <select
                  value={simTxCurrency}
                  onChange={(e) => setSimTxCurrency(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                >
                  <option value="USD">USD - US Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="GBP">GBP - Pound Sterling</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1 font-mono">Account Status</label>
                <select
                  value={simTxStatus}
                  onChange={(e) => setSimTxStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1 font-mono">AI Trust Score (0-100)</label>
                <input
                  type="number"
                  value={simTrustScore}
                  onChange={(e) => setSimTrustScore(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-white text-sm font-semibold text-zinc-950 hover:bg-zinc-200 transition-colors duration-150"
              >
                Run Compliance Check
              </button>
            </form>

            {/* Simulation outcome rendering */}
            {simulationResult && (
              <div className="mt-6 border-t border-slate-800/80 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Simulation Status:</span>
                  <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                    simulationResult.overall_status === "pass" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                  }`}>
                    {simulationResult.overall_status.toUpperCase()}
                  </span>
                </div>
                
                <div className="space-y-2">
                  {simulationResult.policies_checked.map((res: SimulationPolicyResult) => (
                    <div key={res.id} className="p-2.5 rounded bg-slate-900/60 border border-slate-800 text-[11px] leading-relaxed">
                      <div className="flex items-center justify-between mb-1 font-mono font-bold">
                        <span className="text-slate-300">{res.id}</span>
                        <span className={res.status === "pass" ? "text-emerald-400" : "text-rose-400"}>
                          {res.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-slate-500 text-[10px] font-mono">{res.details}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Violations Stream logs */}
          <div className="rounded-xl border border-slate-800 bg-[#121620]/40 p-6 backdrop-blur-md">
            <h2 className="text-lg font-bold text-white tracking-tight mb-4">Rule Violation Audit</h2>
            
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
              {violations.map((v) => (
                <div key={v.id} className="p-3 bg-slate-950/40 rounded border border-slate-800 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-white font-mono">{v.tx_ref}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{v.date}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="inline-flex px-1.5 py-0.2 rounded text-[9px] font-bold font-mono bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      {v.rule_id}
                    </span>
                    <span className="text-[10px] text-rose-400/90 font-mono">failed</span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-mono leading-relaxed">{v.details}</p>
                </div>
              ))}
            </div>
          </div>

        </div>

      </section>
    </div>
  );
}
