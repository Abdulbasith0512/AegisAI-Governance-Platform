"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import "../../styles/tokens.css";
import "../../styles/globals.css";
import "reactflow/dist/style.css";
import {
  LayoutDashboard, ArrowRightLeft, GitBranch, Zap,
  Users, Bot, Shield, Brain, FileText, UserCheck,
  AlertTriangle, BarChart3, Settings, Search,
  Bell, Sun, Moon, Server, ChevronDown, X, LogOut,
  User, ChevronLeft, ChevronRight, Home, ShieldAlert, Cpu, Network, TestTube2, Layers
} from "lucide-react";

const UserIcon = User;

// ── Sidebar Navigation Config ──────────────────────────────────────────────
const NAV_GROUPS = [
  {
    label: "Core",
    items: [
      { label: "Overview", path: "/dashboard", icon: LayoutDashboard },
      { label: "Transactions", path: "/dashboard/transactions", icon: ArrowRightLeft },
      { label: "Customers", path: "/dashboard/customers", icon: Users },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "Knowledge Graph", path: "/dashboard/knowledge-graph", icon: GitBranch },
      { label: "Agents", path: "/dashboard/agents", icon: Bot },
      { label: "Explainability", path: "/dashboard/explainability", icon: Brain },
      { label: "AI Research Lab", path: "/dashboard/research", icon: TestTube2 },
      { label: "AI Intelligence", path: "/dashboard/intelligence", icon: Layers },
    ],
  },
  {
    label: "Governance",
    items: [
      { label: "Policies", path: "/dashboard/policies", icon: FileText },
      { label: "Human Reviews", path: "/dashboard/reviews", icon: UserCheck },
      { label: "Trust Center", path: "/dashboard/trust-center", icon: Shield },
      { label: "AI Security", path: "/dashboard/security", icon: ShieldAlert },
      { label: "Governance Studio", path: "/dashboard/studio", icon: Network },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "MLOps Platform", path: "/dashboard/mlops", icon: Cpu },
      { label: "Chaos Engineering", path: "/dashboard/chaos", icon: Zap },
      { label: "Digital Twin 2.0", path: "/dashboard/simulation", icon: TestTube2 },
      { label: "Incidents", path: "/dashboard/incidents", icon: AlertTriangle },
      { label: "Analytics", path: "/dashboard/analytics", icon: BarChart3 },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Settings", path: "/dashboard/settings", icon: Settings },
    ],
  },
];

// ── Dashboard Layout ───────────────────────────────────────────────────────
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    Promise.resolve().then(() => setMounted(true));
  }, []);

  return (
    <div
      className="dashboard-wrapper"
      style={{
        display: "flex",
        height: "100vh",
        overflow: "hidden",
        background: "#09090b",
        color: "#e2e8f0",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* ── Sidebar ── */}
      <aside
        style={{
          width: collapsed ? 52 : 220,
          flexShrink: 0,
          background: "#0c0c10",
          borderRight: "1px solid #1c1c24",
          display: "flex",
          flexDirection: "column",
          transition: "width 200ms ease",
          overflow: "hidden",
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: collapsed ? "14px 10px" : "14px 16px",
            borderBottom: "1px solid #1c1c24",
            display: "flex",
            alignItems: "center",
            gap: 10,
            minHeight: 52,
          }}
        >
          <span
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: "linear-gradient(135deg, #6366f1, #00d4ff)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 11,
              color: "white",
              fontFamily: "monospace",
              flexShrink: 0,
            }}
          >
            Æ
          </span>
          {!collapsed && (
            <span
              style={{
                fontSize: 14,
                fontWeight: 800,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "white",
                fontFamily: "monospace",
                whiteSpace: "nowrap",
              }}
            >
              AegisAI
            </span>
          )}
        </div>

        {/* Nav groups */}
        <nav
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "8px",
          }}
        >
          {/* Home link */}
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: collapsed ? "7px 10px" : "7px 10px",
              borderRadius: 6,
              fontSize: 13,
              color: "#71717a",
              textDecoration: "none",
              marginBottom: 8,
              transition: "background 100ms",
            }}
          >
            <Home size={15} style={{ flexShrink: 0 }} />
            {!collapsed && <span>Home</span>}
          </Link>

          {NAV_GROUPS.map((group) => (
            <div key={group.label} style={{ marginBottom: 16 }}>
              {!collapsed && (
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "#3f3f46",
                    padding: "0 10px",
                    marginBottom: 4,
                  }}
                >
                  {group.label}
                </div>
              )}
              {group.items.map((item) => {
                const isActive = pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "7px 10px",
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? "white" : "#71717a",
                      textDecoration: "none",
                      background: isActive ? "#1c1c24" : "transparent",
                      borderLeft: isActive
                        ? "2px solid #00d4ff"
                        : "2px solid transparent",
                      transition: "all 100ms",
                    }}
                  >
                    <item.icon size={15} style={{ flexShrink: 0 }} />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          style={{
            padding: "10px",
            borderTop: "1px solid #1c1c24",
            background: "none",
            border: "none",
            color: "#52525e",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderTopStyle: "solid",
            borderTopWidth: 1,
            borderTopColor: "#1c1c24",
          }}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </aside>

      {/* ── Main content ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Topbar */}
        <header
          style={{
            height: 52,
            borderBottom: "1px solid #1c1c24",
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "0 16px",
            background: "#0c0c10",
            flexShrink: 0,
          }}
        >
          <div style={{ flex: 1 }} />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              borderRadius: 6,
              background: "#111118",
              border: "1px solid #1c1c24",
              fontSize: 12,
              fontFamily: "monospace",
              color: "#22c55e",
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#22c55e",
                animation: "pulse 2s ease-in-out infinite",
              }}
            />
            <Server size={11} />
            <span>live</span>
          </div>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "linear-gradient(135deg, rgba(0,212,255,0.15), #1c1c24)",
              border: "1px solid rgba(0,212,255,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              fontWeight: 700,
              color: "#00d4ff",
              fontFamily: "monospace",
            }}
          >
            RJ
          </div>
        </header>

        {/* Page content */}
        <main
          style={{
            flex: 1,
            padding: 20,
            overflowY: "auto",
            background: "#09090b",
          }}
        >
          {mounted ? children : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--gray-600)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-12)' }}>
              INITIALIZING OPERATIONS CONSOLE...
            </div>
          )}
        </main>
      </div>

      {/* Pulse animation keyframe */}
      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
