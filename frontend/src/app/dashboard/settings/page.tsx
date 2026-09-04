"use client";

import React, { useState, useCallback } from 'react';
import { User, Key, Bell, Shield, Database, X, Copy, Check } from 'lucide-react';
import { apiUrl } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────
interface TeamMember {
  name: string;
  role: string;
  email: string;
  avatar: string;
  lastActive: string;
}

interface ApiKey {
  id: string;
  name: string;
  key: string;
  created: string;
  lastUsed: string;
}

type SettingsSection = 'team' | 'api-keys' | 'notifications' | 'security' | 'data-retention';

const SECTIONS: { icon: React.FC<{ size: number; style?: React.CSSProperties }>; label: string; id: SettingsSection }[] = [
  { icon: User, label: 'Team & Access', id: 'team' },
  { icon: Key, label: 'API Keys', id: 'api-keys' },
  { icon: Bell, label: 'Notifications', id: 'notifications' },
  { icon: Shield, label: 'Security', id: 'security' },
  { icon: Database, label: 'Data Retention', id: 'data-retention' },
];

// ── Generic Modal ──────────────────────────────────────────────────────────
function Modal({ open, onClose, title, children, width = 440 }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: number;
}) {
  if (!open) return null;
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width, maxWidth: '90vw', padding: 0,
          boxShadow: '0 16px 64px rgba(0,0,0,0.6)',
          animation: 'fade-in var(--motion-fast)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', borderBottom: '1px solid var(--border-1)',
        }}>
          <span style={{ fontSize: 'var(--text-16)', fontWeight: 600, color: 'var(--gray-100)' }}>
            {title}
          </span>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <X size={15} />
          </button>
        </div>
        <div style={{ padding: '16px' }}>{children}</div>
      </div>
    </div>
  );
}

// ── Settings Page ──────────────────────────────────────────────────────────
export default function Settings() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('team');

  // Team state
  const [team, setTeam] = useState<TeamMember[]>([
    { name: 'Rachel Johnson', role: 'Lead Risk Analyst', email: 'rj@aegisai.io', avatar: 'RJ', lastActive: '2 min ago' },
    { name: 'Priya Kumar', role: 'ML Engineer', email: 'pk@aegisai.io', avatar: 'PK', lastActive: '1h ago' },
    { name: 'Marcus Lee', role: 'Compliance Officer', email: 'ml@aegisai.io', avatar: 'ML', lastActive: '3h ago' },
    { name: 'Tara Thompson', role: 'Risk Analyst', email: 'tt@aegisai.io', avatar: 'TT', lastActive: 'Yesterday' },
  ]);

  // API keys state
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([
    { id: 'k1', name: 'Production API Key', key: 'aeg_live_sk_4f2aBx9mT0qRz7YnPvCd8wEfGhJk', created: '2026-01-15', lastUsed: 'Today' },
    { id: 'k2', name: 'Dashboard Read Key', key: 'aeg_live_sk_8c3dNp5sQ1xKw6UiLmAo2bRtVy4j', created: '2026-03-22', lastUsed: '2 days ago' },
  ]);

  // Invite modal
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Risk Analyst');

  // Generate key modal
  const [generateOpen, setGenerateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Revoke confirm modal
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);

  // Notification settings
  const [notifSettings, setNotifSettings] = useState({
    riskAlerts: true,
    agentStatus: true,
    dailyDigest: false,
    slaBreach: true,
    slackWebhook: '',
  });

  // Security settings
  const [securitySettings, setSecuritySettings] = useState({
    mfaEnabled: true,
    sessionTimeout: 30,
    ipWhitelist: '',
  });

  // Data retention
  const [retentionDays, setRetentionDays] = useState(90);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleInvite = useCallback(async () => {
    if (!inviteEmail.trim()) return;

    try {
      const response = await fetch(apiUrl("/api/v1/users/invite"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: inviteEmail,
          role_name: inviteRole
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        alert(`Failed to send invitation: ${errorData.detail || "Unknown error"}`);
        return;
      }

      const initials = inviteEmail.split('@')[0].slice(0, 2).toUpperCase();
      setTeam(prev => [...prev, {
        name: inviteEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        role: inviteRole,
        email: inviteEmail,
        avatar: initials,
        lastActive: 'Just invited',
      }]);
      alert(`Invitation sent successfully to ${inviteEmail}! Check the backend terminal console logs for the setup url link.`);
    } catch (err) {
      // Safe fallback if server is not running
      const initials = inviteEmail.split('@')[0].slice(0, 2).toUpperCase();
      setTeam(prev => [...prev, {
        name: inviteEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        role: inviteRole,
        email: inviteEmail,
        avatar: initials,
        lastActive: 'Just invited',
      }]);
      alert("Local sandbox invitation created (Backend offline).");
    } finally {
      setInviteEmail('');
      setInviteRole('Risk Analyst');
      setInviteOpen(false);
    }
  }, [inviteEmail, inviteRole]);

  const handleGenerateKey = useCallback(() => {
    if (!newKeyName.trim()) return;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const randomKey = `aeg_live_sk_${Array.from({ length: 28 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')}`;
    setGeneratedKey(randomKey);
    setApiKeys(prev => [...prev, {
      id: `k${Date.now()}`,
      name: newKeyName,
      key: randomKey,
      created: new Date().toISOString().slice(0, 10),
      lastUsed: 'Never',
    }]);
  }, [newKeyName]);

  const handleRevoke = useCallback(() => {
    if (!revokeTarget) return;
    setApiKeys(prev => prev.filter(k => k.id !== revokeTarget.id));
    setRevokeTarget(null);
  }, [revokeTarget]);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    });
  }, []);

  const maskKey = (key: string): string => {
    return key.slice(0, 12) + '••••••••••••••••' + key.slice(-4);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 1000, display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20 }}>
      {/* Sidebar nav */}
      <div className="card" style={{ padding: '8px', height: 'fit-content' }}>
        {SECTIONS.map(s => (
          <button
            key={s.id}
            className="nav-item"
            style={{
              width: '100%',
              background: activeSection === s.id ? 'var(--surface-3)' : 'transparent',
              color: activeSection === s.id ? 'var(--gray-100)' : 'var(--gray-400)',
            }}
            onClick={() => setActiveSection(s.id)}
          >
            <s.icon size={15} style={{ flexShrink: 0 }} />
            {s.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── Team Section ── */}
        {activeSection === 'team' && (
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border-0)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="text-title" style={{ fontSize: 'var(--text-14)' }}>Team Members ({team.length})</div>
              <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => setInviteOpen(true)}>+ Invite</button>
            </div>
            {team.map((member, i) => (
              <div key={member.email} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: i < team.length - 1 ? '1px solid var(--border-0)' : 'none' }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'var(--accent-dim)', border: '1px solid var(--accent-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)',
                  flexShrink: 0,
                }}>{member.avatar}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 'var(--text-14)', fontWeight: 500, color: 'var(--gray-100)' }}>{member.name}</div>
                  <div style={{ fontSize: 'var(--text-12)', color: 'var(--gray-500)' }}>{member.role} · {member.email}</div>
                </div>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--gray-500)' }}>{member.lastActive}</div>
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 11, color: 'var(--risk-critical-text)', padding: '2px 6px' }}
                  onClick={() => setTeam(prev => prev.filter(m => m.email !== member.email))}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── API Keys Section ── */}
        {activeSection === 'api-keys' && (
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border-0)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="text-title" style={{ fontSize: 'var(--text-14)' }}>API Keys ({apiKeys.length})</div>
              <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => { setGenerateOpen(true); setGeneratedKey(null); setNewKeyName(''); setCopiedKey(false); }}>+ Generate Key</button>
            </div>
            {apiKeys.map((key, i) => (
              <div key={key.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 16px', borderBottom: i < apiKeys.length - 1 ? '1px solid var(--border-0)' : 'none' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 'var(--text-13)', fontWeight: 500, color: 'var(--gray-100)', marginBottom: 2 }}>{key.name}</div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--gray-500)' }}>{maskKey(key.key)}</div>
                </div>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--gray-500)', textAlign: 'right' }}>
                  <div>Created: {key.created}</div>
                  <div>Last used: {key.lastUsed}</div>
                </div>
                <button
                  className="btn btn-ghost btn-icon"
                  style={{ padding: 4 }}
                  title="Copy key"
                  onClick={() => copyToClipboard(key.key)}
                >
                  <Copy size={13} />
                </button>
                <button
                  className="btn btn-danger"
                  style={{ fontSize: 11, padding: '4px 8px' }}
                  onClick={() => setRevokeTarget(key)}
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── Notifications Section ── */}
        {activeSection === 'notifications' && (
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border-0)' }}>
              <div className="text-title" style={{ fontSize: 'var(--text-14)' }}>Notification Preferences</div>
            </div>
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {([
                ['riskAlerts', 'Risk Alerts', 'Get notified on critical and high-risk transactions'],
                ['agentStatus', 'Agent Status Changes', 'Get notified when ML agents go degraded or offline'],
                ['dailyDigest', 'Daily Digest', 'Receive a daily summary email of all activity'],
                ['slaBreach', 'SLA Breach Warnings', 'Get notified before review SLA deadlines are breached'],
              ] as const).map(([key, label, desc]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-0)' }}>
                  <div>
                    <div style={{ fontSize: 'var(--text-14)', color: 'var(--gray-100)', fontWeight: 500 }}>{label}</div>
                    <div style={{ fontSize: 'var(--text-12)', color: 'var(--gray-500)', marginTop: 2 }}>{desc}</div>
                  </div>
                  <ToggleSwitch
                    enabled={notifSettings[key]}
                    onChange={(v) => setNotifSettings(prev => ({ ...prev, [key]: v }))}
                  />
                </div>
              ))}
              <div style={{ marginTop: 8 }}>
                <label style={{ fontSize: 'var(--text-12)', color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                  Slack Webhook URL
                </label>
                <input
                  className="input"
                  placeholder="https://hooks.slack.com/services/…"
                  value={notifSettings.slackWebhook}
                  onChange={(e) => setNotifSettings(prev => ({ ...prev, slackWebhook: e.target.value }))}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Security Section ── */}
        {activeSection === 'security' && (
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border-0)' }}>
              <div className="text-title" style={{ fontSize: 'var(--text-14)' }}>Security Settings</div>
            </div>
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-0)' }}>
                <div>
                  <div style={{ fontSize: 'var(--text-14)', color: 'var(--gray-100)', fontWeight: 500 }}>Multi-Factor Authentication</div>
                  <div style={{ fontSize: 'var(--text-12)', color: 'var(--gray-500)', marginTop: 2 }}>Require MFA for all team members</div>
                </div>
                <ToggleSwitch
                  enabled={securitySettings.mfaEnabled}
                  onChange={(v) => setSecuritySettings(prev => ({ ...prev, mfaEnabled: v }))}
                />
              </div>
              <div>
                <label style={{ fontSize: 'var(--text-12)', color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                  Session Timeout (minutes)
                </label>
                <input
                  className="input"
                  type="number"
                  value={securitySettings.sessionTimeout}
                  onChange={(e) => setSecuritySettings(prev => ({ ...prev, sessionTimeout: parseInt(e.target.value) || 30 }))}
                  style={{ width: 120 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 'var(--text-12)', color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                  IP Whitelist (comma-separated)
                </label>
                <input
                  className="input"
                  placeholder="e.g., 10.0.0.0/8, 192.168.1.0/24"
                  value={securitySettings.ipWhitelist}
                  onChange={(e) => setSecuritySettings(prev => ({ ...prev, ipWhitelist: e.target.value }))}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Data Retention Section ── */}
        {activeSection === 'data-retention' && (
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border-0)' }}>
              <div className="text-title" style={{ fontSize: 'var(--text-14)' }}>Data Retention Policy</div>
            </div>
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 'var(--text-12)', color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                  Retain transaction data for
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[30, 60, 90, 180, 365].map(d => (
                    <button
                      key={d}
                      className={`btn ${d === retentionDays ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setRetentionDays(d)}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ padding: '12px', borderRadius: 'var(--radius-md)', background: 'var(--surface-3)', border: '1px solid var(--border-1)', fontSize: 'var(--text-13)', color: 'var(--gray-400)' }}>
                <p>Currently retaining data for <strong style={{ color: 'var(--gray-100)' }}>{retentionDays} days</strong>. Data older than this will be automatically purged from the system.</p>
                <p style={{ marginTop: 8, fontSize: 'var(--text-12)', color: 'var(--gray-500)' }}>Note: Audit logs and compliance records are retained indefinitely regardless of this setting.</p>
              </div>
              <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>Save Retention Policy</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Invite Modal ── */}
      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite Team Member">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 'var(--text-12)', color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
              Email Address
            </label>
            <input
              className="input"
              type="email"
              placeholder="colleague@aegisai.io"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label style={{ fontSize: 'var(--text-12)', color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
              Role
            </label>
            <select className="input" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
              <option>Risk Analyst</option>
              <option>ML Engineer</option>
              <option>Compliance Officer</option>
              <option>Admin</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8 }}>
            <button className="btn btn-outline" onClick={() => setInviteOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleInvite} disabled={!inviteEmail.trim()}>Send Invite</button>
          </div>
        </div>
      </Modal>

      {/* ── Generate Key Modal ── */}
      <Modal open={generateOpen} onClose={() => setGenerateOpen(false)} title={generatedKey ? 'Key Generated' : 'Generate API Key'} width={520}>
        {!generatedKey ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 'var(--text-12)', color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                Key Name
              </label>
              <input
                className="input"
                placeholder="e.g., Production API Key"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8 }}>
              <button className="btn btn-outline" onClick={() => setGenerateOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleGenerateKey} disabled={!newKeyName.trim()}>Generate</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ padding: '12px', borderRadius: 'var(--radius-md)', background: 'var(--accent-dim)', border: '1px solid var(--accent-muted)', fontSize: 'var(--text-13)', color: 'var(--risk-medium-text)' }}>
              Copy this key now — it will not be shown again.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                className="input"
                value={generatedKey}
                readOnly
                style={{ fontFamily: 'var(--font-mono)', fontSize: 12, flex: 1 }}
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button
                className="btn btn-primary"
                onClick={() => copyToClipboard(generatedKey)}
                style={{ gap: 4 }}
              >
                {copiedKey ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8 }}>
              <button className="btn btn-outline" onClick={() => setGenerateOpen(false)}>Done</button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Revoke Confirmation Modal ── */}
      <Modal open={!!revokeTarget} onClose={() => setRevokeTarget(null)} title="Revoke API Key" width={400}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ padding: '12px', borderRadius: 'var(--radius-md)', background: 'rgba(255,59,59,0.1)', border: '1px solid rgba(255,59,59,0.3)', fontSize: 'var(--text-13)', color: 'var(--risk-critical-text)' }}>
            This action is irreversible. Any services using this key will immediately lose access.
          </div>
          <div style={{ fontSize: 'var(--text-13)', color: 'var(--gray-300)' }}>
            Are you sure you want to revoke <strong style={{ color: 'var(--gray-100)' }}>{revokeTarget?.name}</strong>?
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8 }}>
            <button className="btn btn-outline" onClick={() => setRevokeTarget(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={handleRevoke}>Revoke Key</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Toggle Switch Component ────────────────────────────────────────────────
function ToggleSwitch({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      style={{
        width: 40, height: 22, borderRadius: 11, border: 'none',
        background: enabled ? 'var(--accent)' : 'var(--surface-4)',
        cursor: 'pointer', position: 'relative', flexShrink: 0,
        outline: '1px solid',
        outlineColor: enabled ? 'var(--accent-muted)' : 'var(--border-2)',
        transition: 'all var(--motion-fast)',
      }}
      aria-pressed={enabled}
    >
      <div style={{
        width: 16, height: 16, borderRadius: '50%',
        background: enabled ? 'white' : 'var(--gray-500)',
        position: 'absolute', top: 3,
        left: enabled ? 21 : 3,
        transition: 'left var(--motion-fast)',
      }} />
    </button>
  );
}