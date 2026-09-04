"use client";

import React, { useState, useEffect, useRef } from "react";
import { API_BASE_URL, apiUrl } from "@/lib/api";

interface HardwareMetric {
  label: string;
  value: number;
  max: number;
  color: string;
  glow: string;
}

interface AgentTelemetry {
  agent_name: string;
  latency_ms: number;
  prompt_tokens: number;
  completion_tokens: number;
  health_status: number;
  hallucination_rate: number;
  model_drift: number;
  inference_errors: number;
}

export default function ObservabilityCenter() {
  // Base state telemetry values
  const [cpu, setCpu] = useState(14.8);
  const [gpu, setGpu] = useState(8.2);
  const [memory, setMemory] = useState(48.5);
  const [hallucination, setHallucination] = useState(0.012);
  
  const [agentMetrics, setAgentMetrics] = useState<AgentTelemetry[]>([
    { agent_name: "fraud-agent", latency_ms: 18.2, prompt_tokens: 520, completion_tokens: 180, health_status: 1, hallucination_rate: 0.008, model_drift: 0.005, inference_errors: 0 },
    { agent_name: "aml-agent", latency_ms: 22.4, prompt_tokens: 490, completion_tokens: 165, health_status: 1, hallucination_rate: 0.012, model_drift: 0.011, inference_errors: 0 },
    { agent_name: "kyc-agent", latency_ms: 14.5, prompt_tokens: 510, completion_tokens: 170, health_status: 1, hallucination_rate: 0.002, model_drift: 0.002, inference_errors: 0 },
    { agent_name: "behavior-agent", latency_ms: 16.8, prompt_tokens: 535, completion_tokens: 195, health_status: 1, hallucination_rate: 0.018, model_drift: 0.014, inference_errors: 0 },
    { agent_name: "device-agent", latency_ms: 19.5, prompt_tokens: 480, completion_tokens: 160, health_status: 1, hallucination_rate: 0.005, model_drift: 0.009, inference_errors: 0 },
    { agent_name: "compliance-agent", latency_ms: 12.2, prompt_tokens: 550, completion_tokens: 210, health_status: 1, hallucination_rate: 0.001, model_drift: 0.001, inference_errors: 0 },
    { agent_name: "explainability-agent", latency_ms: 28.5, prompt_tokens: 610, completion_tokens: 250, health_status: 1, hallucination_rate: 0.024, model_drift: 0.018, inference_errors: 0 }
  ]);

  const [alerts, setAlerts] = useState<string[]>([
    "System status normal - Scraper listening on port 9090",
    "Model drift monitor tracking: kyc-agent drift minimal (0.002)"
  ]);

  // Real-time streaming simulation toggle state
  const [isStreaming, setIsStreaming] = useState(false);
  const streamInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isStreaming) {
      // Start real-time metrics streaming jitter updates
      streamInterval.current = setInterval(() => {
        setCpu((prev) => {
          const jitter = (Math.random() - 0.5) * 4.0;
          return parseFloat(Math.min(100, Math.max(0, prev + jitter)).toFixed(1));
        });
        setGpu((prev) => {
          const jitter = (Math.random() - 0.5) * 2.5;
          return parseFloat(Math.min(100, Math.max(0, prev + jitter)).toFixed(1));
        });
        setMemory((prev) => {
          const jitter = (Math.random() - 0.5) * 0.8;
          return parseFloat(Math.min(100, Math.max(0, prev + jitter)).toFixed(1));
        });
        setHallucination((prev) => {
          const jitter = (Math.random() - 0.5) * 0.002;
          return parseFloat(Math.min(1, Math.max(0, prev + jitter)).toFixed(3));
        });

        // Jitter agent metrics values
        setAgentMetrics((prevList) =>
          prevList.map((agent) => {
            const latJitter = (Math.random() - 0.5) * 6.0;
            const tokenJitter = Math.floor((Math.random() - 0.5) * 20);
            return {
              ...agent,
              latency_ms: parseFloat(Math.max(5.0, agent.latency_ms + latJitter).toFixed(2)),
              prompt_tokens: agent.prompt_tokens + tokenJitter,
              completion_tokens: agent.completion_tokens + Math.floor(tokenJitter / 3)
            };
          })
        );
      }, 1000);
    } else {
      if (streamInterval.current) {
        clearInterval(streamInterval.current);
      }
    }

    return () => {
      if (streamInterval.current) {
        clearInterval(streamInterval.current);
      }
    };
  }, [isStreaming]);

  const toggleStream = () => {
    setIsStreaming(!isStreaming);
    if (!isStreaming) {
      setAlerts((prev) => [`Real-time Prometheus scraping emulator active - Streaming metrics`, ...prev]);
    } else {
      setAlerts((prev) => [`Metrics streaming paused`, ...prev]);
    }
  };

  const hardwareMetrics: HardwareMetric[] = [
    { label: "CPU Usage", value: cpu, max: 100, color: "stroke-indigo-500", glow: "rgba(99, 102, 241, 0.3)" },
    { label: "GPU Usage", value: gpu, max: 100, color: "stroke-cyan-500", glow: "rgba(6, 182, 212, 0.3)" },
    { label: "Memory allocation", value: memory, max: 100, color: "stroke-emerald-500", glow: "rgba(16, 185, 129, 0.3)" },
    { label: "Hallucination index", value: hallucination * 100, max: 100, color: "stroke-rose-500", glow: "rgba(244, 63, 94, 0.3)" }
  ];

  return (
    <div className="min-h-screen bg-[#0d0f14] text-[#e2e8f0] font-sans antialiased p-6 md:p-12 selection:bg-cyan-500 selection:text-white">
      {/* Glow Effects */}
      <div className="absolute top-0 right-1/4 h-[350px] w-[350px] rounded-full bg-cyan-500/5 blur-3xl"></div>

      {/* Page Header */}
      <header className="mb-10 border-b border-slate-800 pb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`h-2.5 w-2.5 rounded-full bg-cyan-500 ${isStreaming ? "animate-ping" : "animate-pulse"}`}></span>
            <span className="text-xs uppercase tracking-wider text-cyan-400 font-semibold font-mono">Observability Command</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            Observability Platform
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time streaming dashboard tracking hardware resource utilization, agent latencies, hallucinations, and model drifts.
          </p>
        </div>

        {/* Streaming controls */}
        <div>
          <button
            onClick={toggleStream}
            className={`px-5 py-2.5 rounded text-xs font-black uppercase tracking-wider font-mono border transition-all duration-300 ${
              isStreaming
                ? "bg-cyan-600 border-cyan-500 text-white shadow-[0_0_20px_rgba(6,182,212,0.4)]"
                : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            {isStreaming ? "⏸ Pause Stream" : "⚡ Stream Real-time Metrics"}
          </button>
        </div>
      </header>

      {/* Main content grid */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Left Column: SVGs Circular metrics indicators */}
        <div className="xl:col-span-2 space-y-8">
          
          <div className="rounded-xl border border-slate-800 bg-[#121620]/40 p-6 backdrop-blur-md">
            <h2 className="text-lg font-bold text-white tracking-tight mb-6">Hardware Resource Utilization</h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {hardwareMetrics.map((m) => {
                const radius = 40;
                const circumference = 2 * Math.PI * radius;
                const offset = circumference - (m.value / m.max) * circumference;
                
                return (
                  <div key={m.label} className="flex flex-col items-center justify-between p-4 rounded-lg bg-slate-900/30 border border-slate-850 text-center">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 font-mono mb-4 block">
                      {m.label}
                    </span>
                    
                    <div className="relative h-24 w-24 mb-4 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90">
                        {/* Background track circle */}
                        <circle
                          cx="48"
                          cy="48"
                          r={radius}
                          fill="transparent"
                          stroke="#121620"
                          strokeWidth="6"
                        />
                        {/* Interactive gauge circle */}
                        <circle
                          cx="48"
                          cy="48"
                          r={radius}
                          fill="transparent"
                          className={`transition-all duration-500 ${m.color}`}
                          strokeWidth="6"
                          strokeDasharray={circumference}
                          strokeDashoffset={offset}
                          strokeLinecap="round"
                          style={{ filter: `drop-shadow(0 0 4px ${m.glow})` }}
                        />
                      </svg>
                      <div className="absolute text-sm font-black font-mono text-white">
                        {m.value.toFixed(m.label.includes("Hallucination") ? 3 : 1)}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Metrics Table per Agent */}
          <div className="rounded-xl border border-slate-800 bg-[#121620]/40 p-6 backdrop-blur-md">
            <h2 className="text-lg font-bold text-white tracking-tight mb-6">Agent Observability Diagnostics Matrix</h2>
            
            <div className="w-full overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 uppercase tracking-wider">
                    <th className="pb-3 font-semibold">Agent</th>
                    <th className="pb-3 font-semibold">Health</th>
                    <th className="pb-3 font-semibold">Avg Latency</th>
                    <th className="pb-3 font-semibold">Tokens (P/C)</th>
                    <th className="pb-3 font-semibold">Drift</th>
                    <th className="pb-3 font-semibold">Hallucination</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {agentMetrics.map((agent) => (
                    <tr key={agent.agent_name} className="hover:bg-slate-900/20">
                      <td className="py-4 font-bold text-white uppercase">{agent.agent_name.replace("-agent", "")}</td>
                      <td className="py-4">
                        <span className={`inline-flex px-1.5 py-0.2 rounded text-[9px] font-bold ${
                          agent.health_status === 1 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                        }`}>
                          {agent.health_status === 1 ? "ACTIVE" : "OFFLINE"}
                        </span>
                      </td>
                      <td className="py-4 text-slate-300">{agent.latency_ms} ms</td>
                      <td className="py-4 text-slate-400">{agent.prompt_tokens} / {agent.completion_tokens}</td>
                      <td className="py-4 text-slate-400">{agent.model_drift.toFixed(3)}</td>
                      <td className="py-4 text-slate-400">{agent.hallucination_rate.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Right Column: Active alerts list log */}
        <div className="rounded-xl border border-slate-800 bg-[#121620]/40 p-6 backdrop-blur-md flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight mb-4">Grafana Alerts & Scraping Feed</h2>
            
            <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2">
              {alerts.map((alert, idx) => (
                <div key={idx} className="p-3 bg-slate-950/40 rounded border border-slate-800 text-xs font-mono">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-cyan-400 font-bold">INFO</span>
                    <span className="text-[9px] text-slate-600 font-semibold">Just Now</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">{alert}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-850 pt-4 mt-6">
            <span className="text-[10px] text-slate-500 font-mono block">Scraper: {`${API_BASE_URL}/api/v1/observability/metrics`}</span>
            <span className="text-[10px] text-slate-500 font-mono block">Interval: 15s scrape interval configured</span>
          </div>
        </div>

      </section>
    </div>
  );
}