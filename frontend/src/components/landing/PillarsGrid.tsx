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
    link: "/trust-dashboard",
    badge: "Active telemetry",
  },
  {
    icon: Scale,
    title: "Deterministic Policy Engine",
    description: "Hard boundary constraints enforcing RBI Circular G-20, AML thresholds, velocity caps, and dual-signer rules.",
    link: "/policy-dashboard",
    badge: "Rule engine",
  },
  {
    icon: UserCheck,
    title: "Human-in-the-Loop Override",
    description: "Seamless case escalation queue for compliance officers to review, approve, or reject high-value AI transactions.",
    link: "/reviews",
    badge: "Tier 1 / 2 review",
  },
  {
    icon: Network,
    title: "Multi-Agent Consensus",
    description: "Byzantine fault-tolerant voting architecture requiring cross-verification among isolated guardrail sub-agents.",
    link: "/consensus-dashboard",
    badge: "Byzantine BFT",
  },
  {
    icon: FileText,
    title: "SHAP & WORM Audit Trail",
    description: "Cryptographically signed Write-Once-Read-Many (WORM) audit ledgers paired with SHAP feature attributions.",
    link: "/explainability",
    badge: "Immutable logs",
  },
  {
    icon: ZapOff,
    title: "Chaos & Self-Healing",
    description: "Fault injection studio and automated fallback routing to ensure resilience against agent hallucinations or model degradation.",
    link: "/chaos-dashboard",
    badge: "Fault injection",
  },
];

export function PillarsGrid() {
  return (
    <section id="pillars" className="py-20 md:py-28 relative border-t border-white/[0.08] bg-[#0A0A0B]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-400 mb-4">
            Platform pillars
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-[-0.02em] mb-4 font-sans">
            Governance infrastructure, end to end
          </h2>
          <p className="text-[15px] text-zinc-400 leading-relaxed font-sans font-normal">
            Designed specifically for regulated financial institutions deploying autonomous AI agents into production.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PILLARS.map((pillar, idx) => {
            const Icon = pillar.icon;
            return (
              <Link
                key={idx}
                href={pillar.link}
                className="group p-6 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/20 transition-colors duration-150 flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-5">
                    <div className="h-9 w-9 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-center text-zinc-200">
                      <Icon size={18} />
                    </div>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border border-white/10 bg-white/[0.03] text-zinc-500">
                      {pillar.badge}
                    </span>
                  </div>

                  <h3 className="text-[15px] font-semibold text-white mb-1.5 group-hover:text-white transition-colors font-sans tracking-[-0.01em]">
                    {pillar.title}
                  </h3>
                  <p className="text-[13px] text-zinc-400 leading-relaxed font-sans mb-6">
                    {pillar.description}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 font-sans text-[13px] font-medium text-zinc-500 group-hover:text-zinc-100 transition-colors pt-4 border-t border-white/[0.08]">
                  <span>Explore module</span>
                  <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
