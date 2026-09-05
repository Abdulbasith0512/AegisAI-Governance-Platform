// Central API base URL helper.
// NEXT_PUBLIC_API_URL is baked at `next build` time (see frontend/Dockerfile).
// Falls back to localhost for `npm run dev`.
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000";

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${p}`;
}

// ── Governance API types (mirror backend/app/schemas, backend is source of truth) ──
export type Verdict = "approved" | "declined" | "under_review";

export interface InterceptRequest {
  transaction_id?: string;
  customer_id: string;
  merchant_id?: string;
  merchant_category?: string;
  amount: number;
  currency?: string;
  location?: string;
  channel?: string;
  transaction_type?: string;
  failed_attempts?: number;
  device?: { fingerprint: string; ip_address: string; is_emulator?: boolean };
  beneficiary?: { beneficiary_account_number: string; bank_code: string; nickname?: string };
}

export interface InterceptResponse {
  transaction_id: string;
  verdict: Verdict;
  trust_score: number;
  reasons: string[];
  explanation: string | null;
  requires_human_review: boolean;
  review_id: string | null;
}

export interface AgentPrediction {
  agent: string;
  version: string;
  output?: unknown;
  prediction_output?: unknown;
  confidence?: number;
  confidence_score?: number;
  latency?: number;
  latency_ms?: number;
}

export interface TransactionDetail {
  transaction: {
    id: string;
    account_id: string;
    merchant_id: string | null;
    device_id: string | null;
    amount: number;
    currency: string;
    transaction_type: string;
    status: string;
    reference_number: string;
    initiated_at: string;
    completed_at: string | null;
  };
  trust_score: number | null;
  policy_status: string | null;
  consensus_score: number | null;
  predictions: AgentPrediction[];
  explanation: string | null;
}

export interface ReviewQueueItem {
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

export interface AuditEvent {
  id: string;
  transaction_id: string | null;
  event_type: string;
  actor: string | null;
  timestamp: string;
  payload: Record<string, unknown> | null;
  ledger_hash: string;
}

export interface AuditHistory {
  transaction_id: string;
  events: AuditEvent[];
}

export interface AuditVerify {
  transaction_id: string;
  valid: boolean;
  checked: number;
  broken_at: string | null;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function handle<T>(res: Response, action: string): Promise<T> {
  if (!res.ok) {
    let detail = `${action} failed (${res.status})`;
    try {
      const body = await res.json();
      const d = (body as { detail?: unknown }).detail;
      if (typeof d === "string") detail = d;
      else if (d) detail = `${detail}: ${JSON.stringify(d)}`;
    } catch {
      /* keep default */
    }
    throw new ApiError(res.status, detail);
  }
  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiError(res.status, `${action} returned a non-JSON response (${res.status}).`);
  }
}

// fetch() itself only throws on network-level failures (backend down,
// wrong host/port, CORS preflight rejection, offline browser). Classify
// those explicitly so the UI never shows an ambiguous message.
async function request<T>(path: string, action: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(apiUrl(path), init);
  } catch {
    throw new ApiError(
      0,
      `Backend unreachable at ${API_BASE_URL} — is it running, and is NEXT_PUBLIC_API_URL correct? (${action})`
    );
  }
  return handle<T>(res, action);
}

export interface HealthStatus {
  status: string;
  [key: string]: unknown;
}

// Unauthenticated liveness probe for the dashboard connection banner.
// Returns null when the backend cannot be reached at all.
export async function checkBackendHealth(): Promise<HealthStatus | null> {
  try {
    const res = await fetch(apiUrl("/health"));
    if (!res.ok) return { status: `http-${res.status}` };
    return (await res.json()) as HealthStatus;
  } catch {
    return null;
  }
}

// ── Governance API calls (backend remains the source of truth) ──
export async function postIntercept(payload: InterceptRequest): Promise<InterceptResponse> {
  return request<InterceptResponse>("/api/v1/transactions/intercept", "Intercept transaction", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function getTransactionDetail(txId: string): Promise<TransactionDetail> {
  return request<TransactionDetail>(
    `/api/v1/transactions/${encodeURIComponent(txId)}`,
    "Load transaction detail"
  );
}

export async function getTransactionsHistory(limit = 50): Promise<TransactionDetail["transaction"][]> {
  return request<TransactionDetail["transaction"][]>(
    `/api/v1/transactions/history?limit=${limit}`,
    "Load transaction history"
  );
}

export async function getReviewQueue(): Promise<ReviewQueueItem[]> {
  return request<ReviewQueueItem[]>("/api/v1/reviews/queue", "Load review queue");
}

export async function getAuditHistory(txId: string): Promise<AuditHistory> {
  return request<AuditHistory>(
    `/api/v1/audit/transaction/${encodeURIComponent(txId)}`,
    "Load audit history"
  );
}

export async function verifyAuditChain(txId: string): Promise<AuditVerify> {
  return request<AuditVerify>(
    `/api/v1/audit/transaction/${encodeURIComponent(txId)}/verify`,
    "Verify audit chain"
  );
}
