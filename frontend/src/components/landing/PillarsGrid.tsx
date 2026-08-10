"use client";

import React from "react";
import { 
  ShieldCheck, Scale, UserCheck, Network, FileText, ZapOff, ArrowRight 
} from "lucide-react";
import Link from "next/link";

const PILLARS = [
  {
    icon: ShieldCheck,
    title: "Real-Time Trust Scoring",
    description: "Dynamic telemetry engine calculating weighted trust metrics, anomaly indices, and drift scores before settlement.",
    accent: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    link: "/trust-dashboard",
    badge: "Active Telemetry",
  },
  {
    icon: Scale,
    title: "Deterministic Policy Engine",
    description: "Hard boundary constraints enforcing RBI Circular G-20, AML thresholds, velocity caps, and dual-signer rules.",
    accent: "text-indigo-400 bg-indigo-500/10 border-indigo-500/30",
    link: "/policy-dashboard",
    badge: "Rule Engine",
  },
  {
    icon: UserCheck,
    title: "Human-in-the-Loop Override",
    description: "Seamless case escalation queue for compliance officers to review, approve, or reject high-value AI transactions.",
    accent: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    link: "/reviews",
    badge: "Tier 1/2 Review",
  },
  {
    icon: Network,
    title: "Multi-Agent Consensus",
    description: "Byzantine fault-tolerant voting architecture requiring cross-verification among isolated guardrail sub-agents.",
    accent: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
    link: "/consensus-dashboard",
    badge: "Byzantine BFT",
  },
  {
    icon: FileText,
    title: "SHAP & WORM Audit Trail",
    description: "Cryptographically signed Write-Once-Read-Many (WORM) audit ledgers paired with SHAP feature attributions.",
    accent: "text-purple-400 bg-purple-500/10 border-purple-500/30",
    link: "/explainability",
    badge: "Immutable Logs",
  },
  {
    icon: ZapOff,
    title: "Chaos & Self-Healing",
    description: "Fault injection studio and automated fallback routing to ensure resilience against agent hallucinations or model degradation.",
    accent: "text-rose-400 bg-rose-500/10 border-rose-500/30",
    link: "/chaos-dashboard",
    badge: "Fault Injection",
  },
];

export function PillarsGrid() {
  return (
    <section id="pillars" className="py-20 md:py-28 relative bg-[#090b10]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 font-mono text-[11px] uppercase tracking-wider mb-4">
            <span>Six Core Pillars</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4 font-sans">
            Comprehensive AI Governance Infrastructure
          </h2>
          <p className="text-sm sm:text-base text-slate-400 leading-relaxed font-sans font-normal">
            Designed specifically for regulated financial institutions deploying autonomous AI agents into production.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {PILLARS.map((pillar, idx) => {
            const Icon = pillar.icon;
            return (
              <Link
                key={idx}
                href={pillar.link}
                className="group p-6 rounded-xl border border-slate-800/90 bg-slate-900/30 hover:bg-slate-900/70 hover:border-slate-700 transition-all duration-300 flex flex-col justify-between backdrop-blur-md"
              >
                <div>
                  <div className="flex justify-between items-start mb-5">
                    <div className={`h-10 w-10 rounded-lg border flex items-center justify-center transition-all duration-300 ${pillar.accent}`}>
                      <Icon size={20} />
                    </div>
                    <span className="text-[10px] font-mono uppercase tracking-widest px-2.5 py-0.5 rounded border border-slate-800 bg-slate-950 text-slate-400">
                      {pillar.badge}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors font-sans">
                    {pillar.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-sans mb-6">
                    {pillar.description}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 font-sans text-xs font-medium text-slate-400 group-hover:text-emerald-400 transition-colors pt-4 border-t border-slate-800/80">
                  <span>Explore Console Module</span>
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
