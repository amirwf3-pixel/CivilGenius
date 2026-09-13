
import { renderToString } from 'react-dom/server';
import { createElement as h } from 'react';
import { StoreCtx, type StoreValue, buildSampleProject } from '../src/lib/store';
import { calculateBeam, calculateColumn, calculateFoundation } from '../src/lib/engine';
import { market } from '../src/lib/market';
(globalThis as unknown as { window: unknown }).window = {
  location: { hash: '#/column' },
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  scrollTo: () => undefined,
};
import('../src/pages/Advisor').then(({ AdvisorPage }) => {
  const sample = buildSampleProject();
  const results = {
    foundation: calculateFoundation(sample.foundation),
    beam: calculateBeam(sample.beam),
    column: calculateColumn(sample.column),
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
  const html = renderToString(h(StoreCtx.Provider, { value: storeValue }, h(AdvisorPage)));
  console.log('local switch :', html.includes('پایگاه دانش محلی (RAG / مباحث ملی)'));
  console.log('live switch  :', html.includes('مدل زنده — دستیار هوشمند (Groq / LLM)'));
  console.log('column chips :', html.includes('حداقل و حداکثر درصد آرماتور ستون چقدر است؟'));
});


