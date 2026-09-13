import { optimizeSlab } from '../src/lib/smartOptimizer';
import { calculateSlab } from '../src/lib/modules';
import type { SlabInput } from '../src/lib/modules';

const cases: { name: string; inp: SlabInput }[] = [
  { name: 'heavy-solid-L8-h200', inp: { system: 'solid', L: 8, h: 200, DL: 3, LL: 5, Fc: 25, Fy: 400, cover: 25, barDia: 12, negDia: 10, tempDia: 8, joistSpacing: 500 } },
  { name: 'thick-light-solid-L4-h600', inp: { system: 'solid', L: 4, h: 600, DL: 2, LL: 2, Fc: 25, Fy: 400, cover: 25, barDia: 12, negDia: 10, tempDia: 8, joistSpacing: 500 } },
  { name: 'heavy-solid-L8-h600', inp: { system: 'solid', L: 8, h: 600, DL: 3, LL: 5, Fc: 25, Fy: 400, cover: 25, barDia: 12, negDia: 10, tempDia: 8, joistSpacing: 500 } },
  { name: 'waffle-L9-h350', inp: { system: 'waffle', L: 9, h: 350, DL: 4, LL: 5, Fc: 25, Fy: 400, cover: 25, barDia: 12, negDia: 10, tempDia: 8, joistSpacing: 800 } },
  { name: 'joist-L7-h300-DL4-LL6', inp: { system: 'joist', L: 7, h: 300, DL: 4, LL: 6, Fc: 25, Fy: 400, cover: 25, barDia: 12, negDia: 10, tempDia: 8, joistSpacing: 500 } },
  { name: 'solid-L10-h300', inp: { system: 'solid', L: 10, h: 300, DL: 5, LL: 6, Fc: 25, Fy: 400, cover: 25, barDia: 12, negDia: 10, tempDia: 8, joistSpacing: 500 } },
];

for (const c of cases) {
  const opt = optimizeSlab(c.inp);
  const fin = calculateSlab(opt.input);
  const bad = fin.checks.filter((x) => x.status !== 'ok');
  console.log(`\n=== ${c.name} => allOk=${opt.allOk} iter=${opt.iterations}`);
  console.log(`    final h=${(opt.input as SlabInput).h} barDia=${(opt.input as SlabInput).barDia} negDia=${(opt.input as SlabInput).negDia} tempDia=${(opt.input as SlabInput).tempDia}`);
  console.log(`    verdict.ok=${fin.verdict.ok}  non-ok checks: ${bad.map((x) => `${x.id}:${x.status}(${x.value})`).join(' | ') || 'none'}`);
}
