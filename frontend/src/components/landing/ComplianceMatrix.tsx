"use client";

import React, { useState } from "react";
import { CheckCircle2, FileCheck, Landmark } from "lucide-react";

interface Framework {
  id: string;
  name: string;
  authority: string;
  status: string;
  color: string;
  requirements: { clause: string; title: string; aegisSolution: string }[];
}

const FRAMEWORKS: Framework[] = [
  {
    id: "rbi",
    name: "RBI Circular G-20",
    authority: "Reserve Bank of India",
    status: "100% COMPLIANT",
    color: "text-[#1AA0A8] border-[#1AA0A8]/40 bg-[#1AA0A8]/10",
    requirements: [
      {
        clause: "Sec 4.2",
        title: "Mandatory Human-in-the-Loop Override",
        aegisSolution: "Automated routing of high-value AI agent transactions to Tier 1/2 compliance officers.",
      },
      {
        clause: "Sec 5.1",
        title: "Immutable Transaction Ledgering",
        aegisSolution: "Write-Once-Read-Many (WORM) audit logs with cryptographic hash chain signatures.",
      },
      {
        clause: "Sec 6.3",
        title: "Model Drift & Anomaly Boundaries",
        aegisSolution: "Real-time weighted trust engine calculating continuous anomaly indices.",
      },
    ],
  },
  {
    id: "eu",
    name: "EU AI Act (Article 14)",
    authority: "European Parliament & Council",
    status: "HIGH-RISK AI CERTIFIED",
    color: "text-[#F6EFDD] border-[#F6EFDD]/40 bg-[#F6EFDD]/10",
    requirements: [
      {
        clause: "Art. 14(1)",
        title: "Human Oversight Mechanisms",
        aegisSolution: "Real-time kill-switches and manual transaction approval dashboards for AI financial agents.",
      },
      {
        clause: "Art. 13",
        title: "System Transparency & SHAP",
        aegisSolution: "Real-time SHAP feature attributions explaining model outputs before decision finality.",
      },
      {
        clause: "Art. 15",
        title: "Accuracy & Cybersecurity",
        aegisSolution: "Byzantine fault-tolerant multi-agent consensus protocols preventing single-node failures.",
      },
    ],
  },
  {
    id: "iso",
    name: "ISO / IEC 42001",
    authority: "International Standards Org",
    status: "AIMS ALIGNED",
    color: "text-amber-400 border-amber-500/40 bg-amber-950/30",
    requirements: [
      {
        clause: "Clause 6.1",
        title: "AI Risk Assessment & Mitigation",
        aegisSolution: "Automated chaos engineering stress testing and fault injection suite.",
      },
      {
        clause: "Clause 8.2",
        title: "Continuous Telemetry",
        aegisSolution: "24/7 metrics monitoring with real-time KPI event streaming.",
      },
    ],
  },
];

export function ComplianceMatrix() {
  const [selectedFramework, setSelectedFramework] = useState<Framework>(FRAMEWORKS[0]);

  return (
    <section id="compliance" className="py-20 md:py-28 relative bg-[#0a0e17]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-[4px] bg-[#1AA0A8]/10 border border-[#1AA0A8]/30 text-[#1AA0A8] font-mono text-[11px] uppercase tracking-wider mb-4">
            <Landmark size={13} />
            <span>Regulatory Standards Matrix</span>
          </div>
          <h2 
            className="text-3xl sm:text-4xl font-normal text-white tracking-tight mb-4"
            style={{ fontFamily: "Georgia, serif" }}
          >
            Built for Global Financial Regulations
          </h2>
          <p className="text-sm sm:text-base text-[#94A3B8] leading-relaxed font-sans">
            AegisAI satisfies strict regulatory requirements out of the box with zero custom code required.
          </p>
        </div>

        {/* Framework Tabs */}
        <div className="flex flex-wrap justify-center gap-4 mb-10">
          {FRAMEWORKS.map((fw) => {
            const isSelected = fw.id === selectedFramework.id;
            return (
              <button
                key={fw.id}
                onClick={() => setSelectedFramework(fw)}
                className={`px-5 py-3 rounded-[4px] border font-mono text-xs font-bold transition-all duration-200 flex items-center gap-2.5 ${
                  isSelected
                    ? "bg-[#173049] border-[#1AA0A8] text-white shadow-[0_0_15px_rgba(26,160,168,0.25)]"
                    : "bg-[#070b12] border-[#173049] text-slate-400 hover:border-[#1AA0A8]/40 hover:text-white"
                }`}
              >
                <span>{fw.name}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-[4px] border ${fw.color}`}>
                  {fw.status}
                </span>
              </button>
            );
          })}
        </div>

        {/* Requirements Table with Gradient Shell */}
        <div className="p-[1px] rounded-[12px] bg-gradient-to-b from-[#1AA0A8]/40 via-[#173049]/30 to-transparent shadow-[0_24px_60px_rgba(23,48,73,0.15)]">
          <div className="p-6 sm:p-8 rounded-[11px] bg-[#0d131f]/95 backdrop-blur-xl">
            <div className="flex justify-between items-center pb-6 mb-6 border-b border-[#173049]">
              <div>
                <h3 className="text-xl font-bold text-white font-serif">{selectedFramework.name}</h3>
                <p className="text-xs font-mono text-[#5E7386]">{selectedFramework.authority}</p>
              </div>
              <div className={`px-3 py-1 rounded-[4px] border font-mono text-xs font-bold ${selectedFramework.color}`}>
                {selectedFramework.status}
              </div>
            </div>

            <div className="space-y-4">
              {selectedFramework.requirements.map((req, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-[4px] bg-[#070b12]/80 border border-[#173049] flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 font-mono text-xs text-[#F6EFDD] font-semibold">
                      <FileCheck size={14} />
                      <span>CLAUSE {req.clause}: {req.title}</span>
                    </div>
                    <p className="text-xs text-[#94A3B8] font-sans">
                      Regulatory Mandate Requirement
                    </p>
                  </div>

                  <div className="md:max-w-md p-3 rounded-[4px] bg-[#1AA0A8]/10 border border-[#1AA0A8]/30 text-xs font-mono text-slate-200 flex items-start gap-2">
                    <CheckCircle2 size={16} className="text-[#1AA0A8] flex-shrink-0 mt-0.5" />
                    <span>{req.aegisSolution}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
