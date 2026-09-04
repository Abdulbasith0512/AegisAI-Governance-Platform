"use client";

import React, { useState, useEffect, useCallback } from "react";
import { apiUrl } from "@/lib/api";

export interface TimelineStep {
  event: string;
  duration: string;
  status: string;
}

export interface PolicyCheck {
  rule_id: string;
  name: string;
  status: string;
}

export interface ReviewCase {
  id: string;
  transaction_id: string;
  amount: number;
  currency: string;
  customer_name: string;
  trust_score: number;
  status: string;
  reviewer_name: string | null;
  assigned_at: string;
  sla_deadline: string;
  is_sla_breached: boolean;
  warnings?: string[];
  explanation?: string;
  timeline?: TimelineStep[];
  policies?: PolicyCheck[];
  shap?: Record<string, number>;
  comments?: string;
}

export default function HumanReviewCenter() {
  const [queue, setQueue] = useState<ReviewCase[]>([]);
  const [history, setHistory] = useState<ReviewCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"queue" | "history">("queue");
  const [selectedCase, setSelectedCase] = useState<ReviewCase | null>(null);

  // Auditor verdict comments input
  const [verdictComments, setVerdictComments] = useState("");
  const [acting, setActing] = useState(false);

  const fmtDT = (v: string) => {
    const d = new Date(v);
    return isNaN(d.getTime()) ? v : d.toLocaleString();
  };

  const loadLists = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [qRes, hRes] = await Promise.all([
        fetch(apiUrl("/api/v1/reviews/queue")),
        fetch(apiUrl("/api/v1/reviews/history")),
      ]);
      if (!qRes.ok) throw new Error(`Queue request failed (${qRes.status})`);
      if (!hRes.ok) throw new Error(`History request failed (${hRes.status})`);
      setQueue(await qRes.json());
      setHistory(await hRes.json());
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load review data");
      setQueue([]);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function initial() { await loadLists(); }
    void initial();
  }, [loadLists]);

  const selectCase = useCallback(async (c: ReviewCase) => {
    setSelectedCase(c);
    setVerdictComments("");
    // Enrich with live evidence (warnings, explanation, timeline, policies, SHAP)
    try {
      const res = await fetch(apiUrl(`/api/v1/reviews/${c.id}`));
      if (!res.ok) return;
      const d = await res.json();
      setSelectedCase((prev) => {
        if (!prev || prev.id !== c.id) return prev;
        return {
          ...prev,
          comments: d.comments ?? prev.comments,
          warnings: d.trust_warnings ?? prev.warnings,
          explanation: d.explanation_human ?? prev.explanation,
          timeline: Array.isArray(d.explanation_timeline)
            ? d.explanation_timeline.map((t: { event?: string; duration_ms?: number; status?: string }) => ({
                event: String(t.event ?? "step"),
                duration: typeof t.duration_ms === "number" ? `${t.duration_ms}ms` : "—",
                status: String(t.status ?? "success"),
              }))
            : prev.timeline,
          policies: Array.isArray(d.policy_checks)
            ? d.policy_checks.map((p: { rule_id: string; status: string }) => ({
                rule_id: p.rule_id,
                name: p.rule_id,
                status: p.status,
              }))
            : prev.policies,
          shap: d.explanation_shap ?? prev.shap,
        };
      });
    } catch {
      // Keep list-level summary if detail fetch fails
    }
  }, []);

  const handleAction = async (status: "approved" | "rejected" | "escalated") => {
    if (!selectedCase) return;
    if (verdictComments.trim().length < 10) {
      alert("Please write at least 10 characters in reviewer comments.");
      return;
    }

    setActing(true);
    try {
      const res = await fetch(apiUrl(`/api/v1/reviews/${selectedCase.id}/action`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, comments: verdictComments.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const msg = body?.detail
          ? (typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail))
          : `Action failed (${res.status})`;
        alert(msg);
        return;
      }
      alert(`Auditor verdict '${status.toUpperCase()}' resolved and audited successfully.`);
      setSelectedCase(null);
      setVerdictComments("");
      await loadLists();
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0f14] text-[#e2e8f0] font-sans antialiased p-6 md:p-12 selection:bg-rose-500 selection:text-white">
      {/* Glow Effects */}
      <div className="absolute top-0 right-1/4 h-[350px] w-[350px] rounded-full bg-rose-500/5 blur-3xl"></div>

      {/* Page Header */}
      <header className="mb-10 border-b border-slate-800 pb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse"></span>
            <span className="text-xs uppercase tracking-wider text-rose-400 font-semibold font-mono">Auditor Command</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            Human Review Center
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Auditing terminal for low-trust or policy breached cases. Complete with timelines, SHAP, and SLA tracking tools.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex gap-2 p-1 rounded-lg bg-slate-950 border border-slate-850">
          <button
            onClick={() => { setActiveTab("queue"); setSelectedCase(null); }}
            className={`px-4 py-1.5 text-xs font-bold font-mono rounded transition-all ${activeTab === "queue"
                ? "bg-rose-600 text-white shadow-[0_0_15px_rgba(244,63,94,0.3)]"
                : "text-slate-400 hover:text-slate-200"
              }`}
          >
            Review Queue ({queue.length})
          </button>
          <button
            onClick={() => { setActiveTab("history"); setSelectedCase(null); }}
            className={`px-4 py-1.5 text-xs font-bold font-mono rounded transition-all ${activeTab === "history"
                ? "bg-rose-600 text-white shadow-[0_0_15px_rgba(244,63,94,0.3)]"
                : "text-slate-400 hover:text-slate-200"
              }`}
          >
            Audit History ({history.length})
          </button>
        </div>
      </header>

      {/* Grid Workspace */}
      {loadError && (
        <div className="mb-6 p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-sm text-rose-300 flex items-center justify-between gap-4">
          <span>Could not reach the review API: {loadError}</span>
          <button
            onClick={() => void loadLists()}
            className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shrink-0"
          >
            Retry
          </button>
        </div>
      )}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-8">

        {/* Left Column: Case Queue Lists */}
        <div className="xl:col-span-2 space-y-6">
          <h2 className="text-lg font-bold text-white tracking-tight uppercase font-mono">
            {activeTab === "queue" ? "Pending Auditor Review" : "Completed Audit Ledger"}
          </h2>

          <div className="space-y-4">
            {activeTab === "queue" ? (
              queue.map((q) => (
                <div
                  key={q.id}
                  onClick={() => void selectCase(q)}
                  className={`p-6 rounded-xl border transition-all duration-300 cursor-pointer ${selectedCase?.id === q.id
                      ? "bg-[#121620]/80 border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.1)]"
                      : "bg-[#121620]/40 border-slate-800 hover:border-slate-700"
                    }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                    <div>
                      <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block mb-1">
                        Case: {q.id.toUpperCase()}
                      </span>
                      <h3 className="text-lg font-black text-white">
                        {q.customer_name}
                      </h3>
                    </div>

                    {/* SLA Indicators */}
                    <div className="flex items-center gap-3">
                      {q.is_sla_breached ? (
                        <span className="inline-flex px-2 py-0.5 rounded text-[9px] font-bold font-mono bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse">
                          SLA Breached
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 rounded text-[9px] font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          SLA Active
                        </span>
                      )}

                      <span className="text-xs font-mono font-bold text-slate-400">
                        Limit: {q.amount.toLocaleString()} {q.currency}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-800/80 text-xs font-mono">
                    <span className="text-slate-400">
                      Trust score: <strong className={q.trust_score < 70 ? "text-rose-400" : "text-amber-400"}>{q.trust_score}</strong>
                    </span>
                    <span className="text-slate-500">Deadline: {fmtDT(q.sla_deadline)}</span>
                  </div>
                </div>
              ))
            ) : (
              history.map((h) => (
                <div key={h.id} className="p-6 rounded-xl border border-slate-850 bg-[#121620]/20 text-xs font-mono">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-white text-sm">{h.customer_name}</span>
                    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${h.status === "approved" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      }`}>
                      {h.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-slate-400 leading-relaxed mb-3">
                    Remarks: <em className="text-slate-300 font-semibold">{h.comments}</em>
                  </p>
                  <div className="flex justify-between border-t border-slate-900 pt-3 text-[10px] text-slate-500">
                    <span>Reviewer: {h.reviewer_name}</span>
                    <span>Amount: {h.amount.toLocaleString()} {h.currency}</span>
                  </div>
                </div>
              ))
            )}

            {loading ? (
              <div className="text-center py-20 border border-slate-800/50 rounded-xl bg-[#121620]/10 text-slate-500 text-sm">
                Loading live review queue…
              </div>
            ) : ((activeTab === "queue" && queue.length === 0) || (activeTab === "history" && history.length === 0)) && (
              <div className="text-center py-20 border border-slate-800/50 rounded-xl bg-[#121620]/10 text-slate-500">
                No case logs recorded in this section.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Evidence Inspector Viewer */}
        <div className="rounded-xl border border-slate-800 bg-[#121620]/40 p-6 backdrop-blur-md flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight mb-6">Evidence Viewer & Action Portal</h2>

            {selectedCase ? (
              <div className="space-y-6">

                {/* Visual Trust Indicator */}
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-4">
                  <div>
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block">Trust Rating</span>
                    <strong className={`text-xl font-bold font-mono ${selectedCase.trust_score < 70 ? "text-rose-400" : "text-amber-400"
                      }`}>
                      {selectedCase.trust_score} / 100
                    </strong>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${selectedCase.status === "escalated" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "bg-slate-900 text-slate-400 border border-slate-800"
                    }`}>
                    {selectedCase.status.toUpperCase()}
                  </span>
                </div>

                {/* Justification Viewer */}
                <div>
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block mb-2">Decision Narrative</span>
                  <div className="p-3.5 rounded bg-indigo-500/5 border border-indigo-500/15 text-indigo-300 text-xs leading-relaxed">
                    {selectedCase.explanation ?? "Loading decision narrative…"}
                  </div>
                </div>

                {/* Vertical Timeline */}
                <div>
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block mb-3">Audit Timeline</span>
                  <div className="relative border-l-2 border-slate-800 pl-4 space-y-4 ml-2">
                    {selectedCase.timeline?.map((step, idx) => (
                      <div key={idx} className="relative">
                        <span className={`absolute -left-[23px] top-1.5 h-3.5 w-3.5 rounded-full border-4 border-[#0d0f14] ${step.status === "success" ? "bg-emerald-500" : (step.status === "warning" ? "bg-amber-500" : "bg-rose-500")
                          }`}></span>
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-white font-semibold">{step.event}</span>
                          <span className="text-slate-500">{step.duration}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* SHAP attributions */}
                <div>
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block mb-2">SHAP Key Weights</span>
                  <div className="space-y-2">
                    {Object.entries(selectedCase.shap || {}).map(([feature, value]) => (
                      <div key={feature} className="text-xs font-mono">
                        <div className="flex justify-between mb-1 text-[11px]">
                          <span className="text-slate-500">{feature}</span>
                          <span className="text-slate-300 font-bold">{value.toFixed(2)}</span>
                        </div>
                        <div className="h-1 w-full bg-slate-900 rounded overflow-hidden">
                          <div
                            className={`h-full rounded ${value > 0.5 ? "bg-rose-500" : "bg-indigo-500"}`}
                            style={{ width: `${value * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Policy Compliance checks list */}
                <div>
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block mb-2">Policy Checker</span>
                  <div className="space-y-2">
                    {selectedCase.policies?.map((pol) => (
                      <div key={pol.rule_id} className="flex items-center justify-between text-xs font-mono p-2 rounded bg-slate-900 border border-slate-800">
                        <div>
                          <span className="font-bold text-white block">{pol.rule_id}</span>
                          <span className="text-[10px] text-slate-500">{pol.name}</span>
                        </div>
                        <span className={`inline-flex px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${pol.status === "pass" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                          }`}>
                          {pol.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions Verdict Submissions Form */}
                <div className="border-t border-slate-850 pt-4 space-y-4">
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block">Submit Resolution Verdict</span>

                  <div>
                    <textarea
                      placeholder="Enter Auditor comments (at least 10 chars justifying decision)..."
                      value={verdictComments}
                      onChange={(e) => setVerdictComments(e.target.value)}
                      className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-rose-500 font-mono h-20 resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => void handleAction("approved")}
                      disabled={acting}
                      className="py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-[10px] font-extrabold uppercase font-mono text-white shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => void handleAction("rejected")}
                      disabled={acting}
                      className="py-2 rounded bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-[10px] font-extrabold uppercase font-mono text-white shadow-[0_0_15px_rgba(244,63,94,0.15)]"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => void handleAction("escalated")}
                      disabled={acting}
                      className="py-2 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-[10px] font-extrabold uppercase font-mono text-white shadow-[0_0_15px_rgba(245,158,11,0.15)]"
                    >
                      Escalate
                    </button>
                  </div>
                </div>

              </div>
            ) : (
              <div className="text-center py-24 text-slate-500">
                <p className="text-4xl mb-3">🛡️</p>
                <p className="text-xs">No case selected from the queue.</p>
                <p className="text-xs mt-1">Select an active check to inspect demographic profiles, timelines, and policy checks.</p>
              </div>
            )}
          </div>

          <div className="border-t border-slate-850 pt-4 mt-6 text-[10px] text-slate-500 font-mono flex justify-between">
            <span>AegisAI OS Review Console</span>
            <span>v1.0.0</span>
          </div>
        </div>

      </section>
    </div>
  );
}
