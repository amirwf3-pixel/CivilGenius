
/* ============================================================================
 * CivilGenius v20 — formatting layer
 * Persian numerals, Jalali (Persian) calendar, engineering number helpers.
 *
 * CRITICAL: the locale tag "en-u-ca-persian-u-nu-latn" is INVALID in many
 * browsers and throws RangeError, which used to kill the compute flow
 * (button stuck spinning). All Jalali formatting here uses "fa-IR-u-nu-latn"
 * (Latin digits, Persian calendar) or "fa-IR" (Persian digits).
 * ========================================================================== */

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'] as const;
const FA_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
] as const;

/** Convert ASCII digits of any string/number to Persian digits. */
export function toFa(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

/** Convert Persian/Arabic digits back to ASCII digits. */
export function toEn(value: string): string {
  return String(value)
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d as (typeof FA_DIGITS)[number])))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

/** Grouped number with Persian digits. */
export function faNum(value: number, fractionDigits = 0): string {
  if (!Number.isFinite(value)) return '—';
  const s = value.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  return toFa(s);
}

/** Money with a Toman suffix. */
export function faMoney(value: number, unit = 'تومان'): string {
  return `${faNum(Math.round(value))} ${unit}`;
}

/** Compact money for tickers/cards: ۸۵٬۹۱۰ → ۸۵٫۹ هزار تومان */
export function faCompactToman(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${faNum(value / 1_000_000_000, 2)} میلیارد`;
  if (abs >= 1_000_000) return `${faNum(value / 1_000_000, 2)} میلیون`;
  if (abs >= 1_000) return `${faNum(value / 1_000, 1)} هزار`;
  return faNum(value);
}

export function faPercent(value: number, fractionDigits = 1): string {
  if (!Number.isFinite(value)) return '—';
  return `${faNum(value, fractionDigits)}٪`;
}

/** Relative time in Persian ("۴ دقیقه پیش"). */
export function faAgo(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const s = Math.floor(ms / 1000);
  if (s < 45) return `${faNum(Math.max(s, 1))} ثانیه پیش`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${faNum(m)} دقیقه پیش`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${faNum(h)} ساعت پیش`;
  const d = Math.floor(h / 24);
  return `${faNum(d)} روز پیش`;
}

export interface JalaliParts {
  year: number;
  month: number; // 1..12
  day: number;
  monthName: string;
}

/** Decompose a Date into Jalali parts using the Intl Persian calendar. */
export function jalaliParts(date: Date = new Date()): JalaliParts {
  const parts = new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
    calendar: 'persian',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    numberingSystem: 'latn',
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0');
  const year = get('year');
  const month = Math.min(12, Math.max(1, get('month')));
  return { year, month, day: get('day'), monthName: FA_MONTHS[month - 1] };
}

/** "۱۹ شهریور ۱۴۰۵" */
export function jalaliDate(date: Date = new Date()): string {
  const p = jalaliParts(date);
  return toFa(`${p.day} ${p.monthName} ${p.year}`);
}

/** "19 Shahrivar 1405" — Latin digits, used in filenames alongside the Persian part. */
export function jalaliDateLatin(date: Date = new Date()): string {
  const p = jalaliParts(date);
  return `${p.day} ${p.monthName} ${p.year}`;
}

/** Filename-safe Jalali slug: ۱۹-شهریور-۱۴۰۵ */
export function jalaliSlug(date: Date = new Date()): string {
  const p = jalaliParts(date);
  return toFa(`${p.day}-${p.monthName}-${p.year}`);
}

/** numeric Persian Jalali slug for standardized archive names: ۱۴۰۵_۰۶_۱۹ */
export function jalaliNumSlug(date: Date = new Date()): string {
  const p = jalaliParts(date);
  const m = String(p.month).padStart(2, '0');
  const d = String(p.day).padStart(2, '0');
  return toFa(`${p.year}_${m}_${d}`);
}

/** "۱۹ شهریور ۱۴۵ — ۱۴:۲۳" (Jalali date + 24h time). ms=0 → "—". */
export function faStamp(ms: number): string {
  if (!ms) return '—';
  const d = new Date(ms);
  const date = jalaliDate(d);
  const time = new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit', numberingSystem: 'latn' }).format(d);
  return `${date} — ${time}`;
}

/** "۱۴:۲۳:۰۵" live clock. */
export function faClock(ms: number): string {
  return new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit', numberingSystem: 'latn' }).format(new Date(ms));
}

/** "1405/06/19" */
export function jalaliISO(date: Date = new Date()): string {
  const p = jalaliParts(date);
  return `${p.year}/${String(p.month).padStart(2, '0')}/${String(p.day).padStart(2, '0')}`;
}

/**
 * Project code, e.g. "PRJ-FND-050619-K4X9".
 * Uses fa-IR-u-nu-latn (the verified-safe locale) — never the old invalid tag.
 */
export function projectCode(prefix: string, date: Date = new Date()): string {
  const p = jalaliParts(date);
  const stamp = `${String(p.year).slice(2)}${String(p.month).padStart(2, '0')}${String(p.day).padStart(2, '0')}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PRJ-${prefix.toUpperCase()}-${stamp}-${rand}`;
}

/* ------------------------------------------------------------------ math -- */

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function round(v: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

/** Engineering number with unit, Persian digits. */
export function faUnit(value: number, unit: string, fractionDigits = 2): string {
  return `${faNum(value, fractionDigits)} ${unit}`;
}

/** Parse a user-typed number that may contain Persian digits / thousands separators. */
export function parseNum(raw: string): number {
  const cleaned = toEn(String(raw)).replace(/[٬،,\s]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}


