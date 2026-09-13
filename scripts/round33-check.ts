
/* round-33 functional checks:
 *  1. foundation: any user spacing in [120..300] must NOT fail the flexural check
 *     (flexural compares vs AsReq; AsMin is a separate warn with autofix).
 *  2. foundation smart optimization: merged autofix of failing checks recomputes
 *     to an all-green result.
 *  3. wall: boundary element inputs drive confinement; smart autofix clears the
 *     boundary warn into ok.
 */
import { buildSampleProject } from '../src/lib/store';
import { calculateFoundation } from '../src/lib/engine';
import { calculateWall, DEFAULT_WALL } from '../src/lib/modules';

let fail = 0;
const chk = (name: string, ok: boolean): void => {
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
};

const s = buildSampleProject();

/* 1 — the round-33 bug: AsMin-dominated case must NOT red-flag flexural at
 *    code-compliant spacing; As,min becomes its own warn with smart fix. */
const light = calculateFoundation({ ...s.foundation, P: 900, L: 2.6, B: 2.6, H: 0.6, barDia: 14, spacing: 250 });
const lFlex = light.checks.find((c) => c.id === 'rebar');
const lMin = light.checks.find((c) => c.id === 'asmin');
const lSpc = light.checks.find((c) => c.id === 'spacing');
chk('light footing @250mm: flexural ok (was red pre-v24) + spacing ok', lFlex?.status === 'ok' && lSpc?.status === 'ok');
chk('light footing @250mm: As,min separate warn with smart fix', lMin?.status === 'warn' && Boolean(lMin?.autofix));
for (const sp of [120, 150, 200, 250, 300]) {
  const r = calculateFoundation({ ...s.foundation, P: 900, L: 2.6, B: 2.6, H: 0.6, barDia: 14, spacing: sp });
  chk(`spacing=${sp} in [120..300]: spacing-check ok + flexural ok`, r.checks.find((c) => c.id === 'spacing')?.status === 'ok' && r.checks.find((c) => c.id === 'rebar')?.status === 'ok');
}

/* 2 — smart optimization clears everything */
const weak = calculateFoundation({ ...s.foundation, spacing: 300, barDia: 12 });
const merged: Record<string, number> = {};
for (const c of weak.checks) if (c.status !== 'ok' && c.autofix) Object.assign(merged, c.autofix);
const fixed = calculateFoundation({ ...weak.input, ...merged });
chk(
  `foundation smart-optimization: ${Object.keys(merged).join(',')} -> all green`,
  fixed.checks.every((c) => c.status === 'ok') && fixed.verdict.ok,
);
console.log('   weak statuses:', weak.checks.map((c) => `${c.id}:${c.status}`).join(' '));
console.log('   fixed statuses:', fixed.checks.map((c) => `${c.id}:${c.status}`).join(' '));

/* 3 — wall boundary: non-compliant confinement warns; smart autofix greens it */
const wallWeak = calculateWall({ ...DEFAULT_WALL, Pu: 4200, Mu: 6500, beForce: 1, beHoopS: 140, beVertCount: 4, beVertDia: 12 });
const beW = wallWeak.checks.find((c) => c.id === 'be');
const wallMerged: Record<string, number> = {};
for (const c of wallWeak.checks) if (c.status !== 'ok' && c.autofix) Object.assign(wallMerged, c.autofix);
const wallFixed = calculateWall({ ...wallWeak.input, ...wallMerged });
const beFixed = wallFixed.checks.find((c) => c.id === 'be');
chk('wall bad confinement warns -> smart fix greens boundary', beW?.status === 'warn' && beFixed?.status === 'ok');
console.log('   wall weak:', wallWeak.checks.map((c) => `${c.id}:${c.status}`).join(' '));
console.log('   wall fixed:', wallFixed.checks.map((c) => `${c.id}:${c.status}`).join(' '));

/* 4 — boundary manual inputs respected */
const manual = calculateWall({ ...DEFAULT_WALL, beForce: 1, beLenMm: 500, beHoopS: 90, beVertDia: 18, beVertCount: 8 });
chk('wall manual boundary inputs applied', manual.extras.beLen === 500 && Boolean(manual.bbs?.some((b) => b.mark === 'W3' && b.dia === 18)));

process.exit(fail ? 1 : 0);


