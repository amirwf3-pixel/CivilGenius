/* Phase 13B — re-verification of the restored Phase 12 behavior.
 * A: persistence contract (8-module round-trip, legacy backfill, malformed rejection)
 * B: stale lifecycle in the mounted App (chip/banner appear on edit, clear on recompute)
 * C: 8-module restore semantics
 * U: UI facts — management route, mobile 8 tiles, v24 surfaces, honest copy.
 */
import { JSDOM } from 'jsdom';
import { writeFileSync } from 'node:fs';

process.on('unhandledRejection', () => undefined);
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost/#/dashboard',
  pretendToBeVisual: true,
});
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
g.HTMLElement = dom.window.HTMLElement;
g.localStorage = dom.window.localStorage;
g.MouseEvent = dom.window.MouseEvent;
(dom.window.Element.prototype as unknown as { scrollTo: unknown }).scrollTo = function () {};
(dom.window as unknown as { scrollTo: unknown }).scrollTo = function () {};
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const txt = (el: Element | null): string => ((el?.textContent ?? '') as string).replace(/\s+/g, ' ').trim();

const out: Record<string, unknown> = {};
let pass = 0;
let fail = 0;
const check = (name: string, cond: boolean, extra = ''): void => {
  out[name] = cond ? 'PASS' : `FAIL ${extra}`;
  if (cond) pass += 1;
  else fail += 1;
};

void (async () => {
  /* ------------------------------------------------ A: persistence ------ */
  const { normalizeProject, parseProjectJSON, saveProject, listProjects, exportProjectJSON } = await import('../src/lib/projects');
  const { buildSampleProject, DEFAULT_MULTIPLIERS } = await import('../src/lib/store');
  const { DEFAULT_RAMP } = await import('../src/lib/modules');

  const sp = buildSampleProject();
  const pf = {
    v: 22 as const,
    name: 'آزمون فاز ۱۳ب',
    client: 'کارفرما: آزمون',
    savedAt: Date.now(),
    inputs: {
      foundation: sp.foundation, beam: sp.beam, column: sp.column, slab: sp.slab,
      wall: sp.wall, stair: sp.stair, ramp: sp.ramp, joint: sp.joint,
    },
    multipliers: { ...DEFAULT_MULTIPLIERS },
  };
  // A1 save → list round-trip (all 8 survive)
  saveProject(pf);
  const listed = listProjects();
  const got = listed.find((p) => p.name === pf.name);
  check('A1.roundtrip-listed', Boolean(got));
  check('A1.roundtrip-8-inputs', Boolean(got) && Object.keys(got.inputs).length === 8 && Object.keys(got.inputs).includes('joint'));
  // A2 export → parse
  const blobText = await exportProjectJSON(pf).text();
  const reparsed = parseProjectJSON(blobText);
  check('A2.export-parse', reparsed.name === pf.name && reparsed.inputs.ramp.H === sp.ramp.H);
  // A3 legacy 3-module project backfills the newer 5
  const legacy = { v: 22, name: 'قدیمی', client: 'c', savedAt: 1, inputs: { foundation: sp.foundation, beam: sp.beam, column: sp.column }, multipliers: { beams: 5 } };
  const norm = normalizeProject(legacy);
  check('A3.legacy-backfill', Boolean(norm) && norm!.inputs.slab !== undefined && norm!.inputs.joint !== undefined && norm!.inputs.ramp.H === DEFAULT_RAMP.H);
  check('A3.legacy-multiplier-merge', Boolean(norm) && norm!.multipliers.beams === 5 && norm!.multipliers.columns === DEFAULT_MULTIPLIERS.columns);
  // A4 malformed payloads rejected / sanitized
  check('A4a.missing-core-rejected', normalizeProject({ inputs: { foundation: {}, beam: {} } }) === null);
  check('A4b.non-object-rejected', normalizeProject('garbage') === null && normalizeProject(null) === null);
  const partial = normalizeProject({ inputs: { foundation: sp.foundation, beam: sp.beam, column: sp.column, slab: 'NOT-OBJECT', ramp: { H: 4.4 } }, multipliers: { beams: NaN } });
  check('A4c.bad-slot-defaulted', Boolean(partial) && partial!.inputs.slab !== undefined && partial!.inputs.ramp.H === 4.4 && partial!.multipliers.beams === DEFAULT_MULTIPLIERS.beams);
  let threw = false;
  try { parseProjectJSON('{"inputs":{}}'); } catch { threw = true; }
  check('A4d.parse-throws-fa', threw);

  /* ------------------------------------------ B/U: mounted app checks --- */
  const { createElement: h } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const App = (await import('../src/App')).default;
  const host = dom.window.document.getElementById('root')!;
  createRoot(host).render(h(App));
  await sleep(1400);
  const nav = (r: string): void => {
    dom.window.location.hash = `#/${r}`;
    dom.window.dispatchEvent(new dom.window.Event('hashchange'));
  };
  const click = (el: Element): void => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  const findBtn = (needle: string): Element | undefined => [...host.querySelectorAll('button')].find((b) => txt(b).includes(needle));

  // U1 management routed (Phase 12 Wave-1 UI-12-01)
  nav('management');
  await sleep(350);
  check('U1.management-routed', txt(host.querySelector('h1')).includes('اتاق فرمان'));

  // U2 mobile design sheet shows all 8 modules (UI-12-04 fix)
  nav('dashboard');
  await sleep(300);
  const designTab = [...host.querySelectorAll('nav.grid button')].find((b) => txt(b) === 'طراحی');
  if (designTab) click(designTab);
  await sleep(250);
  const sheet = host.querySelector('.fixed.inset-0');
  check('U2.mobile-8-modules', Boolean(sheet) && [...sheet!.querySelectorAll('button')].length === 8 && txt(sheet).includes('دیوار برشی'));
  if (sheet) click(sheet);
  await sleep(150);

  // U3 version surfaces = v24 / نسخه ۲۴, hero count = ۸
  const body0 = txt(host);
  check('U3.hero-version', body0.includes('v24') && body0.includes('نسخه ۲۴'));
  const statVals = [...host.querySelectorAll('section .text-lg.font-bold')].map(txt);
  check('U3.hero-module-count-8', statVals.includes('۸'), JSON.stringify(statVals));
  check('U5.no-live-price-claim', !body0.includes('قیمت لحظه‌ای'));
  check('U5.no-3-module-claim', !body0.includes('طراحی پی، تیر و ستون بر پایه'));

  // B: stale lifecycle on foundation (Wave-2)
  nav('foundation');
  await sleep(400);
  const sb = findBtn('بارگذاری پروژه نمونه سازمانی');
  check('B0.sample-button', Boolean(sb));
  if (sb) click(sb);
  await sleep(2700);
  check('B1.computed', txt(host).includes('قابل قبول') || txt(host).includes('نیاز به اصلاح'));
  check('B1.not-stale-initially', !txt(host).includes('نتیجه قدیمی'));
  // edit first numeric field (controlled input: prototype setter + input + focusout)
  const firstText = host.querySelector('input[type="text"][dir="rtl"]') as HTMLInputElement | null;
  check('B2.field-found', Boolean(firstText));
  if (firstText) {
    const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(firstText, '۲۶');
    firstText.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    firstText.dispatchEvent(new dom.window.FocusEvent('focusout', { bubbles: true }));
  }
  await sleep(400);
  const staleNow = txt(host);
  check('B3.stale-chip-visible', staleNow.includes('نتیجه قدیمی — ورودی‌ها تغییر کرده'));
  check('B3.stale-banner-visible', staleNow.includes('نتیجه قدیمی:') && staleNow.includes('دوباره'));
  // recompute clears staleness
  const cb = findBtn('محاسبه و صدور اسناد');
  if (cb) click(cb);
  await sleep(2700);
  check('B4.stale-cleared-after-recompute', !txt(host).includes('نتیجه قدیمی'));

  // C1: 8-module restore incl. ramp override through normalizeProject
  const saved = { ...pf, inputs: { ...pf.inputs, ramp: { ...sp.ramp, H: 4.4 } } };
  const restored = normalizeProject(saved);
  check('C1.restores-8-with-override', Boolean(restored) && restored!.inputs.ramp.H === 4.4 && restored!.inputs.joint.Vu === sp.joint.Vu);

  out['summary'] = { pass, fail };
  writeFileSync(new URL('./phase12-verify.json', import.meta.url), JSON.stringify(out, null, 2));
  console.log(`PHASE12 VERIFY: ${pass} PASS / ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error('VERIFY ERROR', e);
  process.exit(1);
});
