
/* ============================================================================
 * CivilGenius v20 — hand-rolled SVG charts (no chart library)
 *   XYChart    : line + area, hover tooltip, optional P-M marker
 *   Sparkline  : compact trend
 *   TrendBadge : percentage change pill
 * ========================================================================== */

import { useMemo, useRef, useState, type ReactNode } from 'react';
import { faNum, toFa } from '../lib/format';

export interface SeriesPoint {
  t: number;
  v: number;
}

function niceBounds(min: number, max: number): { min: number; max: number } {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return { min: Math.max(0, min - 1), max: max + 1 };
  }
  const pad = (max - min) * 0.12;
  return { min: Math.max(0, min - pad), max: max + pad };
}

export function XYChart({
  points,
  height = 220,
  color = '#059669',
  yLabel = '',
  marker,
  markerLabel,
  onMarkerClick,
}: {
  points: SeriesPoint[];
  height?: number;
  color?: string;
  yLabel?: string;
  marker?: { x: number; y: number } | null;
  markerLabel?: string;
  onMarkerClick?: () => void;
}): ReactNode {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  const W = 720;
  const H = height;
  const padL = 8;
  const padR = 8;
  const padT = 14;
  const padB = 22;

  const geom = useMemo(() => {
    const xs = points.map((p) => p.t);
    const ys = points.map((p) => p.v);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const { min: yMin, max: yMax } = niceBounds(Math.min(...ys), Math.max(...ys));
    const sx = (x: number) => padL + ((x - xMin) / Math.max(1, xMax - xMin)) * (W - padL - padR);
    const sy = (y: number) => padT + (1 - (y - yMin) / Math.max(1e-9, yMax - yMin)) * (H - padT - padB);
    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.t).toFixed(2)},${sy(p.v).toFixed(2)}`).join(' ');
    const area = `${line} L${sx(xMax).toFixed(2)},${(H - padB).toFixed(2)} L${sx(xMin).toFixed(2)},${(H - padB).toFixed(2)} Z`;
    return { sx, sy, line, area, yMin, yMax, xMin, xMax };
  }, [points, H]);

  if (!points.length) {
    return <div className="grid h-40 place-items-center text-xs text-faint">داده‌ای برای نمایش نیست</div>;
  }

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => geom.yMin + f * (geom.yMax - geom.yMin));
  const active = hover !== null ? points[Math.min(hover, points.length - 1)] : null;

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const rel = (rect.right - e.clientX) / rect.width; // RTL: right is the start
    const x = rel * W;
    const span = Math.max(1, geom.xMax - geom.xMin);
    const t = geom.xMin + ((x - padL) / (W - padL - padR)) * span;
    let best = 0;
    let bestD = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(p.t - t);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    setHover(best);
  };

  return (
    <div
      ref={wrapRef}
      className="relative w-full select-none"
      onMouseMove={handleMove}
      onMouseLeave={() => setHover(null)}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} role="img" aria-label={yLabel}>
        <defs>
          <linearGradient id="cg-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {gridLines.map((g, i) => (
          <line key={i} x1={padL} x2={W - padR} y1={geom.sy(g)} y2={geom.sy(g)} stroke="#e7e9ee" strokeWidth="1" />
        ))}
        <path d={geom.area} fill="url(#cg-area)" className="chart-fade" />
        <path d={geom.line} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" className="chart-draw" />
        {active ? (
          <>
            <line x1={geom.sx(active.t)} x2={geom.sx(active.t)} y1={padT} y2={H - padB} stroke={color} strokeOpacity="0.35" strokeDasharray="4 4" />
            <circle cx={geom.sx(active.t)} cy={geom.sy(active.v)} r="4.5" fill="#fff" stroke={color} strokeWidth="2.5" />
          </>
        ) : null}
        {marker ? (
          <g
            onClick={onMarkerClick}
            className={onMarkerClick ? 'cursor-pointer' : ''}
            role={onMarkerClick ? 'button' : undefined}
          >
            <circle cx={geom.sx(marker.x)} cy={geom.sy(marker.y)} r="7" fill="#d97706" fillOpacity="0.18" />
            <circle cx={geom.sx(marker.x)} cy={geom.sy(marker.y)} r="4" fill="#d97706" stroke="#fff" strokeWidth="1.6" />
            {markerLabel ? (
              <text x={geom.sx(marker.x) - 10} y={geom.sy(marker.y) - 12} fontSize="11" fill="#b45309" fontWeight="700" textAnchor="end">
                {markerLabel}
              </text>
            ) : null}
          </g>
        ) : null}
        <text x={W - padR} y={H - 6} fontSize="10" fill="#98a2b3" textAnchor="end">
          {toFa(new Date(geom.xMin).toLocaleDateString('fa-IR-u-nu-latn', { month: 'short', day: 'numeric' }))}
        </text>
        <text x={padL} y={H - 6} fontSize="10" fill="#98a2b3" textAnchor="start">
          {toFa(new Date(geom.xMax).toLocaleDateString('fa-IR-u-nu-latn', { month: 'short', day: 'numeric' }))}
        </text>
      </svg>
      {active ? (
        <div
          className="pointer-events-none absolute top-2 rounded-lg border border-line bg-panel px-2.5 py-1.5 text-[11px] shadow-lg"
          style={{ left: `${(geom.sx(active.t) / W) * 100}%`, transform: 'translateX(-50%)' }}
        >
          <div className="font-semibold text-ink tnum">{faNum(active.v)}</div>
          <div className="text-faint">{new Date(active.t).toLocaleDateString('fa-IR-u-nu-latn', { year: 'numeric', month: 'short', day: 'numeric' })}</div>
        </div>
      ) : null}
    </div>
  );
}

export function Sparkline({ points, color = '#059669', height = 34 }: { points: SeriesPoint[]; color?: string; height?: number }): ReactNode {
  if (points.length < 2) return <span className="text-[11px] text-faint">—</span>;
  const W = 100;
  const H = height;
  const ys = points.map((p) => p.v);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const span = Math.max(1e-9, max - min);
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * W;
      const y = H - ((p.v - min) / span) * (H - 4) - 2;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="none" aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TrendBadge({ points, className = '' }: { points: SeriesPoint[]; className?: string }): ReactNode {
  if (points.length < 2) return <span className={className}>—</span>;
  const first = points[0].v;
  const last = points[points.length - 1].v;
  const pct = ((last - first) / Math.max(1, first)) * 100;
  const up = pct >= 0;
  return (
    <span
      className={`tnum inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        up ? 'bg-emerald-soft text-forest' : 'bg-bad-soft text-bad'
      } ${className}`}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        <path d={up ? 'M5 1 L9 8 L1 8 Z' : 'M5 9 L1 2 L9 2 Z'} fill="currentColor" />
      </svg>
      {faNum(Math.abs(pct), 2)}٪
    </span>
  );
}


