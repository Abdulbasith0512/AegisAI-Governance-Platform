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
    <section id="modules" className="py-20 md:py-28 relative border-t border-[#173049]/60 bg-[#070b12]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-[4px] bg-[#1AA0A8]/10 border border-[#1AA0A8]/30 text-[#1AA0A8] font-mono text-[11px] uppercase tracking-wider mb-4">
            <span>Operational Console Modules</span>
          </div>
          <h2 
            className="text-3xl sm:text-4xl font-normal text-white tracking-tight mb-4"
            style={{ fontFamily: "Georgia, serif" }}
          >
            Launch Platform Operations Workspace
          </h2>
          <p className="text-sm sm:text-base text-[#94A3B8] leading-relaxed font-sans">
            Direct access to all 11 specialized dashboards within the AegisAI OS control plane.
          </p>
        </div>

        {/* Grid with Gradient Shell Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {MODULES.map((mod, idx) => {
            const Icon = mod.icon;
            return (
              <div
                key={idx}
                className="p-[1px] rounded-[12px] bg-gradient-to-b from-[#1AA0A8]/25 via-[#173049]/20 to-transparent shadow-[0_12px_40px_rgba(23,48,73,0.1)] group"
              >
                <Link
                  href={mod.path}
                  className="h-full p-5 rounded-[11px] bg-[#0d131f]/95 hover:bg-[#131c2d]/95 transition-all duration-200 backdrop-blur-xl flex flex-col justify-between block"
                >
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <div className="h-8 w-8 rounded-[4px] bg-[#173049]/60 border border-[#173049] flex items-center justify-center text-slate-300 group-hover:text-[#1AA0A8] group-hover:border-[#1AA0A8]/50 transition-colors">
                        <Icon size={16} />
                      </div>
                      <span className="text-[10px] font-mono text-[#5E7386] uppercase tracking-wider">
                        {mod.category}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-white mb-1.5 group-hover:text-[#1AA0A8] transition-colors">
                      {mod.name}
                    </h3>
                    <p className="text-xs text-[#94A3B8] leading-relaxed font-sans">
                      {mod.desc}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#173049]/80 flex items-center justify-between font-mono text-[11px] text-slate-400 group-hover:text-[#1AA0A8] transition-colors">
                    <span>Open Console Module</span>
                    <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
