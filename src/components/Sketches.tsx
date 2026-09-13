
/* ============================================================================
 * CivilGenius v20 — live engineering sketches (SVG, update with every compute)
 * ========================================================================== */

import { type ReactNode } from 'react';
import type { Diagram } from '../lib/engine';
import { faNum } from '../lib/format';

const INK = '#101828';
const MUTED = '#98a2b3';
const CONCRETE = '#667085';
const REBAR = '#d92d20';
const DIM = '#2563eb';

function Label({ x, y, children, color = MUTED, size = 10, anchor = 'middle' }: { x: number; y: number; children: string; color?: string; size?: number; anchor?: 'start' | 'middle' | 'end' }): ReactNode {
  return (
    <text x={x} y={y} fontSize={size} fill={color} textAnchor={anchor} fontWeight={600}>
      {children}
    </text>
  );
}

export function Sketch({ diagram }: { diagram: Diagram }): ReactNode {
  if (diagram.kind === 'foundation') return <FoundationSketch d={diagram} />;
  if (diagram.kind === 'beam') return <BeamSketch d={diagram} />;
  if (diagram.kind === 'column') return <ColumnSketch d={diagram} />;
  if (diagram.kind === 'slab') return <SlabSketch d={diagram} />;
  if (diagram.kind === 'wall') return <WallSketch d={diagram} />;
  if (diagram.kind === 'stair') return <StairSketch d={diagram} />;
  return <JointSketch d={diagram} />;
}

function FoundationSketch({ d }: { d: Extract<Diagram, { kind: 'foundation' }> }): ReactNode {
  const W = 640;
  const H = 300;
  const scale = Math.min(380 / d.L, 130 / d.B);
  const w = d.L * scale;
  const h = d.B * scale;
  const ox = (W - w) / 2;
  const oy = 42;
  const meshStep = Math.max(9, (d.spacing / 1000) * scale);
  const verticals: number[] = [];
  for (let x = ox + meshStep; x < ox + w - 1; x += meshStep) verticals.push(x);
  const horizontals: number[] = [];
  for (let y = oy + meshStep; y < oy + h - 1; y += meshStep) horizontals.push(y);
  const cSize = (d.cs / 1000) * scale;
  const cx = ox + w / 2;
  const cy = oy + h / 2;

  const secTop = oy + h + 52;
  const secH = Math.max(14, d.H * 12);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="پلان فونداسیون">
      <defs>
        <pattern id="fnd-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#eef0f4" strokeWidth="1" />
        </pattern>
      </defs>
      {/* chessboard background grid */}
      <rect x="0" y="0" width={W} height={H} fill="url(#fnd-grid)" />
      {/* excavation outline */}
      <rect x={ox - 12} y={oy - 12} width={w + 24} height={h + 24} fill="none" stroke={MUTED} strokeDasharray="5 4" />
      {/* footing */}
      <rect x={ox} y={oy} width={w} height={h} fill="#f7f8fa" stroke={CONCRETE} strokeWidth="2" />
      {verticals.map((x, i) => (
        <line key={`v${i}`} x1={x} y1={oy} x2={x} y2={oy + h} stroke={REBAR} strokeWidth="0.8" opacity="0.75" />
      ))}
      {horizontals.map((y, i) => (
        <line key={`h${i}`} x1={ox} y1={y} x2={ox + w} y2={y} stroke={REBAR} strokeWidth="0.8" opacity="0.75" />
      ))}
      {/* column */}
      <rect x={cx - cSize / 2} y={cy - cSize / 2} width={cSize} height={cSize} fill="#d9dde5" stroke={INK} strokeWidth="1.6" />
      <circle cx={cx} cy={cy} r={cSize * 0.16} fill="none" stroke={REBAR} strokeWidth="1.2" />
      <circle cx={cx} cy={cy} r={cSize * 0.3} fill="none" stroke={REBAR} strokeWidth="1" opacity="0.7" />
      {/* dims */}
      <line x1={ox} y1={oy + h + 16} x2={ox + w} y2={oy + h + 16} stroke={DIM} strokeWidth="1" />
      <line x1={ox} y1={oy + h + 11} x2={ox} y2={oy + h + 21} stroke={DIM} strokeWidth="1" />
      <line x1={ox + w} y1={oy + h + 11} x2={ox + w} y2={oy + h + 21} stroke={DIM} strokeWidth="1" />
      <Label x={ox + w / 2} y={oy + h + 32} color={DIM}>{`L = ${faNum(d.L, 2)} m`}</Label>
      <Label x={ox - 20} y={oy + h / 2} color={DIM} anchor="end">{`B = ${faNum(d.B, 2)} m`}</Label>
      <Label x={ox} y={26} color={INK} size={12} anchor="start">
        {`پلان فونداسیون — شبکه دو طرفه Ø${faNum(d.barDia, 0)} @ ${faNum(d.spacing, 0)} mm`}
      </Label>
      {/* section strip */}
      <rect x={ox} y={secTop} width={w} height={secH} fill="#eef0f4" stroke={CONCRETE} strokeWidth="1.6" />
      <line x1={ox} y1={secTop + secH + 3} x2={ox + w} y2={secTop + secH + 3} stroke="#059669" strokeWidth="2" />
      {/* top & bottom mesh bars with spacing ticks */}
      <line x1={ox + 3} y1={secTop + 4} x2={ox + w - 3} y2={secTop + 4} stroke={REBAR} strokeWidth="1.4" />
      <line x1={ox + 3} y1={secTop + secH - 4} x2={ox + w - 3} y2={secTop + secH - 4} stroke={REBAR} strokeWidth="1.4" />
      {[0.25, 0.5, 0.75].map((f) => (
        <g key={f}>
          <line x1={ox + w * f} y1={secTop + 1.5} x2={ox + w * f} y2={secTop + 6.5} stroke={REBAR} strokeWidth="1" />
          <line x1={ox + w * f} y1={secTop + secH - 6.5} x2={ox + w * f} y2={secTop + secH - 1.5} stroke={REBAR} strokeWidth="1" />
        </g>
      ))}
      <Label x={ox + w * 0.5} y={secTop - 3} color={REBAR} size={9}>
        {`سفره بالا Ø${faNum(d.barDia, 0)} @ ${faNum(d.spacing, 0)} mm`}
      </Label>
      <Label x={ox + w * 0.5} y={secTop + secH + 14} color={REBAR} size={9}>
        {`سفره پایین Ø${faNum(d.barDia, 0)} @ ${faNum(d.spacing, 0)} mm`}
      </Label>
      {/* development length (Ldh) at the bottom bar end */}
      <line x1={ox + 3} y1={secTop + secH - 4} x2={ox + 3} y2={secTop + secH - 12} stroke={DIM} strokeWidth="1.2" />
      <line x1={ox + 3 + Math.min(70, d.ldh * 0.09)} y1={secTop + secH - 4} x2={ox + 3 + Math.min(70, d.ldh * 0.09)} y2={secTop + secH - 12} stroke={DIM} strokeWidth="1.2" />
      <line x1={ox + 3} y1={secTop + secH - 10} x2={ox + 3 + Math.min(70, d.ldh * 0.09)} y2={secTop + secH - 10} stroke={DIM} strokeWidth="1" />
      <Label x={ox + 8 + Math.min(70, d.ldh * 0.09)} y={secTop + secH - 8} color={DIM} size={9} anchor="start">
        {`Ldh ≈ ${faNum(d.ldh, 0)} mm`}
      </Label>
      <Label x={ox + w + 12} y={secTop + 12} color={MUTED} size={9} anchor="start">
        {`ضخامت ${faNum(d.H, 2)} m`}
      </Label>
    </svg>
  );
}

function BeamSketch({ d }: { d: Extract<Diagram, { kind: 'beam' }> }): ReactNode {
  const W = 640;
  const H = 300;
  const span = Math.min(520, d.L * 46);
  const depth = Math.min(90, Math.max(24, (d.h / 1000) * 110));
  const ox = (W - span) / 2;
  const oy = 78;
  const st = Math.max(9, (d.stirrupSpacing / 1000) * 46);
  const stC = Math.max(4, (d.sCritical / 1000) * 46);
  const dPx = Math.min(span * 0.3, (d.dEff / 1000) * 46); // critical zone ≈ d from face
  const sw = Math.max(60, d.b * 0.16);
  const sh = Math.max(70, d.h * 0.16);
  const sx = ox + span / 2 - sw / 2;
  const sy = oy + depth + 74;
  const stirrups: number[] = [];
  for (let x = ox + 3; x <= ox + dPx; x += stC) stirrups.push(x);
  for (let x = ox + dPx + st; x <= ox + span - dPx; x += st) stirrups.push(x);
  for (let x = ox + span - 3; x >= ox + span - dPx; x -= stC) stirrups.push(x);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="نمای تیر">
      <Label x={12} y={24} color={INK} size={12} anchor="start">
        {`نمای تیر — ${faNum(d.bars, 0)}Ø${faNum(d.barDia, 0)} + خاموت Ø${faNum(d.stirrupDia, 0)} @ ${faNum(d.stirrupSpacing, 0)}${d.torsion ? ` + پیچشی ${faNum(d.nTorsionLong, 0)}Ø${faNum(d.barDia, 0)}` : ''}`}
      </Label>
      <rect x={ox} y={oy} width={span} height={depth} fill="#f7f8fa" stroke={CONCRETE} strokeWidth="2" />
      <line x1={ox + 8} y1={oy + 8} x2={ox + span - 8} y2={oy + 8} stroke={REBAR} strokeWidth="2" />
      <line x1={ox + 8} y1={oy + depth - 8} x2={ox + span - 8} y2={oy + depth - 8} stroke={REBAR} strokeWidth="2" />
      {stirrups.map((x, i) => (
        <line key={i} x1={x} y1={oy + 6} x2={x} y2={oy + depth - 6} stroke={REBAR} strokeWidth="1" opacity="0.7" />
      ))}
      {/* critical-zone boundaries (≈ d from support face) */}
      <line x1={ox + dPx} y1={oy - 4} x2={ox + dPx} y2={oy + depth + 4} stroke="#d97706" strokeDasharray="3 3" strokeWidth="1" />
      <line x1={ox + span - dPx} y1={oy - 4} x2={ox + span - dPx} y2={oy + depth + 4} stroke="#d97706" strokeDasharray="3 3" strokeWidth="1" />
      <Label x={ox + dPx / 2} y={oy - 8} color="#b45309" size={8.5}>{`خاموت بحرانی ${faNum(d.sCritical, 0)}`}</Label>
      <Label x={ox + span / 2} y={oy - 8} color={MUTED} size={8.5}>{`خاموت معمولی ${faNum(d.stirrupSpacing, 0)}`}</Label>
      <Label x={ox + span - dPx / 2} y={oy - 8} color="#b45309" size={8.5}>{`خاموت بحرانی ${faNum(d.sCritical, 0)}`}</Label>
      {/* supports */}
      {d.support === 'simple' ? (
        <>
          <polygon points={`${ox},${oy + depth} ${ox - 16},${oy + depth + 20} ${ox + 16},${oy + depth + 20}`} fill="#e7e9ee" stroke={CONCRETE} />
          <polygon points={`${ox + span},${oy + depth} ${ox + span - 16},${oy + depth + 20} ${ox + span + 16},${oy + depth + 20}`} fill="#e7e9ee" stroke={CONCRETE} />
        </>
      ) : (
        <>
          <rect x={ox - 18} y={oy - 4} width={18} height={depth + 8} fill="#d9dde5" stroke={CONCRETE} />
          <rect x={ox + span} y={oy - 4} width={18} height={depth + 8} fill="#d9dde5" stroke={CONCRETE} />
        </>
      )}
      {/* dimension */}
      <line x1={ox} y1={oy + depth + 34} x2={ox + span} y2={oy + depth + 34} stroke={DIM} strokeWidth="1" />
      <line x1={ox} y1={oy + depth + 29} x2={ox} y2={oy + depth + 39} stroke={DIM} strokeWidth="1" />
      <line x1={ox + span} y1={oy + depth + 29} x2={ox + span} y2={oy + depth + 39} stroke={DIM} strokeWidth="1" />
      <Label x={ox + span / 2} y={oy + depth + 50} color={DIM}>{`L = ${faNum(d.L, 2)} m`}</Label>

      {/* cross-section */}
      <rect x={sx} y={sy} width={sw} height={sh} fill="#f7f8fa" stroke={CONCRETE} strokeWidth="1.6" />
      <rect x={sx + 7} y={sy + 7} width={sw - 14} height={sh - 14} fill="none" stroke={REBAR} strokeWidth="1.2" />
      {[
        [sx + 7, sy + 7],
        [sx + sw - 7, sy + 7],
        [sx + 7, sy + sh - 7],
        [sx + sw - 7, sy + sh - 7],
      ].map(([px, py], i) => (
        <circle key={i} cx={px} cy={py} r="4" fill={REBAR} />
      ))}
      {/* skin reinforcement for deep beams (h > 750 mm) */}
      {d.skin ? (
        <>
          {[1 / 3, 2 / 3].map((f) => (
            <g key={f}>
              <circle cx={sx + 7} cy={sy + 7 + (sh - 14) * f} r="3" fill="#f79009" />
              <circle cx={sx + sw - 7} cy={sy + 7 + (sh - 14) * f} r="3" fill="#f79009" />
            </g>
          ))}
          <Label x={sx + sw + 12} y={sy + sh / 2 + 14} color="#b45309" size={9} anchor="start">
            آرماتور جلدی لازم (h&gt;750)
          </Label>
        </>
      ) : null}
      <Label x={sx + sw + 12} y={sy + sh / 2} color={MUTED} size={9} anchor="start">
        {`مقطع ${faNum(d.b, 0)}×${faNum(d.h, 0)} mm`}
      </Label>
    </svg>
  );
}

function ColumnSketch({ d }: { d: Extract<Diagram, { kind: 'column' }> }): ReactNode {
  const W = 640;
  const H = 300;
  const w = Math.max(70, Math.min(120, d.b * 0.22));
  const h = Math.min(170, d.Lc * 42);
  const ox = 120;
  const oy = 60;
  const tieStep = Math.max(10, (d.tieSpacing / 1000) * 42);
  const ties: number[] = [];
  for (let y = oy + tieStep / 2; y < oy + h - 2; y += tieStep) ties.push(y);

  const sw = Math.max(80, d.b * 0.24);
  const sh = Math.max(80, d.h * 0.24);
  const sx = 380;
  const sy = 100;
  const perSide = Math.max(2, Math.round(d.bars / 4));
  const bars: [number, number][] = [];
  for (let i = 0; i < perSide; i++) {
    const t = i / Math.max(1, perSide - 1);
    bars.push([sx + 9 + (sw - 18) * t, sy + 9]);
    bars.push([sx + 9 + (sw - 18) * t, sy + sh - 9]);
  }
  for (let i = 1; i < perSide - 1; i++) {
    const t = i / Math.max(1, perSide - 1);
    bars.push([sx + 9, sy + 9 + (sh - 18) * t]);
    bars.push([sx + sw - 9, sy + 9 + (sh - 18) * t]);
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="ستون">
      <Label x={12} y={24} color={INK} size={12} anchor="start">
        {`ستون — ${faNum(d.bars, 0)}Ø${faNum(d.barDia, 0)} + خاموت Ø${faNum(d.tieDia, 0)} @ ${faNum(d.tieSpacing, 0)}`}
      </Label>
      <rect x={ox} y={oy} width={w} height={h} fill="#f7f8fa" stroke={CONCRETE} strokeWidth="2" />
      <line x1={ox + 7} y1={oy} x2={ox + 7} y2={oy + h} stroke={REBAR} strokeWidth="1.6" />
      <line x1={ox + w - 7} y1={oy} x2={ox + w - 7} y2={oy + h} stroke={REBAR} strokeWidth="1.6" />
      {ties.map((y, i) => (
        <line key={i} x1={ox + 4} y1={y} x2={ox + w - 4} y2={y} stroke={REBAR} strokeWidth="1" opacity="0.65" />
      ))}
      <line x1={ox - 18} y1={oy} x2={ox - 18} y2={oy + h} stroke={DIM} strokeWidth="1" />
      <line x1={ox - 23} y1={oy} x2={ox - 13} y2={oy} stroke={DIM} strokeWidth="1" />
      <line x1={ox - 23} y1={oy + h} x2={ox - 13} y2={oy + h} stroke={DIM} strokeWidth="1" />
      <Label x={ox - 26} y={oy + h / 2} color={DIM} anchor="end">{`Lc = ${faNum(d.Lc, 2)} m`}</Label>

      <rect x={sx} y={sy} width={sw} height={sh} fill="#f7f8fa" stroke={CONCRETE} strokeWidth="2" />
      <rect x={sx + 9} y={sy + 9} width={sw - 18} height={sh - 18} fill="none" stroke={REBAR} strokeWidth="1.2" />
      {bars.map(([px, py], i) => (
        <circle key={i} cx={px} cy={py} r="3.6" fill={REBAR} />
      ))}
      <Label x={sx + sw / 2} y={sy + sh + 20} color={MUTED}>{`مقطع ${faNum(d.b, 0)}×${faNum(d.h, 0)} mm`}</Label>
      <Label x={sx + sw / 2} y={sy - 12} color={INK} size={11}>
        مقطع ستون
      </Label>
    </svg>
  );
}


/* ====================================================== SLAB (round-31) == */

function SlabSketch({ d }: { d: Extract<Diagram, { kind: 'slab' }> }): ReactNode {
  const W = 640;
  const H = 300;
  const span = Math.min(520, d.L * 70);
  const dep = Math.max(34, d.h * 0.16);
  const ox = (W - span) / 2;
  const oy = 96;
  const sy = oy + dep + 66;
  const sh = Math.max(26, d.h * 0.14);
  const ribs: number[] = [];
  if (d.system === 'joist' || d.system === 'waffle') for (let x = ox + 26; x < ox + span - 10; x += 42) ribs.push(x);
  const bot: number[] = [];
  const step = Math.max(14, d.spacing * 0.09);
  for (let x = ox + 8; x <= ox + span - 8; x += step) bot.push(x);
  const neg: number[] = [];
  const nstep = Math.max(12, d.negSpacing * 0.09);
  for (let x = ox + 6; x <= ox + span * 0.25; x += nstep) neg.push(x);
  for (let x = ox + span - 6; x >= ox + span * 0.75; x -= nstep) neg.push(x);
  const SYS = { joist: 'تیرچه-بلوک', waffle: 'وافل', solid: 'دال بتنی', hollow: 'دال مجوف' } as const;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="مقطع سقف">
      <Label x={12} y={24} color={INK} size={12} anchor="start">{`مقطع سقف ${SYS[d.system]} — ضخامت ${faNum(d.h, 0)} mm`}</Label>
      {/* deck */}
      <rect x={ox} y={oy} width={span} height={dep} fill="#f7f8fa" stroke={CONCRETE} strokeWidth="2" />
      {d.system === 'joist' ? (
        ribs.map((x, i) => (
          <g key={i}>
            <rect x={x} y={oy + 10} width={26} height={dep - 12} fill="#fff" stroke={MUTED} strokeWidth="1" />
            <rect x={x + 9} y={oy + dep - 14} width={8} height={10} fill="#e7e9ee" stroke={CONCRETE} strokeWidth="0.8" />
          </g>
        ))
      ) : null}
      {d.system === 'waffle' ? ribs.map((x, i) => <rect key={i} x={x} y={oy + 12} width={30} height={dep - 14} fill="#fff" stroke={MUTED} />) : null}
      {d.system === 'hollow' ? ribs.map((x, i) => <ellipse key={i} cx={x + 12} cy={oy + dep / 2} rx={13} ry={dep * 0.3} fill="#fff" stroke={MUTED} />) : null}
      {/* bottom main bars */}
      {bot.map((x, i) => <circle key={i} cx={x} cy={oy + dep - 6} r="2.6" fill={REBAR} />)}
      <line x1={ox + 6} y1={oy + dep - 6} x2={ox + span - 6} y2={oy + dep - 6} stroke={REBAR} strokeWidth="1.2" />
      {/* negative top bars over supports */}
      <line x1={ox + 4} y1={oy + 6} x2={ox + span * 0.25} y2={oy + 6} stroke={REBAR} strokeWidth="1.4" />
      <line x1={ox + span * 0.75} y1={oy + 6} x2={ox + span - 4} y2={oy + 6} stroke={REBAR} strokeWidth="1.4" />
      {neg.map((x, i) => <line key={i} x1={x} y1={oy + 3.5} x2={x} y2={oy + 8.5} stroke={REBAR} strokeWidth="1" />)}
      {/* temperature mesh label line */}
      <line x1={ox + 6} y1={oy + 11} x2={ox + span - 6} y2={oy + 11} stroke="#f79009" strokeWidth="0.8" strokeDasharray="4 3" />
      <Label x={ox + span / 2} y={oy - 8} color="#b45309" size={9}>{`حرارتی/مونس Ø @ ${faNum(d.tempSpacing, 0)}`}</Label>
      <Label x={ox + span * 0.125} y={oy - 20} color={REBAR} size={9}>{`منفی @ ${faNum(d.negSpacing, 0)}`}</Label>
      <Label x={ox + span - span * 0.125} y={oy - 20} color={REBAR} size={9}>{`منفی @ ${faNum(d.negSpacing, 0)}`}</Label>
      {/* tie beams */}
      {d.tieBeam ? (
        <>
          <rect x={ox - 14} y={oy} width={14} height={dep} fill="#d9dde5" stroke={CONCRETE} />
          <rect x={ox + span} y={oy} width={14} height={dep} fill="#d9dde5" stroke={CONCRETE} />
          <Label x={ox - 18} y={oy + dep + 14} color={MUTED} size={9} anchor="end">تای‌بیم</Label>
          <Label x={ox + span + 18} y={oy + dep + 14} color={MUTED} size={9} anchor="start">تای‌بیم</Label>
        </>
      ) : null}
      {/* dimensions */}
      <line x1={ox} y1={oy + dep + 30} x2={ox + span} y2={oy + dep + 30} stroke={DIM} strokeWidth="1" />
      <Label x={ox + span / 2} y={oy + dep + 44} color={DIM}>{`L = ${faNum(d.L, 2)} m`}</Label>
      <line x1={ox + span + (d.tieBeam ? 26 : 12)} y1={oy} x2={ox + span + (d.tieBeam ? 26 : 12)} y2={oy + dep} stroke={DIM} strokeWidth="1" />
      <Label x={ox + span + (d.tieBeam ? 30 : 16)} y={oy + dep / 2 + 3} color={DIM} anchor="start">{`h = ${faNum(d.h, 0)}`}</Label>
      {/* section strip */}
      <rect x={ox + span / 2 - 60} y={sy} width={120} height={sh} fill="#eef0f4" stroke={CONCRETE} strokeWidth="1.4" />
      <circle cx={ox + span / 2 - 46} cy={sy + sh - 7} r="3" fill={REBAR} />
      <circle cx={ox + span / 2 + 46} cy={sy + sh - 7} r="3" fill={REBAR} />
      <circle cx={ox + span / 2 - 46} cy={sy + 7} r="2.4" fill={REBAR} />
      <circle cx={ox + span / 2 + 46} cy={sy + 7} r="2.4" fill={REBAR} />
      <Label x={ox + span / 2} y={sy + sh + 16} color={MUTED} size={9}>{`کششی Ø${faNum(d.barDia, 0)} @ ${faNum(d.spacing, 0)} mm`}</Label>
    </svg>
  );
}

/* ====================================================== WALL (round-31) == */

function WallSketch({ d }: { d: Extract<Diagram, { kind: 'wall' }> }): ReactNode {
  const W = 640;
  const H = 300;
  const wl = Math.min(460, d.lw * 100);
  const tw = Math.max(16, d.tw * 0.08);
  const ox = (W - wl) / 2;
  const oy = 120;
  const vs: number[] = [];
  const vstep = Math.max(16, d.vSpacing * 0.11);
  for (let x = ox + 6; x <= ox + wl - 6; x += vstep) vs.push(x);
  const hsLines: number[] = [];
  const hstep = Math.max(12, d.hSpacing * 0.11);
  for (let y = oy - 40; y <= oy + tw + 40; y += hstep) hsLines.push(y);
  const be = d.boundary ? Math.max(34, d.beLen * 0.1) : 0;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="مقطع دیوار برشی">
      <Label x={12} y={24} color={INK} size={12} anchor="start">{`مقطع افقی دیوار برشی ${faNum(d.lw, 1)} m × ${faNum(d.tw, 0)} mm`}</Label>
      <rect x={ox} y={oy} width={wl} height={tw} fill="#f7f8fa" stroke={CONCRETE} strokeWidth="2" />
      {/* vertical bars */}
      {vs.map((x, i) => <circle key={i} cx={x} cy={oy + tw / 2} r="2.6" fill={REBAR} />)}
      {/* horizontal bars above/below */}
      <line x1={ox + 4} y1={oy + 4} x2={ox + wl - 4} y2={oy + 4} stroke={REBAR} strokeWidth="1.2" />
      <line x1={ox + 4} y1={oy + tw - 4} x2={ox + wl - 4} y2={oy + tw - 4} stroke={REBAR} strokeWidth="1.2" />
      {/* boundary elements */}
      {d.boundary ? (
        <>
          <rect x={ox - 2} y={oy - 4} width={be} height={tw + 8} fill="none" stroke="#d97706" strokeWidth="1.6" strokeDasharray="4 3" />
          <rect x={ox + wl - be + 2} y={oy - 4} width={be} height={tw + 8} fill="none" stroke="#d97706" strokeWidth="1.6" strokeDasharray="4 3" />
          {[ox + be / 2 - 2, ox + wl - be / 2 + 2].map((cx, i) => (
            <g key={i}>
              <circle cx={cx - 6} cy={oy + tw / 2} r="3.4" fill="#b45309" />
              <circle cx={cx + 6} cy={oy + tw / 2} r="3.4" fill="#b45309" />
              <rect x={cx - 11} y={oy + tw / 2 - 8} width={22} height={16} fill="none" stroke="#b45309" strokeWidth="1.2" />
              {/* crosstie (سنجاق) */}
              <path d={`M ${cx - 6} ${oy + tw / 2} q 4 -6 12 0`} fill="none" stroke="#b45309" strokeWidth="1" />
            </g>
          ))}
          <Label x={ox + be / 2} y={oy - 12} color="#b45309" size={9}>{`المان مرزی ${faNum(d.beLen, 0)} mm`}</Label>
          <Label x={ox + wl - be / 2} y={oy - 12} color="#b45309" size={9}>{`خاموت @${faNum(d.beHoopS, 0)} + سنجاق`}</Label>
        </>
      ) : null}
      <Label x={ox + wl / 2} y={oy + tw + 22} color={REBAR} size={9}>{`عمودی Ø${faNum(d.vDia, 0)} @ ${faNum(d.vSpacing, 0)}`}</Label>
      <Label x={ox + wl / 2} y={oy - 34} color={REBAR} size={9}>{`افقی Ø${faNum(d.hDia, 0)} @ ${faNum(d.hSpacing, 0)}`}</Label>
      <line x1={ox} y1={oy + tw + 40} x2={ox + wl} y2={oy + tw + 40} stroke={DIM} strokeWidth="1" />
      <Label x={ox + wl / 2} y={oy + tw + 54} color={DIM}>{`lw = ${faNum(d.lw, 2)} m`}</Label>
      <line x1={ox - 14} y1={oy} x2={ox - 14} y2={oy + tw} stroke={DIM} strokeWidth="1" />
      <Label x={ox - 18} y={oy + tw / 2 + 3} color={DIM} anchor="end">{`tw = ${faNum(d.tw, 0)}`}</Label>
    </svg>
  );
}

/* ===================================================== STAIR (round-31) == */

function StairSketch({ d }: { d: Extract<Diagram, { kind: 'stair' }> }): ReactNode {
  const W = 640;
  const H = 300;
  const ox = 60;
  const oy = 240;
  const run = Math.min(470, d.Lr * 60);
  const rise = Math.min(170, d.H * 60);
  const t = Math.max(12, d.t * 0.07);
  const n = d.ramp ? 1 : Math.max(4, d.n);
  const pts: string[] = [`${ox},${oy}`];
  if (d.ramp) {
    pts.push(`${ox + run},${oy - rise}`);
  } else {
    for (let k = 0; k < n; k++) {
      pts.push(`${ox + ((k + 1) * run) / n},${oy - (k * rise) / n}`);
      pts.push(`${ox + ((k + 1) * run) / n},${oy - ((k + 1) * rise) / n}`);
    }
  }
  // soffit (slab underside) parallel offset
  const soffit = pts.map((p) => {
    const [x, y] = p.split(',').map(Number);
    return `${x + t * 0.5},${y + t}`;
  });
  const bar = pts.map((p, i) => {
    const [x, y] = p.split(',').map(Number);
    return `${i === 0 ? 'M' : 'L'}${x + t * 0.25},${y + t * 0.62}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="مقطع راهپله">
      <Label x={12} y={24} color={INK} size={12} anchor="start">{d.ramp ? `رمپ شیبدار — ارتفاع ${faNum(d.H, 2)} m` : `راهپله ${faNum(n, 0)} پله — ضخامت دال ${faNum(d.t, 0)} mm`}</Label>
      <path d={`M${pts.join(' L')}`} fill="none" stroke={CONCRETE} strokeWidth="2.4" />
      <path d={`M${soffit.join(' L')}`} fill="none" stroke={CONCRETE} strokeWidth="2" />
      <line x1={ox} y1={oy} x2={ox} y2={oy + t} stroke={CONCRETE} strokeWidth="2" />
      <line x1={ox + run + t * 0.5} y1={oy - rise} x2={ox + run + t * 0.5} y2={oy - rise + t} stroke={CONCRETE} strokeWidth="2" />
      {/* bottom main bar with 90° anchorage bends */}
      <path d={`${bar} M${ox + t * 0.25},${oy + t * 0.62} L${ox + t * 0.25},${oy - 14}`} fill="none" stroke={REBAR} strokeWidth="2" />
      <path d={`M${ox + run + t * 0.25},${oy - rise + t * 0.62} L${ox + run + t * 0.25},${oy - rise - 12}`} fill="none" stroke={REBAR} strokeWidth="2" />
      <Label x={ox + 2} y={oy + 26} color={REBAR} size={9} anchor="start">{`خم مهار 90° + Ld`}</Label>
      <Label x={ox + run - 30} y={oy - rise - 16} color={REBAR} size={9}>{`Ø${faNum(d.barDia, 0)} @ ${faNum(d.spacing, 0)}`}</Label>
      {/* dims */}
      <line x1={ox} y1={oy + 46} x2={ox + run} y2={oy + 46} stroke={DIM} strokeWidth="1" />
      <Label x={ox + run / 2} y={oy + 60} color={DIM}>{`L = ${faNum(d.Lr, 2)} m`}</Label>
      <line x1={ox + run + 40} y1={oy - rise} x2={ox + run + 40} y2={oy} stroke={DIM} strokeWidth="1" />
      <Label x={ox + run + 46} y={oy - rise / 2} color={DIM} anchor="start">{`H = ${faNum(d.H, 2)} m`}</Label>
    </svg>
  );
}

/* ===================================================== JOINT (round-31) == */

function JointSketch({ d }: { d: Extract<Diagram, { kind: 'joint' }> }): ReactNode {
  const W = 640;
  const H = 300;
  const s = Math.min(220 / d.colH, 300 / (d.beamH + 140));
  const cw = d.colB * s;
  const ch = d.colH * s;
  const _bw = d.beamB; // width drawn symbolically via beam rects
  void _bw;
  const bh = d.beamH * s;
  const cx = W / 2;
  const cy = 150;
  const colX = cx - cw / 2;
  const colY = cy - ch / 2;
  const hoops: number[] = [];
  const hstep = Math.max(8, d.hoopS * s);
  for (let y = cy - bh / 2 + 6; y <= cy + bh / 2 - 6; y += hstep) hoops.push(y);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="چشمه اتصال">
      <Label x={12} y={24} color={INK} size={12} anchor="start">{`چشمه اتصال تیر به ستون ${faNum(d.colB, 0)}×${faNum(d.colH, 0)}`}</Label>
      {/* column above & below */}
      <rect x={colX} y={colY - 70} width={cw} height={70} fill="#eef0f4" stroke={CONCRETE} strokeWidth="2" />
      <rect x={colX} y={colY + ch} width={cw} height={70} fill="#eef0f4" stroke={CONCRETE} strokeWidth="2" />
      {/* beams left & right */}
      <rect x={colX - 120} y={cy - bh / 2} width={120} height={bh} fill="#eef0f4" stroke={CONCRETE} strokeWidth="2" />
      <rect x={colX + cw} y={cy - bh / 2} width={120} height={bh} fill="#eef0f4" stroke={CONCRETE} strokeWidth="2" />
      {/* joint panel */}
      <rect x={colX} y={colY} width={cw} height={ch} fill="#fdf6ec" stroke="#d97706" strokeWidth="2" />
      {/* column bars */}
      {[0.15, 0.5, 0.85].map((f) => (
        <line key={f} x1={colX + cw * f} y1={colY - 70} x2={colX + cw * f} y2={colY + ch + 70} stroke={REBAR} strokeWidth="1.6" />
      ))}
      {/* beam bars */}
      <line x1={colX - 120} y1={cy - bh / 2 + 6} x2={colX + cw + 120} y2={cy - bh / 2 + 6} stroke={REBAR} strokeWidth="1.4" />
      <line x1={colX - 120} y1={cy + bh / 2 - 6} x2={colX + cw + 120} y2={cy + bh / 2 - 6} stroke={REBAR} strokeWidth="1.4" />
      {/* dense joint hoops */}
      {hoops.map((y, i) => (
        <line key={i} x1={colX + 4} y1={y} x2={colX + cw - 4} y2={y} stroke="#b45309" strokeWidth="1.6" />
      ))}
      <Label x={colX + cw + 14} y={cy - 4} color="#b45309" size={9} anchor="start">{`خاموت Ø${faNum(d.hoopDia, 0)}@${faNum(d.hoopS, 0)} × ${faNum(d.nHoops, 0)}`}</Label>
      <Label x={colX + cw + 14} y={cy + 10} color={MUTED} size={9} anchor="start">محصورسازی داخل چشمه</Label>
      <Label x={cx} y={colY - 78} color={MUTED} size={9}>ستون بالا</Label>
      <Label x={cx} y={colY + ch + 84} color={MUTED} size={9}>ستون پایین</Label>
      <Label x={colX - 60} y={cy - bh / 2 - 8} color={MUTED} size={9}>تیر چپ</Label>
      <Label x={colX + cw + 60} y={cy - bh / 2 - 8} color={MUTED} size={9}>تیر راست</Label>
    </svg>
  );
}


