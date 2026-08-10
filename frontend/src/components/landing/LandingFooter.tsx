"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function LandingFooter() {
  return (
    <footer className="border-t border-[#173049]/80 bg-[#070b12] text-slate-400 font-mono text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand Col */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-[4px] bg-[#1AA0A8]/10 border border-[#1AA0A8]/30 flex items-center justify-center font-mono font-bold text-xs text-[#1AA0A8]">
                Æ
              </div>
              <span className="text-base font-bold tracking-tight text-white font-serif">
                AegisAI OS
              </span>
            </div>
            <p className="text-xs text-[#94A3B8] leading-relaxed font-sans max-w-md">
              The unified governance operating system for autonomous financial AI agents. Real-time trust scoring, hard policy evaluation, multi-agent consensus, and cryptographically verifiable WORM ledgers.
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-[4px] bg-[#0d131f] border border-[#173049] text-[10px] text-[#1AA0A8]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#1AA0A8] animate-pulse"></span>
              <span>SOC 2 Type II Certified • RBI Circular G-20 Compliant</span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-bold uppercase tracking-wider mb-3 text-xs">Platform Modules</h4>
            <ul className="space-y-2 text-[#94A3B8] text-xs">
              <li>
                <Link href="/dashboard" className="hover:text-[#1AA0A8] transition-colors">
                  Executive Console
                </Link>
              </li>
              <li>
                <Link href="/trust-dashboard" className="hover:text-[#1AA0A8] transition-colors">
                  Trust Telemetry
                </Link>
              </li>
              <li>
                <Link href="/reviews" className="hover:text-[#1AA0A8] transition-colors">
                  Human Review Center
                </Link>
              </li>
              <li>
                <Link href="/policy-dashboard" className="hover:text-[#1AA0A8] transition-colors">
                  Policy Rules Engine
                </Link>
              </li>
              <li>
                <Link href="/copilot" className="hover:text-[#1AA0A8] transition-colors">
                  Governance Copilot
                </Link>
              </li>
            </ul>
          </div>

          {/* Compliance & Standards */}
          <div>
            <h4 className="text-white font-bold uppercase tracking-wider mb-3 text-xs">Compliance Standards</h4>
            <ul className="space-y-2 text-[#94A3B8] text-xs">
              <li>RBI Circular G-20</li>
              <li>EU AI Act Article 14</li>
              <li>ISO / IEC 42001 (AIMS)</li>
              <li>SOC 2 Type II Certified</li>
              <li>WORM Immutable Ledgers</li>
            </ul>
          </div>
        </div>

        {/* Bottom Strip */}
        <div className="pt-8 border-t border-[#173049]/60 flex flex-col sm:flex-row justify-between items-center gap-4 text-[11px] text-[#5E7386]">
          <div>
            &copy; {new Date().getFullYear()} AegisAI Governance Platform. All rights reserved.
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-[#1AA0A8] hover:underline flex items-center gap-1">
              <span>Launch Operations Dashboard</span>
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
