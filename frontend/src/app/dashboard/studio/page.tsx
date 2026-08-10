"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Network, Play, FileEdit, Loader2 } from "lucide-react";
import { ToastBar } from "@/components/ui/ToastBar";

const TEXT_PRIMARY = "var(--text-1)";
const TEXT_SECONDARY = "var(--text-2)";
const TEXT_MUTED = "var(--text-3)";
const PANEL_BG = "var(--surface-2)";
const PANEL_BORDER = "1px solid var(--border-1)";
const PANEL_RADIUS = "var(--radius-xl)";
const ACCENT = "var(--accent-1)";

interface Workflow {
  id: string;
  name: string;
  description: string;
  status: string;
  created_at: string;
  is_template: boolean;
}

export default function AIStudioDashboard() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<{id: string, type: string, message: string}[]>([]);

  const fetchWorkflows = useCallback(async () => {
    try {
      const res = await fetch("http://localhost:8000/api/v1/workflows");
      if (res.ok) {
        const data = await res.json();
        setWorkflows(data);
      } else {
        throw new Error("Failed to load workflows");
      }
    } catch {
      // Mock data if backend is offline
      setWorkflows([
        { id: "1", name: "Transaction Evaluation", description: "Default fraud and AML combined workflow.", status: "published", created_at: new Date().toISOString(), is_template: false },
        { id: "2", name: "KYC Onboarding Check", description: "Verify documents and identity scoring.", status: "draft", created_at: new Date().toISOString(), is_template: false },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await fetchWorkflows();
    })();
  }, [fetchWorkflows]);

  const handleCreateWorkflow = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/v1/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Workflow", description: "A new governance workflow." })
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/dashboard/studio/builder/${data.id}`);
      }
    } catch {
      // Mock fallback: just navigate to a fake builder
      router.push(`/dashboard/studio/builder/new-123`);
    }
  };

  const removeToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <ToastBar toasts={toasts} onDismiss={removeToast} />
      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: TEXT_PRIMARY, display: "flex", alignItems: "center", gap: 10 }}>
            <Network size={24} style={{ color: ACCENT }} /> AI Governance Studio
          </h1>
          <p style={{ fontSize: 13, color: TEXT_SECONDARY, marginTop: 4 }}>
            Visually create, edit, validate, execute, and monitor AI governance workflows.
          </p>
        </div>
        
        <button
          onClick={handleCreateWorkflow}
          style={{
            background: ACCENT, color: "#fff", border: "none", borderRadius: "var(--radius-md)",
            padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 8, transition: "opacity 0.2s"
          }}
        >
          <Plus size={16} /> Create Workflow
        </button>
      </div>

      <div style={{ background: PANEL_BG, border: PANEL_BORDER, borderRadius: PANEL_RADIUS, padding: 20, minHeight: 400 }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 200, color: TEXT_MUTED }}>
            <Loader2 className="spin-animation" size={24} />
          </div>
        ) : workflows.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: TEXT_MUTED }}>
            <Network size={40} style={{ margin: "0 auto 16px", opacity: 0.5 }} />
            <p>No workflows found.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
            {workflows.map(wf => (
              <div key={wf.id} style={{ 
                border: PANEL_BORDER, borderRadius: "var(--radius-md)", padding: 16, 
                display: "flex", flexDirection: "column", gap: 12, background: "var(--surface-1)"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: TEXT_PRIMARY }}>{wf.name}</h3>
                  <span style={{ 
                    fontSize: 10, padding: "2px 8px", borderRadius: 10,
                    background: wf.status === "published" ? "var(--success-dim)" : "var(--gray-dim)",
                    color: wf.status === "published" ? "var(--success)" : TEXT_MUTED
                  }}>
                    {wf.status.toUpperCase()}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: TEXT_SECONDARY, flex: 1 }}>{wf.description}</p>
                <div style={{ display: "flex", gap: 8, borderTop: PANEL_BORDER, paddingTop: 12 }}>
                  <button onClick={() => router.push(`/dashboard/studio/builder/${wf.id}`)} style={{ 
                    flex: 1, background: "none", border: PANEL_BORDER, color: TEXT_PRIMARY, padding: "6px", 
                    borderRadius: "4px", fontSize: 12, cursor: "pointer", display: "flex", justifyContent: "center", gap: 6 
                  }}>
                    <FileEdit size={14} /> Edit
                  </button>
                  <button onClick={() => router.push(`/dashboard/studio/runs/${wf.id}`)} style={{ 
                    flex: 1, background: "none", border: PANEL_BORDER, color: TEXT_PRIMARY, padding: "6px", 
                    borderRadius: "4px", fontSize: 12, cursor: "pointer", display: "flex", justifyContent: "center", gap: 6 
                  }}>
                    <Play size={14} /> Execute
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <style>{`
        .spin-animation { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
