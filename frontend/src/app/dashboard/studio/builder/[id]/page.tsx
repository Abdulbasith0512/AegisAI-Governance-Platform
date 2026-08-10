"use client";

import React, { useState, useCallback, useRef } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  NodeTypes,
} from "reactflow";
import "reactflow/dist/style.css";
import { Save, Play, ArrowLeft } from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { ToastBar } from "@/components/ui/ToastBar";
import type { Toast } from "@/components/ui/ToastBar";

// Custom Nodes styling
interface CustomNodeProps {
  data: { label: string };
  type: string;
}
const CustomNode = ({ data, type }: CustomNodeProps) => {
  const getColors = () => {
    switch (type) {
      case "start": return { bg: "#22c55e", border: "#16a34a" };
      case "end": return { bg: "#ef4444", border: "#dc2626" };
      case "decision": return { bg: "#eab308", border: "#ca8a04" };
      default: return { bg: "var(--surface-3)", border: "var(--accent-1)" };
    }
  };
  const colors = getColors();
  return (
    <div style={{
      background: colors.bg,
      border: `2px solid ${colors.border}`,
      borderRadius: "8px",
      padding: "10px 15px",
      color: type === "start" || type === "end" ? "#fff" : "var(--text-1)",
      fontSize: "12px",
      fontWeight: 600,
      minWidth: "120px",
      textAlign: "center",
      boxShadow: "0 4px 6px rgba(0,0,0,0.3)"
    }}>
      {data.label}
    </div>
  );
};

const nodeTypes: NodeTypes = {
  start: CustomNode,
  end: CustomNode,
  fraud_agent: CustomNode,
  aml_agent: CustomNode,
  decision: CustomNode,
};

const initialNodes = [
  { id: "start-1", type: "start", position: { x: 250, y: 50 }, data: { label: "Start Node" } },
];
const initialEdges: Edge[] = [];

export default function WorkflowBuilder() {
  const router = useRouter();
  const params = useParams();
  const workflowId = params.id as string;

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

const [toasts, setToasts] = useState<Toast[]>([]);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  const addNode = (type: string, label: string) => {
    const newNode = {
      id: `${type}-${Date.now()}`,
      type,
      position: { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 },
      data: { label },
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const handleSave = () => {
    setToasts([{ id: Date.now().toString(), type: "success", message: "Workflow saved successfully." }]);
    // In real app: POST /api/v1/workflows/versions/.../graph
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 80px)" }}>
      <ToastBar toasts={toasts} onDismiss={(id) => setToasts(t => t.filter(x => x.id !== id))} />
      
      {/* Header bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 0 16px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => router.push("/dashboard/studio")} style={{ background: "none", border: "none", color: "var(--text-2)", cursor: "pointer" }}>
            <ArrowLeft size={20} />
          </button>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-1)" }}>Edit Workflow: {workflowId}</h1>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={handleSave} style={{
            background: "var(--surface-2)", color: "var(--text-1)", border: "1px solid var(--border-1)", 
            borderRadius: "6px", padding: "6px 12px", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6
          }}>
            <Save size={14} /> Save Draft
          </button>
          <button onClick={() => router.push(`/dashboard/studio/runs/${workflowId}`)} style={{
            background: "var(--accent-1)", color: "#fff", border: "none", 
            borderRadius: "6px", padding: "6px 12px", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6
          }}>
            <Play size={14} /> Execute Run
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, gap: 16, overflow: "hidden" }}>
        {/* Node Library Panel */}
        <div style={{ 
          width: "250px", background: "var(--surface-2)", border: "1px solid var(--border-1)", 
          borderRadius: "var(--radius-lg)", padding: "16px", display: "flex", flexDirection: "column", gap: 12 
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-2)", marginBottom: 8 }}>Node Library</h3>
          
          <button onClick={() => addNode("fraud_agent", "Fraud Agent")} style={libBtnStyle}>
            Fraud Agent
          </button>
          <button onClick={() => addNode("aml_agent", "AML Agent")} style={libBtnStyle}>
            AML Agent
          </button>
          <button onClick={() => addNode("decision", "Decision logic")} style={libBtnStyle}>
            Decision Node
          </button>
          <button onClick={() => addNode("end", "End Node")} style={{...libBtnStyle, borderLeftColor: "#ef4444"}}>
            End Node
          </button>
        </div>

        {/* React Flow Canvas */}
        <div ref={reactFlowWrapper} style={{ 
          flex: 1, background: "var(--surface-1)", border: "1px solid var(--border-1)", 
          borderRadius: "var(--radius-lg)", overflow: "hidden", position: "relative" 
        }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
          >
            <Background color="#333" gap={16} />
            <Controls />
            <MiniMap nodeColor={(n) => {
              if (n.type === 'start') return '#22c55e';
              if (n.type === 'end') return '#ef4444';
              return 'var(--accent-1)';
            }} />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}

const libBtnStyle = {
  background: "var(--surface-1)", 
  border: "1px solid var(--border-1)", 
  borderLeft: "4px solid var(--accent-1)",
  color: "var(--text-1)", 
  padding: "10px", 
  borderRadius: "6px", 
  cursor: "pointer",
  textAlign: "left" as const,
  fontSize: "13px",
  fontWeight: 500
};
