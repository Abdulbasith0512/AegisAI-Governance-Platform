import React from 'react';

// ── Shared Recharts theme colors (institutional: muted, colorblind-safe) ───
export const CHART_COLORS = {
  accent:   '#10B981',
  critical: '#EF4444',
  high:     '#F97316',
  medium:   '#F59E0B',
  low:      '#34D399',
  safe:     '#10B981',
  grid:     'rgba(255,255,255,0.06)',
  axis:     '#71717A',
  tooltip:  { bg: '#141417', border: 'rgba(255,255,255,0.12)', text: '#E4E4E7' },
};

interface ChartContainerProps {
  title?: string;
  subtitle?: string;
  height?: number;
  children: React.ReactNode;
  action?: React.ReactNode;
}

export const ChartContainer: React.FC<ChartContainerProps> = ({
  title,
  subtitle,
  height = 220,
  children,
  action,
}) => {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {(title || subtitle) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            padding: '14px 16px 10px',
            borderBottom: '1px solid var(--border-0)',
          }}
        >
          <div>
            {title && (
              <div className="text-title" style={{ fontSize: 'var(--text-14)' }}>{title}</div>
            )}
            {subtitle && (
              <div className="text-caption" style={{ marginTop: 2 }}>{subtitle}</div>
            )}
          </div>
          {action}
        </div>
      )}
      <div style={{ padding: '12px 8px 8px', height }}>
        {children}
      </div>
    </div>
  );
};

// ── Shared tooltip ─────────────────────────────────────────────────────────
interface TooltipEntry {
  value?: unknown;
  name?: unknown;
  color?: string;
}

interface SharedTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  labelFormatter?: (v: unknown) => string;
}

export const SharedTooltip: React.FC<SharedTooltipProps> = ({
  active,
  payload,
  label,
  labelFormatter,
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: CHART_COLORS.tooltip.bg,
        border: `1px solid ${CHART_COLORS.tooltip.border}`,
        borderRadius: 6,
        padding: '8px 12px',
        fontSize: 12,
        fontFamily: 'var(--font-sans)',
        color: CHART_COLORS.tooltip.text,
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      }}
    >
      {label !== undefined && label !== null && (
        <div style={{ marginBottom: 4, color: '#71717a', fontSize: 11 }}>
          {labelFormatter ? labelFormatter(label) : String(label)}
        </div>
      )}
      {payload.map((entry: TooltipEntry, i: number) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 8, height: 8, borderRadius: '50%',
              background: entry.color || CHART_COLORS.accent,
              flexShrink: 0,
            }}
          />
          <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            {String(entry.value ?? '')}
          </span>
          {Boolean(entry.name) && (
            <span style={{ color: '#71717a', fontSize: 11 }}>{String(entry.name)}</span>
          )}
        </div>
      ))}
    </div>
  );
};

// ── Shared axis / grid props ───────────────────────────────────────────────
export const AXIS_PROPS = {
  axisLine: { stroke: CHART_COLORS.grid },
  tickLine: { stroke: 'none' as const },
  tick: { fill: CHART_COLORS.axis, fontSize: 11, fontFamily: 'var(--font-sans)' },
};

export const GRID_PROPS = {
  stroke: CHART_COLORS.grid,
  strokeDasharray: '3 3',
};
