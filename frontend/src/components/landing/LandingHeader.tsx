"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#090b10]/85 border-b border-slate-800/80 transition-all duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Identity */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="h-8 w-8 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center font-bold text-sm text-emerald-400 group-hover:bg-emerald-500/20 group-hover:border-emerald-400 transition-all duration-200">
            <ShieldCheck size={18} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold tracking-tight text-white font-sans">
              AegisAI
            </span>
            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 uppercase tracking-wider">
              OS
            </span>
          </div>
        </Link>

        {/* Navigation Links (Clean Sans-Serif) */}
        <nav className="hidden md:flex items-center gap-7 text-xs font-medium text-slate-300">
          <a href="#simulator" className="hover:text-white transition-colors">
            Risk Simulator
          </a>
          <a href="#pillars" className="hover:text-white transition-colors">
            Platform Pillars
          </a>
          <a href="#architecture" className="hover:text-white transition-colors">
            Architecture
          </a>
          <a href="#compliance" className="hover:text-white transition-colors">
            Compliance
          </a>
          <a href="#modules" className="hover:text-white transition-colors">
            Console Modules
          </a>
        </nav>

        {/* Right CTA */}
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-2 font-mono text-[11px] text-emerald-400 bg-emerald-950/40 px-2.5 py-1 rounded border border-emerald-500/20">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>LEDGER: ONLINE</span>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs tracking-wide transition-all duration-200 shadow-[0_2px_10px_rgba(16,185,129,0.25)] hover:shadow-[0_4px_16px_rgba(16,185,129,0.4)]"
          >
            <span>Launch Console</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </header>
  );
}
