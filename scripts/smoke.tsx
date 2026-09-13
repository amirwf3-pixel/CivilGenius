
/* ============================================================================
 * CivilGenius v20 — SSR smoke test.
 * Executes the REAL shipped React components (pages + providers) through
 * react-dom/server so any render-time crash (undefined var, bad JSX, missing
 * context) fails loudly. This runs the same component code the browser builds.
 * ========================================================================== */

import { renderToString } from 'react-dom/server';
import { createElement as h } from 'react';

import { StoreCtx, type StoreValue } from '../src/lib/store';
import { calculateBeam, calculateColumn, calculateFoundation } from '../src/lib/engine';
import { calculateJoint, calculateRamp, calculateSlab, calculateStair, calculateWall } from '../src/lib/modules';
import { buildSampleProject } from '../src/lib/store';
import { market } from '../src/lib/market';
import { Layout } from '../src/components/Layout';
import { TickerStrip } from '../src/components/TickerStrip';
import { DashboardPage } from '../src/pages/Dashboard';
import { MarketPage } from '../src/pages/Market';
import { FoundationPage } from '../src/pages/Foundation';
import { BeamPage } from '../src/pages/Beam';
import { ColumnPage } from '../src/pages/Column';
import { ManagementPage } from '../src/pages/Management';
import { AdvisorPage } from '../src/pages/Advisor';
import { SlabPage } from '../src/pages/Slab';
import { WallPage } from '../src/pages/Wall';
import { StairPage } from '../src/pages/Stair';
import { JointPage } from '../src/pages/Joint';
import { ReportHubPage } from '../src/pages/ReportHub';

// minimal window shim for any module-level reads
(globalThis as unknown as { window: unknown }).window = {
  location: { hash: '#/dashboard' },
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  scrollTo: () => undefined,
};

const sample = buildSampleProject();
market.override('formwork', 95_000);
market.override('excavation', 180_000);

const results = {
  foundation: calculateFoundation(sample.foundation),
  beam: calculateBeam(sample.beam),
  column: calculateColumn(sample.column),
  slab: calculateSlab(sample.slab),
  wall: calculateWall(sample.wall),
  stair: calculateStair(sample.stair),
  ramp: calculateRamp(sample.ramp),
  joint: calculateJoint(sample.joint),
};

const storeValue: StoreValue = {
  projectName: sample.projectName,
  client: sample.client,
  setProjectName: () => undefined,
  setClient: () => undefined,
  inputs: {
    foundation: sample.foundation,
    beam: sample.beam,
    column: sample.column,
    slab: sample.slab,
    wall: sample.wall,
    stair: sample.stair,
    ramp: sample.ramp,
    joint: sample.joint,
  },
  setInput: () => undefined,
  results,
  setResult: () => undefined,
  recent: [results.foundation, results.beam, results.column],
  multipliers: sample.multipliers,
  setMultipliers: () => undefined,
  toasts: [],
  pushToast: () => undefined,
  dismissToast: () => undefined,
  loadSample: () => undefined,
  marketRef: { current: market.getSnapshot() },
};

function render(label: string, node: ReturnType<typeof h>): void {
  const html = renderToString(h(StoreCtx.Provider, { value: storeValue }, node));
  const persian = (html.match(/[\u0600-\u06FF]/g) ?? []).length;
  if (!html || persian < 20) {
    console.error(`FAIL ${label}: rendered=${html.length} persianChars=${persian}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS ${label}: ${html.length.toLocaleString()} chars, ${persian} Persian glyphs`);
  }
}

const shell = (route: string, child: ReturnType<typeof h>): ReturnType<typeof h> =>
  h(Layout, { route, navigate: () => undefined, ticker: route === 'dashboard' ? h(TickerStrip) : null, children: child });

render('TickerStrip', h(TickerStrip));
render('Layout+Dashboard', shell('dashboard', h(DashboardPage, { navigate: () => undefined })));
render('Market', shell('market', h(MarketPage)));
render('Foundation', shell('foundation', h(FoundationPage)));
render('Beam', shell('beam', h(BeamPage)));
render('Column', shell('column', h(ColumnPage)));
render('Management', shell('management', h(ManagementPage)));
render('Slab', shell('slab', h(SlabPage)));
render('Wall', shell('shear-wall', h(WallPage)));
render('Stair', shell('staircase', h(StairPage)));
render('Joint', shell('joint', h(JointPage)));
render('ReportHub', shell('report-generator', h(ReportHubPage)));
render('Advisor', shell('advisor', h(AdvisorPage)));

console.log(process.exitCode ? 'SMOKE FAILED' : 'SMOKE OK — all real components rendered');


