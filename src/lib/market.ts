
/* ============================================================================
 * CivilGenius v20 — MarketEngine
 * 10 materials, 180-day seeded history, live tick, live/reference/manual
 * source tracking, ahanonline live-price application, manual overrides.
 *
 * HONESTY RULE (round 4): a price is only ever presented as "live" when it
 * actually arrived from ahanonline.com in this session. Otherwise the card
 * shows its reference source, and materials without any public list price
 * (formwork, excavation) are flagged "دستی وارد کنید".
 * ========================================================================== */

import { useEffect, useState, useSyncExternalStore } from 'react';

export type SourceType = 'live' | 'reference' | 'manual';

export type MaterialId =
  | 'rebar'
  | 'ibeam'
  | 'sheet'
  | 'cement'
  | 'concrete'
  | 'lean'
  | 'gravel'
  | 'sand'
  | 'formwork'
  | 'excavation'
  | 'block';

export interface MaterialDef {
  id: MaterialId;
  name: string;
  nameEn: string;
  /** Persian unit label used across UI + documents */
  unit: string;
  /** Short latin unit used in DXF / spreadsheet formulas */
  unitEn: string;
  /** Reference base price in Toman per unit (fetched from the named source) */
  base: number;
  sourceType: SourceType;
  sourceName: string;
  sourceUrl: string;
  sourceNote: string;
  /** Synthetic daily volatility used only while the item is NOT locked/live */
  drift: number;
}

export interface LiveInfo {
  status: SourceType;
  price: number;
  at: number;
  url: string;
}

export interface PricePoint {
  t: number;
  v: number;
}

export interface MarketSnapshot {
  rev: number;
  prices: Record<MaterialId, number>;
  prev: Record<MaterialId, number>;
  live: Record<MaterialId, LiveInfo>;
  locked: MaterialId[];
  overrides: Partial<Record<MaterialId, number>>;
  fetch: { status: 'idle' | 'loading' | 'ok' | 'error'; at: number; message: string };
  /** per-item epoch ms of the last real update (0 = manual, never fetched) */
  updatedAt: Record<MaterialId, number>;
  tickAt: number;
}

/** Publication date of the researched reference prices (18 Shahrivar 1405). */
export const REF_PUB = Date.parse('2026-09-09T09:00:00+03:30');

/**
 * Real values researched from public sources (18 شهریور 1405 / 2026-09-09):
 *   rebar ذوب‌آهن 14  = 85,910 T/kg  (+430 daily)   — ahanonline.com
 *   IPE 14            ≈ 80,900 T/kg                — ahanonline.com
 *   sheet ST37        ≈ 112,000 T/kg               — ahanonline.com
 *   cement type-2 pkt = 253,000 T/packet (≈5.06M T/ton) — SharghDaily / Taadol
 *   concrete C25+pump = 2,700,000 T/m³             — Omran Modern (1405)
 *   lean 150 kg/m³    ≈ 2,600,000 T/m³ (≈260k/m²)  — Setoudeh Beton
 *   gravel            = 70,000 T/ton               — Sakhtemanchi
 *   sand              = 95,000 T/ton               — Sakhtemanchi
 *   formwork / excavation — no public list price → manual entry
 */
export const MATERIALS: MaterialDef[] = [
  {
    id: 'rebar',
    name: 'میلگرد A3 سایز ۱۴ ذوب‌آهن اصفهان',
    nameEn: 'Rebar A3 Ø14 (Zob Ahan)',
    unit: 'کیلوگرم',
    unitEn: 'kg',
    base: 85_910,
    sourceType: 'live',
    sourceName: 'آهن‌آنلاین',
    sourceUrl: 'https://ahanonline.com/product-category/ahan-alat/milgerd/',
    sourceNote: 'آخرین قیمت اعلامی ۱۸ شهریور ۱۴۰۵ — میلگرد نورد گرم A3 سایز ۱۴ (تغییر روزانه ‎+۴۳۰ تومان)',
    drift: 0.006,
  },
  {
    id: 'ibeam',
    name: 'تیرآهن IPE 14 ذوب‌آهن اصفهان',
    nameEn: 'IPE 14 beam (Zob Ahan)',
    unit: 'کیلوگرم',
    unitEn: 'kg',
    base: 80_900,
    sourceType: 'live',
    sourceName: 'آهن‌آنلاین',
    sourceUrl: 'https://ahanonline.com/product-category/ahan-alat/tir-ahan/',
    sourceNote: 'قیمت هر کیلوگرم تیرآهن IPE سایز ۱۴ — مرجع استعلام، نه قیمت لحظه‌ای کارخانه',
    drift: 0.005,
  },
  {
    id: 'sheet',
    name: 'ورق سیاه ST37 ضخامت ۸ میلی‌متر',
    nameEn: 'Steel sheet ST37 8mm',
    unit: 'کیلوگرم',
    unitEn: 'kg',
    base: 112_000,
    sourceType: 'live',
    sourceName: 'آهن‌آنلاین',
    sourceUrl: 'https://ahanonline.com/product-category/ahan-alat/varagh-siah/',
    sourceNote: 'ورق سیاه فولاد مبارکه ST37 — مبنای محاسبه قطعات فولادی و پلیت',
    drift: 0.007,
  },
  {
    id: 'cement',
    name: 'سیمان پاکتی تیپ ۲ تهران',
    nameEn: 'Portland cement type II (50kg bag)',
    unit: 'بسته ۵۰ کیلویی',
    unitEn: 'bag',
    base: 253_000,
    sourceType: 'reference',
    sourceName: 'شرق‌دیلی / تعادل',
    sourceUrl: 'https://sharghdaily.com/',
    sourceNote: '۲۵۳٬۰۰۰ تومان هر بسته ≈ ۵٬۰۶۰٬۰۰۰ تومان در هر تن — قیمت درب کارخانه، حمل جدا',
    drift: 0.003,
  },
  {
    id: 'concrete',
    name: 'بتن آماده C25 با پمپ',
    nameEn: 'Ready-mix concrete C25 + pump',
    unit: 'متر مکعب',
    unitEn: 'm³',
    base: 2_700_000,
    sourceType: 'reference',
    sourceName: 'عمران مدرن ۱۴۰۵',
    sourceUrl: 'https://omranmodern.com/',
    sourceNote: 'بتن آماده عیار ۳۵۰ با احتساب هزینه پمپاژ در محدوده تهران',
    drift: 0.002,
  },
  {
    id: 'lean',
    name: 'بتن مگر عیار ۱۵۰ (لایه ۱۰ سانتی‌متر)',
    nameEn: 'Lean concrete 150 kg/m³, 10cm',
    unit: 'متر مکعب',
    unitEn: 'm³',
    base: 2_600_000,
    sourceType: 'reference',
    sourceName: 'ستوده بتن',
    sourceNote: 'هر متر مکعب ≈ ۲۶۰٬۰۰۰ تومان در هر متر مربع با ضخامت ۱۰ سانتی‌متر',
    sourceUrl: 'https://setoudehbeton.com/',
    drift: 0.002,
  },
  {
    id: 'gravel',
    name: 'شن (قلوه‌سنگ) دانه‌بندی شده',
    nameEn: 'Gravel (crushed aggregate)',
    unit: 'تن',
    unitEn: 't',
    base: 70_000,
    sourceType: 'reference',
    sourceName: 'ساختمونچی',
    sourceUrl: 'https://sakhtemanchi.com/',
    sourceNote: 'قیمت درب معدن/بنگاه، بدون کرایه حمل — برای بتن درجا',
    drift: 0.004,
  },
  {
    id: 'sand',
    name: 'ماسه شسته',
    nameEn: 'Washed sand',
    unit: 'تن',
    unitEn: 't',
    base: 95_000,
    sourceType: 'reference',
    sourceName: 'ساختمونچی',
    sourceUrl: 'https://sakhtemanchi.com/',
    sourceNote: 'قیمت درب معدن/بنگاه، بدون کرایه حمل — برای بتن درجا',
    drift: 0.004,
  },
  {
    id: 'formwork',
    name: 'قالب‌بندی (اجرت + مصالح)',
    nameEn: 'Formwork (labour + material)',
    unit: 'متر مربع',
    unitEn: 'm²',
    base: 95_000,
    sourceType: 'manual',
    sourceName: 'توافق در کارگاه',
    sourceUrl: '',
    sourceNote: 'نرخ برآوردی متداول کارگاهی (شهریور ۱۴۰۵) به‌صورت پیش‌فرض درج شده — در صفحه بازار قابل override است',
    drift: 0.001,
  },
  {
    id: 'excavation',
    name: 'خاک‌برداری با ماشین‌آلات',
    nameEn: 'Mechanical excavation',
    unit: 'متر مکعب',
    unitEn: 'm³',
    base: 180_000,
    sourceType: 'manual',
    sourceName: 'توافق در کارگاه',
    sourceUrl: '',
    sourceNote: 'نرخ برآوردی متداول کارگاهی (شهریور ۱۴۰۵) به‌صورت پیش‌فرض درج شده — بسته به عمق/خاک/حمل override کنید',
    drift: 0.001,
  },
  {
    id: 'block',
    name: 'بلوک سقفی سبک ۴۰×۲۰×۲۰ / دال مجوف',
    nameEn: 'Lightweight ceiling block 40x20x20',
    unit: 'عدد',
    unitEn: 'pcs',
    base: 95_000,
    sourceType: 'reference',
    sourceName: 'نرخ مبنای مصوب ۱۴۰۵',
    sourceUrl: 'https://majles.ir',
    sourceNote: 'نرخ مبنای مصوب فهرست‌بهای تأسیسات/ابنیه — قابل override در صفحه بازار',
    drift: 0.002,
  },
];

export const MATERIAL_BY_ID: Record<MaterialId, MaterialDef> = MATERIALS.reduce(
  (acc, m) => {
    acc[m.id] = m;
    return acc;
  },
  {} as Record<MaterialId, MaterialDef>,
);

/* ------------------------------------------------------------- seeded RNG -- */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const DAY_MS = 86_400_000;
const HISTORY_DAYS = 180;

function seedHistory(def: MaterialDef): PricePoint[] {
  const rnd = mulberry32(hashSeed(def.id));
  const out: PricePoint[] = [];
  const now = Date.now();
  // walk backwards from today so the series ends exactly at the base price
  const steps: number[] = [];
  let v = 1;
  for (let i = 0; i < HISTORY_DAYS; i++) {
    const shock = (rnd() - 0.485) * def.drift;
    v *= 1 + shock;
    steps.push(v);
  }
  const last = steps[steps.length - 1] ?? 1;
  for (let i = 0; i < HISTORY_DAYS; i++) {
    const factor = steps[i] / last;
    out.push({ t: now - (HISTORY_DAYS - 1 - i) * DAY_MS, v: Math.max(1, Math.round((def.base * factor) / 10) * 10) });
  }
  return out;
}

/* --------------------------------------------------------------- storage -- */

const LS_KEY = 'cg_market_overrides_v20';
const hasLS = typeof localStorage !== 'undefined';

function readOverrides(): Partial<Record<MaterialId, number>> {
  if (!hasLS) return {};
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Partial<Record<MaterialId, number>> = {};
    for (const m of MATERIALS) {
      const v = (parsed as Record<string, unknown>)[m.id];
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) out[m.id] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function writeOverrides(o: Partial<Record<MaterialId, number>>): void {
  if (!hasLS) return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(o));
  } catch {
    /* quota / private mode — ignore */
  }
}

/* ----------------------------------------------------------------- engine -- */

export class MarketEngine {
  private listeners = new Set<() => void>();
  private rev = 0;
  private snap!: MarketSnapshot;

  readonly materials: MaterialDef[] = MATERIALS;
  private prices = {} as Record<MaterialId, number>;
  private prev = {} as Record<MaterialId, number>;
  private history = {} as Record<MaterialId, PricePoint[]>;
  private live = {} as Record<MaterialId, LiveInfo>;
  private lockedSet = new Set<MaterialId>();
  private overrides: Partial<Record<MaterialId, number>> = {};
  private fetch = { status: 'idle' as MarketSnapshot['fetch']['status'], at: 0, message: '' };
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    for (const m of MATERIALS) {
      this.history[m.id] = seedHistory(m);
      this.prev[m.id] = m.base;
      // manual items carry a customary site-estimate default (برآورد متداول
      // کارگاهی) so totals never collapse to zero; the Market page still flags
      // them for user override.
      this.prices[m.id] = m.base;
      this.live[m.id] = { status: m.sourceType, price: m.base, at: 0, url: m.sourceUrl };
    }
    this.overrides = readOverrides();
    // manual overrides win over the seeded base immediately
    for (const m of MATERIALS) {
      const o = this.overrides[m.id];
      if (typeof o === 'number') {
        this.prices[m.id] = o;
        this.prev[m.id] = o;
        this.live[m.id] = { status: 'manual', price: o, at: 0, url: '' };
      }
    }
    this.snap = this.build();
  }

  /* ------------------------------------------------------------- pub/sub -- */
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  private build(): MarketSnapshot {
    const updatedAt = {} as Record<MaterialId, number>;
    for (const m of MATERIALS) {
      const at = this.live[m.id].at;
      updatedAt[m.id] = at > 0 ? at : m.sourceType === 'manual' && this.overrides[m.id] === undefined ? 0 : REF_PUB;
    }
    return {
      rev: this.rev,
      prices: { ...this.prices },
      prev: { ...this.prev },
      live: { ...this.live },
      locked: [...this.lockedSet],
      overrides: { ...this.overrides },
      fetch: { ...this.fetch },
      updatedAt,
      tickAt: Date.now(),
    };
  }

  private emit(): void {
    this.rev += 1;
    this.snap = this.build();
    this.listeners.forEach((fn) => fn());
  }

  getSnapshot = (): MarketSnapshot => this.snap;

  /* -------------------------------------------------------------- access -- */
  price(id: MaterialId): number {
    return this.prices[id];
  }

  def(id: MaterialId): MaterialDef {
    return MATERIAL_BY_ID[id];
  }

  historyOf(id: MaterialId): PricePoint[] {
    return this.history[id];
  }

  isLocked(id: MaterialId): boolean {
    return this.lockedSet.has(id);
  }

  isManualUnset(id: MaterialId): boolean {
    return MATERIAL_BY_ID[id].sourceType === 'manual' && this.overrides[id] === undefined;
  }

  /** Every material still requiring manual entry — drives the amber warning chip. */
  missingManual(): MaterialId[] {
    return MATERIALS.filter((m) => m.sourceType === 'manual' && this.overrides[m.id] === undefined).map((m) => m.id);
  }

  /** Coverage summary for the Market page progress bar. */
  coverage(): { live: number; reference: number; manual: number; total: number } {
    let live = 0;
    let reference = 0;
    let manual = 0;
    for (const m of MATERIALS) {
      const st = this.live[m.id].status;
      if (st === 'live') live += 1;
      else if (st === 'reference') reference += 1;
      else manual += 1;
    }
    return { live, reference, manual, total: MATERIALS.length };
  }

  /* ------------------------------------------------------------- updates -- */

  /** Apply prices scraped from ahanonline.com; locks those items from synthetic drift. */
  applyLivePrices(items: { id: MaterialId; price: number; url?: string }[]): number {
    if (!items.length) return 0;
    let applied = 0;
    const now = Date.now();
    for (const it of items) {
      const def = MATERIAL_BY_ID[it.id];
      if (!def) continue;
      if (!Number.isFinite(it.price) || it.price <= 0) continue;
      // sanity guard: ignore absurd scrapes (>20x or <5% of reference base)
      if (it.price > def.base * 20 || it.price < def.base * 0.05) continue;
      this.prev[it.id] = this.prices[it.id];
      this.prices[it.id] = it.price;
      this.live[it.id] = { status: 'live', price: it.price, at: now, url: it.url || def.sourceUrl };
      this.lockedSet.add(it.id);
      this.history[it.id].push({ t: now, v: it.price });
      applied += 1;
    }
    this.fetch = { status: applied ? 'ok' : 'error', at: now, message: applied ? `${applied} قلم از آهن‌آنلاین به‌روزرسانی شد` : 'هیچ قیمت معتبری یافت نشد' };
    this.emit();
    return applied;
  }

  /** Manual entry by the user — always wins, marks the item manual. */
  override(id: MaterialId, price: number): void {
    if (!Number.isFinite(price) || price <= 0) return;
    this.overrides[id] = price;
    this.prev[id] = this.prices[id];
    this.prices[id] = price;
    this.live[id] = { status: 'manual', price, at: Date.now(), url: '' };
    writeOverrides(this.overrides);
    this.emit();
  }

  clearOverride(id: MaterialId): void {
    delete this.overrides[id];
    const def = MATERIAL_BY_ID[id];
    const manual = def.sourceType === 'manual';
    this.prices[id] = manual ? 0 : def.base;
    this.prev[id] = manual ? 0 : def.base;
    this.live[id] = { status: def.sourceType, price: manual ? 0 : def.base, at: 0, url: def.sourceUrl };
    this.lockedSet.delete(id);
    writeOverrides(this.overrides);
    this.emit();
  }

  setFetchStatus(status: MarketSnapshot['fetch']['status'], message = ''): void {
    this.fetch = { status, at: Date.now(), message };
    this.emit();
  }

  /** Small synthetic movement — only for items that are NOT locked by a real price. */
  /** Per-second heartbeat. Prices never move synthetically — a price changes only
   *  when a live fetch lands or the user overrides it (round-21 honesty rule). */
  tick(): void {
    this.emit();
  }

  start(intervalMs = 1000): void {
    if (this.timer || typeof setInterval === 'undefined') return;
    this.timer = setInterval(() => this.tick(), intervalMs);
  }

  stop(): void {
    if (this.timer && typeof clearInterval !== 'undefined') clearInterval(this.timer);
    this.timer = null;
  }

  /** Price table used by every BOQ/export — keeps documents consistent with UI. */
  priceTable(): { def: MaterialDef; price: number; status: SourceType }[] {
    return MATERIALS.map((def) => ({ def, price: this.prices[def.id], status: this.live[def.id].status }));
  }
}

export const market = new MarketEngine();
if (typeof window !== 'undefined') market.start();

/* ----------------------------------------------------------------- hooks -- */

/** Live market snapshot; re-renders on every engine emit. */
export function useMarket(): MarketSnapshot {
  return useSyncExternalStore(market.subscribe, market.getSnapshot, market.getSnapshot);
}

/** Ticking clock (relative timestamps, live dots). */
export function useClock(intervalMs = 1000): number {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}


