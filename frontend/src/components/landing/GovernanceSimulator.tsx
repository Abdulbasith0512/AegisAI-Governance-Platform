"use client";

import React, { useState } from "react";
import { 
  Play, ShieldAlert, ShieldCheck, AlertTriangle, 
  Sliders, RefreshCw, BarChart2, Lock, Terminal
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
      verdictColor = "text-amber-400 border-amber-500/40";
      verdictBg = "bg-amber-950/40";
      verdictText = "ESCALATED TO HUMAN REVIEW";
    } else {
      verdict = "BLOCKED";
      verdictColor = "text-rose-400 border-rose-500/40";
      verdictBg = "bg-rose-950/40";
      verdictText = "BLOCKED BY HARD POLICY";
    }
  } else if (effectiveTrustScore < 75) {
    verdict = "ESCALATED";
    verdictColor = "text-amber-400 border-amber-500/40";
    verdictBg = "bg-amber-950/40";
    verdictText = "ESCALATED TO HUMAN REVIEW";
  } else {
    verdict = "APPROVED";
    verdictColor = "text-emerald-400 border-emerald-500/40";
    verdictBg = "bg-emerald-950/40";
    verdictText = "APPROVED & LEDGERED";
  }

  const handleSimulate = () => {
    setIsSimulating(true);
    setTimeout(() => {
      setIsSimulating(false);
      setSimRunCount((prev) => prev + 1);
    }, 600);
  };

  return (
    <section id="simulator" className="py-16 md:py-24 relative border-t border-slate-800/80 bg-[#07090d]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[11px] uppercase tracking-wider mb-4">
            <Sliders size={13} />
            <span>Interactive Governance Sandbox</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4 font-sans">
            Test Real-Time AI Agent Policy Evaluation
          </h2>
          <p className="text-sm sm:text-base text-slate-400 leading-relaxed font-sans font-normal">
            Select a banking agent transaction scenario, adjust risk sensitivity, and watch AegisAI calculate weighted trust scores, execute SHAP attributions, and enforce regulatory compliance in real time.
          </p>
        </div>

        {/* Simulator Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Panel */}
          <div className="lg:col-span-5 space-y-6 rounded-xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur-md">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-3 font-sans">
                1. Select Banking Agent Scenario
              </label>
              <div className="space-y-2.5">
                {SCENARIOS.map((scenario) => {
                  const isSelected = scenario.id === selectedScenario.id;
                  return (
                    <button
                      key={scenario.id}
                      onClick={() => setSelectedScenario(scenario)}
                      className={`w-full text-left p-3.5 rounded border transition-all duration-200 ${
                        isSelected
                          ? "bg-slate-800 border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                          : "bg-slate-950/50 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60"
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-xs font-bold font-sans ${isSelected ? "text-emerald-400" : "text-white"}`}>
                          {scenario.name}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-400">
                          ${scenario.amount.toLocaleString()}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed font-sans">
                        {scenario.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Controls */}
            <div className="pt-4 border-t border-slate-800 space-y-4">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 font-sans">
                2. Adjust Governance Parameters
              </label>

              {/* Slider */}
              <div>
                <div className="flex justify-between text-xs font-sans mb-2">
                  <span className="text-slate-400">Risk Sensitivity Threshold</span>
                  <span className="text-emerald-400 font-bold font-mono">{riskSensitivity}%</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="100"
                  value={riskSensitivity}
                  onChange={(e) => setRiskSensitivity(Number(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>

              {/* Toggle Switch */}
              <div className="flex items-center justify-between p-3 rounded bg-slate-950/60 border border-slate-800 font-sans text-xs">
                <div className="flex items-center gap-2 text-slate-300">
                  <Lock size={14} className="text-amber-400" />
                  <span>Dual-Signer Enforcement Policy</span>
                </div>
                <button
                  onClick={() => setDualSignerRequired(!dualSignerRequired)}
                  className={`w-11 h-6 rounded-full transition-colors p-1 ${
                    dualSignerRequired ? "bg-emerald-500" : "bg-slate-700"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-slate-950 transition-transform ${
                      dualSignerRequired ? "translate-x-5" : "translate-x-0"
                    }`}
                  ></div>
                </button>
              </div>

              {/* Execute Button */}
              <button
                onClick={handleSimulate}
                disabled={isSimulating}
                className="w-full flex items-center justify-center gap-2 py-3 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs uppercase tracking-wider transition-all duration-200 shadow-[0_2px_10px_rgba(16,185,129,0.2)]"
              >
                {isSimulating ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Evaluating Guardrails...</span>
                  </>
                ) : (
                  <>
                    <Play size={14} className="fill-slate-950" />
                    <span>Re-Run Policy Evaluation</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Panel */}
          <div className="lg:col-span-7 rounded-xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur-md">
            {/* Verdict Header Banner */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-800">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-1">
                  Agent Evaluation Outcome (Run #{simRunCount})
                </div>
                <div className="text-sm font-sans text-slate-200 font-semibold">
                  {selectedScenario.agent}
                </div>
              </div>

              <div className={`px-3.5 py-1.5 rounded border font-mono text-xs font-bold flex items-center gap-2 ${verdictColor} ${verdictBg}`}>
                {verdict === "BLOCKED" && <ShieldAlert size={16} />}
                {verdict === "ESCALATED" && <AlertTriangle size={16} />}
                {verdict === "APPROVED" && <ShieldCheck size={16} />}
                <span>{verdictText}</span>
              </div>
            </div>

            {/* Metrics Row */}
            <div className="grid grid-cols-3 gap-4 my-6">
              <div className="p-4 rounded bg-slate-950/60 border border-slate-800/80 text-center">
                <div className="text-[10px] font-mono uppercase text-slate-500 mb-1">Trust Score</div>
                <div className={`text-2xl font-mono font-black ${effectiveTrustScore < 50 ? "text-rose-400" : effectiveTrustScore < 75 ? "text-amber-400" : "text-emerald-400"}`}>
                  {effectiveTrustScore} / 100
                </div>
              </div>

              <div className="p-4 rounded bg-slate-950/60 border border-slate-800/80 text-center">
                <div className="text-[10px] font-mono uppercase text-slate-500 mb-1">Anomaly Index</div>
                <div className="text-2xl font-mono font-black text-slate-200">
                  {(selectedScenario.anomalyScore * 100).toFixed(0)}%
                </div>
              </div>

              <div className="p-4 rounded bg-slate-950/60 border border-slate-800/80 text-center">
                <div className="text-[10px] font-mono uppercase text-slate-500 mb-1">Policy Rules</div>
                <div className="text-2xl font-mono font-black text-indigo-400">
                  4 Passed / 1 Triggered
                </div>
              </div>
            </div>

            {/* SHAP Chart */}
            <div>
              <div className="flex justify-between items-center mb-3 font-sans">
                <span className="text-xs uppercase font-semibold tracking-wider text-slate-300 flex items-center gap-1.5">
                  <BarChart2 size={14} className="text-emerald-400" />
                  <span>SHAP Feature Attribution & Risk Drivers</span>
                </span>
                <span className="text-[10px] font-mono text-slate-500">EXPLAINABLE AI SUB-ENGINE</span>
              </div>

              <div className="space-y-2.5">
                {selectedScenario.shapFeatures.map((feat, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-[11px] font-sans">
                      <span className="text-slate-300 font-medium">{feat.name}</span>
                      <span className={`font-mono ${feat.isNegative ? "text-rose-400" : "text-emerald-400"}`}>
                        {feat.impact > 0 ? `+${feat.impact}` : feat.impact} SHAP
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-950 rounded overflow-hidden flex">
                      <div
                        className={`h-full rounded transition-all duration-500 ${
                          feat.isNegative ? "bg-rose-500" : "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.abs(feat.impact)}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* WORM Audit */}
            <div className="mt-6 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <Terminal size={13} className="text-emerald-400" />
                <span>WORM HASH: 0x8f9c7a2e...b9102c</span>
              </span>
              <span className="text-emerald-400">RBI CIRCULAR G-20 COMPLIANT LOG</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
