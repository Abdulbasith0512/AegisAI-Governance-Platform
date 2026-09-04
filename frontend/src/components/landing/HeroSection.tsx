"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Play, CheckCircle2, Activity, Zap, ShieldCheck } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative pt-16 pb-20 md:pt-24 md:pb-28 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        {/* Compliance Badge Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/10 bg-white/[0.03] mb-8 text-xs font-medium text-zinc-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
          <span>SOC 2 Type II Certified</span>
          <span className="text-zinc-700">•</span>
          <span>RBI Circular G-20 Compliant</span>
          <span className="text-zinc-700">•</span>
          <span className="text-zinc-100 font-semibold">EU AI Act Ready</span>
        </div>

        {/* Editorial headline — solid white, tight tracking */}
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-400 mb-5">
          AI Governance for Banking
        </p>
        <h1 className="text-4xl sm:text-6xl lg:text-[4.4rem] font-bold tracking-[-0.03em] text-white leading-[1.04] mb-6 max-w-5xl mx-auto font-sans">
          Autonomous AI governance
          <span className="block text-zinc-400">
            built for regulated banking networks.
          </span>
        </h1>

        {/* Human-written subheadline */}
        <p className="text-base sm:text-lg text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed font-sans font-normal">
          AegisAI provides real-time active supervision for financial AI agents. Monitor weighted trust scores, audit SHAP feature attributions, enforce hard compliance parameters, and block non-compliant transactions before settlement.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16">
          <Link
            href="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-white hover:bg-zinc-200 text-zinc-950 font-semibold text-sm transition-colors duration-150"
          >
            <span>Launch Operations Console</span>
            <ArrowRight size={16} />
          </Link>

          <a
            href="#simulator"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-zinc-200 font-medium text-sm transition-colors duration-150"
          >
            <Play size={14} className="text-emerald-400" />
            <span>Test Risk Simulator</span>
          </a>
        </div>

        {/* Proof bar — flat stat row */}
        <div className="max-w-4xl mx-auto rounded-xl border border-white/10 bg-white/[0.02] text-xs">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/[0.06] rounded-xl overflow-hidden">
            <div className="p-4 text-center bg-[#0A0A0B]">
              <div className="text-zinc-500 text-[10px] uppercase tracking-[0.12em] mb-1.5">WORM Ledgers</div>
              <div className="text-white text-sm font-semibold flex items-center justify-center gap-1.5 tabular-nums">
                <CheckCircle2 size={14} className="text-emerald-400" />
                <span>100% pristine</span>
              </div>
            </div>

            <div className="p-4 text-center bg-[#0A0A0B]">
              <div className="text-zinc-500 text-[10px] uppercase tracking-[0.12em] mb-1.5">Daily Decisions</div>
              <div className="text-white text-sm font-semibold flex items-center justify-center gap-1.5 tabular-nums">
                <Activity size={14} className="text-zinc-400" />
                <span>4,200 / day</span>
              </div>
            </div>

            <div className="p-4 text-center bg-[#0A0A0B]">
              <div className="text-zinc-500 text-[10px] uppercase tracking-[0.12em] mb-1.5">Consensus Uptime</div>
              <div className="text-white text-sm font-semibold flex items-center justify-center gap-1.5 tabular-nums">
                <Zap size={14} className="text-zinc-400" />
                <span>99.98%</span>
              </div>
            </div>

            <div className="p-4 text-center bg-[#0A0A0B]">
              <div className="text-zinc-500 text-[10px] uppercase tracking-[0.12em] mb-1.5">Policy Breaches</div>
              <div className="text-emerald-400 text-sm font-semibold flex items-center justify-center gap-1.5 tabular-nums">
                <ShieldCheck size={14} className="text-emerald-400" />
                <span>0.00%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
