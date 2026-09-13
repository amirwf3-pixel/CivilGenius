
/* round-32 DXF audit: emit v24 sheet-layout DXFs for ALL 7 modules so the
 * ezdxf side can verify integrity + extents (auto-fit/centering). */
import { mkdirSync, writeFileSync } from 'node:fs';
import { buildSampleProject } from '../src/lib/store';
import { calculateFoundation, calculateBeam, calculateColumn } from '../src/lib/engine';
import { calculateJoint, calculateSlab, calculateStair, calculateWall } from '../src/lib/modules';
import { market } from '../src/lib/market';
import { buildDxfBlob, docName, type ExportPayload } from '../src/lib/exporters';
import { priceBOQ } from '../src/lib/engine';

(globalThis as unknown as { window: unknown }).window = {
  location: { hash: '#/slab' },
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  scrollTo: () => undefined,
};

const OUT = '/home/user/deliverables/preview';
mkdirSync(OUT, { recursive: true });

const sample = buildSampleProject();
const results = [
  calculateFoundation(sample.foundation),
  calculateBeam(sample.beam),
  calculateColumn(sample.column),
  calculateSlab(sample.slab),
  calculateWall(sample.wall),
  calculateStair(sample.stair),
  calculateJoint(sample.joint),
];

const snap = market.getSnapshot();
for (const r of results) {
  const { rows, total } = priceBOQ(
    r.boq,
    (id) => market.price(id),
    (id) => snap.live[id].status,
    (id) => ({ name: market.def(id).sourceName, url: market.def(id).sourceUrl }),
  );
  const payload: ExportPayload = {
    result: r, rows, total,
    prices: market.priceTable().map((p) => ({ def: p.def, price: p.price, status: p.status })),
    projectName: sample.projectName, client: sample.client,
  };
  const blob = buildDxfBlob(r, payload);
  const t = blob instanceof Blob ? await blob.text() : String(blob);
  writeFileSync(`${OUT}/v24-${r.type}.dxf`, t);
  console.log('wrote', docName(r.type, 'drawing'), t.length, 'chars');
}


