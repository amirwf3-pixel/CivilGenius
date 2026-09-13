
/* round-30 visual QA: SSR the real pages and dump HTML for SVG extraction */
import { writeFileSync } from 'node:fs';
import { renderToString } from 'react-dom/server';
import { createElement as h } from 'react';

import { StoreCtx, type StoreValue } from '../src/lib/store';
import { calculateBeam, calculateColumn, calculateFoundation } from '../src/lib/engine';
import { calculateJoint, calculateRamp, calculateSlab, calculateStair, calculateWall } from '../src/lib/modules';
import { buildSampleProject } from '../src/lib/store';
import { market } from '../src/lib/market';
import { FoundationPage } from '../src/pages/Foundation';
import { BeamPage } from '../src/pages/Beam';
import { ColumnPage } from '../src/pages/Column';
import { SlabPage } from '../src/pages/Slab';
import { WallPage } from '../src/pages/Wall';
import { StairPage } from '../src/pages/Stair';
import { RampPage } from '../src/pages/Ramp';
import { JointPage } from '../src/pages/Joint';

(globalThis as unknown as { window: unknown }).window = {
  location: { hash: '#/foundation' },
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  scrollTo: () => undefined,
};

const sample = buildSampleProject();
// deep beam (h=800) to exercise skin reinforcement; slender column kept from sample
sample.beam = { ...sample.beam, h: 800 };

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
  recent: [],
  multipliers: sample.multipliers,
  setMultipliers: () => undefined,
  toasts: [],
  pushToast: () => undefined,
  dismissToast: () => undefined,
  loadSample: () => undefined,
  marketRef: { current: market.getSnapshot() },
};

const dump = (name: string, node: ReturnType<typeof h>): void => {
  const html = renderToString(h(StoreCtx.Provider, { value: storeValue }, node));
  writeFileSync(`/home/user/preview/r30-${name}.html`, html);
  console.log(`dumped r30-${name}.html (${html.length} chars)`);
};

dump('foundation', h(FoundationPage));
dump('beam', h(BeamPage));
dump('column', h(ColumnPage));
dump('slab', h(SlabPage));
dump('wall', h(WallPage));
dump('stair', h(StairPage));
dump('ramp', h(RampPage));
dump('joint', h(JointPage));


