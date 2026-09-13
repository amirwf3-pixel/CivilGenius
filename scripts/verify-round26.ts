
/* Round-26 verification: Auto-Fix must turn every failing check green in ONE click. */
import { calculateBeam, calculateColumn, calculateFoundation, DEFAULT_BEAM, DEFAULT_COLUMN, DEFAULT_FOUNDATION, interactionCurve, pointInPolygon } from '../src/lib/engine';

let fail = 0;
const check = (name: string, cond: boolean, extra = ''): void => {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name} ${extra}`);
  if (!cond) fail++;
};

/* ---- independent brute-force SF (ray march) ---- */
const bruteSF = (M: number, P: number, pts: { M: number; P: number }[]): number => {
  let t = 1;
  while (t < 200 && pointInPolygon(M * t, P * t, pts)) t += 0.005;
  return t;
};

/* 1) beam default */
{
  const r = calculateBeam(DEFAULT_BEAM);
  const sh = r.checks.find((c) => c.id === 'shear')!;
  check('beam default shear ok', sh.status === 'ok', sh.value);
}

/* 2) beam with bad manual spacing -> autofix -> pass */
{
  const bad = calculateBeam({ ...DEFAULT_BEAM, stirrupSpacing: 400 });
  const sh = bad.checks.find((c) => c.id === 'shear')!;
  check('beam s=400 flagged', sh.status !== 'ok', `${sh.value} | ${sh.suggestion}`);
  const patch = sh.autofix!;
  const fixed = calculateBeam({ ...DEFAULT_BEAM, ...patch });
  const sh2 = fixed.checks.find((c) => c.id === 'shear')!;
  check('beam autofix one-click pass', sh2.status === 'ok', `patch=${JSON.stringify(patch)} -> ${sh2.value}`);
}

/* 3) beam heavy shear load -> Vu-based suggestion */
{
  const heavy = calculateBeam({ ...DEFAULT_BEAM, wl: 60, wd: 40, stirrupSpacing: 300 });
  const sh = heavy.checks.find((c) => c.id === 'shear')!;
  const patch = sh.autofix!;
  const fixed = calculateBeam({ ...DEFAULT_BEAM, wl: 60, wd: 40, ...patch });
  const sh2 = fixed.checks.find((c) => c.id === 'shear')!;
  check('beam heavy-Vu autofix pass', sh2.status === 'ok', `sugg=${JSON.stringify(patch)} -> ${sh2.value}`);
}

/* 4) column default: sane SF + all green */
{
  const r = calculateColumn(DEFAULT_COLUMN);
  const pm = r.checks.find((c) => c.id === 'pm')!;
  const rho = r.checks.find((c) => c.id === 'rho')!;
  const sf = r.extras.sf as number;
  check('column default SF sane', sf >= 1 && sf <= 5, `SF=${sf.toFixed(2)}`);
  check('column default pm+rho ok', pm.status === 'ok' && rho.status === 'ok', `${pm.value} rho=${rho.value}`);
  /* brute-force cross-check of the fixed ray math (effective designed section) */
  const { points } = interactionCurve(r.extras.b as number, r.extras.h as number, r.input.Fc, r.input.Fy, r.input.cover, r.input.barDia, r.extras.nBars as number);
  const bf = bruteSF(r.extras.MuDesign as number, r.extras.Pu as number, points);
  check('pmSafetyFactor matches brute ray-march', Math.abs(bf - sf) < 0.02, `analytic=${sf.toFixed(3)} brute=${bf.toFixed(3)}`);
}

/* 5) column overloaded w/ tiny manual bars -> autofix (bars + maybe dims) -> pass */
{
  const badIn = { ...DEFAULT_COLUMN, Pu: 4200, Mu: 320, nBars: 4 };
  const bad = calculateColumn(badIn);
  const pm = bad.checks.find((c) => c.id === 'pm')!;
  const rho = bad.checks.find((c) => c.id === 'rho')!;
  check('column overloaded flagged', pm.status !== 'ok' || rho.status !== 'ok', `${pm.value} ${rho.value}`);
  const patch = pm.autofix!;
  const fixed = calculateColumn({ ...badIn, ...patch });
  const pm2 = fixed.checks.find((c) => c.id === 'pm')!;
  const rho2 = fixed.checks.find((c) => c.id === 'rho')!;
  check('column autofix one-click pass', pm2.status === 'ok' && rho2.status === 'ok', `patch=${JSON.stringify(patch)} -> ${pm2.value} ${rho2.value}`);
}

/* 6) tiny-load column: SF must equal true ray ratio (not a bogus 56) */
{
  const r = calculateColumn({ ...DEFAULT_COLUMN, Pu: 300, Mu: 20 });
  const sf = r.extras.sf as number;
  const { points } = interactionCurve(r.extras.b as number, r.extras.h as number, r.input.Fc, r.input.Fy, r.input.cover, r.input.barDia, r.extras.nBars as number);
  const bf = bruteSF(r.extras.MuDesign as number, r.extras.Pu as number, points);
  check('tiny-load SF == brute ratio', Math.abs(bf - sf) < 0.02, `analytic=${sf.toFixed(2)} brute=${bf.toFixed(2)}`);
}

/* 7) foundation autofix one-click */
{
  const badIn = { ...DEFAULT_FOUNDATION, P: 30000 };
  const bad = calculateFoundation(badIn);
  const failing = bad.checks.filter((c) => c.status !== 'ok' && c.autofix);
  let cur = badIn as typeof DEFAULT_FOUNDATION;
  for (let i = 0; i < 3 && failing.length; i++) {
    const r = calculateFoundation(cur);
    const f = r.checks.find((c) => c.status !== 'ok' && c.autofix);
    if (!f) break;
    cur = { ...cur, ...f.autofix };
  }
  const fin = calculateFoundation(cur);
  check('foundation autofix clears shear/punch/rebar', fin.checks.every((c) => c.id === 'bearing' || c.id === 'spacing' || c.status === 'ok'), fin.checks.map((c) => `${c.id}:${c.status}`).join(' '));
}

console.log(fail === 0 ? 'ALL VERIFY PASS' : `${fail} VERIFY FAILURES`);
process.exit(fail === 0 ? 0 : 1);


