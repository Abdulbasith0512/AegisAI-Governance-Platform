import React, { useEffect, useRef, useState } from 'react';
import { eventStream } from '@/lib/eventStream';
import type { StreamEvent, RiskAlertPayload } from '@/lib/eventStream';
import { AlertTriangle, X } from 'lucide-react';

interface Toast {
  id: string;
  title: string;
  message: string;
  riskLevel?: 'critical' | 'high';
  ts: string;
}

export const ToastManager: React.FC = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timerRefs = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timerRefs.current.get(id);
    if (timer) clearTimeout(timer);
    timerRefs.current.delete(id);
  };

  useEffect(() => {
    const unsub = eventStream.on('risk_alert', (e: StreamEvent) => {
      const p = e.payload as RiskAlertPayload;
      const id = `toast-${Date.now()}`;
      const toast: Toast = {
        id,
        title: `${p.riskLevel === 'critical' ? 'Critical' : 'High'} risk alert`,
        message: `${p.customerName} · $${p.amount.toFixed(2)} · ${p.reason}`,
        riskLevel: p.riskLevel === 'critical' ? 'critical' : 'high',
        ts: new Date().toLocaleTimeString(),
      };
      setToasts((prev) => [toast, ...prev].slice(0, 5)); // max 5 toasts

      // Auto-dismiss after 6 seconds
      const timer = setTimeout(() => dismiss(id), 6000);
      timerRefs.current.set(id, timer);
    });

    return () => { unsub(); };
  }, []);

  if (toasts.length === 0) return null;

  const riskBorderColor = (level?: string) =>
    level === 'critical' ? 'var(--risk-critical)' : 'var(--risk-high)';
  const riskBgColor = (level?: string) =>
    level === 'critical' ? 'var(--risk-critical-dim)' : 'var(--risk-high-dim)';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        maxWidth: 360,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            background: 'var(--surface-2)',
            border: `1px solid ${riskBorderColor(toast.riskLevel)}`,
            borderLeft: `3px solid ${riskBorderColor(toast.riskLevel)}`,
            borderRadius: 'var(--radius-lg)',
            padding: '12px 14px',
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            pointerEvents: 'auto',
            animation: 'none',
          }}
        >
          <AlertTriangle
            size={15}
            style={{
              color: riskBorderColor(toast.riskLevel),
              flexShrink: 0,
              marginTop: 1,
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 'var(--text-13)',
                fontWeight: 600,
                color: 'var(--gray-100)',
                marginBottom: 3,
              }}
            >
              {toast.title}
            </div>
            <div
              style={{
                fontSize: 'var(--text-12)',
                color: 'var(--gray-400)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {toast.message}
            </div>
            <div
              style={{
                fontSize: 'var(--text-11)',
                color: 'var(--gray-600)',
                fontFamily: 'var(--font-mono)',
                marginTop: 4,
              }}
            >
              {toast.ts}
            </div>
          </div>
          <button
            className="btn btn-ghost btn-icon"
            style={{ flexShrink: 0, padding: 2 }}
            onClick={() => dismiss(toast.id)}
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
};
