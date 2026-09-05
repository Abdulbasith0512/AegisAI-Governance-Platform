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
import { ConnectionState, TxEvent, TxSubscription, subscribeToTransaction } from "@/lib/txEvents";

type StageState = "done" | "active" | "queued" | "skipped" | "failed";

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
  const [connection, setConnection] = useState<ConnectionState | null>(null);
  const [liveStages, setLiveStages] = useState<Record<string, { state: StageState; note?: string }>>({});
  const [liveReviewId, setLiveReviewId] = useState<string | null>(null);
  const subRef = React.useRef<TxSubscription | null>(null);
  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const resyncRef = React.useRef(false);

  function closeStream() {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    subRef.current?.close();
    subRef.current = null;
  }

  React.useEffect(() => {
    return () => {
      closeStream();
    };
  }, []);

  const AGENT_STAGE: Record<string, string> = {
    DeviceAgent: "device",
    FraudAgent: "fraud",
    AMLAgent: "aml",
    PolicyAgent: "policy",
  };

  function applyEvent(ev: TxEvent) {
    const meta = (ev.metadata ?? {}) as Record<string, unknown>;
    switch (ev.event_type) {
      case "transaction.received":
        setLiveStages((p) => ({ ...p, received: { state: "done" }, running: { state: "active" } }));
        break;
      case "agent.started": {
        const key = ev.agent ? AGENT_STAGE[ev.agent] : undefined;
        if (key) setLiveStages((p) => ({ ...p, [key]: { state: "active" } }));
        break;
      }
      case "agent.completed": {
        const key = ev.agent ? AGENT_STAGE[ev.agent] : undefined;
        const ms = typeof meta.execution_time_s === "number" ? ` · ${(meta.execution_time_s * 1000).toFixed(1)} ms` : "";
        if (key) setLiveStages((p) => ({ ...p, [key]: { state: "done", note: `completed${ms}` } }));
        break;
      }
      case "agent.failed": {
        const key = ev.agent ? AGENT_STAGE[ev.agent] : undefined;
        const err = typeof meta.error === "string" ? meta.error : "failed";
        if (key) setLiveStages((p) => ({ ...p, [key]: { state: "failed", note: err } }));
        break;
      }
      case "policy.evaluated": {
        const failed = Array.isArray(meta.failed_policies) ? (meta.failed_policies as string[]).join(", ") : "";
        setLiveStages((p) => ({
          ...p,
          policy: { state: "done", note: failed ? `violations: ${failed}` : "passed" },
        }));
        break;
      }
      case "trust.calculated": {
        const score = typeof meta.trust_score === "number" ? meta.trust_score : null;
        setLiveStages((p) => ({
          ...p,
          trust: score !== null ? { state: "done", note: `${score} / 100` } : { state: "active" },
        }));
        break;
      }
      case "review.created":
        if (typeof meta.review_id === "string") setLiveReviewId(meta.review_id);
        break;
      case "decision.created":
        setLiveStages((p) => ({ ...p, completed: { state: "done" } }));
        // Grace period for late events (e.g. review.created) before
        // releasing the socket; resync on reconnect covers the rest.
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
        closeTimerRef.current = setTimeout(() => {
    subRef.current?.close();
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
          subRef.current = null;
        }, 8000);
        break;
      default:
        break;
    }
  }

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
    const failedRaw = failedAttempts.trim();
    if (failedRaw !== "" && !/^\d+$/.test(failedRaw)) {
      setError("Failed attempts must be a whole number, zero or more.");
      return;
    }
    if (fingerprint.trim() !== "" && ipAddress.trim() === "") {
      setError("Device IP is required when a fingerprint is provided (and vice versa).");
      return;
    }
    if (ipAddress.trim() !== "" && fingerprint.trim() === "") {
      setError("Device fingerprint is required when an IP is provided (and vice versa).");
      return;
    }
    setRunning(true);
    // Subscribe BEFORE posting so no execution event is missed. The
    // transaction ID is client-generated (backend accepts it), which lets
    // the socket attach ahead of the run.
    const txId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `console-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    subRef.current?.close();
    setLiveStages({ received: { state: "queued" }, running: { state: "queued" } });
    setLiveReviewId(null);
    setConnection(null);
    resyncRef.current = false;
    subRef.current = subscribeToTransaction(txId, {
      onEvent: applyEvent,
      onConnection: (state) => {
        setConnection(state);
        // Heal missed events from the REST source of truth on reconnect
        if (state === "reconnecting") resyncRef.current = true;
        if (state === "connected" && resyncRef.current) {
          resyncRef.current = false;
          void (async () => {
            try {
              const healed = await getTransactionDetail(txId);
              setDetail(healed);
              // Heal missed stage events from REST truth
              setLiveStages((prev) => {
                const next = { ...prev };
                for (const p of healed.predictions ?? []) {
                  const agent = String(p.agent ?? "").toLowerCase();
                  const key = ["device", "fraud", "aml", "policy"].find((m) => agent.includes(m));
                  if (key && !next[key]) {
                    next[key] = { state: "done", note: "recovered on reconnect" };
                  }
                }
                if (typeof healed.trust_score === "number" && !next.trust) {
                  next.trust = { state: "done", note: `${healed.trust_score} / 100` };
                }
                return next;
              });
            } catch {
              /* detail stays as-is; stages keep last-known state */
            }
          })();
        }
      },
      onExhausted: () => setError("Live stream unavailable — result below still comes from the completed request."),
    });
    try {
      const res = await postIntercept({
        transaction_id: txId,
        customer_id: customerId.trim(),
        amount: parsedAmount,
        currency,
        channel,
        transaction_type: txType,
        ...(merchantCategory.trim() ? { merchant_category: merchantCategory.trim() } : {}),
        ...(location.trim() ? { location: location.trim() } : {}),
        // Only send device signals the operator actually entered, and only
        // as a complete pair (backend requires fingerprint + ip together).
        // Empty fields are omitted, never filled with fake values.
        ...(fingerprint.trim() && ipAddress.trim()
          ? {
              device: {
                fingerprint: fingerprint.trim(),
                ip_address: ipAddress.trim(),
              },
            }
          : {}),
        failed_attempts: failedRaw === "" ? 0 : parseInt(failedRaw, 10),
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
      // The run never started: release the socket (no reconnect loop leaks)
      // and clear the queued stages so nothing implies execution.
      closeStream();
      setLiveStages({});
      setError(err instanceof ApiError ? err.message : "Intercept failed.");
    } finally {
      setRunning(false);
    }
  }

  const predictions: AgentPrediction[] = detail?.predictions ?? [];
  // Live socket state wins; REST detail enriches rows the socket missed.
  function stageFor(
    key: string,
    fallback: () => { state: StageState; note?: string }
  ): { state: StageState; note?: string } {
    return liveStages[key] ?? fallback();
  }
  const stages: Stage[] = !result && !running && Object.keys(liveStages).length === 0
    ? []
    : [
        {
          key: "received",
          label: "Received",
          ...stageFor("received", () => ({
            state: "done" as StageState,
            note: result ? result.transaction_id : undefined,
          })),
        },
        {
          key: "running",
          label: "Running",
          ...stageFor("running", () => ({ state: (running ? "active" : "done") as StageState })),
        },
        ...(["device", "fraud", "aml", "policy"] as const).map((m) => {
          const p = predictionFor(predictions, m);
          const label = { device: "Device check", fraud: "Fraud check", aml: "AML check", policy: "Policy check" }[m];
          const { state, note } = stageFor(m, () => {
            if (running || (!p && !detail)) return { state: "queued" as StageState };
            if (!p) return { state: "skipped" as StageState };
            return { state: "done" as StageState, note: `conf ${confOf(p)} · ${latencyOf(p)}` };
          });
          return { key: m, label, state, note };
        }),
        {
          key: "trust",
          label: "Trust evaluation",
          ...stageFor("trust", () =>
            detail && typeof detail.trust_score === "number"
              ? { state: "done" as StageState, note: `${detail.trust_score} / 100` }
              : { state: (running ? "active" : "queued") as StageState }
          ),
        },
        {
          key: "completed",
          label: result && !running ? `Completed · ${result.verdict.replace(/_/g, " ")}` : "Completed",
          ...stageFor("completed", () => ({
            state: (result && !running ? "done" : "queued") as StageState,
          })),
        },
      ];

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
        <div className="text-title">New interception</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {connection && connection !== "connected" && (
            <span style={{
              fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 999,
              background: connection === "reconnecting" ? "var(--risk-medium-dim)" : "var(--risk-critical-dim)",
              color: connection === "reconnecting" ? "var(--risk-medium-text)" : "var(--risk-critical-text)",
              border: "1px solid var(--border-1)",
            }}>
              {connection === "reconnecting" ? "Reconnecting live stream…" : "Live stream offline"}
            </span>
          )}
          <div className="text-caption">POST /api/v1/transactions/intercept</div>
        </div>
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
                    background: s.state === "done" ? "var(--status-success)" : s.state === "active" ? "var(--accent)" : s.state === "failed" ? "var(--risk-critical)" : s.state === "skipped" ? "var(--gray-600)" : "var(--surface-4)",
                    border: "2px solid var(--border-1)",
                  }} />
                  {i < stages.length - 1 && <div style={{ width: 1, flex: 1, minHeight: 14, background: "var(--border-1)", margin: "3px 0" }} />}
                </div>
                <div style={{ paddingBottom: 8, minWidth: 0 }}>
                  <div style={{ fontSize: "var(--text-13)", fontWeight: 600, color: s.state === "queued" ? "var(--gray-500)" : "var(--gray-100)" }}>
                    {s.label}
                    {s.state === "active" && <span style={{ color: "var(--accent)", fontWeight: 500 }}> — running</span>}
                    {s.state === "skipped" && <span style={{ color: "var(--gray-600)", fontWeight: 500 }}> — no result</span>}
                    {s.state === "failed" && <span style={{ color: "var(--risk-critical-text)", fontWeight: 600 }}> — failed</span>}
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
                {result.verdict.replace(/_/g, " ")}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--gray-600)", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 2 }}>Trust score</div>
              <div style={{ fontSize: "var(--text-14)", fontWeight: 700, color: "var(--gray-100)", fontVariantNumeric: "tabular-nums" }}>{result.trust_score} / 100</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--gray-600)", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 2 }}>Human review</div>
              <div style={{ fontSize: "var(--text-13)", color: "var(--gray-200)" }}>
                {(result.requires_human_review || liveReviewId) ? (
                  <>
                    Pending{(() => {
                      const id = result.review_id ?? liveReviewId;
                      return id ? ` · ${String(id).slice(0, 8)}` : "";
                    })()} —{" "}
                    <Link href="/dashboard/reviews" style={{ color: "var(--accent)", textDecoration: "underline" }}>open review queue</Link>
                  </>
                ) : (
                  "Not required"
                )}
              </div>
            </div>
          </div>

          {(result.reasons ?? []).length > 0 && (
            <ul style={{ margin: "0 0 12px 18px", fontSize: "var(--text-13)", color: "var(--gray-300)" }}>
              {(result.reasons ?? []).map((r, i) => <li key={i}>{r}</li>)}
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
