"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { apiUrl } from '@/lib/api';
import { RiskBadge, DataTable, FilterBar, Drawer } from '@/components/ui';
import type { ColumnDef } from '@/components/ui/DataTable';
import type { RiskLevel } from '@/lib/mockData';

interface QueueItem {
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
}

interface ReviewDetail extends QueueItem {
  comments: string | null;
  reviewed_at: string | null;
  trust_warnings: string[];
  explanation_human: string | null;
  explanation_timeline: { event?: string; duration?: string; status?: string }[];
  explanation_shap: Record<string, number>;
  policy_checks: { rule_id: string; status: string; details?: unknown }[];
}

interface Row {
  id: string;
  customerName: string;
  amount: number;
  riskLevel: RiskLevel;
  riskScore: number;
  reason: string;
  assignedTo: string;
  status: string;
  slaDeadline: string;
  createdAt: string;
}

function trustToRisk(trust: number): { level: RiskLevel; score: number } {
  const score = Math.max(0, Math.min(100, Math.round(100 - trust)));
  if (trust < 50) return { level: 'critical', score };
  if (trust < 60) return { level: 'high', score };
  if (trust < 75) return { level: 'medium', score };
  if (trust < 90) return { level: 'low', score };
  return { level: 'safe', score };
}

function toRow(q: QueueItem): Row {
  const { level, score } = trustToRisk(q.trust_score);
  return {
    id: q.id,
    customerName: q.customer_name,
    amount: q.amount,
    riskLevel: level,
    riskScore: score,
    reason: `Trust ${Math.round(q.trust_score)} · ${q.status.replace('_', ' ')}`,
    assignedTo: q.reviewer_name ?? 'Unassigned',
    status: q.status,
    slaDeadline: q.sla_deadline,
    createdAt: q.assigned_at,
  };
}

function slaStatus(deadline: string): { label: string; color: string } {
  const msLeft = new Date(deadline).getTime() - Date.now();
  if (msLeft < 0) return { label: 'Breached', color: 'var(--risk-critical-text)' };
  if (msLeft < 3600000) return { label: `${Math.round(msLeft / 60000)}m left`, color: 'var(--risk-high-text)' };
  return { label: `${(msLeft / 3600000).toFixed(1)}h left`, color: 'var(--risk-low-text)' };
}

const COLUMNS: ColumnDef<Row>[] = [
  { key: 'id', header: 'Case ID', width: 130, mono: true },
  { key: 'customerName', header: 'Customer', sortable: true },
  { key: 'amount', header: 'Amount', sortable: true, mono: true, width: 110,
    render: (v) => `$${Number(v).toLocaleString('en', { minimumFractionDigits: 2 })}` },
  { key: 'riskLevel', header: 'Risk', width: 110, render: (v, row) => <RiskBadge level={(row as Row).riskLevel} score={(row as Row).riskScore} /> },
  { key: 'reason', header: 'Reason', minWidth: 180 },
  { key: 'assignedTo', header: 'Assigned', width: 120, mono: true },
  { key: 'status', header: 'Status', width: 100, sortable: true,
    render: (v) => <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: v === 'pending' ? 'var(--risk-medium-text)' : v === 'escalated' ? 'var(--risk-high-text)' : v === 'approved' ? 'var(--status-success)' : v === 'rejected' ? 'var(--risk-critical-text)' : 'var(--gray-400)' }}>{String(v)}</span> },
  { key: 'slaDeadline', header: 'SLA', width: 100,
    render: (v) => { const { label, color } = slaStatus(String(v)); return <span style={{ fontSize: 11, fontWeight: 600, color }}>{label}</span>; } },
];

export default function HumanReviews() {
  const [search, setSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReviewDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [comments, setComments] = useState('');
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [qRes, hRes] = await Promise.all([
        fetch(apiUrl('/api/v1/reviews/queue')),
        fetch(apiUrl('/api/v1/reviews/history')),
      ]);
      if (!qRes.ok) throw new Error(`Queue request failed (${qRes.status})`);
      if (!hRes.ok) throw new Error(`History request failed (${hRes.status})`);
      const qData: QueueItem[] = await qRes.json();
      const hData: QueueItem[] = await hRes.json();
      setQueue([...qData, ...hData]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load review queue');
      setQueue([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function initial() { await loadQueue(); }
    void initial();
  }, [loadQueue]);

  const openDetail = useCallback(async (id: string) => {
    setSelectedId(id);
    setDetail(null);
    setComments('');
    setActionError(null);
    setDetailLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/v1/reviews/${id}`));
      if (!res.ok) throw new Error(`Detail request failed (${res.status})`);
      setDetail(await res.json());
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to load case detail');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const submitAction = useCallback(async (status: 'approved' | 'rejected' | 'escalated') => {
    if (!selectedId) return;
    if (comments.trim().length < 10) {
      setActionError('Comments must be at least 10 characters.');
      return;
    }
    setActing(true);
    setActionError(null);
    try {
      const res = await fetch(apiUrl(`/api/v1/reviews/${selectedId}/action`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, comments: comments.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const msg = body?.detail
          ? (typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail))
          : `Action failed (${res.status})`;
        throw new Error(msg);
      }
      setSelectedId(null);
      setDetail(null);
      setComments('');
      await loadQueue();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActing(false);
    }
  }, [selectedId, comments, loadQueue]);

  const rows = queue.map(toRow);
  const filtered = rows.filter(c => {
    if (search && !c.customerName.toLowerCase().includes(search.toLowerCase()) && !c.id.toLowerCase().includes(search.toLowerCase())) return false;
    const sf = activeFilters['status'];
    if (sf?.length && !sf.includes(c.status)) return false;
    return true;
  });

  return (
    <div style={{ maxWidth: 1600 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 'var(--text-20)', fontWeight: 700, color: 'var(--gray-50)' }}>Human Reviews</h1>
        <p style={{ fontSize: 'var(--text-13)', color: 'var(--gray-500)', marginTop: 4 }}>
          {loading ? 'Loading live review queue…' : `${queue.length} cases in queue`}
        </p>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--border-0)' }}>
          <FilterBar
            searchPlaceholder="Search cases…"
            searchValue={search}
            onSearchChange={setSearch}
            filters={[{ key: 'status', label: 'Status', options: ['pending','escalated','approved','rejected'].map(v => ({ value: v, label: v.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) })) }]}
            activeFilters={activeFilters}
            onFilterChange={(k, v) => setActiveFilters(p => ({ ...p, [k]: v }))}
            onClearAll={() => { setSearch(''); setActiveFilters({}); }}
            totalCount={queue.length}
            filteredCount={filtered.length}
          />
        </div>
        {error ? (
          <div style={{ padding: 32, textAlign: 'center', fontSize: 'var(--text-13)', color: 'var(--risk-critical-text)' }}>
            <p>Could not reach the review API: {error}</p>
            <button className="btn btn-outline" style={{ marginTop: 12 }} onClick={() => void loadQueue()}>Retry</button>
          </div>
        ) : (
          <DataTable columns={COLUMNS} data={filtered} rowKey={c => c.id} maxHeight={580} onRowClick={(r) => void openDetail(r.id)} />
        )}
      </div>
      <Drawer open={!!selectedId} onClose={() => { setSelectedId(null); setDetail(null); setComments(''); }} title={selectedId ?? ''} subtitle={detail?.customer_name}>
        {detailLoading && (
          <div style={{ padding: 24, fontSize: 'var(--text-13)', color: 'var(--gray-500)' }}>Loading case evidence…</div>
        )}
        {detail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <RiskBadge level={trustToRisk(detail.trust_score).level} score={Math.round(detail.trust_score)} />
              {detail.is_sla_breached && (
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--risk-critical-text)' }}>SLA BREACHED</span>
              )}
            </div>
            <div>
              <p style={{ fontSize: 'var(--text-13)', color: 'var(--gray-400)', marginBottom: 12 }}>
                <strong style={{ color: 'var(--gray-200)' }}>Explanation: </strong>
                {detail.explanation_human ?? 'No explanation recorded.'}
              </p>
              {detail.trust_warnings.length > 0 && (
                <ul style={{ fontSize: 'var(--text-13)', color: 'var(--risk-medium-text)', margin: '0 0 12px 16px' }}>
                  {detail.trust_warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              )}
              {[['Amount', `${detail.currency} $${detail.amount.toFixed(2)}`], ['Transaction', detail.transaction_id], ['Reviewer', detail.reviewer_name ?? 'Unassigned'], ['SLA Deadline', new Date(detail.sla_deadline).toLocaleString()], ['Assigned', new Date(detail.assigned_at).toLocaleString()]].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '5px 0', borderBottom: '1px solid var(--border-0)', fontSize: 'var(--text-13)' }}>
                  <span style={{ color: 'var(--gray-500)', flexShrink: 0 }}>{k}</span>
                  <span style={{ fontSize: 12, color: 'var(--gray-200)', textAlign: 'right', overflowWrap: 'anywhere' }}>{v}</span>
                </div>
              ))}
              {detail.policy_checks.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <p style={{ fontSize: 'var(--text-12)', fontWeight: 600, color: 'var(--gray-400)', marginBottom: 8 }}>POLICY CHECKS</p>
                  {detail.policy_checks.map((pc) => (
                    <div key={pc.rule_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border-0)', fontSize: 'var(--text-13)' }}>
                      <span style={{ color: 'var(--gray-200)' }}>{pc.rule_id}</span>
                      <span style={{ color: pc.status === 'pass' ? 'var(--status-success)' : 'var(--risk-critical-text)', fontWeight: 600 }}>{pc.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Reviewer comments (minimum 10 characters)…"
                rows={3}
                className="input"
                style={{ resize: 'vertical' }}
              />
            </div>
            {actionError && (
              <div style={{ fontSize: 'var(--text-13)', color: 'var(--risk-critical-text)' }}>{actionError}</div>
            )}
            <div style={{ display: 'flex', gap: 8, paddingTop: 8 }}>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={acting} onClick={() => void submitAction('approved')}>Approve</button>
              <button className="btn btn-danger" style={{ flex: 1, justifyContent: 'center' }} disabled={acting} onClick={() => void submitAction('rejected')}>Reject</button>
              <button className="btn btn-outline" disabled={acting} onClick={() => void submitAction('escalated')}>Escalate</button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
