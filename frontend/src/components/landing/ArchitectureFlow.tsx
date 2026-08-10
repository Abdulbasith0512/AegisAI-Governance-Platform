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
    <section id="architecture" className="py-20 md:py-28 relative border-t border-[#173049]/60 bg-[#070b12]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-[4px] bg-[#1AA0A8]/10 border border-[#1AA0A8]/30 text-[#1AA0A8] font-mono text-[11px] uppercase tracking-wider mb-4">
            <span>Execution Pipeline</span>
          </div>
          <h2 
            className="text-3xl sm:text-4xl font-normal text-white tracking-tight mb-4"
            style={{ fontFamily: "Georgia, serif" }}
          >
            How AegisAI Governs Autonomous Agent Actions
          </h2>
          <p className="text-sm sm:text-base text-[#94A3B8] leading-relaxed font-sans">
            Every transaction or decision passes through a multi-stage zero-trust validation pipeline before final execution.
          </p>
        </div>

        {/* Stepper Pipeline */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-12">
          {STEPS.map((s, idx) => {
            const Icon = s.icon;
            const isActive = idx === activeStep;
            return (
              <button
                key={idx}
                onClick={() => setActiveStep(idx)}
                className={`p-4 rounded-[4px] border text-left transition-all duration-200 relative ${
                  isActive
                    ? "bg-[#173049] border-[#1AA0A8] shadow-[0_0_20px_rgba(26,160,168,0.25)] text-white"
                    : "bg-[#0d131f]/70 border-[#173049] hover:border-[#1AA0A8]/40 hover:bg-[#173049]/40 text-slate-400"
                }`}
              >
                <div className="flex justify-between items-center mb-3">
                  <span className={`font-mono text-xs font-bold ${isActive ? "text-[#1AA0A8]" : "text-[#5E7386]"}`}>
                    STEP {s.step}
                  </span>
                  <Icon size={18} className={isActive ? "text-[#1AA0A8]" : "text-[#5E7386]"} />
                </div>
                <h4 className="text-xs sm:text-sm font-bold text-white mb-1">{s.title}</h4>
                <div className="text-[10px] font-mono text-slate-400 truncate">{s.tech}</div>
              </button>
            );
          })}
        </div>

        {/* Active Step Detail Visualizer with Gradient Shell */}
        <div className="p-[1px] rounded-[12px] bg-gradient-to-b from-[#1AA0A8]/40 via-[#173049]/30 to-transparent shadow-[0_24px_60px_rgba(23,48,73,0.15)]">
          <div className="p-6 sm:p-8 rounded-[11px] bg-[#0d131f]/95 backdrop-blur-xl flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl text-left">
              <div className="inline-flex items-center gap-2 font-mono text-xs text-[#1AA0A8] bg-[#173049]/60 px-3 py-1 rounded-[4px] border border-[#1AA0A8]/30">
                <CheckCircle size={14} />
                <span>ACTIVE STAGE: STEP {STEPS[activeStep].step} — {STEPS[activeStep].tech}</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white font-serif">
                {STEPS[activeStep].title}
              </h3>
              <p className="text-sm text-[#94A3B8] leading-relaxed font-sans">
                {STEPS[activeStep].detail}
              </p>
            </div>

            <div className="w-full md:w-auto flex-shrink-0">
              <div className="p-4 rounded-[4px] bg-[#070b12] border border-[#173049] font-mono text-xs space-y-2 text-slate-400 min-w-[280px]">
                <div className="flex justify-between border-b border-[#173049] pb-1">
                  <span>LATENCY:</span>
                  <span className="text-[#1AA0A8]">12.4 ms</span>
                </div>
                <div className="flex justify-between border-b border-[#173049] pb-1">
                  <span>ENFORCEMENT:</span>
                  <span className="text-white">HARD BLOCK</span>
                </div>
                <div className="flex justify-between">
                  <span>INTEGRITY HASH:</span>
                  <span className="text-[#F6EFDD]">SHA256-VERIFIED</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
