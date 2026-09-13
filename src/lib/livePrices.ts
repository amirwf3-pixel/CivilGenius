
/* ============================================================================
 * CivilGenius v20 — ahanonline.com live-price connector
 *
 * Strategy (round 2/3):
 *   1. Fetch category pages through a chain of CORS proxies
 *      (allorigins -> corsproxy -> codetabs -> direct).
 *   2. Parse WooCommerce output: JSON-LD first, then
 *      product-title + price pairing, then a generic regex fallback.
 *   3. Filter by material keyword + a sane price window, preferring
 *      "ذوب‌آهن اصفهان A3 نورد گرم".
 *   4. Cache in localStorage for 6 hours; refresh silently at boot.
 *
 * Everything is guarded so the module also loads in Node (artifact scripts).
 * ========================================================================== */

import { market, type MaterialId } from './market';

export interface LiveTarget {
  id: MaterialId;
  urls: string[];
  keywords: string[];
  prefer: string[];
  min: number;
  max: number;
}

/** Real category slugs on ahanonline.com (verified during round 3). */
export const TARGETS: LiveTarget[] = [
  {
    id: 'rebar',
    urls: [
      'https://ahanonline.com/product-category/ahan-alat/milgerd/',
      'https://ahanonline.com/product-category/milgerd/',
    ],
    keywords: ['میلگرد', 'milgerd', 'rebar'],
    prefer: ['ذوب', 'zob', 'A3', 'نورد گرم', '14'],
    min: 20_000,
    max: 400_000,
  },
  {
    id: 'ibeam',
    urls: [
      'https://ahanonline.com/product-category/ahan-alat/tir-ahan/',
      'https://ahanonline.com/product-category/tir-ahan/',
    ],
    keywords: ['تیرآهن', 'IPE', 'tir-ahan'],
    prefer: ['ذوب', 'IPE', '14'],
    min: 20_000,
    max: 400_000,
  },
  {
    id: 'sheet',
    urls: [
      'https://ahanonline.com/product-category/ahan-alat/varagh-siah/',
      'https://ahanonline.com/product-category/varagh/',
    ],
    keywords: ['ورق', 'varagh', 'sheet'],
    prefer: ['سیاه', 'ST37', 'مبارکه'],
    min: 20_000,
    max: 600_000,
  },
];

const PROXIES: ((u: string) => string)[] = [
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  (u) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(u)}`,
  (u) => u,
];

const CACHE_KEY = 'cg_live_prices_v20';
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

export interface LiveHit {
  id: MaterialId;
  title: string;
  price: number;
  url: string;
  via: string;
}

const hasDOM = typeof window !== 'undefined' && typeof document !== 'undefined';

async function fetchViaProxy(url: string, timeoutMs = 12_000): Promise<{ html: string; via: string } | null> {
  if (typeof fetch === 'undefined') return null;
  for (const make of PROXIES) {
    const proxied = make(url);
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(proxied, { signal: ctrl.signal, headers: { Accept: 'text/html,*/*' } });
      clearTimeout(timer);
      if (!res.ok) continue;
      const html = await res.text();
      if (html && html.length > 500) return { html, via: new URL(proxied).hostname };
    } catch {
      /* try the next proxy */
    }
  }
  return null;
}

/* ------------------------------------------------------------------ parse -- */

interface Candidate {
  title: string;
  price: number;
}

/** Parse Persian/Arabic digits and thousand separators out of a price string. */
export function parsePrice(raw: string): number {
  const cleaned = String(raw)
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[٬،,\s_]/g, '');
  const m = /(\d+(?:\.\d+)?)/.exec(cleaned);
  return m ? Number(m[1]) : NaN;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&zwnj;|&#8204;/g, '\u200c')
    .replace(/<[^>]+>/g, '')
    .trim();
}

/** JSON-LD "@graph" / ItemList / Product offers. */
function parseJsonLd(html: string): Candidate[] {
  const out: Candidate[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const data = JSON.parse(m[1]) as unknown;
      const stack: unknown[] = [data];
      while (stack.length) {
        const node = stack.pop() as Record<string, unknown> | unknown[] | undefined;
        if (!node || typeof node !== 'object') continue;
        if (Array.isArray(node)) {
          stack.push(...node);
          continue;
        }
        const rec = node as Record<string, unknown>;
        if (rec['@graph']) stack.push(rec['@graph']);
        if (rec.itemListElement) stack.push(rec.itemListElement);
        if (rec.item) stack.push(rec.item);
        const offers = (rec.offers ?? rec.Offers) as Record<string, unknown> | undefined;
        if (typeof rec.name === 'string' && offers) {
          const price = parsePrice(String(offers.price ?? offers.lowPrice ?? ''));
          if (Number.isFinite(price)) out.push({ title: String(rec.name), price });
        }
      }
    } catch {
      /* malformed JSON-LD block — ignore */
    }
  }
  return out;
}

/** WooCommerce list markup: product title next to an amount. */
function parseDomPairs(html: string): Candidate[] {
  const out: Candidate[] = [];
  const blocks = html.split(/<li[^>]*class="[^"]*product[^"]*"/i).slice(1);
  for (const block of blocks) {
    const title = /class="[^"]*(?:woocommerce-loop-product__title|product-title)[^"]*"[^>]*>([\s\S]*?)<\/h2>|<h2[^>]*>([\s\S]*?)<\/h2>/i.exec(block);
    const price = /class="[^"]*(?:woocommerce-Price-amount|amount)[^"]*"[^>]*>([\s\S]*?)</i.exec(block);
    const t = decodeEntities(title?.[1] ?? title?.[2] ?? '');
    const p = parsePrice(price?.[1] ?? '');
    if (t && Number.isFinite(p)) out.push({ title: t, price: p });
  }
  return out;
}

/** Generic fallback: any "…تومان… <digits>" pair near a known keyword. */
function parseRegexFallback(html: string, keywords: string[]): Candidate[] {
  const out: Candidate[] = [];
  const text = decodeEntities(html);
  const re = /([^\n<>{}]{4,90}?)\s*(?:[:\-–—]\s*)?([\d۰-۹٠-٩٬،,]{4,14})\s*تومان/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const title = m[1].trim();
    const price = parsePrice(m[2]);
    if (!Number.isFinite(price)) continue;
    if (keywords.length && !keywords.some((k) => title.toLowerCase().includes(k.toLowerCase()))) continue;
    out.push({ title, price });
  }
  return out;
}

function score(hit: Candidate, target: LiveTarget): number {
  let s = 0;
  const t = hit.title.toLowerCase();
  if (hit.price < target.min || hit.price > target.max) return -1;
  if (!target.keywords.some((k) => t.includes(k.toLowerCase()))) return -1;
  target.prefer.forEach((p, i) => {
    if (t.includes(p.toLowerCase())) s += target.prefer.length - i;
  });
  return s;
}

/** Fetch + parse every target; returns the best hit per material. */
export async function fetchLivePrices(): Promise<LiveHit[]> {
  const hits: LiveHit[] = [];
  for (const target of TARGETS) {
    let candidates: Candidate[] = [];
    let via = '';
    for (const url of target.urls) {
      const got = await fetchViaProxy(url);
      if (!got) continue;
      via = got.via;
      candidates = [...parseJsonLd(got.html), ...parseDomPairs(got.html)];
      if (!candidates.length) candidates = parseRegexFallback(got.html, target.keywords);
      if (candidates.length) break;
    }
    const ranked = candidates
      .map((c) => ({ c, s: score(c, target) }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => b.s - a.s);
    if (ranked.length) {
      const best = ranked[0];
      hits.push({
        id: target.id,
        title: best.c.title,
        price: best.c.price,
        url: target.urls[0],
        via,
      });
    }
  }
  return hits;
}

/* ----------------------------------------------------------------- cache -- */

interface CacheShape {
  at: number;
  hits: LiveHit[];
}

function readCache(): CacheShape | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheShape;
    if (!parsed?.hits || Date.now() - parsed.at > CACHE_TTL) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(hits: LiveHit[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), hits } satisfies CacheShape));
  } catch {
    /* ignore */
  }
}

export interface LiveRefreshResult {
  applied: number;
  fromCache: boolean;
  hits: LiveHit[];
  message: string;
}

/** Full refresh: cache first, then network. Applies hits to the MarketEngine. */
export async function refreshLivePrices(opts: { force?: boolean } = {}): Promise<LiveRefreshResult> {
  if (!hasDOM) return { applied: 0, fromCache: false, hits: [], message: 'خارج از مرورگر' };
  market.setFetchStatus('loading', 'در حال استعلام از آهن‌آنلاین…');
  const cached = opts.force ? null : readCache();
  if (cached && !opts.force) {
    const applied = market.applyLivePrices(cached.hits.map((h) => ({ id: h.id, price: h.price, url: h.url })));
    market.setFetchStatus('ok', `${applied} قلم از حافظه نهان (تا ۶ ساعت)`);
    return { applied, fromCache: true, hits: cached.hits, message: 'از حافظه نهان' };
  }
  try {
    const hits = await fetchLivePrices();
    if (!hits.length) {
      market.setFetchStatus('error', 'دسترسی مستقیم به آهن‌آنلاین ممکن نشد — از مبنای معتبر استفاده شد');
      return { applied: 0, fromCache: false, hits: [], message: 'خطا در استعلام' };
    }
    const applied = market.applyLivePrices(hits.map((h) => ({ id: h.id, price: h.price, url: h.url })));
    writeCache(hits);
    market.setFetchStatus('ok', `${applied} قلم از آهن‌آنلاین به‌روزرسانی شد`);
    return { applied, fromCache: false, hits, message: 'استعلام موفق' };
  } catch {
    market.setFetchStatus('error', 'خطای شبکه در استعلام قیمت');
    return { applied: 0, fromCache: false, hits: [], message: 'خطای شبکه' };
  }
}

/** Silent boot refresh — never throws, never blocks the UI. */
export function initLivePrices(): void {
  if (!hasDOM) return;
  void refreshLivePrices().catch(() => undefined);
}


