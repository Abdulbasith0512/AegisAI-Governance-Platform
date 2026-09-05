"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  DataTable, FilterBar, RiskBadge, Drawer, ChartContainer,
  SharedTooltip, CHART_COLORS, AXIS_PROPS, GRID_PROPS,
} from '@/components/ui';
import type { ColumnDef } from '@/components/ui/DataTable';
import type { Transaction, RiskLevel, TxStatus } from '@/lib/mockData';
import InterceptConsole from './intercept-console';
import { ApiError, getAuditHistory, getReviewQueue, getTransactionDetail, getTransactionsHistory, verifyAuditChain } from "@/lib/api";
import type { AuditEvent, AuditVerify, ReviewQueueItem, TransactionDetail } from "@/lib/api";

// Display helpers that never invent data: missing values render as "—",
// never as epoch dates, zeros, or inherited colors.
function fmtDateTime(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function safeLower(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : "";
}

// Amount histogram data
function buildAmountHistogram(txs: Transaction[]) {
  const buckets = [0, 100, 500, 1000, 5000, 10000, 25000];
  return buckets.slice(0, -1).map((min, i) => {
    const max = buckets[i + 1];
    return {
      label: `$${min}–${max}`,
      count: txs.filter(t => t.amount >= min && t.amount < max).length,
    };
  });
}

function buildRiskHistogram(txs: Transaction[]) {
  const levels: { level: RiskLevel; label: string; color: string }[] = [
    { level: 'critical', label: 'Critical', color: CHART_COLORS.critical },
    { level: 'high', label: 'High', color: CHART_COLORS.high },
    { level: 'medium', label: 'Medium', color: CHART_COLORS.medium },
    { level: 'low', label: 'Low', color: CHART_COLORS.low },
    { level: 'safe', label: 'Safe', color: CHART_COLORS.safe },
  ];
  return levels.map(({ level, label, color }) => ({
    label,
    count: txs.filter(t => t.riskLevel === level).length,
    color,
  }));
}

const STATUS_COLORS: Record<TxStatus, string> = {
  approved: 'var(--status-success)',
  declined: 'var(--risk-critical-text)',
  review: 'var(--risk-medium-text)',
  flagged: 'var(--risk-high-text)',
};

// ── Columns ────────────────────────────────────────────────────────────────
const COLUMNS: ColumnDef<Transaction>[] = [
  { key: 'id', header: 'TX ID', width: 130, mono: true, sortable: false,
    render: (v) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)' }}>{String(v)}</span> },
  { key: 'customerName', header: 'Customer', sortable: true, minWidth: 130 },
  { key: 'merchantName', header: 'Merchant', sortable: true, minWidth: 120 },
  { key: 'merchantCategory', header: 'Category', sortable: true, minWidth: 100 },
  { key: 'amount', header: 'Amount', sortable: true, mono: true, width: 110,
    render: (v, row) => (
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
        {(row as Transaction).currency} {Number(v).toLocaleString('en', { minimumFractionDigits: 2 })}
      </span>
    )},
  { key: 'riskLevel', header: 'Risk', width: 100,
    render: (v, row) => <RiskBadge level={(row as Transaction).riskLevel} /> },
  { key: 'status', header: 'Status', sortable: true, width: 90,
    render: (v) => (
      <span style={{
        fontSize: 'var(--text-11)', fontFamily: 'var(--font-mono)', fontWeight: 600,
        color: STATUS_COLORS[v as TxStatus], textTransform: 'uppercase', letterSpacing: '0.04em',
      }}>
        {String(v)}
      </span>
    )},
  { key: 'country', header: 'Country', sortable: true, width: 70, mono: true },
  { key: 'timestamp', header: 'Time', sortable: true, width: 160, mono: true,
    render: (v) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-500)' }}>{fmtDateTime(v)}</span> },
];

// ── Transactions Page (live governance data; backend is source of truth) ──
export default function Transactions() {
  const [allTxs, setAllTxs] = useState<Transaction[]>([]);
  const [newRowIds, setNewRowIds] = useState<Set<string>>(new Set());
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  // Fetch live history from backend API (no sample fallback)
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const data = await getTransactionsHistory(50);
      const mapped: Transaction[] = data.map((t) => {
        const status = t.status === "declined" ? "declined" : (t.status === "under_review" ? "review" : "approved");
        const riskLevel: RiskLevel = t.status === "declined" ? "critical" : (t.status === "under_review" ? "medium" : "safe");
        const accountId = typeof t.account_id === "string" ? t.account_id : "";
        return {
          id: t.id,
          customerId: accountId,
          customerName: accountId ? `Customer ${accountId.slice(0, 8).toUpperCase()}` : "Unknown customer",
          merchantName: t.merchant_id ? `Merchant ${t.merchant_id.slice(0, 8).toUpperCase()}` : "Direct transfer",
          merchantCategory: typeof t.transaction_type === "string" ? t.transaction_type.toUpperCase() : "UNKNOWN",
          amount: t.amount,
          currency: t.currency,
          riskScore: 0,
          riskLevel,
          status,
          agentVerdict: t.status === "declined" ? "BLOCK" : "ALLOW",
          rulesFireCount: 0,
          modelScore: 0,
          deviceId: t.device_id || "—",
          country: "—",
          timestamp: t.initiated_at,
        };
      });
      setAllTxs(mapped);
    } catch (err) {
      setHistoryError(err instanceof ApiError ? err.message : "Failed to load transaction history.");
      setAllTxs([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    async function initial() { await loadHistory(); }
    void initial();
  }, [loadHistory]);

  // Highlight a newly intercepted transaction and refresh the list.
  // The timer only clears the highlight; it never fabricates rows.
  const highlightTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    return () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    };
  }, []);
  const handleIntercepted = useCallback(async (txId: string) => {
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    setNewRowIds(new Set([txId]));
    highlightTimer.current = setTimeout(() => setNewRowIds(new Set()), 4000);
    await loadHistory();
  }, [loadHistory]);

  // Filter logic
  const filtered = useMemo(() => {
    let rows = allTxs;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(t =>
        safeLower(t.id).includes(q) ||
        safeLower(t.customerName).includes(q) ||
        safeLower(t.merchantName).includes(q) ||
        safeLower(t.country).includes(q)
      );
    }
    const riskF = activeFilters['riskLevel'];
    if (riskF?.length) rows = rows.filter(t => riskF.includes(t.riskLevel));
    const statusF = activeFilters['status'];
    if (statusF?.length) rows = rows.filter(t => statusF.includes(t.status));
    return rows;
  }, [allTxs, search, activeFilters]);

  const amountHisto = useMemo(() => buildAmountHistogram(filtered.slice(0, 500)), [filtered]);
  const riskHisto   = useMemo(() => buildRiskHistogram(filtered.slice(0, 500)), [filtered]);

  return (
    <div style={{ maxWidth: 1600 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-20)', fontWeight: 700, color: 'var(--gray-50)', lineHeight: 1 }}>Transactions</h1>
          <p style={{ fontSize: 'var(--text-13)', color: 'var(--gray-500)', marginTop: 4 }}>
            {historyLoading ? "Loading live transactions…" : `${allTxs.length.toLocaleString()} transactions · live governance data`}
          </p>
        </div>
      </div>

      <InterceptConsole onIntercepted={handleIntercepted} />

      {/* Distribution charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <ChartContainer title="Amount Distribution" subtitle="Tx count by amount bucket" height={160}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={amountHisto} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey="label" {...AXIS_PROPS} />
              <YAxis {...AXIS_PROPS} width={36} />
              <Tooltip content={<SharedTooltip />} />
              <Bar dataKey="count" fill={CHART_COLORS.accent} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
        <ChartContainer title="Transactions by Risk Level" subtitle="Live ledger rows grouped by assessed level" height={160}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={riskHisto} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey="label" {...AXIS_PROPS} />
              <YAxis {...AXIS_PROPS} width={36} />
              <Tooltip content={<SharedTooltip />} />
              <Bar dataKey="count" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                {riskHisto.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>

      {/* Table card */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--border-0)' }}>
          <FilterBar
            searchPlaceholder="Search by ID, customer, merchant, country…"
            searchValue={search}
            onSearchChange={setSearch}
            filters={[
              { key: 'riskLevel', label: 'Risk Level', options: ['critical','high','medium','low','safe'].map(v => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) })) },
              { key: 'status', label: 'Status', options: ['approved','declined','review','flagged'].map(v => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) })) },
            ]}
            activeFilters={activeFilters}
            onFilterChange={(key, vals) => setActiveFilters(prev => ({ ...prev, [key]: vals }))}
            onClearAll={() => { setSearch(''); setActiveFilters({}); }}
            totalCount={allTxs.length}
            filteredCount={filtered.length}
          />
        </div>
        {historyError ? (
          <div style={{ padding: 32, textAlign: 'center', fontSize: 'var(--text-13)', color: 'var(--risk-critical-text)' }}>
            <p>Could not reach the transaction API: {historyError}</p>
            <button className="btn btn-outline" style={{ marginTop: 12 }} onClick={() => void loadHistory()}>Retry</button>
          </div>
        ) : (
          <DataTable
            columns={COLUMNS}
            data={filtered}
            rowKey={(t) => t.id}
            maxHeight={560}
            newRowIds={newRowIds}
            onRowClick={(tx) => setSelectedTx(tx)}
          />
        )}
      </div>

      {/* Transaction detail drawer */}
      <Drawer
        open={!!selectedTx}
        onClose={() => setSelectedTx(null)}
        title={selectedTx?.id}
        subtitle={[selectedTx?.customerName, selectedTx?.merchantName].filter(Boolean).join(" · ") || undefined}
      >
        {selectedTx && <TxDetail tx={selectedTx} />}
      </Drawer>
    </div>
  );
}

// ── Transaction Detail Content (live backend record; source of truth) ──
function TxDetail({ tx }: { tx: Transaction }) {
  const [details, setDetails] = useState<TransactionDetail | null>(null);
  const [review, setReview] = useState<ReviewQueueItem | null>(null);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [auditVerify, setAuditVerify] = useState<AuditVerify | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadDetails() {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await getTransactionDetail(tx.id);
        if (!cancelled) setDetails(data);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof ApiError ? err.message : "Failed to load transaction record.");
          setDetails(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
      // Human review status for this transaction (best-effort enrichment)
      try {
        const queue = await getReviewQueue();
        if (!cancelled) setReview(queue.find((r) => r.transaction_id === tx.id) ?? null);
      } catch {
        if (!cancelled) setReview(null);
      }
      // Immutable ledger slice + chain verdict (best-effort enrichment).
      // allSettled: a verify failure must not discard loaded events.
      const [historyRes, verifyRes] = await Promise.allSettled([
        getAuditHistory(tx.id),
        verifyAuditChain(tx.id),
      ]);
      if (cancelled) return;
      if (historyRes.status === "fulfilled" && Array.isArray(historyRes.value?.events)) {
        setAudit(historyRes.value.events);
      } else {
        setAudit([]);
      }
      setAuditVerify(verifyRes.status === "fulfilled" ? verifyRes.value : null);
    }
    void loadDetails();
    return () => {
      cancelled = true;
    };
  }, [tx.id]);

  if (loading) {
    return <div style={{ padding: 20, color: 'var(--gray-500)', fontSize: 12 }}>Loading live transaction record…</div>;
  }

  if (loadError || !details) {
    return (
      <div style={{ padding: 20, fontSize: 'var(--text-13)', color: 'var(--risk-critical-text)' }}>
        <p>{loadError ?? "Transaction record unavailable."}</p>
      </div>
    );
  }

  const activeTx = details.transaction;
  const trust = details.trust_score ?? 0;
  const detailStatusKey = (activeTx.status === 'under_review' ? 'review' : activeTx.status) as TxStatus;
  const detailStatusColor = STATUS_COLORS[detailStatusKey] ?? 'var(--gray-400)';
  const detailStatusLabel = typeof activeTx.status === 'string' ? activeTx.status : 'unknown';
  const explanation = details.explanation ?? "No explanation generated.";
  const predictions = details.predictions ?? [];

  const timelineEvents = [
    { label: 'Transaction received and validated', status: 'done' },
    { label: `Policies checks resolved: ${details.policy_status || 'PASS'}`, status: details.policy_status === 'fail' ? 'error' : 'done' },
    { label: `Agent consensus scored: ${((details.consensus_score ?? 1.0) * 100).toFixed(0)}%`, status: 'done' },
    { label: `Overall trust score resolved: ${trust} / 100`, status: trust < 60 ? 'error' : 'done' },
    { label: `Verdict output: ${String(activeTx.status ?? 'unknown').toUpperCase()}`, status: activeTx.status === 'declined' ? 'error' : 'done' }
  ];

  const fields: [string, string][] = [
    ['Transaction ID', activeTx.id],
    ['Customer Account', activeTx.account_id],
    ['Device ID', activeTx.device_id || 'unknown'],
    ['Merchant ID', activeTx.merchant_id || 'direct transfer'],
    ['Amount', `${activeTx.currency} ${Number(activeTx.amount).toLocaleString()}`],
    ['Category', activeTx.transaction_type],
    ['Risk Score', `${100 - trust} / 100`],
    ['Trust Level', `${trust} / 100`],
    ['Status', activeTx.status.toUpperCase()],
    ['Reference Number', activeTx.reference_number || 'none'],
    ['Timestamp', fmtDateTime(activeTx.initiated_at)]
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Status + Risk */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <RiskBadge level={trust < 50 ? 'critical' : (trust < 75 ? 'medium' : 'safe')} score={100 - trust} />
        <span style={{
          fontSize: 'var(--text-11)', fontWeight: 700,
          color: detailStatusColor, textTransform: 'uppercase',
          letterSpacing: '0.04em', padding: '2px 7px', borderRadius: 9999,
          background: 'var(--surface-3)', border: '1px solid var(--border-2)',
        }}>{detailStatusLabel}</span>
      </div>

      {/* Fields grid */}
      <div>
        <div className="text-label" style={{ marginBottom: 8 }}>Transaction Details</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
          {fields.map(([label, value]) => (
            <div key={label} style={{ paddingBottom: 6, borderBottom: '1px solid var(--border-0)' }}>
              <div style={{ fontSize: 10, color: 'var(--gray-600)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 'var(--text-12)', color: 'var(--gray-200)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Explainability section */}
      <div>
        <div className="text-label" style={{ marginBottom: 8 }}>Explainability Audit Details</div>
        <div style={{
          padding: 10, borderRadius: 'var(--radius-md)', background: 'var(--surface-2)',
          border: '1px solid var(--border-1)', fontSize: 'var(--text-12)',
          fontFamily: 'var(--font-mono)', color: 'var(--gray-300)', lineHeight: 1.4
        }}>
          {explanation}
        </div>
      </div>

      {/* Decision timeline */}
      <div>
        <div className="text-label" style={{ marginBottom: 10 }}>Decision Timeline</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {timelineEvents.map((evt, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, paddingTop: 2 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: evt.status === 'error' ? 'var(--risk-critical)' : 'var(--status-success)',
                  border: `2px solid ${evt.status === 'error' ? 'var(--risk-critical-dim)' : 'var(--risk-low-dim)'}`,
                  flexShrink: 0,
                }} />
                {i < timelineEvents.length - 1 && (
                  <div style={{ width: 1, flex: 1, minHeight: 20, background: 'var(--border-1)', margin: '4px 0' }} />
                )}
              </div>
              <div style={{ paddingBottom: 10 }}>
                <div style={{ fontSize: 'var(--text-13)', color: 'var(--gray-200)' }}>{evt.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Agent results (backend predictions) */}
      <div>
        <div className="text-label" style={{ marginBottom: 8 }}>Agent Results ({predictions.length})</div>
        {predictions.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-12)' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--gray-500)', borderBottom: '1px solid var(--border-1)' }}>
                  <th style={{ padding: '6px 8px', fontWeight: 600 }}>Agent</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600 }}>Version</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600 }}>Confidence</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600 }}>Latency</th>
                </tr>
              </thead>
              <tbody>
                {predictions.map((p, i) => {
                  const conf = p.confidence ?? p.confidence_score;
                  const lat = p.latency ?? p.latency_ms;
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-0)', color: 'var(--gray-200)' }}>
                      <td style={{ padding: '6px 8px', fontFamily: 'var(--font-mono)' }}>{String(p.agent ?? '—')}</td>
                      <td style={{ padding: '6px 8px', fontFamily: 'var(--font-mono)' }}>{String(p.version ?? '—')}</td>
                      <td style={{ padding: '6px 8px', fontVariantNumeric: 'tabular-nums' }}>{typeof conf === 'number' ? conf.toFixed(3) : '—'}</td>
                      <td style={{ padding: '6px 8px', fontVariantNumeric: 'tabular-nums' }}>{typeof lat === 'number' ? `${lat.toFixed(1)} ms` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-caption">No per-agent rows recorded for this transaction.</div>
        )}
      </div>

      {/* Human review status */}
      <div>
        <div className="text-label" style={{ marginBottom: 8 }}>Human Review</div>
        {review ? (
          <div style={{ fontSize: 'var(--text-13)', color: 'var(--gray-200)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div>Status: <strong style={{ textTransform: 'uppercase' }}>{review.status}</strong></div>
            <div style={{ color: 'var(--gray-400)', fontSize: 'var(--text-12)' }}>
              Reviewer: {review.reviewer_name ?? 'Unassigned'} · SLA {review.is_sla_breached ? 'breached' : `due ${fmtDateTime(review.sla_deadline)}`}
            </div>
          </div>
        ) : (
          <div className="text-caption">
            {activeTx.status === 'under_review'
              ? 'Flagged for review — see the Human Reviews queue for the live case.'
              : 'No human review required for this transaction.'}
          </div>
        )}
      </div>

      {/* Immutable audit trail */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div className="text-label">Audit Trail</div>
          {auditVerify && (
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
              background: auditVerify.valid ? 'var(--risk-safe-dim)' : 'var(--risk-critical-dim)',
              color: auditVerify.valid ? 'var(--risk-safe-text)' : 'var(--risk-critical-text)',
              border: '1px solid var(--border-1)',
            }}>
              {auditVerify.valid ? `Chain verified · ${auditVerify.checked}` : 'Chain broken'}
            </span>
          )}
        </div>
        {audit.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {audit.map((evt, i) => (
              <div key={evt.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, paddingTop: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--gray-500)', flexShrink: 0 }} />
                  {i < audit.length - 1 && (
                    <div style={{ width: 1, flex: 1, minHeight: 16, background: 'var(--border-1)', margin: '3px 0' }} />
                  )}
                </div>
                <div style={{ paddingBottom: 8, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--text-13)', color: 'var(--gray-200)', fontFamily: 'var(--font-mono)' }}>{evt.event_type}</div>
                  <div style={{ fontSize: 'var(--text-11)', color: 'var(--gray-500)' }}>
                    {fmtDateTime(evt.timestamp)} · {evt.actor ?? 'system'} · #{typeof evt.ledger_hash === 'string' ? evt.ledger_hash.slice(0, 8) : '—'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-caption">No ledger events recorded for this transaction yet.</div>
        )}
      </div>
    </div>
  );
}