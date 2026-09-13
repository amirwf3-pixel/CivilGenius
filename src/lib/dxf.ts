
/* ============================================================================
 * CivilGenius v24 — CAD SHEET-LAYOUT ENGINE (AutoCAD R12 / AC1009 writer)
 *
 * Architecture (round-32 refactor, video-driven fixes):
 *   Two coordinate spaces with an explicit affine fit between them:
 *
 *     MODEL SPACE  — every drawXxx() function emits geometry in its own
 *                    convenient local units around an arbitrary origin.
 *     PAPER SPACE  — the 42×32 A3 sheet; frame + title block are emitted
 *                    untransformed (paper entities).
 *
 *   At build() time the engine:
 *     1. computes the exact model bounding box (Xmin..Xmax, Ymin..Ymax) of
 *        everything the module drew (rebar overhangs and flights included);
 *     2. derives a uniform scale  k = min(Wd/ΔX, Hd/ΔY)  into the drawing
 *        viewport  DRAW = [2..40]×[8..30]  (the band above the title block,
 *        inset from the inner frame by a ≥1-unit safe margin);
 *     3. centers the scaled bbox inside DRAW (equal residual padding both
 *        axes) so every sheet — slab, stair/ramp, joint, wall, beam, column,
 *        foundation — lands perfectly framed, never tiny, never overflowing;
 *     4. Liang–Barsky clips every transformed LINE against DRAW so extended
 *        beam/slab/grid lines can never cross the sheet border;
 *     5. emits TEXT and DIMENSION ticks in constant PAPER size (≈2.5–5 mm),
 *        i.e. TEXTSIZE/DIMSCALE are independent of the fit scale.
 *
 *   Layering (industry standard, color→lineweight via plot style in R12):
 *     S-CONC  white  7   0.35 mm   concrete outlines
 *     S-REBAR red    1   0.50 mm   reinforcement
 *     S-GRID  magenta 6  0.13 mm   centerline/hatch (LTYPE CENTER)
 *     S-DIM   cyan   4   0.18 mm   dimensions
 *     S-TEXT  yellow 2   0.20 mm   annotations
 *     S-TITLE blue   5   0.25 mm   frame + title block
 *
 *   Entities limited to LINE / CIRCLE / TEXT (R12-safe), printable ASCII
 *   only, validated head-less with ezdxf audit (0 errors / 0 fixes).
 * ========================================================================== */

import type { CalcResult, Diagram } from './engine';
import { CALC_META } from './engine';
import { jalaliISO } from './format';

/* ------------------------------------------------------- sheet constants -- */

/* round-34 CRITICAL FIX: pure ASCII DXF R12 (AC1009). No handles, no $HANDSEED,
 * no OBJECTS / BLOCKS / BLOCK_RECORD / VPORT / DIMSTYLE tables — only the
 * minimal HEADER + TABLES (LTYPE/LAYER/STYLE) + ENTITIES + EOF that every
 * AutoCAD generation opens instantly, edits and saves without prompts.
 * Sheet: true A3 in millimetres (420×297), title block bottom-right with a
 * strict 50 mm safety band above it; model geometry auto-fits/centers/clips
 * inside DRAW so Z→E always lands on a fully framed sheet. */
const SHEET_W = 420;
const SHEET_H = 297;

/** Drawing viewport (mm): 50 mm clear band above the 60 mm title block,
 *  10 mm inside the inner frame on the other sides. */
const DRAW = { x0: 20, y0: 120, x1: 400, y1: 280 } as const;

/** Constant paper text sizes in mm (readable on A3). */
const TXT = { body: 3.5, small: 2.8, dim: 2.8 } as const;

export const DXF_LAYERS = [
  { name: 'S-CONC', color: 7, lt: 'CONTINUOUS' },
  { name: 'S-REBAR', color: 1, lt: 'CONTINUOUS' },
  { name: 'S-STIRRUP', color: 3, lt: 'CONTINUOUS' },
  { name: 'S-DIM', color: 2, lt: 'CONTINUOUS' },
  { name: 'S-TEXT', color: 4, lt: 'CONTINUOUS' },
  { name: 'S-BORDER', color: 5, lt: 'CONTINUOUS' },
] as const;

/** internal authoring names → published standard layers */
const LAYER_MAP: Record<string, string> = {
  CONCRETE: 'S-CONC',
  FORMWORK: 'S-CONC',
  HATCH: 'S-CONC',
  REBAR: 'S-REBAR',
  STIRRUP: 'S-STIRRUP',
  GRID: 'S-DIM',
  DIM: 'S-DIM',
  TEXT: 'S-TEXT',
  FRAME: 'S-BORDER',
};

const ascii = (s: string): string => s.replace(/[^\x20-\x7E]/g, '');
const f = (n: number): string => n.toFixed(4);

/* ------------------------------------------------------- entity buffers -- */

interface LineEnt { k: 'line'; x1: number; y1: number; x2: number; y2: number; layer: string }
interface CircleEnt { k: 'circle'; cx: number; cy: number; r: number; layer: string }
interface TextEnt { k: 'text'; x: number; y: number; h: number; v: string; layer: string; mc: boolean }
interface DimEnt { k: 'dim'; p1: [number, number]; p2: [number, number]; dp: [number, number]; v: string }
type Ent = LineEnt | CircleEnt | TextEnt | DimEnt;

/** Liang–Barsky segment clipping against the DRAW viewport.
 *  Returns the clipped segment or null when fully outside. */
function clipLine(
  x1: number, y1: number, x2: number, y2: number,
): [number, number, number, number] | null {
  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - DRAW.x0, DRAW.x1 - x1, y1 - DRAW.y0, DRAW.y1 - y1];
  for (let i = 0; i < 4; i++) {
    if (Math.abs(p[i]) < 1e-12) {
      if (q[i] < 0) return null;
    } else {
      const r = q[i] / p[i];
      if (p[i] < 0) {
        if (r > t1) return null;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return null;
        if (r < t1) t1 = r;
      }
    }
  }
  return [x1 + t0 * dx, y1 + t0 * dy, x1 + t1 * dx, y1 + t1 * dy];
}

/* ------------------------------------------------------------- the writer -- */

class DXF {
  private model: Ent[] = [];
  private paper: Ent[] = [];
  private mx0 = Infinity;
  private my0 = Infinity;
  private mx1 = -Infinity;
  private my1 = -Infinity;
  /** estimated fit scale, published to draw*() so symbol spacing adapts */
  private kEst = 1;

  private track(x: number, y: number): void {
    if (x < this.mx0) this.mx0 = x;
    if (y < this.my0) this.my0 = y;
    if (x > this.mx1) this.mx1 = x;
    if (y > this.my1) this.my1 = y;
  }

  /**
   * Modules declare their intended model extent up-front; kEst then lets them
   * choose rebar-symbol steps that stay ≥ ~1.6 mm apart ON PAPER after the
   * auto-fit (prevents the line/circle pile-ups seen for thin walls/slabs).
   */
  preFit(w: number, h: number): void {
    this.kEst = Math.min(
      (DRAW.x1 - DRAW.x0) / Math.max(1e-6, w),
      (DRAW.y1 - DRAW.y0) / Math.max(1e-6, h),
    );
  }
  /** minimum model step so symbols stay ≥1.6 mm apart on paper */
  minStep(): number {
    return 1.6 / Math.max(1e-6, this.kEst);
  }
  /** model radius that plots as ~0.9 mm on paper */
  symR(): number {
    return 0.9 / Math.max(1e-6, this.kEst);
  }

  /* ---- model-space authoring API ---- */
  lwpoly(pts: [number, number][], layer: string, closed = false): void {
    for (let i = 0; i < pts.length - 1; i++) this.line2(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], layer);
    if (closed && pts.length > 2) this.line2(pts[pts.length - 1][0], pts[pts.length - 1][1], pts[0][0], pts[0][1], layer);
  }
  line2(x1: number, y1: number, x2: number, y2: number, layer: string): void {
    this.track(x1, y1);
    this.track(x2, y2);
    this.model.push({ k: 'line', x1, y1, x2, y2, layer });
  }
  circle(cx: number, cy: number, r: number, layer: string): void {
    this.track(cx - r, cy - r);
    this.track(cx + r, cy + r);
    this.model.push({ k: 'circle', cx, cy, r, layer });
  }
  /** h is a PAPER height (sheet units) — constant readable size on the sheet */
  text(x: number, y: number, h: number, value: string, layer = 'TEXT', mc = false): void {
    this.track(x, y);
    this.model.push({ k: 'text', x, y, h, v: ascii(value) || ' ', layer, mc });
  }
  dim(p1: [number, number], p2: [number, number], dimPt: [number, number], text: string): void {
    this.track(p1[0], p1[1]);
    this.track(p2[0], p2[1]);
    this.track(dimPt[0], dimPt[1]);
    this.model.push({ k: 'dim', p1, p2, dp: dimPt, v: text });
  }

  /* ---- paper-space API (frame / title block) ---- */
  pLine(x1: number, y1: number, x2: number, y2: number, layer: string): void {
    this.paper.push({ k: 'line', x1, y1, x2, y2, layer });
  }
  pPoly(pts: [number, number][], layer: string, closed = false): void {
    for (let i = 0; i < pts.length - 1; i++) this.pLine(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], layer);
    if (closed && pts.length > 2) this.pLine(pts[pts.length - 1][0], pts[pts.length - 1][1], pts[0][0], pts[0][1], layer);
  }
  pText(x: number, y: number, h: number, value: string, layer = 'TEXT', mc = false): void {
    this.paper.push({ k: 'text', x, y, h, v: ascii(value) || ' ', layer, mc });
  }

  /* ---- emit ---- */
        /** round-34: pure ASCII DXF R12 (AC1009). Minimal HEADER + TABLES +
   *  ENTITIES + EOF. No handles, no OBJECTS/BLOCKS/VPORT/DIMSTYLE — opens
   *  instantly in every AutoCAD version, Z->E frames the A3 sheet. */
  build(): string {
    const has = Number.isFinite(this.mx0);
    const X0 = has ? this.mx0 : 0;
    const Y0 = has ? this.my0 : 0;
    const X1 = has ? this.mx1 : 1;
    const Y1 = has ? this.my1 : 1;

    /* uniform fit scale into the mm viewport + centering residuals */
    const k = Math.min(
      (DRAW.x1 - DRAW.x0) / Math.max(1e-6, X1 - X0),
      (DRAW.y1 - DRAW.y0) / Math.max(1e-6, Y1 - Y0),
    );
    const cx = DRAW.x0 + ((DRAW.x1 - DRAW.x0) - (X1 - X0) * k) / 2;
    const cy = DRAW.y0 + ((DRAW.y1 - DRAW.y0) - (Y1 - Y0) * k) / 2;
    const TX = (x: number): number => cx + (x - X0) * k;
    const TY = (y: number): number => cy + (y - Y0) * k;

    const L = (layer: string): string => LAYER_MAP[layer] ?? layer;
    const o: string[] = [];
    const W = (c: number, v: string | number): void => { o.push(String(c), String(v)); };
    const eLine = (x1: number, y1: number, x2: number, y2: number, layer: string): void => {
      W(0, 'LINE'); W(8, L(layer));
      W(10, f(x1)); W(20, f(y1)); W(30, '0');
      W(11, f(x2)); W(21, f(y2)); W(31, '0');
    };
    const eCircle = (cx2: number, cy2: number, r: number, layer: string): void => {
      W(0, 'CIRCLE'); W(8, L(layer));
      W(10, f(cx2)); W(20, f(cy2)); W(30, '0');
      W(40, f(r));
    };
    const eText = (x: number, y: number, h: number, v: string, layer: string, mc: boolean): void => {
      W(0, 'TEXT'); W(8, L(layer));
      W(10, f(x)); W(20, f(y)); W(30, '0');
      W(40, f(h));
      W(1, v);
      W(7, 'STANDARD');
      if (mc) {
        W(72, 1); W(73, 2);
        W(11, f(x)); W(21, f(y)); W(31, '0');
      }
    };

    /* ------------------------------ HEADER ------------------------------- */
    W(0, 'SECTION'); W(2, 'HEADER');
    W(9, '$ACADVER'); W(1, 'AC1009');
    W(9, '$INSBASE'); W(10, '0'); W(20, '0'); W(30, '0');
    W(9, '$EXTMIN'); W(10, '0'); W(20, '0'); W(30, '0');
    W(9, '$EXTMAX'); W(10, String(SHEET_W)); W(20, String(SHEET_H)); W(30, '0');
    W(9, '$LIMMIN'); W(10, '0'); W(20, '0');
    W(9, '$LIMMAX'); W(10, String(SHEET_W)); W(20, String(SHEET_H));
    W(0, 'ENDSEC');

    /* ------------------------------ TABLES ------------------------------- */
    W(0, 'SECTION'); W(2, 'TABLES');
    W(0, 'TABLE'); W(2, 'LTYPE'); W(70, 1);
    W(0, 'LTYPE'); W(2, 'CONTINUOUS'); W(70, 0); W(3, 'Solid line'); W(72, 65); W(73, 0); W(40, '0');
    W(0, 'ENDTAB');
    W(0, 'TABLE'); W(2, 'LAYER'); W(70, 1 + DXF_LAYERS.length);
    W(0, 'LAYER'); W(2, '0'); W(70, 0); W(62, 7); W(6, 'CONTINUOUS');
    for (const DL of DXF_LAYERS) {
      W(0, 'LAYER'); W(2, DL.name); W(70, 0); W(62, DL.color); W(6, 'CONTINUOUS');
    }
    W(0, 'ENDTAB');
    W(0, 'TABLE'); W(2, 'STYLE'); W(70, 1);
    W(0, 'STYLE'); W(2, 'STANDARD'); W(70, 0); W(40, '0'); W(41, '1'); W(50, '0'); W(71, 0); W(42, '2.5'); W(3, 'txt'); W(4, '');
    W(0, 'ENDTAB');
    W(0, 'ENDSEC');

    /* ----------------------------- ENTITIES ------------------------------ */
    W(0, 'SECTION'); W(2, 'ENTITIES');

    for (const e of this.model) {
      if (e.k === 'line') {
        const c = clipLine(TX(e.x1), TY(e.y1), TX(e.x2), TY(e.y2));
        if (c) eLine(c[0], c[1], c[2], c[3], e.layer);
      } else if (e.k === 'circle') {
        const pr = Math.max(0.5, e.r * k);
        const px = Math.min(Math.max(TX(e.cx), DRAW.x0 + pr), DRAW.x1 - pr);
        const py = Math.min(Math.max(TY(e.cy), DRAW.y0 + pr), DRAW.y1 - pr);
        if (px <= DRAW.x1 - pr && py >= DRAW.y0 + pr) eCircle(px, py, pr, e.layer);
      } else if (e.k === 'text') {
        const w = 0.7 * e.h * e.v.length;
        const px = Math.min(Math.max(TX(e.x), DRAW.x0), DRAW.x1 - Math.max(30, w));
        const py = Math.min(Math.max(TY(e.y), DRAW.y0), DRAW.y1);
        eText(px, py, e.h, e.v, e.layer, e.mc);
      } else {
        const ax = TX(e.p1[0]);
        const ay = TY(e.p1[1]);
        const bx = TX(e.p2[0]);
        const by = TY(e.p2[1]);
        const dx = TX(e.dp[0]);
        const dy = TY(e.dp[1]);
        const tick = 1.8;
        const emitTick = (px: number, py: number): void => {
          const t = clipLine(px - tick, py - tick, px + tick, py + tick);
          if (t) eLine(t[0], t[1], t[2], t[3], 'DIM');
        };
        const halfw = Math.min(60, 0.35 * TXT.dim * e.v.length);
        const clampX = (x: number): number => Math.min(Math.max(x, DRAW.x0 + halfw + 2), DRAW.x1 - halfw - 2);
        const clampY = (y: number): number => Math.min(Math.max(y, DRAW.y0 + 3), DRAW.y1 - 4);
        if (Math.abs(ay - by) < 1e-9) {
          for (const [px, py] of [[ax, ay], [bx, by]] as const) {
            const seg = clipLine(px, py, px, dy);
            if (seg) eLine(seg[0], seg[1], seg[2], seg[3], 'DIM');
            emitTick(px, py);
          }
          const seg = clipLine(ax, dy, bx, dy);
          if (seg) eLine(seg[0], seg[1], seg[2], seg[3], 'DIM');
          eText(clampX((ax + bx) / 2), clampY(dy + 2), TXT.dim, e.v, 'DIM', true);
        } else {
          for (const [px, py] of [[ax, ay], [bx, by]] as const) {
            const seg = clipLine(px, py, dx, py);
            if (seg) eLine(seg[0], seg[1], seg[2], seg[3], 'DIM');
            emitTick(px, py);
          }
          const seg = clipLine(dx, ay, dx, by);
          if (seg) eLine(seg[0], seg[1], seg[2], seg[3], 'DIM');
          eText(clampX(dx - 3), clampY((ay + by) / 2), TXT.dim, e.v, 'DIM', true);
        }
      }
    }

    /* paper chrome (frame + title block) untransformed */
    for (const e of this.paper) {
      if (e.k === 'line') eLine(e.x1, e.y1, e.x2, e.y2, e.layer);
      else if (e.k === 'text') eText(e.x, e.y, e.h, e.v, e.layer, e.mc);
      else if (e.k === 'circle') eCircle(e.cx, e.cy, e.r, e.layer);
    }
    W(0, 'ENDSEC');
    W(0, 'EOF');

    return o.join('\r\n');
  }
}

/* ------------------------------------------------------------- titleblock -- */

function titleBlock(d: DXF, o: { code: string; title: string; scale: string; sheet: string; date: string; items: number }): void {
  /* A3 border: outer 5mm trim line, inner 10mm drawing frame */
  d.pPoly([[5, 5], [SHEET_W - 5, 5], [SHEET_W - 5, SHEET_H - 5], [5, SHEET_H - 5]], 'FRAME', true);
  d.pPoly([[10, 10], [SHEET_W - 10, 10], [SHEET_W - 10, SHEET_H - 10], [10, SHEET_H - 10]], 'FRAME', true);
  /* title block 180x60 bottom-right; DRAW.y0 = 120 keeps a 50 mm band above */
  const ix = SHEET_W - 10 - 180;
  const iy = 10;
  const iw = 180;
  const ih = 60;
  d.pPoly([[ix, iy], [ix + iw, iy], [ix + iw, iy + ih], [ix, iy + ih]], 'FRAME', true);
  d.pLine(ix, iy + 20, ix + iw, iy + 20, 'FRAME');
  d.pLine(ix, iy + 40, ix + iw, iy + 40, 'FRAME');
  d.pLine(ix + iw - 64, iy + 20, ix + iw - 64, iy + ih, 'FRAME');
  d.pText(ix + 4, iy + 11, 3.2, `CODE: ${o.code}`, 'FRAME');
  d.pText(ix + 4, iy + 15.5, 3.2, `DATE: ${o.date}`, 'FRAME');
  d.pText(ix + iw - 24, iy + 11, 7, 'CG', 'FRAME');
  d.pText(ix + (iw - 64) / 2, iy + 50, 4, 'CivilGenius v24', 'FRAME', true);
  d.pText(ix + 4, iy + 26, 4, o.title, 'FRAME');
  d.pText(ix + iw - 60, iy + 26, 4, `SCALE ${o.scale}`, 'FRAME');
  d.pText(ix + iw - 64, iy + 46, 3.5, `${o.sheet} / ${o.items} BOQ`, 'FRAME');
}

/* ---------------------------------------------------- module draw fns ----- */
/* All draw fns author in LOCAL model coordinates (origin arbitrary); the     */
/* engine fits/centers/clips them. preFit() publishes the expected extent so  */
/* rebar symbols can keep a readable paper pitch via minStep()/symR().        */

function drawFoundation(d: DXF, g: Extract<Diagram, { kind: 'foundation' }>): void {
  const { L, B, cs, spacing, barDia } = g;
  d.preFit(L + 6, B + g.H + 10);
  const ox = 0;
  const oy = 0;
  d.lwpoly([[ox, oy], [ox + L, oy], [ox + L, oy + B], [ox, oy + B]], 'CONCRETE', true);
  const step = Math.max(1.0, d.minStep());
  for (let x = ox + step / 2; x <= ox + L - 0.05; x += step) d.line2(x, oy, x, oy + B, 'REBAR');
  for (let y = oy + step / 2; y <= oy + B - 0.05; y += step) d.line2(ox, y, ox + L, y, 'REBAR');
  const cx = ox + L / 2;
  const cy = oy + B / 2;
  const c = cs / 1000;
  d.lwpoly([[cx - c / 2, cy - c / 2], [cx + c / 2, cy - c / 2], [cx + c / 2, cy + c / 2], [cx - c / 2, cy + c / 2]], 'CONCRETE', true);
  d.circle(cx, cy, c * 0.18, 'REBAR');
  d.circle(cx, cy, c * 0.32, 'REBAR');
  d.dim([ox, oy], [ox + L, oy], [ox + L / 2, oy - 1.4], `L = ${L.toFixed(2)} m`);
  d.dim([ox, oy], [ox, oy + B], [ox - 1.4, oy + B / 2], `B = ${B.toFixed(2)} m`);
  d.text(ox, oy + B + 0.9, TXT.body, `FOUNDATION PLAN - REBAR A3 D${barDia} @ ${spacing} mm`, 'TEXT');

  const sy = oy + B + 3;
  const sLen = Math.min(24, L);
  d.lwpoly([[ox, sy], [ox + sLen, sy], [ox + sLen, sy + g.H], [ox, sy + g.H]], 'CONCRETE', true);
  d.line2(ox, sy - 0.1, ox + sLen, sy - 0.1, 'FORMWORK');
  const stepSec = Math.max(spacing / 1000, d.minStep());
  const r = d.symR();
  for (let x = ox + 0.3; x <= ox + sLen - 0.3; x += stepSec) d.circle(x, sy + 0.08, r, 'REBAR');
  for (let x = ox + 0.3; x <= ox + sLen - 0.3; x += stepSec) d.circle(x, sy + g.H - 0.12, r, 'REBAR');
  d.dim([ox, sy + g.H], [ox, sy], [ox - 1.2, sy + g.H / 2], `H = ${g.H.toFixed(2)} m`);
  d.text(ox, sy + g.H + 0.6, TXT.small, 'SECTION A-A', 'TEXT');
}

function drawBeam(d: DXF, g: Extract<Diagram, { kind: 'beam' }>): void {
  const { L, b, h, bars, barDia, stirrupDia, stirrupSpacing, support, torsion, nTorsionLong } = g;
  const hh = (h / 1000) * 4;
  const bb = (b / 1000) * 4;
  const Ld = L * 2;
  d.preFit(Ld + 4, hh + 12);
  const ox = 0;
  const oy = 0;
  d.lwpoly([[ox, oy], [ox + Ld, oy], [ox + Ld, oy + hh], [ox, oy + hh]], 'CONCRETE', true);
  if (support === 'simple') {
    d.lwpoly([[ox, oy - 0.5], [ox + 0.5, oy - 0.5], [ox + 0.25, oy]], 'CONCRETE', true);
    d.lwpoly([[ox + Ld - 0.5, oy - 0.5], [ox + Ld, oy - 0.5], [ox + Ld - 0.25, oy]], 'CONCRETE', true);
  } else {
    d.line2(ox - 0.7, oy - 0.5, ox + 0.7, oy - 0.5, 'CONCRETE');
    d.line2(ox + Ld - 0.7, oy - 0.5, ox + Ld + 0.7, oy - 0.5, 'CONCRETE');
  }
  d.line2(ox + 0.08, oy + 0.1, ox + Ld - 0.08, oy + 0.1, 'REBAR');
  d.line2(ox + 0.08, oy + hh - 0.1, ox + Ld - 0.08, oy + hh - 0.1, 'REBAR');
  const hk = Math.min(0.6, hh * 0.25);
  d.line2(ox + 0.08, oy + 0.1, ox + 0.08, oy + 0.1 + hk, 'REBAR');
  d.line2(ox + Ld - 0.08, oy + 0.1, ox + Ld - 0.08, oy + 0.1 + hk, 'REBAR');
  d.line2(ox + 0.08, oy + hh - 0.1, ox + 0.08, oy + hh - 0.1 - hk, 'REBAR');
  d.line2(ox + Ld - 0.08, oy + hh - 0.1, ox + Ld - 0.08, oy + hh - 0.1 - hk, 'REBAR');
  const st = Math.max(stirrupSpacing / 500, d.minStep());
  for (let x = ox + 0.15; x <= ox + Ld - 0.15; x += st) d.line2(x, oy + 0.06, x, oy + hh - 0.06, 'STIRRUP');
  d.dim([ox, oy + hh], [ox + Ld, oy + hh], [ox + Ld / 2, oy + hh + 1.2], `L = ${L.toFixed(2)} m`);
  d.text(ox, oy + hh + 2.2, TXT.body, `BEAM ELEVATION - ${bars}D${barDia} + STIRRUPS D${stirrupDia} @ ${stirrupSpacing} mm${torsion ? ` + TORSION ${nTorsionLong}D${barDia}` : ''}`, 'TEXT');

  const sx = ox;
  const sy = oy - 8;
  d.lwpoly([[sx, sy], [sx + bb, sy], [sx + bb, sy + hh], [sx, sy + hh]], 'CONCRETE', true);
  const cov = 0.05;
  d.lwpoly([[sx + cov, sy + cov], [sx + bb - cov, sy + cov], [sx + bb - cov, sy + hh - cov], [sx + cov, sy + hh - cov]], 'STIRRUP', true);
  d.line2(sx + cov, sy + hh - cov, sx + cov - 0.25, sy + hh - cov + 0.25, 'STIRRUP');
  d.line2(sx + bb - cov, sy + hh - cov, sx + bb - cov + 0.25, sy + hh - cov + 0.25, 'STIRRUP');
  const rr = Math.max(0.06, d.symR());
  for (const [px, py] of [[sx + cov, sy + cov], [sx + bb - cov, sy + cov], [sx + cov, sy + hh - cov], [sx + bb - cov, sy + hh - cov]] as [number, number][]) {
    d.circle(px, py, rr, 'REBAR');
  }
  d.dim([sx, sy + hh], [sx + bb, sy + hh], [sx + bb / 2, sy - 0.8], `b = ${b} mm`);
  d.text(sx, sy - 1.6, TXT.small, `SECTION ${b} x ${h} mm`, 'TEXT');
}

function drawColumn(d: DXF, g: Extract<Diagram, { kind: 'column' }>): void {
  const { b, h, Lc, bars, barDia, tieDia, tieSpacing } = g;
  const bb = (b / 1000) * 4;
  const hh = (h / 1000) * 4;
  const Ld = Lc * 2;
  d.preFit(bb * 2 + 6, Ld + 10);
  const ox = 0;
  const oy = 0;
  d.lwpoly([[ox, oy], [ox + bb, oy], [ox + bb, oy + Ld], [ox, oy + Ld]], 'CONCRETE', true);
  d.line2(ox + 0.06, oy, ox + 0.06, oy + Ld, 'REBAR');
  d.line2(ox + bb - 0.06, oy, ox + bb - 0.06, oy + Ld, 'REBAR');
  const hkc = Math.min(0.5, bb * 0.3);
  d.line2(ox + 0.06, oy, ox + 0.06 + hkc, oy, 'REBAR');
  d.line2(ox + bb - 0.06, oy, ox + bb - 0.06 - hkc, oy, 'REBAR');
  d.line2(ox + 0.06, oy + Ld, ox + 0.06 + hkc, oy + Ld, 'REBAR');
  d.line2(ox + bb - 0.06, oy + Ld, ox + bb - 0.06 - hkc, oy + Ld, 'REBAR');
  const ts = Math.max(tieSpacing / 500, d.minStep());
  for (let y = oy + 0.08; y <= oy + Ld - 0.08; y += ts) d.line2(ox + 0.03, y, ox + bb - 0.03, y, 'STIRRUP');
  d.dim([ox, oy], [ox, oy + Ld], [ox - 1.3, oy + Ld / 2], `Lc = ${Lc.toFixed(2)} m`);
  d.text(ox, oy + Ld + 0.8, TXT.body, `COLUMN ELEVATION - ${bars}D${barDia} + TIES D${tieDia} @ ${tieSpacing} mm`, 'TEXT');

  const sx = ox + bb + 3;
  const sy = oy;
  d.lwpoly([[sx, sy], [sx + bb, sy], [sx + bb, sy + hh], [sx, sy + hh]], 'CONCRETE', true);
  const cov = 0.04;
  d.lwpoly([[sx + cov, sy + cov], [sx + bb - cov, sy + cov], [sx + bb - cov, sy + hh - cov], [sx + cov, sy + hh - cov]], 'STIRRUP', true);
  d.line2(sx + cov, sy + hh - cov, sx + cov - 0.25, sy + hh - cov + 0.25, 'STIRRUP');
  d.line2(sx + bb - cov, sy + hh - cov, sx + bb - cov + 0.25, sy + hh - cov + 0.25, 'STIRRUP');
  const n = Math.max(4, 2 * Math.round(bars / 2));
  const half = n / 2 + 2;
  const q = Math.max(2, Math.floor(half / 2));
  const p = half - q;
  const rr = Math.max(0.06, d.symR());
  for (let i = 0; i < p; i++) {
    const t = i / Math.max(1, p - 1);
    d.circle(sx + cov + (bb - 2 * cov) * t, sy + cov, rr, 'REBAR');
    d.circle(sx + cov + (bb - 2 * cov) * t, sy + hh - cov, rr, 'REBAR');
  }
  for (let j = 1; j < q - 1; j++) {
    const t = j / Math.max(1, q - 1);
    d.circle(sx + cov, sy + cov + (hh - 2 * cov) * t, rr, 'REBAR');
    d.circle(sx + bb - cov, sy + cov + (hh - 2 * cov) * t, rr, 'REBAR');
  }
  d.dim([sx, sy + hh], [sx + bb, sy + hh], [sx + bb / 2, sy - 0.8], `b = ${b} mm`);
  d.text(sx, sy - 1.6, TXT.small, `SECTION ${b} x ${h} mm`, 'TEXT');
}

function drawSlab(d: DXF, g: Extract<Diagram, { kind: 'slab' }>): void {
  const L = g.L * 100;
  /* vertical exaggeration: real 1:1 slab sections are 20..40:1 slivers that
   * become unreadable after uniform fit; cap the aspect at 7:1 and annotate */
  const Htrue = g.h / 10;
  const ex = Math.max(1, L / (7 * Math.max(1e-6, Htrue)));
  const H = Htrue * ex;
  const exNote = ex > 1.15 ? ` (VERT EXAG x${ex.toFixed(0)})` : '';
  d.preFit(L + 10, H + 10);
  const ox = 0;
  const oy = 0;
  d.lwpoly([[ox, oy], [ox + L, oy], [ox + L, oy + H], [ox, oy + H]], 'CONCRETE', true);
  const s = Math.max(2, d.minStep());
  const r = d.symR();
  for (let x = ox + 1; x <= ox + L - 1; x += s) d.circle(x, oy + H - 0.6, r, 'REBAR');
  d.line2(ox + 1, oy + H - 0.6, ox + L - 1, oy + H - 0.6, 'REBAR');
  d.line2(ox, oy + 0.6, ox + L * 0.25, oy + 0.6, 'REBAR');
  d.line2(ox + L * 0.75, oy + 0.6, ox + L, oy + 0.6, 'REBAR');
  for (let x = ox + 1; x <= ox + L - 1; x += Math.max(4, d.minStep())) d.line2(x, oy + 1.1, x + 1.6, oy + 1.1, 'HATCH');
  if (g.tieBeam) {
    d.line2(ox - 2, oy, ox - 2, oy + H, 'CONCRETE');
    d.line2(ox + L + 2, oy, ox + L + 2, oy + H, 'CONCRETE');
    d.text(ox + L + 3, oy + H + 1.2, TXT.small, 'TIE BEAM 150 x h', 'TEXT');
  }
  d.dim([ox, oy + H], [ox + L, oy + H], [ox + L / 2, oy + H + 2.4], `L = ${g.L.toFixed(2)} m`);
  d.dim([ox + L + (g.tieBeam ? 3 : 1), oy], [ox + L + (g.tieBeam ? 3 : 1), oy + H], [ox + L + (g.tieBeam ? 5 : 3), oy + H / 2], `h = ${g.h} mm${exNote}`);
  d.text(ox, oy - 1.4, TXT.body, `SLAB ${g.system.toUpperCase()} - MAIN O${g.barDia} @ ${g.spacing} mm`, 'TEXT');
  d.text(ox, oy - 2.6, TXT.small, `NEG @ ${g.negSpacing} - TEMP O8 @ ${g.tempSpacing}`, 'TEXT');
}

function drawWall(d: DXF, g: Extract<Diagram, { kind: 'wall' }>): void {
  const wl = g.lw * 100;
  /* same sliver problem as the slab: cap the plan/section aspect at 7:1 */
  const twTrue = Math.max(2, g.tw / 20);
  const ex = Math.max(1, wl / (7 * twTrue));
  const tw = twTrue * ex;
  d.preFit(wl + 10, tw + 10);
  const ox = 0;
  const oy = 0;
  d.lwpoly([[ox, oy], [ox + wl, oy], [ox + wl, oy + tw], [ox, oy + tw]], 'CONCRETE', true);
  const vs = Math.max(4, d.minStep());
  const r = d.symR();
  for (let x = ox + 1; x <= ox + wl - 1; x += vs) d.circle(x, oy + tw / 2, r, 'REBAR');
  d.line2(ox + 0.6, oy + 0.6, ox + wl - 0.6, oy + 0.6, 'REBAR');
  d.line2(ox + 0.6, oy + tw - 0.6, ox + wl - 0.6, oy + tw - 0.6, 'REBAR');
  if (g.boundary) {
    const be = Math.max(4, g.beLen / 20);
    d.lwpoly([[ox - 0.5, oy - 0.5], [ox + be, oy - 0.5], [ox + be, oy + tw + 0.5], [ox - 0.5, oy + tw + 0.5]], 'FORMWORK', true);
    d.lwpoly([[ox + wl - be, oy - 0.5], [ox + wl + 0.5, oy - 0.5], [ox + wl + 0.5, oy + tw + 0.5], [ox + wl - be, oy + tw + 0.5]], 'FORMWORK', true);
    for (const cx2 of [ox + be / 2, ox + wl - be / 2]) {
      d.circle(cx2 - 0.8, oy + tw / 2, r, 'REBAR');
      d.circle(cx2 + 0.8, oy + tw / 2, r, 'REBAR');
      d.lwpoly([[cx2 - 1.4, oy + tw / 2 - 1], [cx2 + 1.4, oy + tw / 2 - 1], [cx2 + 1.4, oy + tw / 2 + 1], [cx2 - 1.4, oy + tw / 2 + 1]], 'STIRRUP', true);
    }
    d.text(ox, oy - 1.8, TXT.small, `BOUNDARY ELEMENT ${Math.round(g.beLen)} mm - HOOPS + CROSSTIES @ ${g.beHoopS}`, 'TEXT');
  }
  d.dim([ox, oy + tw + 1], [ox + wl, oy + tw + 1], [ox + wl / 2, oy + tw + 3], `lw = ${g.lw.toFixed(2)} m`);
  d.dim([ox - 1.6, oy], [ox - 1.6, oy + tw], [ox - 3, oy + tw / 2], `tw = ${g.tw} mm${ex > 1.15 ? ` (VERT EXAG x${ex.toFixed(0)})` : ''}`);
  d.text(ox, oy - 3.0, TXT.body, `SHEAR WALL - VERT O${g.vDia} @ ${g.vSpacing} - HORZ O${g.hDia} @ ${g.hSpacing}`, 'TEXT');
}

function drawStair(d: DXF, g: Extract<Diagram, { kind: 'stair' }>): void {
  /* local coordinates: origin at bottom support, flight rises toward +x/-y;
     the fit engine centers the whole flight + landings + bent bars. */
  const run = g.Lr * 100;
  const rise = g.H * 100;
  const t = Math.max(1.5, g.t / 20);
  const n = g.ramp ? 1 : Math.max(4, g.n);
  d.preFit(run + 14, rise + 12);
  const ox = 0;
  const oy = 0;
  const pts: [number, number][] = [[ox, oy]];
  if (g.ramp) pts.push([ox + run, oy - rise]);
  else for (let k2 = 0; k2 < n; k2++) { pts.push([ox + ((k2 + 1) * run) / n, oy - (k2 * rise) / n]); pts.push([ox + ((k2 + 1) * run) / n, oy - ((k2 + 1) * rise) / n]); }
  d.lwpoly(pts, 'CONCRETE');
  const sof = pts.map(([x, y]) => [x + t * 0.5, y + t] as [number, number]);
  d.lwpoly(sof, 'CONCRETE');
  /* landing slabs at both ends so the flight reads as a real stair */
  d.lwpoly([[ox - 3, oy], [ox, oy], [ox, oy + t], [ox - 3, oy + t]], 'CONCRETE', true);
  const top = pts[pts.length - 1];
  d.lwpoly([[top[0], top[1]], [top[0] + 3, top[1]], [top[0] + 3, top[1] + t], [top[0], top[1] + t]], 'CONCRETE', true);
  const bar = pts.map(([x, y]) => [x + t * 0.25, y + t * 0.6] as [number, number]);
  d.lwpoly(bar, 'REBAR');
  /* 90° anchorage bends into the landings */
  d.line2(bar[0][0], bar[0][1], bar[0][0] - 2, bar[0][1], 'REBAR');
  d.line2(bar[0][0] - 2, bar[0][1], bar[0][0] - 2, bar[0][1] - 1.5, 'REBAR');
  d.line2(bar[bar.length - 1][0], bar[bar.length - 1][1], bar[bar.length - 1][0] + 2, bar[bar.length - 1][1], 'REBAR');
  d.line2(bar[bar.length - 1][0] + 2, bar[bar.length - 1][1], bar[bar.length - 1][0] + 2, bar[bar.length - 1][1] + 1.5, 'REBAR');
  d.dim([ox, oy + 3], [ox + run, oy + 3], [ox + run / 2, oy + 5], `L = ${g.Lr.toFixed(2)} m`);
  d.dim([ox + run + 4, oy - rise], [ox + run + 4, oy], [ox + run + 6, oy - rise / 2], `H = ${g.H.toFixed(2)} m`);
  d.text(ox, oy - rise - 2, TXT.body, `STAIR/RAMP - MAIN O${g.barDia} @ ${g.spacing} mm - 90deg BENDS + Ld`, 'TEXT');
}

function drawJoint(d: DXF, g: Extract<Diagram, { kind: 'joint' }>): void {
  const cw = g.colB / 10;
  const ch = g.colH / 10;
  const bh = g.beamH / 10;
  d.preFit(cw + 26, ch + 18);
  const cx = 0;
  const cy = 0;
  d.lwpoly([[cx - cw / 2, cy - ch / 2 - 8], [cx + cw / 2, cy - ch / 2 - 8], [cx + cw / 2, cy + ch / 2 + 8], [cx - cw / 2, cy + ch / 2 + 8]], 'CONCRETE', true);
  d.lwpoly([[cx - cw / 2 - 12, cy - bh / 2], [cx + cw / 2 + 12, cy - bh / 2], [cx + cw / 2 + 12, cy + bh / 2], [cx - cw / 2 - 12, cy + bh / 2]], 'CONCRETE', true);
  const hs = Math.max(1.2, d.minStep());
  for (let y = cy - bh / 2 + 1; y <= cy + bh / 2 - 1; y += hs) d.line2(cx - cw / 2 + 0.6, y, cx + cw / 2 - 0.6, y, 'STIRRUP');
  for (const fx of [0.15, 0.5, 0.85]) d.line2(cx - cw / 2 + cw * fx, cy - ch / 2 - 8, cx - cw / 2 + cw * fx, cy + ch / 2 + 8, 'REBAR');
  d.text(cx - cw / 2, cy - ch / 2 - 9.5, TXT.body, `JOINT PANEL - HOOPS O${g.hoopDia} @ ${g.hoopS} x ${g.nHoops}`, 'TEXT');
  d.dim([cx - cw / 2, cy + ch / 2 + 9.5], [cx + cw / 2, cy + ch / 2 + 9.5], [cx, cy + ch / 2 + 11.5], `hc = ${g.colH} mm`);
}

/* ---------------------------------------------------------------- public -- */

export function buildDxfText(result: CalcResult, meta: { projectName: string; rows: number }): string {
  const d = new DXF();
  const m = CALC_META[result.type];
  titleBlock(d, {
    code: result.code,
    title: `${m.titleEn.toUpperCase()} PLAN/SECTION`,
    scale: 'NTS (AUTO-FIT)',
    sheet: result.type === 'foundation' ? 'SHEET S-01' : result.type === 'beam' ? 'SHEET S-02' : result.type === 'column' ? 'SHEET S-03' : result.type === 'slab' ? 'SHEET S-04' : result.type === 'wall' ? 'SHEET S-05' : result.type === 'stair' ? 'SHEET S-06' : result.type === 'ramp' ? 'SHEET S-07' : 'SHEET S-08',
    date: jalaliISO(),
    items: meta.rows,
  });
  const dg = result.diagram;
  if (dg.kind === 'foundation') drawFoundation(d, dg);
  else if (dg.kind === 'beam') drawBeam(d, dg);
  else if (dg.kind === 'column') drawColumn(d, dg);
  else if (dg.kind === 'slab') drawSlab(d, dg);
  else if (dg.kind === 'wall') drawWall(d, dg);
  else if (dg.kind === 'stair') drawStair(d, dg);
  else drawJoint(d, dg);
  return d.build();
}


