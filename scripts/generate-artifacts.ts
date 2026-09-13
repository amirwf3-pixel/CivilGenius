
/* ============================================================================
 * CivilGenius v20 — head-less artifact generator
 *
 * This script does NOT re-implement any export logic. It imports the exact
 * builders the web app ships (lib/exporters.ts → buildAllBlobs / buildExcelBlob
 * / buildWordBlob / buildDxfBlob, driven by lib/engine.ts + lib/market.ts) and
 * writes their byte output to /deliverables instead of triggering a browser
 * download. Every file the user receives is therefore produced by the same
 * code path the Delivery Center uses in the browser.
 *
 * Usage:  npm run artifacts
 * ========================================================================== */

import { chmodSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { calculateBeam, calculateColumn, calculateFoundation, priceBOQ, type CalcResult, type CalcType } from '../src/lib/engine';
import { market } from '../src/lib/market';
import { buildAllBlobs, buildProcurementBlob, procurementDocName, type ExportPayload, type ProcurementRow } from '../src/lib/exporters';
import { buildSampleProject } from '../src/lib/store';
import { jalaliDate, jalaliISO } from '../src/lib/format';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'deliverables');
mkdirSync(OUT, { recursive: true });

interface Written {
  path: string;
  bytes: number;
  kind: string;
}

const written: Written[] = [];

async function write(name: string, blob: Blob, kind: string): Promise<void> {
  const buf = Buffer.from(await blob.arrayBuffer());
  let path = join(OUT, name);
  // Read-Only safeguard: drop stale AutoCAD lock files, make any existing target
  // writable first, and fall back to a timestamped name if the file is locked.
  for (const lock of [`${path}.dwl`, `${path}.dwl2`]) {
    if (existsSync(lock)) rmSync(lock, { force: true });
  }
  if (existsSync(path)) {
    try {
      chmodSync(path, 0o666);
    } catch {
      /* fall through to rename */
    }
  }
  try {
    // atomic: write a temp file (stream fully closed) then replace — a running
    // AutoCAD never sees a half-written drawing and no handle stays open here
    const tmp = `${path}.tmp`;
    writeFileSync(tmp, buf);
    renameSync(tmp, path);
  } catch {
    const alt = name.replace(/(\.[a-z0-9]+)$/i, `-${Date.now()}$1`);
    path = join(OUT, alt);
    writeFileSync(path, buf);
    console.log(`  ! ${name} was locked — wrote ${alt}`);
  }
  try {
    chmodSync(path, 0o666); // never ship a read-only drawing
  } catch {
    /* best effort */
  }
  written.push({ path, bytes: buf.byteLength, kind });
  console.log(`  ✓ ${name}  (${buf.byteLength.toLocaleString('en-US')} bytes)`);
}

function payloadFor(result: CalcResult, projectName: string, client: string): ExportPayload {
  const snap = market.getSnapshot();
  const { rows, total } = priceBOQ(
    result.boq,
    (id) => snap.prices[id],
    (id) => snap.live[id].status,
    (id) => ({ name: market.def(id).sourceName, url: market.def(id).sourceUrl }),
  );
  return {
    result,
    rows,
    total,
    prices: market.priceTable().map((p) => ({ def: p.def, price: p.price, status: p.status })),
    projectName,
    client,
  };
}

async function main(): Promise<void> {
  console.log(`\nCivilGenius ${'v20'} — artifact generation`);
  console.log(`Jalali date: ${jalaliDate()}  (${jalaliISO()})`);
  console.log(`Output: ${OUT}\n`);

  const sample = buildSampleProject();

  // mark the two manual-entry materials exactly as a user would on the Market page,
  // so the exported documents contain complete (not zero) prices for every row.
  market.override('formwork', 95_000);
  market.override('excavation', 180_000);

  const cases: { type: CalcType; result: CalcResult }[] = [
    { type: 'foundation', result: calculateFoundation(sample.foundation) },
    { type: 'beam', result: calculateBeam(sample.beam) },
    { type: 'column', result: calculateColumn(sample.column) },
  ];

  for (const c of cases) {
    console.log(`[${c.type}] ${c.result.code} — ${c.result.boq.length} BOQ items`);
    const payload = payloadFor(c.result, sample.projectName, sample.client);
    const bundle = await buildAllBlobs(payload);
    await write(bundle.excel.name, bundle.excel.blob, 'xlsx');
    await write(bundle.word.name, bundle.word.blob, 'docx');
    await write(bundle.dxf.name, bundle.dxf.blob, 'dxf');
    console.log('');
  }

  /* management procurement sheet (5% waste, aggregated over members) */
  const snap = market.getSnapshot();
  const agg = new Map<string, number>();
  const pushItems = (result: CalcResult, count: number): void => {
    for (const item of result.boq) {
      agg.set(item.materialId, (agg.get(item.materialId) ?? 0) + item.qty * count);
    }
  };
  pushItems(cases[0].result, sample.multipliers.foundations);
  pushItems(cases[1].result, sample.multipliers.beams);
  pushItems(cases[2].result, sample.multipliers.columns);

  const rows: ProcurementRow[] = [...agg.entries()].map(([materialId, qty]) => {
    const id = materialId as keyof typeof snap.prices;
    const def = market.def(id);
    const withWaste = qty * 1.05;
    return {
      materialId,
      name: def.name,
      unit: def.unit,
      qty: withWaste,
      unitPrice: snap.prices[id],
      amount: withWaste * snap.prices[id],
      status: snap.live[id].status,
      source: def.sourceName,
    };
  });
  const procurementBlob = buildProcurementBlob(rows, sample.projectName, cases[0].result.code);
  const procurementName = procurementDocName();
  console.log('[management] procurement');
  await write(procurementName, procurementBlob, 'xlsx');

  // final sweep: no stale AutoCAD locks or temp files may remain in the output
  for (const f of readdirSync(OUT)) {
    if (f.endsWith('.dwl') || f.endsWith('.dwl2') || f.endsWith('.tmp')) {
      rmSync(join(OUT, f), { force: true });
    }
  }

  console.log(`\nDone — ${written.length} files written to ${OUT}\n`);
}

void main();


