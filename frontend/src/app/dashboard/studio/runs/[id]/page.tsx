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
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 80px)", gap: 16 }}>
      {/* Header Bar */}
      <div className="glass-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button 
            onClick={() => router.push("/dashboard/studio")} 
            style={{ 
              background: "rgba(251, 191, 36, 0.1)", 
              border: "1px solid rgba(251, 191, 36, 0.25)", 
              borderRadius: "8px",
              padding: "6px",
              color: "#FBBF24", 
              cursor: "pointer",
              display: "flex",
              alignItems: "center"
            }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#8c7c59" }}>Workflow Executor</div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "#FBBF24", textShadow: "0 0 10px rgba(251, 191, 36, 0.2)" }}>
              {workflowId}
            </h1>
          </div>
        </div>
        
        <button 
          onClick={handleExecute} 
          disabled={isRunning}
          style={{
            background: isRunning 
              ? "rgba(45, 38, 20, 0.6)" 
              : "linear-gradient(135deg, #FBBF24, #F59E0B)", 
            color: isRunning ? "#8c7c59" : "#050401", 
            fontWeight: 600,
            border: isRunning ? "1px solid rgba(251, 191, 36, 0.2)" : "none", 
            borderRadius: "10.5px", 
            padding: "8px 16px", 
            fontSize: 13, 
            cursor: isRunning ? "not-allowed" : "pointer", 
            display: "flex", 
            alignItems: "center", 
            gap: 8,
            boxShadow: isRunning ? "none" : "0 0 16px rgba(251, 191, 36, 0.35)",
            transition: "all 0.2s ease"
          }}
        >
          {isRunning ? <Loader2 size={16} className="spin-animation" /> : <Play size={16} />} 
          {isRunning ? "Executing Run..." : "Start Execution"}
        </button>
      </div>

      <div style={{ display: "flex", flex: 1, gap: 16 }}>
        {/* Left: Input parameters */}
        <div className="glass-card" style={{ 
          width: "320px", padding: "16px", display: "flex", flexDirection: "column", gap: 12 
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: "#FBBF24", textTransform: "uppercase", letterSpacing: "0.06em" }}>Input Payload</h3>
            <span style={{ fontSize: 11, color: "#8c7c59", fontFamily: "monospace" }}>JSON</span>
          </div>
          <textarea 
            disabled={isRunning}
            style={{ 
              flex: 1, 
              background: "rgba(10, 8, 4, 0.75)", 
              border: "1px solid rgba(251, 191, 36, 0.2)", 
              borderRadius: "8px", 
              padding: "12px", 
              color: "#faf7ee", 
              fontFamily: "'JetBrains Mono', monospace", 
              fontSize: 12, 
              resize: "none",
              outline: "none",
              boxShadow: "inset 0 2px 4px rgba(0,0,0,0.5)"
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
        <div className="glass-card" style={{ 
          flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" 
        }}>
          <div style={{ 
            padding: "14px 16px", 
            borderBottom: "1px solid rgba(251, 191, 36, 0.18)", 
            background: "rgba(12, 10, 6, 0.6)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: "#FBBF24", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Execution Stream
            </h3>
            <div style={{ fontSize: 11, color: "#8c7c59", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: isRunning ? "#FBBF24" : "#A5FF2A", display: "inline-block" }} />
              {isRunning ? "STREAMING" : "READY"}
            </div>
          </div>
          
          <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 8 }}>
            {logs.length === 0 ? (
              <div style={{ color: "#8c7c59", textAlign: "center", marginTop: 60, fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>
                // Ready for workflow execution. Click &quot;Start Execution&quot; above.
              </div>
            ) : (
              logs.map((log, i) => (
                <div key={i} style={{ 
                  display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", 
                  background: "rgba(10, 8, 4, 0.7)", borderRadius: "8px", 
                  border: "1px solid rgba(251, 191, 36, 0.15)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
                }}>
                  {log.status === "success" ? <CheckCircle size={16} color="#A5FF2A" /> : 
                   log.status === "pending" ? <Clock size={16} color="#FBBF24" /> : 
                   <XCircle size={16} color="#ff3b3b" />}
                  
                  <span style={{ fontSize: 13, color: "#FFFFFF", fontFamily: "'JetBrains Mono', monospace" }}>
                    {log.msg}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

