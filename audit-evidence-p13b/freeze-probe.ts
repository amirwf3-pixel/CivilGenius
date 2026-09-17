/* Phase 13B engineering zero-drift probe.
 * Runs sample + edge profiles through all 8 calculators and dumps the FULL
 * serialized results (document `code` removed — it is intentionally random).
 * Deterministic: run BEFORE and AFTER implementation; must be byte-identical. */
import { writeFileSync } from 'node:fs';
import { buildSampleProject } from '../src/lib/store';
import { calculateFoundation, calculateBeam, calculateColumn, type CalcResult } from '../src/lib/engine';
import { calculateSlab, calculateWall, calculateStair, calculateRamp, calculateJoint } from '../src/lib/modules';

const sp = buildSampleProject();
const dump: Record<string, unknown> = {};
const clean = (r: CalcResult): string => {
  const { code: _code, createdAt: _createdAt, ...rest } = r;
  return JSON.stringify(rest);
};

dump['foundation'] = clean(calculateFoundation(sp.foundation));
dump['beam'] = clean(calculateBeam(sp.beam));
dump['column'] = clean(calculateColumn(sp.column));
dump['slab'] = clean(calculateSlab(sp.slab));
dump['wall'] = clean(calculateWall(sp.wall));
dump['stair'] = clean(calculateStair(sp.stair));
dump['ramp'] = clean(calculateRamp(sp.ramp));
dump['joint'] = clean(calculateJoint(sp.joint));

// deterministic edge sentinels
dump['beam-edge'] = clean(calculateBeam({ ...sp.beam, L: 4.5, wd: 8, wl: 4 }));
dump['column-edge'] = clean(calculateColumn({ ...sp.column, Pu: 4500, Mu: 60 }));
dump['slab-edge'] = clean(calculateSlab({ ...sp.slab, L: 3.1, h: 200 }));
dump['wall-edge'] = clean(calculateWall({ ...sp.wall, Pu: 4200, Vu: 1400 }));

writeFileSync(new URL('./freeze-dump.json', import.meta.url), JSON.stringify(dump, null, 1));
console.log('FREEZE DUMP WRITTEN');
