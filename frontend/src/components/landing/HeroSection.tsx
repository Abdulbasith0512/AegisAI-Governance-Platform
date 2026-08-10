"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Play, CheckCircle2, Activity, Zap, ShieldCheck } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative pt-12 pb-20 md:pt-20 md:pb-28 overflow-hidden">
      {/* Background blurs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] rounded-full bg-emerald-500/8 blur-[140px] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        {/* Compliance Badge Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-slate-800 bg-slate-900/80 backdrop-blur-md mb-8 text-xs font-medium text-slate-300">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>SOC 2 Type II Certified</span>
          <span className="text-slate-700">•</span>
          <span>RBI Circular G-20 Compliant</span>
          <span className="text-slate-700">•</span>
          <span className="text-emerald-400 font-semibold">EU AI Act Ready</span>
        </div>

        {/* Modern Sans-Serif Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-[1.08] mb-6 max-w-5xl mx-auto font-sans">
          Autonomous AI Governance
          <span className="block mt-2 text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-300">
            built for regulated banking networks.
          </span>
        </h1>

        {/* Human-written subheadline */}
        <p className="text-base sm:text-lg text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed font-sans font-normal">
          AegisAI provides real-time active supervision for financial AI agents. Monitor weighted trust scores, audit SHAP feature attributions, enforce hard compliance parameters, and block non-compliant transactions before settlement.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <Link
            href="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs tracking-wide transition-all duration-200 shadow-[0_4px_14px_rgba(16,185,129,0.3)] hover:shadow-[0_6px_20px_rgba(16,185,129,0.45)]"
          >
            <span>Launch Operations Console</span>
            <ArrowRight size={16} />
          </Link>

          <a
            href="#simulator"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded border border-slate-800 bg-slate-900/60 hover:bg-slate-800/80 hover:border-slate-700 text-slate-200 font-medium text-xs tracking-wide transition-all duration-200 backdrop-blur-md"
          >
            <Play size={14} className="text-emerald-400 fill-emerald-400/20" />
            <span>Test Risk Simulator</span>
          </a>
        </div>

        {/* Metric Bar */}
        <div className="max-w-4xl mx-auto p-4 rounded-xl border border-slate-800/80 bg-slate-950/60 backdrop-blur-md font-mono text-xs">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 text-center border-r border-slate-800/60 last:border-r-0">
              <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">WORM Ledgers</div>
              <div className="text-white text-sm font-bold flex items-center justify-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-400" />
                <span>100% PRISTINE</span>
              </div>
            </div>

            <div className="p-3 text-center border-r border-slate-800/60 last:border-r-0">
              <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">Daily Decisions</div>
              <div className="text-white text-sm font-bold flex items-center justify-center gap-1.5">
                <Activity size={14} className="text-indigo-400" />
                <span>4,200 / DAY</span>
              </div>
            </div>

            <div className="p-3 text-center border-r border-slate-800/60 last:border-r-0">
              <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">Consensus Uptime</div>
              <div className="text-white text-sm font-bold flex items-center justify-center gap-1.5">
                <Zap size={14} className="text-amber-400" />
                <span>99.98%</span>
              </div>
            </div>

            <div className="p-3 text-center">
              <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">Policy Breaches</div>
              <div className="text-emerald-400 text-sm font-bold flex items-center justify-center gap-1.5">
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
