
import { writeFileSync } from 'node:fs';
import { buildSampleProject } from '../src/lib/store';
import { calculateSlab } from '../src/lib/modules';
import { market } from '../src/lib/market';
import { buildExcelBlob, type ExportPayload } from '../src/lib/exporters';
import { priceBOQ } from '../src/lib/engine';
(globalThis as unknown as { window: unknown }).window = { location: { hash: '#/slab' }, addEventListener: () => undefined, removeEventListener: () => undefined, scrollTo: () => undefined };
const sample = buildSampleProject();
const r = calculateSlab(sample.slab);
const snap = market.getSnapshot();
const { rows, total } = priceBOQ(r.boq, (id) => market.price(id), (id) => snap.live[id].status, (id) => ({ name: market.def(id).sourceName, url: market.def(id).sourceUrl }));
const payload: ExportPayload = { result: r, rows, total, prices: market.priceTable().map((p) => ({ def: p.def, price: p.price, status: p.status })), projectName: sample.projectName };
void (async () => {
  const blob = buildExcelBlob(payload);
  writeFileSync('/home/user/preview/r31-slab.xlsx', Buffer.from(await blob.arrayBuffer()));
  console.log('xlsx written', blob.size);
})();


