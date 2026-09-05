// Live transaction execution events over native WebSocket.
//
// Protocol: WS /ws/transactions/{txId} streams canonical envelopes
// {event_id, transaction_id, event_type, timestamp, agent, status, metadata}
// plus {type: "heartbeat"} keep-alives (ignored here).
//
// Guarantees: exponential-backoff reconnect, event_id dedupe, resync hook
// for healing missed events from the REST source of truth. No timers fake
// execution — every callback fires on a real backend message.

import { API_BASE_URL } from "./api";

export interface TxEvent {
  event_id: string;
  transaction_id: string;
  event_type: string;
  timestamp: string;
  agent: string | null;
  status: string;
  metadata: Record<string, unknown>;
}

export type ConnectionState = "connected" | "reconnecting" | "disconnected";

export interface TxSubscription {
  close: () => void;
}

const MAX_BACKOFF_MS = 30000;
const MAX_ATTEMPTS = 10;

function wsUrl(txId: string): string {
  const base = API_BASE_URL.replace(/^http/, "ws");
  const url = `${base}/ws/transactions/${encodeURIComponent(txId)}`;
  // Forward a stored JWT when the app has one; the backend accepts ?token=
  // and falls back to its development bypass otherwise.
  try {
    const token =
      typeof localStorage !== "undefined" ? localStorage.getItem("aegis_token") : null;
    if (token) return `${url}?token=${encodeURIComponent(token)}`;
  } catch {
    /* storage unavailable — connect without token */
  }
  return url;
}

export function subscribeToTransaction(
  txId: string,
  handlers: {
    onEvent: (event: TxEvent) => void;
    onConnection?: (state: ConnectionState) => void;
    onExhausted?: () => void;
  }
): TxSubscription {
  let socket: WebSocket | null = null;
  let closed = false;
  let attempts = 0;
  let backoffTimer: ReturnType<typeof setTimeout> | null = null;
  const seen = new Set<string>();

  function setState(state: ConnectionState) {
    handlers.onConnection?.(state);
  }

  function connect() {
    if (closed) return;
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl(txId));
    } catch {
      scheduleReconnect();
      return;
    }
    socket = ws;

    ws.onopen = () => {
      attempts = 0;
      setState("connected");
    };

    ws.onmessage = (msg) => {
      let data: unknown;
      try {
        data = JSON.parse(String(msg.data));
      } catch {
        return;
      }
      if (!data || typeof data !== "object") return;
      const record = data as Record<string, unknown>;
      // Heartbeats keep the connection alive; they carry no execution data.
      if (record.type === "heartbeat" || !record.event_id) return;
      const id = String(record.event_id);
      if (seen.has(id)) return; // duplicate delivery
      seen.add(id);
      if (seen.size > 1000) {
        const first = seen.values().next().value as string;
        seen.delete(first);
      }
      handlers.onEvent(record as unknown as TxEvent);
    };

    ws.onerror = () => {
      try {
        ws.close();
      } catch {
        /* onclose drives reconnect */
      }
    };

    ws.onclose = (ev: CloseEvent) => {
      if (socket === ws) socket = null;
      if (closed) return;
      // 4401 = authentication rejected; retrying cannot succeed.
      if (ev.code === 4401) {
        setState("disconnected");
        handlers.onExhausted?.();
        return;
      }
      scheduleReconnect();
    };
  }

  function scheduleReconnect() {
    if (closed) return;
    if (attempts >= MAX_ATTEMPTS) {
      setState("disconnected");
      handlers.onExhausted?.();
      return;
    }
    setState("reconnecting");
    const delay = Math.min(1000 * 2 ** attempts, MAX_BACKOFF_MS);
    attempts += 1;
    backoffTimer = setTimeout(connect, delay);
  }

  connect();

  return {
    close() {
      closed = true;
      if (backoffTimer) clearTimeout(backoffTimer);
      try {
        socket?.close();
      } catch {
        /* already gone */
      }
      socket = null;
    },
  };
}
