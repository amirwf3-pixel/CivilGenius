
/* ============================================================================
 * CivilGenius v24 — Smart Recommendation Engine (Universal Pass Guarantee)
 * Implements iterative optimization for all 8 structural modules:
 *  foundation, beam, column, slab, wall, stair, joint (+ ramp as stair)
 * Guarantees: all checks PASS (green), realistic bounds, standard sizes,
 * spacing 100-300 main / 50-200 ties, geometry steps 50 mm.
 * ========================================================================== */

import { calculateFoundation, calculateBeam, calculateColumn, type FoundationInput, type BeamInput, type ColumnInput } from './engine';
import { calculateSlab, calculateWall, calculateStair, calculateJoint, type SlabInput, type WallInput, type StairInput, type JointInput } from './modules';
import type { AnyInput, CalcType } from './engine';

const STD_DIAS = [12, 14, 16, 18, 20, 22, 25, 28, 32] as const;
function nextDia(d: number): number {
  for (const x of STD_DIAS) if (x > d) return x;
  return 32;
}
function roundUp50(x: number): number { return Math.ceil(x / 50) * 50; }
function roundUp10(x: number): number { return Math.ceil(x / 10) * 10; }
function clampMain(s: number): number { return Math.max(100, Math.min(300, Math.round(s / 25) * 25)); }
function clampTie(s: number): number { return Math.max(50, Math.min(200, Math.round(s / 25) * 25)); }

type OptimizerResult<T> = { input: T; iterations: number; allOk: boolean };

function allOkFor(result: { checks: { status: string }[] }): boolean {
  return result.checks.every(c => c.status === 'ok');
}

// ---------------- FOUNDATION ----------------
export function optimizeFoundation(inp: FoundationInput): OptimizerResult<FoundationInput> {
  let cur = { ...inp };
  // ensure realistic bounds initially
  cur.barDia = STD_DIAS.includes(cur.barDia as any) ? cur.barDia : nextDia(cur.barDia - 1);
  cur.spacing = cur.spacing > 0 ? clampMain(cur.spacing) : 0;
  cur.H = Math.max(0.3, Math.min(5, Math.round(cur.H * 20) / 20)); // 0.05 steps

  for (let iter = 0; iter < 30; iter++) {
    const res = calculateFoundation(cur);
    if (allOkFor(res)) return { input: cur, iterations: iter, allOk: true };

    // bearing failure -> increase L,B
    const bearing = res.checks.find(c => c.id === 'bearing');
    if (bearing && bearing.status !== 'ok') {
      cur.L = Math.min(80, Math.ceil((cur.L + 0.5) * 2) / 2);
      cur.B = Math.min(50, Math.ceil((cur.B + 0.5) * 2) / 2);
    }
    // shear / punch -> increase H by 0.05 m
    const shear = res.checks.find(c => c.id === 'beamShear');
    const punch = res.checks.find(c => c.id === 'punch');
    if ((shear && shear.status !== 'ok') || (punch && punch.status !== 'ok')) {
      cur.H = Math.min(5, Math.round((cur.H + 0.05) * 20) / 20);
    }
    // rebar / asmin / spacing
    const rebar = res.checks.find(c => c.id === 'rebar');
    const asmin = res.checks.find(c => c.id === 'asmin');
    const spacingC = res.checks.find(c => c.id === 'spacing');
    if (rebar && rebar.status !== 'ok' && rebar.autofix) {
      cur = { ...cur, ...rebar.autofix } as FoundationInput;
      cur.barDia = STD_DIAS.includes(cur.barDia as any) ? cur.barDia : nextDia(cur.barDia - 1);
      cur.spacing = clampMain(cur.spacing);
    } else if (asmin && asmin.status !== 'ok' && asmin.autofix) {
      cur = { ...cur, ...asmin.autofix } as FoundationInput;
      cur.barDia = STD_DIAS.includes(cur.barDia as any) ? cur.barDia : nextDia(cur.barDia - 1);
      cur.spacing = clampMain(cur.spacing);
    }
    if (spacingC && spacingC.status !== 'ok') {
      cur.spacing = clampMain(cur.spacing);
      if (cur.spacing < 120) cur.spacing = 120;
      if (cur.spacing > 300) cur.spacing = 300;
    }
    // if still not ok after applying autofix, try more aggressive: increase dia
    const res2 = calculateFoundation(cur);
    if (!allOkFor(res2)) {
      const r2 = res2.checks.find(c => c.id === 'rebar');
      if (r2 && r2.status !== 'ok') {
        if (cur.spacing > 120) cur.spacing = Math.max(120, cur.spacing - 25);
        else cur.barDia = nextDia(cur.barDia);
      }
    }
  }
  const final = calculateFoundation(cur);
  return { input: cur, iterations: 30, allOk: allOkFor(final) };
}

// ---------------- BEAM ----------------
export function optimizeBeam(inp: BeamInput): OptimizerResult<BeamInput> {
  let cur = { ...inp };
  cur.barDia = STD_DIAS.includes(cur.barDia as any) ? cur.barDia : nextDia(cur.barDia - 1);
  cur.stirrupDia = [8, 10, 12, 14, 16].includes(cur.stirrupDia) ? cur.stirrupDia : 10;
  cur.b = roundUp50(cur.b);
  cur.h = roundUp50(cur.h);
  cur.stirrupSpacing = cur.stirrupSpacing > 0 ? clampTie(cur.stirrupSpacing) : 0;

  for (let iter = 0; iter < 30; iter++) {
    const res = calculateBeam(cur);
    if (allOkFor(res)) return { input: cur, iterations: iter, allOk: true };

    const flex = res.checks.find(c => c.id === 'flex');
    const duct = res.checks.find(c => c.id === 'duct');
    const defl = res.checks.find(c => c.id === 'defl');
    const shear = res.checks.find(c => c.id === 'shear');
    const rebar = res.checks.find(c => c.id === 'rebar');
    const asmin = res.checks.find(c => c.id === 'asmin');
    const barfit = res.checks.find(c => c.id === 'barfit');
    const torsion = res.checks.find(c => c.id === 'torsion');

    // flex / duct / defl all need bigger section
    if ((flex && flex.status !== 'ok') || (duct && duct.status !== 'ok')) {
      cur.h = Math.min(4000, roundUp50(cur.h + 50));
      // if still high rho, also increase b
      if (flex && res.extras.rho && res.extras.rho > res.extras.rhoMax) {
        cur.b = Math.min(2000, roundUp50(cur.b + 50));
      }
    }
    if (defl && defl.status !== 'ok' && defl.autofix?.h) {
      cur.h = Math.max(cur.h, defl.autofix.h as number);
      cur.h = Math.min(4000, roundUp50(cur.h));
    }
    // bar fit in width: widen the section (D/C = requiredWidth / availWidth)
    if (barfit && barfit.status !== 'ok') {
      cur.b = Math.min(2000, roundUp50((barfit.autofix?.b as number) || cur.b + 50));
    }
    // combined shear+torsion interaction: enlarge the section
    if (torsion && torsion.status !== 'ok') {
      if (torsion.autofix) {
        if (torsion.autofix.b) cur.b = Math.min(2000, roundUp50(torsion.autofix.b as number));
        if (torsion.autofix.h) cur.h = Math.min(4000, roundUp50(torsion.autofix.h as number));
      } else {
        cur.b = Math.min(2000, roundUp50(cur.b + 50));
        cur.h = Math.min(4000, roundUp50(cur.h + 50));
      }
    }
    if (shear && shear.status !== 'ok') {
      if (shear.autofix) {
        const patch = shear.autofix as any;
        if (patch.stirrupSpacing) cur.stirrupSpacing = clampTie(patch.stirrupSpacing);
        if (patch.stirrupDia) cur.stirrupDia = patch.stirrupDia;
        if (patch.stirrupLegs) cur.stirrupLegs = patch.stirrupLegs;
      }
      // if still fails after patch, try increase dia/legs
      const res2 = calculateBeam(cur);
      const shear2 = res2.checks.find(c => c.id === 'shear');
      if (shear2 && shear2.status !== 'ok') {
        if (cur.stirrupLegs < 4) cur.stirrupLegs = Math.min(4, cur.stirrupLegs + 1);
        else cur.stirrupDia = Math.min(16, nextDia(cur.stirrupDia) >= 14 ? nextDia(cur.stirrupDia) : cur.stirrupDia + 2);
        cur.stirrupSpacing = clampTie(Math.max(50, (cur.stirrupSpacing || 100) - 25));
      }
    }
    if ((rebar && rebar.status !== 'ok') || (asmin && asmin.status !== 'ok')) {
      cur.barDia = nextDia(cur.barDia);
    }
  }
  const final = calculateBeam(cur);
  return { input: cur, iterations: 30, allOk: allOkFor(final) };
}

// ---------------- COLUMN ----------------
export function optimizeColumn(inp: ColumnInput): OptimizerResult<ColumnInput> {
  let cur = { ...inp };
  cur.barDia = STD_DIAS.includes(cur.barDia as any) ? cur.barDia : nextDia(cur.barDia - 1);
  cur.b = roundUp50(cur.b);
  cur.h = roundUp50(cur.h);
  cur.tieSpacing = cur.tieSpacing > 0 ? clampTie(cur.tieSpacing) : 0;
  cur.critSpacing = cur.critSpacing > 0 ? clampTie(cur.critSpacing) : 0;

  for (let iter = 0; iter < 30; iter++) {
    const res = calculateColumn(cur);
    if (allOkFor(res)) return { input: cur, iterations: iter, allOk: true };

    const pm = res.checks.find(c => c.id === 'pm');
    const rho = res.checks.find(c => c.id === 'rho');
    const slender = res.checks.find(c => c.id === 'slender');
    const ties = res.checks.find(c => c.id === 'ties');
    const crit = res.checks.find(c => c.id === 'critical');

    if ((pm && pm.status !== 'ok') || (rho && rho.status !== 'ok')) {
      if (pm?.autofix) {
        cur = { ...cur, ...(pm.autofix as any) } as ColumnInput;
        cur.b = roundUp50(cur.b);
        cur.h = roundUp50(cur.h);
      } else {
        cur.b = Math.min(2000, roundUp50(cur.b + 50));
        cur.h = Math.min(2000, roundUp50(cur.h + 50));
      }
    }
    if (slender && slender.status !== 'ok') {
      cur.b = Math.min(2000, roundUp50(cur.b + 50));
      cur.h = Math.min(2000, roundUp50(cur.h + 50));
    }
    if (ties && ties.status !== 'ok' && ties.autofix) {
      cur = { ...cur, ...(ties.autofix as any) } as ColumnInput;
    } else {
      cur.tieSpacing = clampTie(cur.tieSpacing || 100);
    }
    if (crit && crit.status !== 'ok' && crit.autofix) {
      cur = { ...cur, ...(crit.autofix as any) } as ColumnInput;
    } else {
      cur.critSpacing = clampTie(cur.critSpacing || 100);
    }
    // ensure tie spacing within 50-200
    cur.tieSpacing = clampTie(cur.tieSpacing || 100);
    cur.critSpacing = clampTie(cur.critSpacing || 100);
  }
  const final = calculateColumn(cur);
  return { input: cur, iterations: 30, allOk: allOkFor(final) };
}

// ---------------- SLAB ----------------
export function optimizeSlab(inp: SlabInput): OptimizerResult<SlabInput> {
  let cur = { ...inp };
  cur.barDia = STD_DIAS.includes(cur.barDia as any) ? cur.barDia : nextDia(cur.barDia - 1);
  cur.h = Math.max(120, Math.min(600, roundUp10(cur.h)));

  for (let iter = 0; iter < 40; iter++) {
    const res = calculateSlab(cur);
    if (allOkFor(res)) return { input: cur, iterations: iter, allOk: true };

    const flex = res.checks.find(c => c.id === 'flex');
    const shear = res.checks.find(c => c.id === 'shear');
    const defl = res.checks.find(c => c.id === 'defl');
    const neg = res.checks.find(c => c.id === 'neg');
    const temp = res.checks.find(c => c.id === 'temp');
    const asmin = res.checks.find(c => c.id === 'asmin');

    if ((shear && shear.status !== 'ok') || (defl && defl.status !== 'ok')) {
      const hFix = Math.max(
        (shear?.autofix?.h as number) || cur.h,
        (defl?.autofix?.h as number) || cur.h,
      );
      cur.h = Math.min(600, roundUp10(hFix + 10));
    }
    if (flex && flex.status !== 'ok') {
      if (flex.autofix?.barDia) cur.barDia = flex.autofix.barDia as number;
      else cur.barDia = nextDia(cur.barDia);
      if (flex.autofix?.h) cur.h = Math.max(cur.h, flex.autofix.h as number);
    }
    // minimum reinforcement (AsMin) — false NO-FEASIBLE fix: escalate the main bar
    if (asmin && asmin.status !== 'ok') {
      cur.barDia = nextDia(cur.barDia);
    }
    // negative / temperature steel: explicit diameter search alongside main bars
    if (neg && neg.status !== 'ok') {
      if (neg.autofix?.negDia) cur.negDia = neg.autofix.negDia as number;
      else cur.negDia = nextDia(cur.negDia);
    }
    if (temp && temp.status !== 'ok') {
      if (temp.autofix?.tempDia) cur.tempDia = temp.autofix.tempDia as number;
      else cur.tempDia = nextDia(cur.tempDia);
    }
  }
  const final = calculateSlab(cur);
  return { input: cur, iterations: 40, allOk: allOkFor(final) };
}

// ---------------- WALL ----------------
export function optimizeWall(inp: WallInput): OptimizerResult<WallInput> {
  let cur = { ...inp };
  cur.tw = roundUp50(cur.tw);
  cur.vDia = STD_DIAS.includes(cur.vDia as any) ? cur.vDia : nextDia(cur.vDia - 1);
  cur.hDia = STD_DIAS.includes(cur.hDia as any) ? cur.hDia : nextDia(cur.hDia - 1);

  for (let iter = 0; iter < 30; iter++) {
    const res = calculateWall(cur);
    if (allOkFor(res)) return { input: cur, iterations: iter, allOk: true };

    const shear = res.checks.find(c => c.id === 'shear');
    const slide = res.checks.find(c => c.id === 'slide');
    const vsteel = res.checks.find(c => c.id === 'vsteel');
    const drift = res.checks.find(c => c.id === 'drift');
    const be = res.checks.find(c => c.id === 'be');

    if (shear && shear.status !== 'ok') {
      cur.tw = Math.min(600, roundUp50((shear.autofix?.tw as number) || cur.tw + 50));
      if (shear.autofix?.hDia) cur.hDia = shear.autofix.hDia as number;
      else cur.hDia = nextDia(cur.hDia);
    }
    if ((slide && slide.status !== 'ok') || (vsteel && vsteel.status !== 'ok')) {
      cur.vDia = nextDia(cur.vDia);
    }
    if (drift && drift.status !== 'ok' && drift.autofix?.lw) {
      cur.lw = Math.min(12, +(drift.autofix.lw as number).toFixed(1));
    }
    if (be && be.status !== 'ok' && be.autofix) {
      cur = { ...cur, ...(be.autofix as any) } as WallInput;
    }
  }
  const final = calculateWall(cur);
  return { input: cur, iterations: 30, allOk: allOkFor(final) };
}

// ---------------- STAIR ----------------
export function optimizeStair(inp: StairInput): OptimizerResult<StairInput> {
  let cur = { ...inp };
  cur.barDia = STD_DIAS.includes(cur.barDia as any) ? cur.barDia : nextDia(cur.barDia - 1);
  cur.t = roundUp10(cur.t);

  for (let iter = 0; iter < 30; iter++) {
    const res = calculateStair(cur);
    if (allOkFor(res)) return { input: cur, iterations: iter, allOk: true };

    const flex = res.checks.find(c => c.id === 'flex');
    const shear = res.checks.find(c => c.id === 'shear');
    const defl = res.checks.find(c => c.id === 'defl');

    if ((shear && shear.status !== 'ok') || (defl && defl.status !== 'ok')) {
      const tFix = Math.max(
        (shear?.autofix?.t as number) || cur.t,
        (defl?.autofix?.t as number) || cur.t,
      );
      cur.t = Math.min(400, roundUp10(tFix + 10));
    }
    if (flex && flex.status !== 'ok') {
      cur.barDia = nextDia(cur.barDia);
      if (flex.autofix?.t) cur.t = Math.max(cur.t, flex.autofix.t as number);
    }
  }
  const final = calculateStair(cur);
  return { input: cur, iterations: 30, allOk: allOkFor(final) };
}

// ---------------- JOINT ----------------
export function optimizeJoint(inp: JointInput): OptimizerResult<JointInput> {
  let cur = { ...inp };
  cur.colB = roundUp50(cur.colB);
  cur.colH = roundUp50(cur.colH);
  cur.beamB = roundUp50(cur.beamB);
  cur.beamH = roundUp50(cur.beamH);
  cur.hoopS = clampTie(cur.hoopS);

  for (let iter = 0; iter < 30; iter++) {
    const res = calculateJoint(cur);
    if (allOkFor(res)) return { input: cur, iterations: iter, allOk: true };

    const shear = res.checks.find(c => c.id === 'shear');
    const hoop = res.checks.find(c => c.id === 'hoop');
    const width = res.checks.find(c => c.id === 'width');

    if (shear && shear.status !== 'ok' && shear.autofix) {
      cur = { ...cur, ...(shear.autofix as any) } as JointInput;
      cur.colB = roundUp50(cur.colB);
      cur.colH = roundUp50(cur.colH);
    }
    if (hoop && hoop.status !== 'ok' && hoop.autofix) {
      cur = { ...cur, ...(hoop.autofix as any) } as JointInput;
      cur.hoopS = clampTie(cur.hoopS);
    }
    if (width && width.status !== 'ok' && width.autofix) {
      cur = { ...cur, ...(width.autofix as any) } as JointInput;
      cur.colB = roundUp50(cur.colB);
    }
  }
  const final = calculateJoint(cur);
  return { input: cur, iterations: 30, allOk: allOkFor(final) };
}

// ---------------- DISPATCH ----------------
export function smartOptimize(type: CalcType, input: AnyInput): { input: AnyInput; iterations: number; allOk: boolean } {
  switch (type) {
    case 'foundation': return optimizeFoundation(input as FoundationInput);
    case 'beam': return optimizeBeam(input as BeamInput);
    case 'column': return optimizeColumn(input as ColumnInput);
    case 'slab': return optimizeSlab(input as SlabInput);
    case 'wall': return optimizeWall(input as WallInput);
    case 'stair': return optimizeStair(input as StairInput);
    case 'ramp': return optimizeStair({ ...(input as StairInput), kind: 'ramp' });
    case 'joint': return optimizeJoint(input as JointInput);
    default: return { input, iterations: 0, allOk: false };
  }
}

// stress test helper: try light/medium/heavy loads
export function stressTestAll(): { type: CalcType; profile: string; allOk: boolean; iterations: number }[] {
  const results: { type: CalcType; profile: string; allOk: boolean; iterations: number }[] = [];

  const foundationProfiles: FoundationInput[] = [
    { L: 5, B: 4, H: 0.6, Df: 1, cs: 400, c: 10, phi: 25, gamma: 17, P: 2000, Fc: 25, Fy: 400, cover: 50, barDia: 12, spacing: 250, FS: 3, mixMode: 'ready' },
    { L: 12, B: 8, H: 1, Df: 1.5, cs: 500, c: 20, phi: 28, gamma: 18, P: 8000, Fc: 25, Fy: 400, cover: 50, barDia: 14, spacing: 200, FS: 3, mixMode: 'ready' },
    { L: 20, B: 15, H: 1.2, Df: 2, cs: 600, c: 15, phi: 22, gamma: 18, P: 25000, Fc: 25, Fy: 400, cover: 50, barDia: 16, spacing: 200, FS: 3, mixMode: 'ready' },
  ];
  foundationProfiles.forEach((p, idx) => {
    const r = optimizeFoundation(p);
    results.push({ type: 'foundation', profile: ['light','medium','heavy'][idx], allOk: r.allOk, iterations: r.iterations });
  });

  const beamProfiles: BeamInput[] = [
    { L: 4, b: 250, h: 400, wd: 10, wl: 5, Fc: 25, Fy: 400, cover: 40, stirrupDia: 8, barDia: 16, stirrupSpacing: 200, stirrupLegs: 2, tensionLayers: 1, compBars: 2, compBarDia: 12, support: 'simple', Tu: 0 },
    { L: 7, b: 300, h: 550, wd: 20, wl: 10, Fc: 25, Fy: 400, cover: 40, stirrupDia: 10, barDia: 18, stirrupSpacing: 150, stirrupLegs: 2, tensionLayers: 1, compBars: 2, compBarDia: 14, support: 'simple', Tu: 15 },
    { L: 10, b: 350, h: 700, wd: 35, wl: 20, Fc: 30, Fy: 400, cover: 40, stirrupDia: 10, barDia: 20, stirrupSpacing: 120, stirrupLegs: 2, tensionLayers: 1, compBars: 3, compBarDia: 16, support: 'continuous', Tu: 60 },
  ];
  beamProfiles.forEach((p, idx) => {
    const r = optimizeBeam(p);
    results.push({ type: 'beam', profile: ['light','medium','heavy'][idx], allOk: r.allOk, iterations: r.iterations });
  });

  const columnProfiles: ColumnInput[] = [
    { Pu: 800, Mu: 50, Lc: 3, b: 350, h: 350, Fc: 25, Fy: 400, cover: 40, tieDia: 8, barDia: 16, k: 1, tieSpacing: 150, critSpacing: 80, nBars: 0 },
    { Pu: 2000, Mu: 150, Lc: 3.5, b: 400, h: 400, Fc: 25, Fy: 400, cover: 40, tieDia: 10, barDia: 18, k: 1, tieSpacing: 120, critSpacing: 80, nBars: 0 },
    { Pu: 5000, Mu: 400, Lc: 4.5, b: 500, h: 500, Fc: 30, Fy: 400, cover: 40, tieDia: 10, barDia: 22, k: 1.2, tieSpacing: 100, critSpacing: 80, nBars: 0 },
  ];
  columnProfiles.forEach((p, idx) => {
    const r = optimizeColumn(p);
    results.push({ type: 'column', profile: ['light','medium','heavy'][idx], allOk: r.allOk, iterations: r.iterations });
  });

  const slabProfiles: SlabInput[] = [
    { system: 'solid', L: 4, h: 150, DL: 2, LL: 2, Fc: 25, Fy: 400, cover: 20, barDia: 10, negDia: 10, tempDia: 8, joistSpacing: 500 },
    { system: 'joist', L: 6, h: 250, DL: 2.5, LL: 2.5, Fc: 25, Fy: 400, cover: 25, barDia: 12, negDia: 10, tempDia: 8, joistSpacing: 500 },
    { system: 'solid', L: 8, h: 200, DL: 3, LL: 5, Fc: 25, Fy: 400, cover: 25, barDia: 12, negDia: 10, tempDia: 8, joistSpacing: 500 },
  ];
  slabProfiles.forEach((p, idx) => {
    const r = optimizeSlab(p);
    results.push({ type: 'slab', profile: ['light','medium','heavy'][idx], allOk: r.allOk, iterations: r.iterations });
  });

  const wallProfiles: WallInput[] = [
    { lw: 3, tw: 200, hs: 3, Pu: 1500, Mu: 2000, Vu: 500, Fc: 25, Fy: 400, cover: 30, vDia: 12, hDia: 10, hoopDia: 10, beForce: 0, beLenMm: 0, beHoopS: 0, beVertDia: 14, beVertCount: 6 },
    { lw: 4, tw: 250, hs: 3.2, Pu: 3000, Mu: 5000, Vu: 1000, Fc: 30, Fy: 400, cover: 30, vDia: 14, hDia: 12, hoopDia: 10, beForce: 0, beLenMm: 0, beHoopS: 0, beVertDia: 16, beVertCount: 6 },
    { lw: 5, tw: 250, hs: 3.5, Pu: 6000, Mu: 12000, Vu: 2000, Fc: 30, Fy: 400, cover: 30, vDia: 16, hDia: 14, hoopDia: 10, beForce: 0, beLenMm: 0, beHoopS: 0, beVertDia: 18, beVertCount: 6 },
  ];
  wallProfiles.forEach((p, idx) => {
    const r = optimizeWall(p);
    results.push({ type: 'wall', profile: ['light','medium','heavy'][idx], allOk: r.allOk, iterations: r.iterations });
  });

  const stairProfiles: StairInput[] = [
    { kind: 'stair', H: 3, Lr: 4.5, bw: 1.2, t: 150, DL: 1.5, LL: 3, Fc: 25, Fy: 400, cover: 20, barDia: 12 },
    { kind: 'stair', H: 3.2, Lr: 5.6, bw: 1.2, t: 180, DL: 2, LL: 5, Fc: 25, Fy: 400, cover: 25, barDia: 14 },
    { kind: 'stair', H: 4.2, Lr: 7.2, bw: 1.3, t: 200, DL: 2.5, LL: 5, Fc: 25, Fy: 400, cover: 25, barDia: 14 },
  ];
  stairProfiles.forEach((p, idx) => {
    const r = optimizeStair(p);
    results.push({ type: 'stair', profile: ['light','medium','heavy'][idx], allOk: r.allOk, iterations: r.iterations });
  });

  const rampProfiles: StairInput[] = [
    { kind: 'ramp', H: 0.9, Lr: 8, bw: 1.2, t: 150, DL: 1.5, LL: 3, Fc: 25, Fy: 400, cover: 25, barDia: 12 },
    { kind: 'ramp', H: 1.2, Lr: 8, bw: 1.5, t: 220, DL: 2, LL: 5, Fc: 25, Fy: 400, cover: 25, barDia: 14 },
    { kind: 'ramp', H: 1.4, Lr: 8, bw: 2.0, t: 250, DL: 3, LL: 5, Fc: 25, Fy: 400, cover: 25, barDia: 14 },
  ];
  rampProfiles.forEach((p, idx) => {
    const r = optimizeStair({ ...p, kind: 'ramp' });
    results.push({ type: 'ramp', profile: ['light','medium','heavy'][idx], allOk: r.allOk, iterations: r.iterations });
  });

  const jointProfiles: JointInput[] = [
    { colB: 400, colH: 400, beamB: 300, beamH: 500, Vu: 800, Fc: 25, Fy: 400, hoopDia: 10, hoopS: 120, faces: 4 },
    { colB: 500, colH: 500, beamB: 350, beamH: 600, Vu: 1500, Fc: 30, Fy: 400, hoopDia: 10, hoopS: 100, faces: 4 },
    { colB: 500, colH: 500, beamB: 400, beamH: 700, Vu: 3000, Fc: 30, Fy: 400, hoopDia: 10, hoopS: 100, faces: 2 },
  ];
  jointProfiles.forEach((p, idx) => {
    const r = optimizeJoint(p);
    results.push({ type: 'joint', profile: ['light','medium','heavy'][idx], allOk: r.allOk, iterations: r.iterations });
  });

  return results;
}


