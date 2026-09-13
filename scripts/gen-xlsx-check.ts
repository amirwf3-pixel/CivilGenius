
/* round-33: emit a fresh styled workbook (with BBS sheet) for check-xlsx.py */
import { writeFileSync } from 'node:fs';
import { buildSampleProject } from '../src/lib/store';
import { calculateSlab } from '../src/lib/modules';
import { market } from '../src/lib/market';
import { buildExcelBlob, type ExportPayload } from '../src/lib/exporters';
import { priceBOQ } from '../src/lib/engine';

(globalThis as unknown as { window: unknown }).window = {
  location: { hash: '#/slab' },
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  scrollTo: () => undefined,
};

const sample = buildSampleProject();
const r = calculateSlab(sample.slab);
const snap = market.getSnapshot();
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
const blob = buildExcelBlob(payload);
void blob.arrayBuffer().then((ab) => {
  writeFileSync('/home/user/deliverables/preview/v24-xlsx-check.xlsx', Buffer.from(ab));
  console.log('wrote v24-xlsx-check.xlsx', ab.byteLength, 'bytes');
});


