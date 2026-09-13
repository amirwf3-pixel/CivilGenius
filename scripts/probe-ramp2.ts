import { optimizeStair } from '../src/lib/smartOptimizer';
import { calculateStair } from '../src/lib/modules';
import type { StairInput } from '../src/lib/modules';

const cases: StairInput[] = [
  { kind: 'ramp', H: 1.2, Lr: 10, bw: 1.2, t: 160, DL: 1.5, LL: 3, Fc: 25, Fy: 400, cover: 25, barDia: 12 },
  { kind: 'ramp', H: 2, Lr: 13, bw: 1.5, t: 200, DL: 2, LL: 5, Fc: 25, Fy: 400, cover: 25, barDia: 14 },
  { kind: 'ramp', H: 2.1, Lr: 14, bw: 1.8, t: 250, DL: 2.5, LL: 5, Fc: 25, Fy: 400, cover: 25, barDia: 14 },
  { kind: 'ramp', H: 2.4, Lr: 14, bw: 1.8, t: 300, DL: 2.5, LL: 6, Fc: 25, Fy: 400, cover: 25, barDia: 16 },
];
for (const p of cases) {
  const opt = optimizeStair({ ...p, kind: 'ramp' });
  const fin = calculateStair(opt.input);
  const bad = fin.checks.filter((x) => x.status !== 'ok');
  console.log(`H=${p.H} Lr=${p.Lr} slope=${(p.H/p.Lr*100).toFixed(1)}% => allOk=${opt.allOk} iter=${opt.iterations} t=${(opt.input as StairInput).t} barDia=${(opt.input as StairInput).barDia} bad=[${bad.map(b=>b.id+':'+b.status+' dc='+(b.dc??0).toFixed(2)).join(', ')}]`);
}
