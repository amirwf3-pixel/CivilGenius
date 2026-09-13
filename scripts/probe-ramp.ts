import { optimizeStair } from '../src/lib/smartOptimizer';
import { calculateStair } from '../src/lib/modules';
import type { StairInput } from '../src/lib/modules';

const p: StairInput = { kind: 'ramp', H: 4.5, Lr: 9, bw: 1.6, t: 200, DL: 2.5, LL: 5, Fc: 25, Fy: 400, cover: 25, barDia: 14 };
const opt = optimizeStair({ ...p, kind: 'ramp' });
const fin = calculateStair(opt.input);
console.log('allOk=', opt.allOk, 'iter=', opt.iterations);
console.log('final:', JSON.stringify({ H: (opt.input as StairInput).H, Lr: (opt.input as StairInput).Lr, t: (opt.input as StairInput).t, barDia: (opt.input as StairInput).barDia }));
for (const c of fin.checks) {
  if (c.status !== 'ok') console.log('NON-OK:', c.id, c.status, c.value, '| dc=', c.dc, '| autofix=', JSON.stringify(c.autofix));
}
