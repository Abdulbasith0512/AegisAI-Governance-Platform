"use client";

import React, { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Play, CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";

interface ExecutionStep {
  msg: string;
  status: string;
  time: number;
}

export default function WorkflowExecution() {
  const router = useRouter();
  const params = useParams();
  const workflowId = params.id as string;
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<ExecutionStep[]>([]);

  const handleExecute = () => {
    setIsRunning(true);
    setLogs([]);
    
    // Simulate execution flow
    const steps = [
      { msg: "Starting workflow run...", status: "pending", time: 0 },
      { msg: "Start Node executed successfully.", status: "success", time: 500 },
      { msg: "Calling Fraud Agent...", status: "pending", time: 800 },
      { msg: "Fraud Agent returned score: 0.05", status: "success", time: 2000 },
      { msg: "Calling AML Agent...", status: "pending", time: 2200 },
      { msg: "AML Agent returned risk: low", status: "success", time: 3500 },
      { msg: "Evaluating Decision Logic...", status: "pending", time: 3800 },
      { msg: "Decision: Approved", status: "success", time: 4200 },
      { msg: "Workflow completed successfully.", status: "success", time: 4500 }
    ];

    steps.forEach((step, index) => {
      setTimeout(() => {
        setLogs(prev => [...prev, step]);
        if (index === steps.length - 1) setIsRunning(false);
      }, step.time);
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 80px)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 0 16px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => router.push("/dashboard/studio")} style={{ background: "none", border: "none", color: "var(--text-2)", cursor: "pointer" }}>
            <ArrowLeft size={20} />
          </button>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-1)" }}>Execute Workflow: {workflowId}</h1>
        </div>
        
        <button 
          onClick={handleExecute} 
          disabled={isRunning}
          style={{
            background: isRunning ? "var(--surface-3)" : "var(--accent-1)", 
            color: isRunning ? "var(--text-3)" : "#fff", 
            border: "none", borderRadius: "6px", padding: "6px 12px", 
            fontSize: 13, cursor: isRunning ? "not-allowed" : "pointer", 
            display: "flex", alignItems: "center", gap: 6
          }}
        >
          {isRunning ? <Loader2 size={14} className="spin-animation" /> : <Play size={14} />} 
          {isRunning ? "Running..." : "Start Execution"}
        </button>
      </div>

      <div style={{ display: "flex", flex: 1, gap: 16 }}>
        {/* Left: Input parameters */}
        <div style={{ 
          width: "300px", background: "var(--surface-2)", border: "1px solid var(--border-1)", 
          borderRadius: "var(--radius-lg)", padding: "16px", display: "flex", flexDirection: "column", gap: 12 
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-2)" }}>Input Payload</h3>
          <textarea 
            disabled={isRunning}
            style={{ 
              flex: 1, background: "var(--surface-1)", border: "1px solid var(--border-1)", 
              borderRadius: "6px", padding: "12px", color: "var(--text-1)", fontFamily: "monospace", 
              fontSize: 12, resize: "none" 
            }}
            defaultValue={JSON.stringify({
              transaction_id: "tx-123456",
              amount: 500,
              currency: "USD",
              user_id: "user_789"
            }, null, 2)}
          />
        </div>

        {/* Right: Execution Logs */}
        <div style={{ 
          flex: 1, background: "var(--surface-1)", border: "1px solid var(--border-1)", 
          borderRadius: "var(--radius-lg)", overflow: "hidden", display: "flex", flexDirection: "column" 
        }}>
          <div style={{ padding: "16px", borderBottom: "1px solid var(--border-1)", background: "var(--surface-2)" }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-1)" }}>Execution Logs</h3>
          </div>
          
          <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 8 }}>
            {logs.length === 0 ? (
              <div style={{ color: "var(--text-3)", textAlign: "center", marginTop: 40, fontSize: 13 }}>
                Click &quot;Start Execution&quot; to run the workflow.
              </div>
            ) : (
              logs.map((log, i) => (
                <div key={i} style={{ 
                  display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", 
                  background: "var(--surface-2)", borderRadius: "6px", border: "1px solid var(--border-1)" 
                }}>
                  {log.status === "success" ? <CheckCircle size={16} color="#22c55e" /> : 
                   log.status === "pending" ? <Clock size={16} color="var(--accent-1)" /> : 
                   <XCircle size={16} color="#ef4444" />}
                  
                  <span style={{ fontSize: 13, color: "var(--text-1)", fontFamily: "monospace" }}>
                    {log.msg}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      
      <style>{`
        .spin-animation { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
