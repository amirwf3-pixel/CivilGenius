
/* round-32 e2e: mount each module page in jsdom and verify the new UX flow:
 *   1. initial state = "Uncalculated / Ready" (no auto-compute, clean placeholder)
 *   2. clicking «بارگذاری پروژه نمونه سازمانی» computes and renders the live
 *      canvas + D/C cards + BBS table.
 */
import { JSDOM } from 'jsdom';
import type { CalcResult, CalcType } from '../src/lib/engine';
import type { StoreValue } from '../src/lib/store';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/#/slab', pretendToBeVisual: true });
(globalThis as Record<string, unknown>).window = dom.window;
(globalThis as Record<string, unknown>).document = dom.window.document;
(globalThis as Record<string, unknown>).navigator = dom.window.navigator;
(globalThis as Record<string, unknown>).HTMLElement = dom.window.HTMLElement;
(globalThis as Record<string, unknown>).localStorage = dom.window.localStorage;

void import('react-dom/client').then(async ({ createRoot }) => {
  const { createElement: h } = await import('react');
  const { StoreCtx, buildSampleProject } = await import('../src/lib/store');
  const { market } = await import('../src/lib/market');
  const sample = buildSampleProject();
  const results: Partial<Record<CalcType, CalcResult>> = {};
  const inputs = {
    foundation: sample.foundation, beam: sample.beam, column: sample.column,
    slab: sample.slab, wall: sample.wall, stair: sample.stair, ramp: sample.ramp, joint: sample.joint,
  };
  let root: ReturnType<typeof createRoot> | null = null;
  let PageRef: (() => ReturnType<typeof h>) | null = null;
  /** re-render with fresh context identities so consumers observe state (like the real store) */
  const bump = (): void => {
    value = { ...value, inputs: { ...inputs }, results: { ...results } };
    if (root && PageRef) root.render(h(StoreCtx.Provider, { value }, h(PageRef)));
  };
  let value: StoreValue = {
    projectName: sample.projectName, client: sample.client,
    setProjectName: () => undefined, setClient: () => undefined,
    inputs,
    setInput: (t, v) => { (inputs as Record<string, unknown>)[t] = v; bump(); },
    results,
    setResult: (t: CalcType, r: CalcResult) => { results[t] = r; bump(); },
    recent: [], multipliers: sample.multipliers, setMultipliers: () => undefined,
    toasts: [], pushToast: () => undefined, dismissToast: () => undefined,
    loadSample: () => undefined, marketRef: { current: market.getSnapshot() },
  };
  const pages: [string, string, () => Promise<Record<string, unknown>>][] = [
    ['Slab', 'مقطع سقف', () => import('../src/pages/Slab')],
    ['Wall', 'مقطع دیوار برشی', () => import('../src/pages/Wall')],
    ['Stair', 'مقطع راهپله', () => import('../src/pages/Stair')],
    ['Joint', 'چشمه اتصال', () => import('../src/pages/Joint')],
  ];
  let fail = 0;
  for (const [name, marker, load] of pages) {
    const mod = await load();
    PageRef = mod[Object.keys(mod)[0]] as () => ReturnType<typeof h>;
    const host = dom.window.document.createElement('div');
    dom.window.document.body.appendChild(host);
    root = createRoot(host);
    root.render(h(StoreCtx.Provider, { value }, h(PageRef)));
    await new Promise((r) => setTimeout(r, 250));
    const idle = host.innerHTML;
    const svg = `aria-label="${marker}"`; // canvas marker only exists inside the result panel
    const idleOk = idle.includes('هنوز محاسبه‌ای انجام نشده') && !idle.includes(svg);
    // click the enterprise-sample button
    const btn = [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('بارگذاری پروژه نمونه سازمانی'));
    if (btn) btn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 1200));
    const live = host.innerHTML;
    const liveOk = live.includes(svg) && live.includes('نسبت تقاضا به ظرفیت');
    const ok = idleOk && liveOk && Boolean(btn);
    if (!ok) fail++;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: idle-clean=${idleOk} sample-btn=${Boolean(btn)} live-canvas=${live.includes(svg)} D/C=${live.includes('نسبت تقاضا به ظرفیت')}`);
    root = null; PageRef = null;
  }
  process.exit(fail ? 1 : 0);
}).catch((e) => {
  console.error('E2E ERROR', e);
  process.exit(1);
});


