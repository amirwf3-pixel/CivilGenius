
/* ============================================================================
 * CivilGenius v20 — SVG donut for budget allocation
 * ========================================================================== */

import { type ReactNode } from 'react';
import { faNum } from '../lib/format';

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export function Donut({
  segments,
  size = 180,
  thickness = 22,
  centerLabel = 'جمع کل',
  centerValue,
}: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}): ReactNode {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={centerLabel}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef0f4" strokeWidth={thickness} />
          {total > 0 &&
            segments.map((seg, i) => {
              const frac = Math.max(0, seg.value) / total;
              const dash = frac * c;
              const el = (
                <circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={thickness}
                  strokeDasharray={`${dash} ${c - dash}`}
                  strokeDashoffset={-offset}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                  strokeLinecap="butt"
                />
              );
              offset += dash;
              return el;
            })}
        </svg>
        <div className="absolute inset-0 grid place-content-center text-center">
          <div className="text-[10px] text-muted">{centerLabel}</div>
          <div className="text-sm font-bold text-ink tnum">{centerValue ?? faNum(total)}</div>
        </div>
      </div>
      <ul className="w-full space-y-2">
        {segments.map((seg, i) => {
          const pct = total > 0 ? (Math.max(0, seg.value) / total) * 100 : 0;
          return (
            <li key={i} className="flex items-center justify-between gap-3 text-xs">
              <span className="flex items-center gap-2 text-muted">
                <span className="size-2.5 rounded-full" style={{ background: seg.color }} />
                {seg.label}
              </span>
              <span className="tnum font-semibold text-ink">{faNum(pct, 1)}٪</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}


