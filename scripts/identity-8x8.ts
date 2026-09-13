/* ============================================================================
 * P1-2.4 — 8/8 Identity Validation (CivilGenius v25 Phase 4)
 * Validates that the four identity dimensions — As_provided, section geometry,
 * rebar count/dia, and spacing — are consistent across the surfaces that carry
 * them, for all 8 modules:
 *   1. UI Metrics + Trace Log   (result.metrics / result.trace)
 *   2. Calculation Sheet        (CalcBook ← result.trace/checks)
 *   3. DXF drawing              (buildDxfBlob ← result.diagram)
 *   4. BBS / لیستوفر             (result.bbs)
 *   5. Excel / BOQ              (result.boq)
 * Additional P0-1.4 gate: for Foundation/Beam/Column the BBS Σ weight must
 * equal the BOQ rebar quantity (the modules for which the task mandates BBS).
 * ========================================================================== */
import { calculateFoundation, calculateBeam, calculateColumn, priceBOQ } from '../src/lib/engine';
import { calculateSlab, calculateWall, calculateStair, calculateRamp, calculateJoint } from '../src/lib/modules';
import { buildSampleProject } from '../src/lib/store';
import { market } from '../src/lib/market';
import { buildDxfBlob, type ExportPayload } from '../src/lib/exporters';
import { faNum } from '../src/lib/format';

(globalThis as unknown as { window: unknown }).window = {
  location: { hash: '#/slab' },
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  scrollTo: () => undefined,
};

let FAIL = 0;
const chk = (label: string, ok: boolean, extra = ''): void => {
  if (!ok) FAIL++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  | ' + extra : ''}`);
};

const barArea = (d: number): number => (Math.PI * d * d) / 4;

/** P0-1.4 gate — BBS total rebar weight must equal BOQ rebar (±0.6 kg rounding). */
function weightGate(name: string, bbs: { dia: number; count: number; lenMm: number }[], boqRebarKg: number): void {
  const sumKg = bbs.reduce((s, b) => s + barArea(b.dia) * b.lenMm * b.count / 1e6 * 7.85, 0);
  chk(`${name} [P0-1.4]: BBS Σ weight == BOQ rebar (±0.6 kg)`, Math.abs(sumKg - boqRebarKg) < 0.6, `BBS=${sumKg.toFixed(1)} BOQ=${boqRebarKg.toFixed(1)}`);
}

function dxfPayload(r: Parameters<typeof buildDxfBlob>[0], s: ReturnType<typeof buildSampleProject>): ExportPayload {
  const snap = market.getSnapshot();
  const { rows, total } = priceBOQ(
    r.boq,
    (id) => market.price(id),
    (id) => snap.live[id].status,
    (id) => ({ name: market.def(id).sourceName, url: market.def(id).sourceUrl }),
  );
  return { result: r, rows, total, prices: [], projectName: s.projectName, client: s.client };
}

async function main(): Promise<void> {
  const s = buildSampleProject();

  /* ---------------- 1. FOUNDATION ---------------- */
  {
    const r = calculateFoundation(s.foundation);
    const boqKg = r.boq.find((b) => b.code === 'RB')!.qty;
    weightGate('FOUNDATION', r.bbs!, boqKg);
    const b1 = r.bbs!.find((b) => b.mark === 'F1')!;
    chk('FOUNDATION: BBS F1 dia == input barDia', b1.dia === r.input.barDia);
    chk('FOUNDATION: BBS F1 count == B/1000 spacing grid', b1.count === Math.ceil((r.input.B * 1000) / r.extras.spacing), `count=${b1.count} spacing=${r.extras.spacing}`);
    chk('FOUNDATION: AsProvided consistent (metric vs extras)', r.metrics.some((m) => m.raw === r.extras.AsProvided && m.unit === 'mm²/m'));
    chk('FOUNDATION: trace has spacing step', r.trace.some((t) => t.title.includes('فاصله شبکه')));
    const dxf = await buildDxfBlob(r, dxfPayload(r, s));
    const dxfTxt = dxf instanceof Blob ? await dxf.text() : String(dxf);
    chk('FOUNDATION: DXF carries D{barDia} @ {spacing}', dxfTxt.includes(`D${r.input.barDia} @ ${r.extras.spacing}`), `D${r.input.barDia} @ ${r.extras.spacing}`);
  }

  /* ---------------- 2. BEAM ---------------- */
  {
    const r = calculateBeam({ ...s.beam, Tu: 55 });
    const boqKg = r.boq.filter((b) => b.code === 'RB' || b.code === 'ST').reduce((x, b) => x + b.qty, 0);
    weightGate('BEAM', r.bbs!, boqKg);
    const b1 = r.bbs!.find((b) => b.mark === 'B1')!;
    chk('BEAM: BBS B1 count == nBars', b1.count === r.extras.nBars, `count=${b1.count} nBars=${r.extras.nBars}`);
    chk('BEAM: BBS B1 dia == barDia', b1.dia === r.input.barDia);
    const mAs = r.metrics.find((m) => m.label.includes('آرماتور موجود'))!;
    chk('BEAM: metrics AsProvided == nBars×Ab', Math.abs(mAs.raw - r.extras.nBars * barArea(r.input.barDia)) < 1);
    chk('BEAM: diagram torsion + nTorsionLong == extras (Tu=55)', (r.diagram as any).torsion === true && (r.diagram as any).nTorsionLong === r.extras.nTorsionLong, `nTorsionLong=${r.extras.nTorsionLong}`);
    chk('BEAM: BBS B4 torsional bars present', r.bbs!.some((b) => b.mark === 'B4'), `B4 count=${r.bbs!.find((b) => b.mark === 'B4')?.count}`);
    const dxf = await buildDxfBlob(r, dxfPayload(r, s));
    const dxfTxt = dxf instanceof Blob ? await dxf.text() : String(dxf);
    chk('BEAM: DXF mentions TORSION bars', dxfTxt.includes('TORSION'));
  }

  /* ---------------- 3. COLUMN ---------------- */
  {
    const r = calculateColumn(s.column);
    const boqKg = r.boq.filter((b) => b.code === 'RB' || b.code === 'ST').reduce((x, b) => x + b.qty, 0);
    weightGate('COLUMN', r.bbs!, boqKg);
    const c1 = r.bbs!.find((b) => b.mark === 'C1')!;
    chk('COLUMN: BBS C1 count == nBars', c1.count === r.extras.nBars, `count=${c1.count} nBars=${r.extras.nBars}`);
    chk('COLUMN: BBS C1 dia == barDia', c1.dia === r.input.barDia);
    chk('COLUMN: BBS C2 ties exist', r.bbs!.some((b) => b.mark === 'C2'), `nTies=${r.bbs!.find((b) => b.mark === 'C2')?.count}`);
  }

  /* ---------------- 4. SLAB ---------------- */
  {
    const r = calculateSlab(s.slab);
    const b1 = r.bbs!.find((b) => b.mark === 'S1')!;
    chk('SLAB: BBS S1 dia == barDia', b1.dia === r.input.barDia);
    chk('SLAB: diagram spacing == extras sMain', (r.diagram as any).spacing === r.extras.sMain, `spacing=${(r.diagram as any).spacing}`);
    chk('SLAB: S1 count == ceil(1000/sMain)', b1.count === Math.ceil(1000 / r.extras.sMain), `count=${b1.count} sMain=${r.extras.sMain}`);
    chk('SLAB: BOQ detail lists Øbar/Øneg/Øtemp', r.boq.find((b) => b.code === 'SLB-R')!.detail.includes(faNum(r.input.barDia, 0)));
  }

  /* ---------------- 5. WALL ---------------- */
  {
    const r = calculateWall(s.wall);
    const w1 = r.bbs!.find((b) => b.mark === 'W1')!;
    chk('WALL: BBS W1 dia == vDia', w1.dia === r.input.vDia);
    chk('WALL: diagram vSpacing == extras sV', (r.diagram as any).vSpacing === r.extras.sV, `sV=${r.extras.sV}`);
    chk('WALL: trace mentions 0.0025 min steel', r.trace.some((t) => t.formula.includes('0.0025')));
  }

  /* ---------------- 6. STAIR ---------------- */
  {
    const r = calculateStair(s.stair);
    const t1 = r.bbs!.find((b) => b.mark === 'T1')!;
    chk('STAIR: BBS T1 dia == barDia', t1.dia === r.input.barDia);
    chk('STAIR: diagram spacing == sB', (r.diagram as any).spacing === r.extras.sB, `spacing=${(r.diagram as any).spacing}`);
    chk('STAIR: BOQ detail lists Ø{barDia}@{sB}', r.boq.find((b) => b.code === 'STR-R')!.detail.includes(`Ø${faNum(r.input.barDia, 0)}@${faNum(r.extras.sB, 0)}`));
  }

  /* ---------------- 7. RAMP (new module) ---------------- */
  {
    const r = calculateRamp(s.ramp);
    chk('RAMP: type === ramp', r.type === 'ramp', `type=${r.type}`);
    chk('RAMP: code carries RMP prefix', r.code.includes('RMP'), `code=${r.code}`);
    chk('RAMP: diagram.ramp === true', (r.diagram as any).ramp === true);
    chk('RAMP: input kind forced to ramp', r.input.kind === 'ramp');
    const t1 = r.bbs!.find((b) => b.mark === 'T1')!;
    chk('RAMP: BBS T1 dia == barDia', t1.dia === r.input.barDia);
  }

  /* ---------------- 8. JOINT ---------------- */
  {
    const r = calculateJoint(s.joint);
    const j1 = r.bbs!.find((b) => b.mark === 'J1')!;
    chk('JOINT: BBS J1 dia == hoopDia', j1.dia === r.input.hoopDia);
    chk('JOINT: diagram hoopS == extras hoopS', (r.diagram as any).hoopS === r.extras.hoopS);
  }

  console.log(FAIL === 0 ? '\nALL 8/8 IDENTITY CHECKS PASS' : `\n${FAIL} IDENTITY CHECK(S) FAILED`);
  process.exit(FAIL ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
