"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function LandingFooter() {
  return (
    <footer className="border-t border-white/[0.08] bg-[#0A0A0B] text-zinc-400 font-sans text-[13px]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand Col */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
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
            </div>
            <p className="text-[13px] text-zinc-500 leading-relaxed font-sans max-w-md">
              The unified governance operating system for autonomous financial AI agents. Real-time trust scoring, hard policy evaluation, multi-agent consensus, and cryptographically verifiable WORM ledgers.
            </p>
            <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-white/[0.03] border border-white/10 text-xs text-zinc-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              <span>SOC 2 Type II · RBI Circular G-20 compliant</span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-semibold mb-3 text-[13px] font-sans">Platform</h4>
            <ul className="space-y-2.5 text-zinc-500 text-[13px]">
              <li>
                <Link href="/dashboard" className="hover:text-white transition-colors">
                  Executive Console
                </Link>
              </li>
              <li>
                <Link href="/trust-dashboard" className="hover:text-white transition-colors">
                  Trust Telemetry
                </Link>
              </li>
              <li>
                <Link href="/reviews" className="hover:text-white transition-colors">
                  Human Review Center
                </Link>
              </li>
              <li>
                <Link href="/policy-dashboard" className="hover:text-white transition-colors">
                  Policy Rules Engine
                </Link>
              </li>
              <li>
                <Link href="/copilot" className="hover:text-white transition-colors">
                  Governance Copilot
                </Link>
              </li>
            </ul>
          </div>

          {/* Compliance & Standards */}
          <div>
            <h4 className="text-white font-semibold mb-3 text-[13px] font-sans">Compliance</h4>
            <ul className="space-y-2.5 text-zinc-500 text-[13px]">
              <li>RBI Circular G-20</li>
              <li>EU AI Act Article 14</li>
              <li>ISO / IEC 42001 (AIMS)</li>
              <li>SOC 2 Type II Certified</li>
              <li>WORM Immutable Ledgers</li>
            </ul>
          </div>
        </div>

        {/* Bottom Strip */}
        <div className="pt-6 border-t border-white/[0.08] flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-zinc-600">
          <div>
            &copy; {new Date().getFullYear()} AegisAI Governance Platform. All rights reserved.
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-zinc-300 hover:text-white flex items-center gap-1 font-medium">
              <span>Launch operations dashboard</span>
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
