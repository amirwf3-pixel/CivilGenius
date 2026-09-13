import { optimizeStair } from '../src/lib/smartOptimizer';
import { calculateStair } from '../src/lib/modules';
import type { StairInput } from '../src/lib/modules';

const cases: { label: string; inp: StairInput }[] = [
  { label: 'H=1.2 L=8 (15%)', inp: { kind: 'ramp', H: 1.2, Lr: 8, bw: 1.8, t: 200, DL: 2.5, LL: 5, Fc: 25, Fy: 400, cover: 25, barDia: 14 } },
  { label: 'H=1.5 L=8 (18.8%)', inp: { kind: 'ramp', H: 1.5, Lr: 8, bw: 1.8, t: 200, DL: 2.5, LL: 5, Fc: 25, Fy: 400, cover: 25, barDia: 14 } },
  { label: 'H=1.6 L=9 (17.8%)', inp: { kind: 'ramp', H: 1.6, Lr: 9, bw: 2.0, t: 220, DL: 3, LL: 5, Fc: 25, Fy: 400, cover: 25, barDia: 14 } },
  { label: 'H=2.0 L=9 (22%)', inp: { kind: 'ramp', H: 2.0, Lr: 9, bw: 2.0, t: 250, DL: 3, LL: 5, Fc: 25, Fy: 400, cover: 25, barDia: 14 } },
];
for (const c of cases) {
  const r = optimizeStair(c.inp);
  const fin = calculateStair(r.input);
  const defl = fin.checks.find(x => x.id === 'defl');
  console.log(`${c.label.padEnd(16)} allOk=${r.allOk} iter=${r.iterations} t=${(r.input as any).t} barDia=${(r.input as any).barDia} defl=${defl?.value} dc=${defl?.dc?.toFixed(2)}`);
}
