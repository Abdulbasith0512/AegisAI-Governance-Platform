"use client";

import React, { useState } from "react";
import { CheckCircle2, FileCheck } from "lucide-react";

interface Framework {
  id: string;
  name: string;
  authority: string;
  status: string;
  statusTone: string;
  requirements: { clause: string; title: string; aegisSolution: string }[];
}

const FRAMEWORKS: Framework[] = [
  {
    id: "rbi",
    name: "RBI Circular G-20",
    authority: "Reserve Bank of India",
    status: "Compliant",
    statusTone: "text-emerald-300",
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
    status: "High-risk certified",
    statusTone: "text-emerald-300",
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
    status: "AIMS aligned",
    statusTone: "text-amber-300",
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
    <section id="compliance" className="py-20 md:py-28 relative border-t border-white/[0.08] bg-[#0A0A0B]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-400 mb-4">
            Regulatory coverage
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-[-0.02em] mb-4 font-sans">
            Built for global financial regulation
          </h2>
          <p className="text-[15px] text-zinc-400 leading-relaxed font-sans">
            AegisAI satisfies strict regulatory requirements out of the box with zero custom code required.
          </p>
        </div>

        {/* Framework Tabs */}
        <div className="flex flex-wrap justify-center gap-2.5 mb-8">
          {FRAMEWORKS.map((fw) => {
            const isSelected = fw.id === selectedFramework.id;
            return (
              <button
                key={fw.id}
                onClick={() => setSelectedFramework(fw)}
                className={`px-4 py-2.5 rounded-xl border text-[13px] font-semibold transition-colors duration-150 flex items-center gap-2 ${
                  isSelected
                    ? "bg-white/[0.05] border-white/20 text-white"
                    : "bg-transparent border-white/[0.08] text-zinc-400 hover:border-white/20 hover:text-white"
                }`}
              >
                <span>{fw.name}</span>
                <span className={`text-xs font-medium ${fw.statusTone}`}>
                  · {fw.status}
                </span>
              </button>
            );
          })}
        </div>

        {/* Requirements Table */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02]">
          <div className="p-6 sm:p-8">
            <div className="flex justify-between items-center pb-5 mb-5 border-b border-white/[0.08]">
              <div>
                <h3 className="text-lg font-bold text-white tracking-[-0.01em] font-sans">{selectedFramework.name}</h3>
                <p className="text-[13px] text-zinc-500 font-sans">{selectedFramework.authority}</p>
              </div>
              <div className={`px-2.5 py-1 rounded-full border border-white/10 bg-white/[0.03] text-xs font-semibold font-sans ${selectedFramework.statusTone}`}>
                {selectedFramework.status}
              </div>
            </div>

            <div className="space-y-3">
              {selectedFramework.requirements.map((req, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[13px] text-white font-semibold font-sans">
                      <FileCheck size={14} className="text-zinc-500 shrink-0" />
                      <span>{req.clause} · {req.title}</span>
                    </div>
                    <p className="text-[13px] text-zinc-500 font-sans">
                      Regulatory mandate requirement
                    </p>
                  </div>

                  <div className="md:max-w-md p-3 rounded-lg bg-emerald-500/[0.07] border border-white/10 text-[13px] text-zinc-200 flex items-start gap-2 font-sans">
                    <CheckCircle2 size={15} className="text-emerald-400 flex-shrink-0 mt-0.5" />
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
