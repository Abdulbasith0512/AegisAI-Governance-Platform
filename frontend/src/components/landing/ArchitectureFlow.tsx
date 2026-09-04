"use client";

import React, { useState } from "react";
import { Cpu, ShieldCheck, Scale, UserCheck, Terminal, CheckCircle } from "lucide-react";

const STEPS = [
  {
    step: "01",
    title: "Request Ingestion",
    icon: Cpu,
    detail: "Banking agent submits payload (e.g. transaction, credit approval, liquidity movement) to AegisAI API gateway.",
    tech: "REST / gRPC Interceptor",
  },
  {
    step: "02",
    title: "Hard Policy Evaluation",
    icon: Scale,
    detail: "Instant evaluation against RBI Circular G-20 regulations, AML caps, dual-signature requirements, and velocity rules.",
    tech: "Pydantic & Rule Engine",
  },
  {
    step: "03",
    title: "Trust & Consensus Scoring",
    icon: ShieldCheck,
    detail: "Real-time anomaly scoring, model drift check, and multi-agent Byzantine fault consensus voting.",
    tech: "Weighted Telemetry Vector",
  },
  {
    step: "04",
    title: "Verdict & Escalation",
    icon: UserCheck,
    detail: "Autonomous approval or immediate automated escalation to Human Review Queue for officer sign-off.",
    tech: "Human-in-the-Loop Gateway",
  },
  {
    step: "05",
    title: "WORM Audit Ledgering",
    icon: Terminal,
    detail: "Cryptographic hash generation and append to Write-Once-Read-Many audit trail for regulatory compliance.",
    tech: "SHA-256 Cryptographic Chain",
  },
];

export function ArchitectureFlow() {
  const [activeStep, setActiveStep] = useState<number>(2);

  return (
    <section id="architecture" className="py-20 md:py-28 relative border-t border-white/[0.08] bg-[#0A0A0B]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-400 mb-4">
            Execution pipeline
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-[-0.02em] mb-4 font-sans">
            How AegisAI governs agent actions
          </h2>
          <p className="text-[15px] text-zinc-400 leading-relaxed font-sans">
            Every transaction passes through a multi-stage zero-trust validation pipeline before execution.
          </p>
        </div>

        {/* Stepper Pipeline */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-5">
          {STEPS.map((s, idx) => {
            const Icon = s.icon;
            const isActive = idx === activeStep;
            return (
              <button
                key={idx}
                onClick={() => setActiveStep(idx)}
                className={`p-4 rounded-xl border text-left transition-colors duration-150 ${
                  isActive
                    ? "bg-white/[0.05] border-white/20 text-white"
                    : "bg-white/[0.02] border-white/[0.08] hover:border-white/20 hover:bg-white/[0.04] text-zinc-400"
                }`}
                style={isActive ? { boxShadow: "inset 0 2px 0 #10B981" } : undefined}
              >
                <div className="flex justify-between items-center mb-3">
                  <span className={`text-[11px] font-semibold tabular-nums ${isActive ? "text-emerald-300" : "text-zinc-600"}`}>
                    {s.step}
                  </span>
                  <Icon size={17} className={isActive ? "text-emerald-300" : "text-zinc-600"} />
                </div>
                <h4 className="text-[13px] font-semibold text-white mb-1 font-sans">{s.title}</h4>
                <div className="text-[11px] text-zinc-500 truncate font-sans">{s.tech}</div>
              </button>
            );
          })}
        </div>

        {/* Active Step Detail */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02]">
          <div className="p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl text-left">
              <div className="inline-flex items-center gap-2 text-xs text-emerald-300 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-white/10 font-sans font-medium">
                <CheckCircle size={13} />
                <span>Stage {STEPS[activeStep].step} · {STEPS[activeStep].tech}</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white tracking-[-0.01em] font-sans">
                {STEPS[activeStep].title}
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed font-sans">
                {STEPS[activeStep].detail}
              </p>
            </div>

            <div className="w-full md:w-auto flex-shrink-0">
              <div className="p-4 rounded-xl bg-[#0A0A0B] border border-white/10 text-xs space-y-2.5 text-zinc-400 min-w-[260px] font-sans">
                <div className="flex justify-between border-b border-white/[0.08] pb-2">
                  <span>Latency</span>
                  <span className="text-white tabular-nums font-semibold">12.4 ms</span>
                </div>
                <div className="flex justify-between border-b border-white/[0.08] pb-2">
                  <span>Enforcement</span>
                  <span className="text-white font-medium">Hard block</span>
                </div>
                <div className="flex justify-between">
                  <span>Integrity</span>
                  <span className="text-emerald-300 font-medium">SHA-256 verified</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
