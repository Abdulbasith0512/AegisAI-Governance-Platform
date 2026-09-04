import React, { useEffect, useRef } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import type { ChartPoint } from '@/lib/mockData';

interface StatCardProps {
  label: string;
  value: string | number;
  delta?: number;
  deltaLabel?: string;
  sparkline?: ChartPoint[];
  sparklineColor?: string;
  mono?: boolean;
  live?: boolean;
  /** Compact single-line mode */
  compact?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  delta,
  deltaLabel,
  sparkline,
  sparklineColor = 'var(--accent-1)',
  mono = false,
  live = false,
  compact = false,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const prevValue = useRef(value);

  // Subtle border acknowledgement when a live value changes (no glow)
  useEffect(() => {
    if (prevValue.current !== value && cardRef.current) {
      const el = cardRef.current;
      el.style.borderColor = 'var(--border-2)';
      const t = setTimeout(() => {
        if (el) el.style.borderColor = '';
      }, 500);
      return () => clearTimeout(t);
    }
    prevValue.current = value;
  }, [value]);

  const isPositive = delta !== undefined && delta > 0;
  const isNegative = delta !== undefined && delta < 0;
  const isNeutral = delta === undefined || delta === 0;

  const deltaColor = isNeutral
    ? 'var(--gray-500)'
    : isPositive
    ? 'var(--status-success)'
    : 'var(--risk-critical-text)';

  const DeltaIcon = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown;

  if (compact) {
    return (
      <div
        ref={cardRef}
        className="card"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, transition: 'border-color var(--motion-normal)' }}
      >
        <div>
          <div className="text-label" style={{ marginBottom: 4 }}>
            {label}
            {live && <span className="live-dot" style={{ display: 'inline-block', marginLeft: 6, verticalAlign: 'middle' }} />}
          </div>
          <div
            style={{
              fontSize: 'var(--text-20)',
              fontWeight: 700,
              color: 'var(--gray-50)',
              fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {value}
          </div>
        </div>
        {delta !== undefined && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: deltaColor, fontSize: 'var(--text-12)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            <DeltaIcon size={12} />
            {Math.abs(delta)}{deltaLabel}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={cardRef}
      className="card"
      style={{ transition: 'border-color var(--motion-normal)' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="text-label">
          {label}
          {live && (
            <span
              className="live-dot"
              style={{ display: 'inline-block', marginLeft: 6, verticalAlign: 'middle' }}
            />
          )}
        </div>
        {delta !== undefined && (
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 3,
              color: deltaColor,
              fontSize: 'var(--text-11)',
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <DeltaIcon size={11} />
            {Math.abs(delta)}{deltaLabel}
          </div>
        )}
      </div>

      {/* Value */}
      <div
        style={{
          fontSize: 'var(--text-28)',
          fontWeight: 700,
          color: 'var(--gray-50)',
          fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
          marginBottom: sparkline ? 16 : 0,
        }}
      >
        {value}
      </div>

      {/* Sparkline */}
      {sparkline && sparkline.length > 0 && (
        <ResponsiveContainer width="100%" height={40}>
          <LineChart data={sparkline} margin={{ top: 2, right: 2, bottom: 0, left: 2 }}>
            <Line
              type="monotone"
              dataKey="value"
              stroke={sparklineColor}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};
