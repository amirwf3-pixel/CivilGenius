
import { compute } from '../src/lib/engine';
import { DEFAULT_JOINT, DEFAULT_SLAB, DEFAULT_STAIR, DEFAULT_WALL } from '../src/lib/modules';
(globalThis as unknown as { window: unknown }).window = { location: { hash: '#/slab' }, addEventListener: () => undefined, removeEventListener: () => undefined, scrollTo: () => undefined };
for (const [t, i] of [
  ['slab', DEFAULT_SLAB],
  ['wall', DEFAULT_WALL],
  ['stair', DEFAULT_STAIR],
  ['joint', DEFAULT_JOINT],
] as const) {
  const r = compute(t, i);
  console.log(t, '=>', r.code, '| checks:', r.checks.length, '| bbs:', r.bbs?.length ?? 0, '| diagram:', r.diagram.kind, '| verdict:', r.verdict.ok);
}


