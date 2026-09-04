"use client";

import React, { useState } from "react";
import {
  Play, ShieldAlert, ShieldCheck, AlertTriangle,
  RefreshCw, BarChart2, Lock, Terminal
} from "lucide-react";

interface Scenario {
  id: string;
  name: string;
  agent: string;
  description: string;
  amount: number;
  baseTrust: number;
  anomalyScore: number;
  shapFeatures: { name: string; impact: number; isNegative: boolean }[];
}

const SCENARIOS: Scenario[] = [
  {
    id: "wire",
    name: "Offshore Wire Transfer ($500k)",
    agent: "Agent #402 (Liquidity Rebalancer)",
    description: "Autonomous initiation of $500,000 cross-border settlement to unverified counterparty ledger.",
    amount: 500000,
    baseTrust: 42,
    anomalyScore: 0.88,
    shapFeatures: [
      { name: "Counterparty Longevity", impact: -42, isNegative: true },
      { name: "Transaction Size", impact: -35, isNegative: true },
      { name: "Historical Frequency", impact: +12, isNegative: false },
      { name: "Time of Initiation", impact: +5, isNegative: false },
    ],
  },
  {
    id: "microloan",
    name: "Micro-Loan Approval Spike",
    agent: "Agent #109 (Retail Underwriter)",
    description: "Burst execution of 48 automated micro-loans within 4 seconds during market volatility window.",
    amount: 72000,
    baseTrust: 64,
    anomalyScore: 0.72,
    shapFeatures: [
      { name: "Velocity Burst Multiplier", impact: -38, isNegative: true },
      { name: "Debt-to-Income Variance", impact: -18, isNegative: true },
      { name: "Credit Score Verification", impact: +20, isNegative: false },
      { name: "Collateral Ratio", impact: +14, isNegative: false },
    ],
  },
  {
    id: "drift",
    name: "Credit Model Drift Anomaly",
    agent: "Agent #882 (Risk Classifier)",
    description: "Real-time SHAP feature drift detected in underwriting model; baseline accuracy degraded.",
    amount: 150000,
    baseTrust: 51,
    anomalyScore: 0.65,
    shapFeatures: [
      { name: "Feature Drift Index", impact: -45, isNegative: true },
      { name: "Distribution Shift", impact: -22, isNegative: true },
      { name: "Historical Calibration", impact: +18, isNegative: false },
      { name: "Agent Identity Signature", impact: +10, isNegative: false },
    ],
  },
];

export function GovernanceSimulator() {
  const [selectedScenario, setSelectedScenario] = useState<Scenario>(SCENARIOS[0]);
  const [riskSensitivity, setRiskSensitivity] = useState<number>(75);
  const [dualSignerRequired, setDualSignerRequired] = useState<boolean>(true);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simRunCount, setSimRunCount] = useState<number>(1);

  const effectiveTrustScore = Math.max(
    10,
    Math.min(99, Math.round(selectedScenario.baseTrust * (100 / Math.max(50, riskSensitivity))))
  );

  let verdict: "BLOCKED" | "ESCALATED" | "APPROVED";
  let verdictColor: string;
  let verdictBg: string;
  let verdictText: string;

  if (effectiveTrustScore < 50 || selectedScenario.anomalyScore > 0.8) {
    if (dualSignerRequired) {
      verdict = "ESCALATED";
      verdictColor = "text-amber-300";
      verdictBg = "bg-amber-500/10 border-white/10";
      verdictText = "Escalated to human review";
    } else {
      verdict = "BLOCKED";
      verdictColor = "text-red-300";
      verdictBg = "bg-red-500/10 border-white/10";
      verdictText = "Blocked by hard policy";
    }
  } else if (effectiveTrustScore < 75) {
    verdict = "ESCALATED";
    verdictColor = "text-amber-300";
    verdictBg = "bg-amber-500/10 border-white/10";
    verdictText = "Escalated to human review";
  } else {
    verdict = "APPROVED";
    verdictColor = "text-emerald-300";
    verdictBg = "bg-emerald-500/10 border-white/10";
    verdictText = "Approved and ledgered";
  }

  const handleSimulate = () => {
    setIsSimulating(true);
    setTimeout(() => {
      setIsSimulating(false);
      setSimRunCount((prev) => prev + 1);
    }, 600);
  };

  return (
    <section id="simulator" className="py-16 md:py-24 relative border-t border-white/[0.08] bg-[#0A0A0B]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-400 mb-4">
            Interactive sandbox
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-[-0.02em] mb-4 font-sans">
            Test policy evaluation in real time
          </h2>
          <p className="text-[15px] text-zinc-400 leading-relaxed font-sans font-normal">
            Select a banking agent scenario, adjust risk sensitivity, and watch AegisAI calculate weighted trust scores, execute SHAP attributions, and enforce compliance in real time.
          </p>
        </div>

        {/* Simulator Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Panel */}
          <div className="lg:col-span-5 space-y-6 rounded-xl border border-white/10 bg-white/[0.02] p-6">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400 mb-3 font-sans">
                1 · Select scenario
              </label>
              <div className="space-y-2">
                {SCENARIOS.map((scenario) => {
                  const isSelected = scenario.id === selectedScenario.id;
                  return (
                    <button
                      key={scenario.id}
                      onClick={() => setSelectedScenario(scenario)}
                      className={`w-full text-left p-4 rounded-lg border transition-colors duration-150 ${
                        isSelected
                          ? "bg-white/[0.05] border-white/20"
                          : "bg-transparent border-white/[0.08] hover:border-white/20 hover:bg-white/[0.03]"
                      }`}
                      style={isSelected ? { boxShadow: "inset 2px 0 0 #10B981" } : undefined}
                    >
                      <div className="flex justify-between items-center mb-1 gap-3">
                        <span className="text-[13px] font-semibold font-sans text-white">
                          {scenario.name}
                        </span>
                        <span className="text-[11px] tabular-nums px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/10 text-zinc-400 font-sans shrink-0">
                          ${scenario.amount.toLocaleString('en-US')}
                        </span>
                      </div>
                      <p className="text-[13px] text-zinc-400 line-clamp-2 leading-relaxed font-sans">
                        {scenario.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Controls */}
            <div className="pt-5 border-t border-white/[0.08] space-y-4">
              <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400 font-sans">
                2 · Adjust parameters
              </label>

              {/* Slider */}
              <div>
                <div className="flex justify-between text-[13px] font-sans mb-2">
                  <span className="text-zinc-400">Risk sensitivity</span>
                  <span className="text-white font-semibold tabular-nums">{riskSensitivity}%</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="100"
                  value={riskSensitivity}
                  onChange={(e) => setRiskSensitivity(Number(e.target.value))}
                  className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-white"
                />
              </div>

              {/* Toggle Switch */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/[0.08] font-sans text-[13px]">
                <div className="flex items-center gap-2 text-zinc-300">
                  <Lock size={14} className="text-zinc-500" />
                  <span>Dual-signer enforcement</span>
                </div>
                <button
                  onClick={() => setDualSignerRequired(!dualSignerRequired)}
                  aria-pressed={dualSignerRequired}
                  className={`w-10 h-[22px] rounded-full transition-colors p-[3px] ${
                    dualSignerRequired ? "bg-emerald-500" : "bg-white/15"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      dualSignerRequired ? "translate-x-[18px]" : "translate-x-0"
                    }`}
                  ></div>
                </button>
              </div>

              {/* Execute Button */}
              <button
                onClick={handleSimulate}
                disabled={isSimulating}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-white hover:bg-zinc-200 disabled:opacity-60 text-zinc-950 font-semibold text-sm transition-colors duration-150"
              >
                {isSimulating ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Evaluating guardrails…</span>
                  </>
                ) : (
                  <>
                    <Play size={14} />
                    <span>Run policy evaluation</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Panel */}
          <div className="lg:col-span-7 rounded-xl border border-white/10 bg-white/[0.02] p-6">
            {/* Verdict Header Banner */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-white/[0.08]">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500 mb-1">
                  Evaluation outcome · Run #{simRunCount}
                </div>
                <div className="text-sm font-sans text-zinc-100 font-semibold">
                  {selectedScenario.agent}
                </div>
              </div>

              <div className={`px-3 py-1.5 rounded-full border text-[13px] font-semibold flex items-center gap-2 ${verdictColor} ${verdictBg}`}>
                {verdict === "BLOCKED" && <ShieldAlert size={15} />}
                {verdict === "ESCALATED" && <AlertTriangle size={15} />}
                {verdict === "APPROVED" && <ShieldCheck size={15} />}
                <span>{verdictText}</span>
              </div>
            </div>

            {/* Metrics Row */}
            <div className="grid grid-cols-3 gap-3 my-5">
              <div className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.08] text-center">
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500 mb-1.5">Trust score</div>
                <div className={`text-[26px] font-bold tabular-nums leading-none ${effectiveTrustScore < 50 ? "text-red-300" : effectiveTrustScore < 75 ? "text-amber-300" : "text-emerald-300"}`}>
                  {effectiveTrustScore}
                  <span className="text-sm font-medium text-zinc-500"> / 100</span>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.08] text-center">
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500 mb-1.5">Anomaly index</div>
                <div className="text-[26px] font-bold tabular-nums leading-none text-white">
                  {(selectedScenario.anomalyScore * 100).toFixed(0)}
                  <span className="text-sm font-medium text-zinc-500">%</span>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.08] text-center">
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500 mb-1.5">Policy rules</div>
                <div className="text-[26px] font-bold tabular-nums leading-none text-white">
                  4<span className="text-sm font-medium text-zinc-500"> passed · </span>1<span className="text-sm font-medium text-zinc-500"> flagged</span>
                </div>
              </div>
            </div>

            {/* SHAP Chart */}
            <div>
              <div className="flex justify-between items-center mb-3 font-sans">
                <span className="text-[11px] uppercase font-semibold tracking-[0.12em] text-zinc-400 flex items-center gap-1.5">
                  <BarChart2 size={14} className="text-zinc-500" />
                  <span>SHAP attribution</span>
                </span>
                <span className="text-[10px] uppercase tracking-[0.12em] text-zinc-600">Explainability engine</span>
              </div>

              <div className="space-y-2.5">
                {selectedScenario.shapFeatures.map((feat, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-[13px] font-sans">
                      <span className="text-zinc-300 font-medium">{feat.name}</span>
                      <span className={`tabular-nums font-semibold ${feat.isNegative ? "text-red-300" : "text-emerald-300"}`}>
                        {feat.impact > 0 ? `+${feat.impact}` : feat.impact}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden flex">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          feat.isNegative ? "bg-red-400" : "bg-emerald-400"
                        }`}
                        style={{ width: `${Math.abs(feat.impact)}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* WORM Audit */}
            <div className="mt-6 pt-4 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
              <span className="flex items-center gap-1.5">
                <Terminal size={13} className="text-zinc-500" />
                <span className="font-mono">WORM hash 0x8f9c…b9102c</span>
              </span>
              <span>RBI Circular G-20 compliant log</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
