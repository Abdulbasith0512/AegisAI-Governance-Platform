"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 bg-[#0A0A0B]/90 backdrop-blur-md border-b border-white/[0.08]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Identity */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-[7px] bg-white flex items-center justify-center font-sans font-extrabold text-[13px] text-zinc-950">
            A
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[15px] font-bold tracking-[-0.01em] text-white font-sans">
              AegisAI
            </span>
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-500">
              Governance OS
            </span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-7 text-[13px] font-medium text-zinc-400">
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
          <div className="hidden lg:flex items-center gap-2 text-xs text-zinc-400 bg-white/[0.03] px-2.5 py-1.5 rounded-full border border-white/10">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
            <span>Ledger online</span>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white hover:bg-zinc-200 text-zinc-950 font-semibold text-[13px] transition-colors duration-150"
          >
            <span>Launch Console</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </header>
  );
}
