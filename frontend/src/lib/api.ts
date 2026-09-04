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
  return (await res.json()) as T;
}

// ── Governance API calls (backend remains the source of truth) ──
export async function postIntercept(payload: InterceptRequest): Promise<InterceptResponse> {
  const res = await fetch(apiUrl("/api/v1/transactions/intercept"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handle<InterceptResponse>(res, "Intercept transaction");
}

export async function getTransactionDetail(txId: string): Promise<TransactionDetail> {
  const res = await fetch(apiUrl(`/api/v1/transactions/${txId}`));
  return handle<TransactionDetail>(res, "Load transaction detail");
}

export async function getTransactionsHistory(limit = 50): Promise<TransactionDetail["transaction"][]> {
  const res = await fetch(apiUrl(`/api/v1/transactions/history?limit=${limit}`));
  return handle<TransactionDetail["transaction"][]>(res, "Load transaction history");
}

export async function getReviewQueue(): Promise<ReviewQueueItem[]> {
  const res = await fetch(apiUrl("/api/v1/reviews/queue"));
  return handle<ReviewQueueItem[]>(res, "Load review queue");
}
