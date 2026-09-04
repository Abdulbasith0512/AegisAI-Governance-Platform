"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import "../../styles/tokens.css";
import "../../styles/globals.css";
import "reactflow/dist/style.css";
import {
  LayoutDashboard, ArrowRightLeft, GitBranch, Zap,
  Users, Bot, Shield, Brain, FileText, UserCheck,
  AlertTriangle, BarChart3, Settings, Search,
  Bell, Server, ChevronLeft, ChevronRight, Home, ShieldAlert, Cpu, Network, TestTube2, Layers
} from "lucide-react";

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

// ── Dashboard Layout (institutional shell: flat ink, neutral chrome) ────────
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className="dashboard-wrapper"
      style={{
        display: "flex",
        height: "100vh",
        overflow: "hidden",
        background: "var(--surface-0)",
        color: "var(--text-2)",
        fontFamily: "var(--font-sans)",
        position: "relative",
      }}
    >
      {/* ── Sidebar ── */}
      <aside
        style={{
          width: collapsed ? 60 : 232,
          flexShrink: 0,
          background: "var(--surface-1)",
          borderRight: "1px solid var(--border-1)",
          display: "flex",
          flexDirection: "column",
          transition: "width 180ms ease",
          overflow: "hidden",
          zIndex: 10,
        }}
      >
        {/* Wordmark */}
        <div
          style={{
            padding: collapsed ? "16px 0" : "16px 18px",
            borderBottom: "1px solid var(--border-1)",
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
            gap: 10,
            minHeight: 60,
          }}
        >
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              background: "#FAFAFA",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 13,
              color: "#0A0A0B",
              fontFamily: "var(--font-sans)",
              letterSpacing: "-0.02em",
              flexShrink: 0,
            }}
          >
            A
          </span>
          {!collapsed && (
            <span style={{ minWidth: 0 }}>
              <span
                style={{
                  display: "block",
                  fontSize: 13.5,
                  fontWeight: 700,
                  letterSpacing: "-0.01em",
                  color: "var(--text-1)",
                  whiteSpace: "nowrap",
                  lineHeight: 1.2,
                }}
              >
                AegisAI
              </span>
              <span
                style={{
                  display: "block",
                  fontSize: 10.5,
                  fontWeight: 500,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  whiteSpace: "nowrap",
                  lineHeight: 1.4,
                }}
              >
                Governance OS
              </span>
            </span>
          )}
        </div>

        {/* Nav groups */}
        <nav
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "10px 8px",
          }}
        >
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "7px 10px",
              borderRadius: 7,
              fontSize: 13,
              fontWeight: 500,
              color: "var(--text-3)",
              textDecoration: "none",
              marginBottom: 10,
            }}
          >
            <Home size={15} style={{ flexShrink: 0 }} />
            {!collapsed && <span>Home</span>}
          </Link>

          {NAV_GROUPS.map((group) => (
            <div key={group.label} style={{ marginBottom: 14 }}>
              {!collapsed && (
                <div
                  style={{
                    fontSize: 10.5,
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                    padding: "0 10px",
                    marginBottom: 5,
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
                      borderRadius: 7,
                      fontSize: 13,
                      fontWeight: isActive ? 600 : 500,
                      color: isActive ? "var(--text-1)" : "var(--text-3)",
                      textDecoration: "none",
                      background: isActive ? "rgba(255,255,255,0.06)" : "transparent",
                      boxShadow: isActive
                        ? "inset 2px 0 0 var(--accent)"
                        : "inset 2px 0 0 transparent",
                      transition: "background 120ms ease",
                    }}
                  >
                    <item.icon size={15} style={{ flexShrink: 0, color: isActive ? "var(--accent-1)" : "inherit" }} />
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
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          style={{
            padding: "10px",
            background: "none",
            border: "none",
            borderTop: "1px solid var(--border-1)",
            color: "var(--text-muted)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
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
            height: 56,
            borderBottom: "1px solid var(--border-1)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "0 16px",
            background: "var(--surface-1)",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 10px",
              borderRadius: 8,
              background: "var(--surface-2)",
              border: "1px solid var(--border-1)",
              fontSize: 13,
              color: "var(--text-muted)",
              minWidth: 220,
              maxWidth: 320,
              flex: 1,
            }}
          >
            <Search size={13} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>Search transactions, agents…</span>
            <kbd
              style={{
                fontSize: 10.5,
                fontFamily: "var(--font-sans)",
                background: "var(--surface-3)",
                border: "1px solid var(--border-1)",
                borderRadius: 4,
                padding: "1px 5px",
                color: "var(--text-muted)",
              }}
            >
              ⌘K
            </kbd>
          </div>
          <div style={{ flex: 1 }} />
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "5px 11px",
              borderRadius: 999,
              background: "var(--surface-2)",
              border: "1px solid var(--border-1)",
              fontSize: 12,
              fontWeight: 500,
              color: "var(--text-3)",
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "var(--accent-1)",
              }}
            />
            <Server size={11} />
            <span>Live · Production</span>
          </span>
          <button
            aria-label="Notifications"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "transparent",
              border: "1px solid transparent",
              color: "var(--text-3)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Bell size={15} />
          </button>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "var(--surface-3)",
              border: "1px solid var(--border-2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10.5,
              fontWeight: 700,
              color: "var(--text-2)",
              letterSpacing: "0.02em",
            }}
          >
            RJ
          </div>
        </header>

        {/* Page content */}
        <main
          style={{
            flex: 1,
            padding: 24,
            overflowY: "auto",
            background: "var(--surface-0)",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
