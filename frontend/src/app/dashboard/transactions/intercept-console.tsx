"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ApiError,
  InterceptResponse,
  AgentPrediction,
  TransactionDetail,
  getTransactionDetail,
  postIntercept,
} from "@/lib/api";

type StageState = "done" | "active" | "queued" | "skipped";

interface Stage {
  key: string;
  label: string;
  state: StageState;
  note?: string;
}

function predictionFor(predictions: AgentPrediction[], match: string): AgentPrediction | undefined {
  const m = match.toLowerCase();
  return predictions.find((p) => String(p.agent ?? "").toLowerCase().includes(m));
}

function confOf(p?: AgentPrediction): string {
  if (!p) return "—";
  const c = p.confidence ?? p.confidence_score;
  return typeof c === "number" ? c.toFixed(3) : "—";
}

function latencyOf(p?: AgentPrediction): string {
  if (!p) return "—";
  const l = p.latency ?? p.latency_ms;
  return typeof l === "number" ? `${l.toFixed(1)} ms` : "—";
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  borderRadius: 7,
  background: "var(--surface-2)",
  border: "1px solid var(--border-1)",
  color: "var(--text-1)",
  fontSize: 13,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
  marginBottom: 5,
};

export default function InterceptConsole({ onIntercepted }: { onIntercepted?: (txId: string) => void }) {
  const [customerId, setCustomerId] = useState("");
  const [amount, setAmount] = useState("250.00");
  const [currency, setCurrency] = useState("USD");
  const [channel, setChannel] = useState("mobile");
  const [txType, setTxType] = useState("transfer");
  const [merchantCategory, setMerchantCategory] = useState("");
  const [location, setLocation] = useState("");
  const [fingerprint, setFingerprint] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [failedAttempts, setFailedAttempts] = useState("0");

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InterceptResponse | null>(null);
  const [detail, setDetail] = useState<TransactionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (running) return;
    setError(null);
    setResult(null);
    setDetail(null);
    const parsedAmount = Number(amount);
    if (!customerId.trim()) {
      setError("Customer ID is required.");
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Amount must be a number greater than zero.");
      return;
    }
    setRunning(true);
    try {
      const res = await postIntercept({
        customer_id: customerId.trim(),
        amount: parsedAmount,
        currency,
        channel,
        transaction_type: txType,
        ...(merchantCategory.trim() ? { merchant_category: merchantCategory.trim() } : {}),
        ...(location.trim() ? { location: location.trim() } : {}),
        ...(fingerprint.trim() || ipAddress.trim()
          ? {
              device: {
                fingerprint: fingerprint.trim() || `console-${Date.now()}`,
                ip_address: ipAddress.trim() || "127.0.0.1",
              },
            }
          : {}),
        failed_attempts: Math.max(0, parseInt(failedAttempts || "0", 10) || 0),
      });
      setResult(res);
      onIntercepted?.(res.transaction_id);
      // Load full agent-level evidence for the completed run
      setDetailLoading(true);
      try {
        setDetail(await getTransactionDetail(res.transaction_id));
      } catch {
        // Intercept response already carries verdict/trust/explanation;
        // detail enriches with per-agent rows when available.
      } finally {
        setDetailLoading(false);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Intercept failed.");
    } finally {
      setRunning(false);
    }
  }

  const predictions: AgentPrediction[] = detail?.predictions ?? [];
  const stages: Stage[] = !result && !running
    ? []
    : [
        { key: "received", label: "Received", state: "done", note: result ? result.transaction_id : undefined },
        { key: "running", label: "Running", state: running ? "active" : "done" },
        ...(["device", "fraud", "aml", "policy"] as const).map((m) => {
          const p = predictionFor(predictions, m);
          const label = { device: "Device check", fraud: "Fraud check", aml: "AML check", policy: "Policy check" }[m];
          if (running || (!p && !detail)) return { key: m, label, state: "queued" as StageState };
          if (!p) return { key: m, label, state: "skipped" as StageState };
          return { key: m, label, state: "done" as StageState, note: `conf ${confOf(p)} · ${latencyOf(p)}` };
        }),
        detail && detail.trust_score !== null
          ? { key: "trust", label: "Trust evaluation", state: "done" as StageState, note: `${detail.trust_score} / 100` }
          : { key: "trust", label: "Trust evaluation", state: (running ? "active" : "queued") as StageState },
        result && !running
          ? { key: "completed", label: `Completed · ${result.verdict.replace("_", " ")}`, state: "done" as StageState }
          : { key: "completed", label: "Completed", state: "queued" as StageState },
      ];

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
        <div className="text-title">New interception</div>
        <div className="text-caption">POST /api/v1/transactions/intercept</div>
      </div>
      <p className="text-caption" style={{ marginBottom: 14 }}>
        Submit a transaction to the governance pipeline. Verdict, agent results and evidence below come from the backend response.
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 12 }}>
          <div>
            <label style={labelStyle} htmlFor="ic-customer">Customer ID *</label>
            <input id="ic-customer" className="input" style={inputStyle} value={customerId} onChange={(e) => setCustomerId(e.target.value)} placeholder="uuid" disabled={running} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="ic-amount">Amount *</label>
            <input id="ic-amount" className="input" style={inputStyle} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" disabled={running} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="ic-currency">Currency</label>
            <select id="ic-currency" className="input" style={inputStyle} value={currency} onChange={(e) => setCurrency(e.target.value)} disabled={running}>
              {["USD", "EUR", "GBP", "INR"].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle} htmlFor="ic-channel">Channel</label>
            <select id="ic-channel" className="input" style={inputStyle} value={channel} onChange={(e) => setChannel(e.target.value)} disabled={running}>
              {["mobile", "web", "atm"].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle} htmlFor="ic-type">Type</label>
            <select id="ic-type" className="input" style={inputStyle} value={txType} onChange={(e) => setTxType(e.target.value)} disabled={running}>
              {["transfer", "payment", "withdrawal"].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle} htmlFor="ic-mcc">Merchant category</label>
            <input id="ic-mcc" className="input" style={inputStyle} value={merchantCategory} onChange={(e) => setMerchantCategory(e.target.value)} placeholder="5411" disabled={running} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="ic-loc">Location</label>
            <input id="ic-loc" className="input" style={inputStyle} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Berlin, DE" disabled={running} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="ic-fp">Device fingerprint</label>
            <input id="ic-fp" className="input" style={inputStyle} value={fingerprint} onChange={(e) => setFingerprint(e.target.value)} placeholder="optional" disabled={running} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="ic-ip">IP address</label>
            <input id="ic-ip" className="input" style={inputStyle} value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} placeholder="optional" disabled={running} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="ic-fail">Failed attempts</label>
            <input id="ic-fail" className="input" style={inputStyle} value={failedAttempts} onChange={(e) => setFailedAttempts(e.target.value)} inputMode="numeric" disabled={running} />
          </div>
        </div>
        <button type="submit" className="btn btn-primary" disabled={running} style={{ justifyContent: "center", minWidth: 220 }}>
          {running ? "Executing pipeline…" : "Submit to pipeline"}
        </button>
      </form>

      {error && (
        <div style={{ marginTop: 12, padding: 10, borderRadius: "var(--radius-md)", background: "var(--risk-critical-dim)", border: "1px solid var(--risk-critical)", fontSize: "var(--text-13)", color: "var(--risk-critical-text)" }}>
          {error}
        </div>
      )}

      {stages.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="text-label" style={{ marginBottom: 8 }}>Execution state</div>
          <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 0 }}>
            {stages.map((s, i) => (
              <li key={s.key} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, paddingTop: 3 }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: "50%",
                    background: s.state === "done" ? "var(--status-success)" : s.state === "active" ? "var(--accent)" : s.state === "skipped" ? "var(--gray-600)" : "var(--surface-4)",
                    border: "2px solid var(--border-1)",
                  }} />
                  {i < stages.length - 1 && <div style={{ width: 1, flex: 1, minHeight: 14, background: "var(--border-1)", margin: "3px 0" }} />}
                </div>
                <div style={{ paddingBottom: 8, minWidth: 0 }}>
                  <div style={{ fontSize: "var(--text-13)", fontWeight: 600, color: s.state === "queued" ? "var(--gray-500)" : "var(--gray-100)" }}>
                    {s.label}
                    {s.state === "active" && <span style={{ color: "var(--accent)", fontWeight: 500 }}> — running</span>}
                    {s.state === "skipped" && <span style={{ color: "var(--gray-600)", fontWeight: 500 }}> — no result</span>}
                  </div>
                  {s.note && (
                    <div style={{ fontSize: "var(--text-12)", color: "var(--gray-400)", fontFamily: "var(--font-mono)", wordBreak: "break-all" }}>{s.note}</div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {result && (
        <div style={{ marginTop: 16, borderTop: "1px solid var(--border-0)", paddingTop: 14 }}>
          <div className="text-label" style={{ marginBottom: 8 }}>Decision</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "8px 16px", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: "var(--gray-600)", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 2 }}>Transaction ID</div>
              <div style={{ fontSize: "var(--text-12)", color: "var(--gray-100)", fontFamily: "var(--font-mono)", wordBreak: "break-all" }}>{result.transaction_id}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--gray-600)", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 2 }}>Final decision</div>
              <div style={{ fontSize: "var(--text-14)", fontWeight: 700, color: result.verdict === "declined" ? "var(--risk-critical-text)" : result.verdict === "under_review" ? "var(--risk-medium-text)" : "var(--status-success)", textTransform: "uppercase" }}>
                {result.verdict.replace("_", " ")}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--gray-600)", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 2 }}>Trust score</div>
              <div style={{ fontSize: "var(--text-14)", fontWeight: 700, color: "var(--gray-100)", fontVariantNumeric: "tabular-nums" }}>{result.trust_score} / 100</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--gray-600)", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 2 }}>Human review</div>
              <div style={{ fontSize: "var(--text-13)", color: "var(--gray-200)" }}>
                {result.requires_human_review ? (
                  <>
                    Pending{result.review_id ? ` · ${result.review_id.slice(0, 8)}` : ""} —{" "}
                    <Link href="/dashboard/reviews" style={{ color: "var(--accent)", textDecoration: "underline" }}>open review queue</Link>
                  </>
                ) : (
                  "Not required"
                )}
              </div>
            </div>
          </div>

          {result.reasons.length > 0 && (
            <ul style={{ margin: "0 0 12px 18px", fontSize: "var(--text-13)", color: "var(--gray-300)" }}>
              {result.reasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          )}

          {result.explanation && (
            <div style={{ padding: 10, borderRadius: "var(--radius-md)", background: "var(--surface-2)", border: "1px solid var(--border-1)", fontSize: "var(--text-12)", color: "var(--gray-300)", lineHeight: 1.5, marginBottom: 12 }}>
              {result.explanation}
            </div>
          )}

          <div className="text-label" style={{ marginBottom: 8 }}>
            Agent results {detailLoading ? "(loading…)" : detail ? `(${predictions.length})` : ""}
          </div>
          {detail && predictions.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-12)" }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "var(--gray-500)", borderBottom: "1px solid var(--border-1)" }}>
                    <th style={{ padding: "6px 8px", fontWeight: 600 }}>Agent</th>
                    <th style={{ padding: "6px 8px", fontWeight: 600 }}>Version</th>
                    <th style={{ padding: "6px 8px", fontWeight: 600 }}>Confidence</th>
                    <th style={{ padding: "6px 8px", fontWeight: 600 }}>Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {predictions.map((p, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border-0)", color: "var(--gray-200)" }}>
                      <td style={{ padding: "6px 8px", fontFamily: "var(--font-mono)" }}>{String(p.agent ?? "—")}</td>
                      <td style={{ padding: "6px 8px", fontFamily: "var(--font-mono)" }}>{String(p.version ?? "—")}</td>
                      <td style={{ padding: "6px 8px", fontVariantNumeric: "tabular-nums" }}>{confOf(p)}</td>
                      <td style={{ padding: "6px 8px", fontVariantNumeric: "tabular-nums" }}>{latencyOf(p)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            !detailLoading && <div className="text-caption">Per-agent rows load from the transaction record after the run completes.</div>
          )}
        </div>
      )}
    </div>
  );
}
