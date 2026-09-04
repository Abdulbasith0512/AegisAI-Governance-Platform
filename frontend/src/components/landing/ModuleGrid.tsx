"use client";

import React from "react";
import Link from "next/link";
import { 
  Activity, ShieldCheck, UserCheck, Scale, Network, MessageSquareCode, 
  Search, HeartPulse, Terminal, ZapOff, ArrowRight, LayoutDashboard 
} from "lucide-react";

const MODULES = [
  {
    name: "Executive Console",
    path: "/dashboard",
    icon: LayoutDashboard,
    desc: "High-level platform KPI overview, transaction volume charts, and alert streams.",
    category: "Control Plane",
  },
  {
    name: "Trust Score Telemetry",
    path: "/trust-dashboard",
    icon: ShieldCheck,
    desc: "Real-time weighted trust scoring, drift indicators, and sub-score metrics.",
    category: "Risk Telemetry",
  },
  {
    name: "Human Review Center",
    path: "/reviews",
    icon: UserCheck,
    desc: "Queue of escalated agent actions requiring compliance officer sign-off.",
    category: "Governance",
  },
  {
    name: "Policy & Rule Engine",
    path: "/policy-dashboard",
    icon: Scale,
    desc: "Configure hard financial boundaries, velocity caps, and AML threshold parameters.",
    category: "Rule Engine",
  },
  {
    name: "Consensus Dashboard",
    path: "/consensus-dashboard",
    icon: Network,
    desc: "Monitor multi-agent voting rounds and Byzantine fault tolerance metrics.",
    category: "Multi-Agent",
  },
  {
    name: "Governance Copilot",
    path: "/copilot",
    icon: MessageSquareCode,
    desc: "AI assistant for querying compliance status, policy rules, and audit logs.",
    category: "Copilot",
  },
  {
    name: "Explainability & SHAP",
    path: "/explainability",
    icon: Activity,
    desc: "Audit SHAP feature attributions and model prediction drivers.",
    category: "Explainability",
  },
  {
    name: "Knowledge Graph",
    path: "/knowledge-graph",
    icon: Search,
    desc: "Explore relationships between agents, policies, counterparties, and ledgers.",
    category: "Graph Engine",
  },
  {
    name: "WORM Observability",
    path: "/observability",
    icon: Terminal,
    desc: "Tamper-evident append-only logs and cryptographic signature verification.",
    category: "Audit Logs",
  },
  {
    name: "Chaos Engineering",
    path: "/chaos-dashboard",
    icon: ZapOff,
    desc: "Inject agent failures, latency spikes, and hallucinations to test resilience.",
    category: "Stress Test",
  },
  {
    name: "Self-Healing Recovery",
    path: "/self-healing",
    icon: HeartPulse,
    desc: "Autonomous fallback routing and model recovery workflows.",
    category: "Resilience",
  },
];

export function ModuleGrid() {
  return (
    <section id="modules" className="py-20 md:py-28 relative border-t border-white/[0.08] bg-[#0A0A0B]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-400 mb-4">
            Console modules
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-[-0.02em] mb-4 font-sans">
            One workspace, eleven modules
          </h2>
          <p className="text-[15px] text-zinc-400 leading-relaxed font-sans">
            Direct access to every specialized dashboard in the AegisAI control plane.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MODULES.map((mod, idx) => {
            const Icon = mod.icon;
            return (
              <Link
                key={idx}
                href={mod.path}
                className="group p-5 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/20 transition-colors duration-150 flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <div className="h-9 w-9 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-center text-zinc-200">
                      <Icon size={17} />
                    </div>
                    <span className="text-[11px] font-medium text-zinc-600 font-sans">
                      {mod.category}
                    </span>
                  </div>
                  <h3 className="text-[15px] font-semibold text-white mb-1 font-sans tracking-[-0.01em]">
                    {mod.name}
                  </h3>
                  <p className="text-[13px] text-zinc-400 leading-relaxed font-sans">
                    {mod.desc}
                  </p>
                </div>

                <div className="mt-4 pt-3.5 border-t border-white/[0.08] flex items-center justify-between text-[13px] font-medium text-zinc-500 group-hover:text-zinc-100 transition-colors font-sans">
                  <span>Open module</span>
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
