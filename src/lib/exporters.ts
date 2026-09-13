
/* ============================================================================
 * CivilGenius v20 — document exporters
 *   buildExcelBlob  : styled RTL workbook (xlsx-js-style)
 *   buildWordBlob   : complete Persian technical report (docx)
 *   buildDxfBlob    : AutoCAD R2010 (AC1024) drawing with title block
 *   docName()       : dual-language filename + Jalali date
 *   exportAllBundle : sequential 3-file delivery
 *
 * All three builders are pure (Blob in / Blob out) so they can be executed
 * head-lessly by `npm run artifacts` — the files shipped in /deliverables are
 * produced by exactly this code path.
 * ========================================================================== */

import type * as XLSXT from 'xlsx-js-style';
import * as XLSXNS from 'xlsx-js-style';

/**
 * CJS interop: xlsx-js-style ships a UMD bundle, so under Node ESM the
 * namespace only exposes `default`. Vite exposes both. Resolve once here so the
 * same builder runs in the browser AND in `npm run artifacts`.
 */
const XLSX: typeof XLSXT = (XLSXNS as unknown as { default?: typeof XLSXT }).default ?? XLSXNS;
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableLayoutType,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
import type { CalcResult, PricedRow } from './engine';
import { CALC_META, pmKeyPoints } from './engine';
import { faNum, faStamp, jalaliDate, jalaliISO, jalaliNumSlug, toFa } from './format';
import type { MaterialDef, SourceType } from './market';
import { MATERIAL_BY_ID, market } from './market';
import { buildDxfText } from './dxf';
import { blobToDataUrl, downloadBlobDirect, vaultPut, type VaultDoc } from './fileio';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const DXF_MIME = 'application/dxf';

export const APP_NAME = 'CivilGenius';
export const APP_VERSION = 'v24';

/* --------------------------------------------------------------- payload -- */

export interface PriceRow {
  def: MaterialDef;
  price: number;
  status: SourceType;
  fetchedAt?: number;
}

export interface ExportPayload {
  result: CalcResult;
  rows: PricedRow[];
  total: number;
  prices: PriceRow[];
  projectName: string;
  client?: string;
}

const STATUS_FA: Record<SourceType, string> = {
  live: 'لحظه‌ای (آهن‌آنلاین)',
  reference: 'مبنای معتبر',
  manual: 'ورود دستی',
};

/* ------------------------------------------------------------- filenames -- */

export type DocKind = 'boq' | 'report' | 'drawing' | 'procurement';

const KIND_META: Record<DocKind, { ext: 'xlsx' | 'docx' | 'dxf'; fa: string; en: string; mime: string }> = {
  boq: { ext: 'xlsx', fa: 'متره_برآورد', en: 'BOQ', mime: XLSX_MIME },
  report: { ext: 'docx', fa: 'گزارش_فنی', en: 'Technical-Report', mime: DOCX_MIME },
  drawing: { ext: 'dxf', fa: 'خروجی_طراحی', en: 'Drawing', mime: DXF_MIME },
  procurement: { ext: 'xlsx', fa: 'جدول_خرید', en: 'Procurement', mime: XLSX_MIME },
};

/**
 * Standardized dated bilingual archive names (round-30):
 * CivilGenius_Column_خروجی_طراحی_ستون_۱۴۰۵_۰۶_۱۹.dxf
 * CivilGenius_Foundation_متره_برآورد_فونداسیون_۱۴۰۵_۰۶_۱۹.xlsx
 * CivilGenius_Beam_گزارش_فنی_تیر_۱۴۰۵_۰۶_۱۹.docx
 */
export function docName(type: CalcResult['type'], kind: DocKind, date: Date = new Date()): string {
  const meta = CALC_META[type];
  const k = KIND_META[kind];
  return `${APP_NAME}_${meta.titleEn}_${k.fa}_${meta.title}_${jalaliNumSlug(date)}.${k.ext}`;
}

/** CivilGenius_برنامه-خرید-مصالح_۱۴۰۵_۰۶_۱۹.xlsx */
export function procurementDocName(date: Date = new Date()): string {
  return `${APP_NAME}_برنامه_خرید_مصالح_${jalaliNumSlug(date)}.xlsx`;
}

export function docTitle(kind: DocKind): string {
  // file names use underscores; human-readable titles use a ZWNJ space
  return KIND_META[kind].fa.replace(/_/g, '\u200c');
}

export function docMime(kind: DocKind): string {
  return KIND_META[kind].mime;
}

/* ======================================================================== */
/*  1) EXCEL                                                                 */
/* ======================================================================== */

const NAVY = '0E3A34';
const GREEN = '0F5257';
const GOLD = 'C9A227';
const LINE = 'E7E9EE';
const SOFT = 'F7F8FA';
const INK = '101828';
const MUTED = '667085';

type CellStyle = {
  font?: { name?: string; sz?: number; bold?: boolean; color?: { rgb: string }; italic?: boolean };
  alignment?: { horizontal?: 'left' | 'center' | 'right'; vertical?: 'center' | 'top' | 'bottom'; wrapText?: boolean };
  fill?: { fgColor?: { rgb: string }; patternType?: string };
  border?: Record<'top' | 'bottom' | 'left' | 'right', { style: string; color: { rgb: string } }>;
};

const FONT = 'Vazirmatn';

function border(color = LINE, style = 'thin'): CellStyle['border'] {
  return {
    top: { style, color: { rgb: color } },
    bottom: { style, color: { rgb: color } },
    left: { style, color: { rgb: color } },
    right: { style, color: { rgb: color } },
  };
}

function cell(
  v: string | number,
  s: CellStyle = {},
  opts: { z?: string; f?: string; t?: 's' | 'n' } = {},
): XLSXT.CellObject {
  const base: CellStyle = {
    font: { name: FONT, sz: 11, color: { rgb: INK } },
    alignment: { horizontal: 'right', vertical: 'center', wrapText: true },
    border: border(),
    ...s,
  };
  return {
    v,
    t: opts.t ?? (typeof v === 'number' ? 'n' : 's'),
    s: base,
    ...(opts.z ? { z: opts.z } : {}),
    ...(opts.f ? { f: opts.f } : {}),
  } as XLSXT.CellObject;
}


/**
 * Enable the right-to-left sheet view.
 *
 * IMPORTANT: the flag lives at wb.Workbook.Views[0].RTL — the writer emits
 * <sheetView rightToLeft="1"> from exactly that path. The shorthand
 * "wb.Views = [{RTL:true}]" (used in the v20 handoff notes) is silently
 * ignored by SheetJS and produces a left-to-right sheet, which is why the
 * exported BOQ opened LTR. Verified with openpyxl after the fix.
 */
/** Auto-fit column widths from content so every Persian string is fully visible. */
function autofit(ws: XLSXT.WorkSheet, aoa: XLSXT.CellObject[][], min = 10, max = 60): void {
  const widths: number[] = [];
  for (const row of aoa) {
    row.forEach((c, ci) => {
      const len = c && c.v != null ? String(c.v).length : 0;
      widths[ci] = Math.max(widths[ci] ?? 0, len);
    });
  }
  ws['!cols'] = widths.map((n) => ({ wch: Math.min(max, Math.max(min, Math.round(n * 1.12) + 2)) }));
}

/** Uniform thousands-separator formatting: every numeric cell gets #,##0 (or
 *  #,##0.00 for fractional values) unless it already carries a format. */
function normNums(ws: XLSXT.WorkSheet): void {
  for (const addr of Object.keys(ws)) {
    if (addr.startsWith('!')) continue;
    const c = ws[addr] as XLSXT.CellObject;
    if (c && c.t === 'n' && typeof c.v === 'number' && !c.z) {
      c.z = Number.isInteger(c.v) ? '#,##0' : '#,##0.00';
    }
  }
}

function setRtl(wb: XLSXT.WorkBook): void {
  const props = (wb.Workbook ?? {}) as XLSXT.WBProps;
  props.Views = [{ RTL: true }];
  wb.Workbook = props;
}

export function buildExcelWorkbook(payload: ExportPayload): XLSXT.WorkBook {
  const { result, rows, total, prices, projectName, client } = payload;
  const meta = CALC_META[result.type];
  const today = jalaliDate();

  const wb = XLSX.utils.book_new();

  /* ---------------------------------------------------------- sheet 1: BOQ */
  const aoa: XLSXT.CellObject[][] = [];
  const merges: XLSXT.Range[] = [];
  const rowHeights: Partial<XLSXT.RowInfo>[] = [];

  const addRow = (cells: XLSXT.CellObject[], hpt?: number) => {
    aoa.push(cells);
    rowHeights.push(hpt ? { hpt } : {});
    return aoa.length - 1;
  };
  const merge = (r1: number, c1: number, r2: number, c2: number) =>
    merges.push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } });

  // title band
  addRow([
    cell(`${APP_NAME} ${APP_VERSION} — متره و برآورد ${meta.title}`, {
      font: { name: FONT, sz: 16, bold: true, color: { rgb: 'FFFFFF' } },
      alignment: { horizontal: 'right', vertical: 'center' },
      fill: { fgColor: { rgb: NAVY }, patternType: 'solid' },
    }),
  ], 30);
  merge(0, 0, 0, 7);

  addRow([
    cell(`${projectName}${client ? ` — کارفرما: ${client}` : ''}   |   تاریخ: ${today}   |   کد سند: ${result.code}`, {
      font: { name: FONT, sz: 10, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '14544A' }, patternType: 'solid' },
    }),
  ], 20);
  merge(1, 0, 1, 7);

  addRow([], 6);

  // header
  const headIdx = addRow(
    [
      cell('ردیف', { font: { name: FONT, sz: 11, bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: NAVY }, patternType: 'solid' }, alignment: { horizontal: 'center' } }),
      cell('شرح عملیات', { font: { name: FONT, sz: 11, bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: NAVY }, patternType: 'solid' } }),
      cell('واحد', { font: { name: FONT, sz: 11, bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: NAVY }, patternType: 'solid' }, alignment: { horizontal: 'center' } }),
      cell('مقدار', { font: { name: FONT, sz: 11, bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: NAVY }, patternType: 'solid' }, alignment: { horizontal: 'center' } }),
      cell('فی (تومان)', { font: { name: FONT, sz: 11, bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: NAVY }, patternType: 'solid' }, alignment: { horizontal: 'center' } }),
      cell('مبلغ کل (تومان)', { font: { name: FONT, sz: 11, bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: NAVY }, patternType: 'solid' }, alignment: { horizontal: 'center' } }),
      cell('منبع قیمت', { font: { name: FONT, sz: 11, bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: NAVY }, patternType: 'solid' }, alignment: { horizontal: 'center' } }),
      cell('توضیحات', { font: { name: FONT, sz: 11, bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: NAVY }, patternType: 'solid' } }),
    ],
    26,
  );

  rows.forEach((r, i) => {
    const zebra = i % 2 === 1;
    const fillStyle: CellStyle['fill'] = zebra ? { fgColor: { rgb: SOFT }, patternType: 'solid' } : undefined;
    const base: CellStyle = { ...(fillStyle ? { fill: fillStyle } : {}) };
    addRow(
      [
        cell(i + 1, { ...base, alignment: { horizontal: 'center' } }, { z: '0' }),
        cell(r.title, base),
        cell(r.unit, { ...base, alignment: { horizontal: 'center' } }),
        cell(r.qty, { ...base, alignment: { horizontal: 'center' } }, { z: '#,##0.00' }),
        cell(r.unitPrice, base, { z: '#,##0' }),
        cell(r.amount, { ...base, font: { name: FONT, sz: 11, bold: true, color: { rgb: INK } } }, { z: '#,##0' }),
        cell(
          `${r.status === 'manual' && r.unitPrice <= 0 ? 'دستی وارد کنید' : `${r.sourceName} — ${STATUS_FA[r.status]}`}\nبروزرسانی: ${faStamp(market.getSnapshot().updatedAt[r.materialId])}`,
          { ...base, font: { name: FONT, sz: 9, color: { rgb: r.status === 'live' ? GREEN : r.status === 'manual' ? 'B54708' : MUTED } }, alignment: { vertical: 'top', wrapText: true } },
        ),
        cell(r.detail, { ...base, font: { name: FONT, sz: 9, color: { rgb: MUTED } } }),
      ],
      22,
    );
  });

  // total row (green)
  const totalIdx = addRow(
    [
      cell('جمع کل', {
        font: { name: FONT, sz: 13, bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: GREEN }, patternType: 'solid' },
        alignment: { horizontal: 'right' },
      }),
      cell(`مبلغ کل پروژه (${meta.title})`, {
        font: { name: FONT, sz: 13, bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: GREEN }, patternType: 'solid' },
      }),
      cell('', { fill: { fgColor: { rgb: GREEN }, patternType: 'solid' } }),
      cell('', { fill: { fgColor: { rgb: GREEN }, patternType: 'solid' } }),
      cell('', { fill: { fgColor: { rgb: GREEN }, patternType: 'solid' } }),
      cell(total, {
        font: { name: FONT, sz: 13, bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: GREEN }, patternType: 'solid' },
        alignment: { horizontal: 'center' },
      }, { z: '#,##0' }),
      cell('', { fill: { fgColor: { rgb: GREEN }, patternType: 'solid' } }),
      cell('', { fill: { fgColor: { rgb: GREEN }, patternType: 'solid' } }),
    ],
    28,
  );
  merge(totalIdx, 0, totalIdx, 1);

  // note row (gold)
  const noteIdx = addRow([
    cell(
      `قیمت‌های فولادی از ahanonline.com و قیمت‌های بتن/سیمان از منابع اعلام‌شده در برگه «منابع قیمت» اخذ شده است. اقلام «ورود دستی» تا زمان تکمیل، با نرخ پیشنهادی محاسبه شده‌اند.`,
      {
        font: { name: FONT, sz: 9, italic: true, color: { rgb: GOLD } },
        fill: { fgColor: { rgb: 'FDF3E3' }, patternType: 'solid' },
        border: border('F6DFB6'),
      },
    ),
  ], 30);
  merge(noteIdx, 0, noteIdx, 7);

  // summary metrics block
  addRow([], 8);
  addRow([
    cell('شاخص‌های مهندسی', {
      font: { name: FONT, sz: 12, bold: true, color: { rgb: NAVY } },
      alignment: { horizontal: 'right' },
    }),
  ], 22);
  merge(aoa.length - 1, 0, aoa.length - 1, 7);

  result.metrics.forEach((m) => {
    addRow(
      [
        cell(m.label, { font: { name: FONT, sz: 10, color: { rgb: MUTED } } }),
        cell(`${m.value} ${m.unit}`.trim(), {
          font: { name: FONT, sz: 11, bold: true, color: { rgb: m.tone === 'bad' ? 'D92D20' : m.tone === 'warn' ? 'B54708' : INK } },
          alignment: { horizontal: 'center' },
        }),
      ],
      18,
    );
    merge(aoa.length - 1, 2, aoa.length - 1, 7);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa as unknown[][]);
  ws['!merges'] = merges;
  ws['!rows'] = rowHeights as XLSXT.RowInfo[];
  // REAL live formulas: amount = qty*unit, grand total = SUM(amounts).
  const firstDataRow = headIdx + 2;
  const lastDataRow = headIdx + 1 + rows.length;
  rows.forEach((_r, i) => {
    const rn = firstDataRow + i;
    const c = ws[`F${rn}`];
    if (c) c.f = `D${rn}*E${rn}`;
  });
  const tCell = ws[`F${totalIdx + 1}`];
  if (tCell) tCell.f = `SUM(F${firstDataRow}:F${lastDataRow})`;
  normNums(ws);
  autofit(ws, aoa);
  // engineering-metrics block: give the label/value columns breathing room
  const bCols = ws['!cols'] ?? [];
  bCols[0] = { wch: Math.max(bCols[0]?.wch ?? 0, 30) };
  bCols[1] = { wch: Math.max(bCols[1]?.wch ?? 0, 26) };
  ws['!cols'] = bCols;
  XLSX.utils.book_append_sheet(wb, ws, 'متره و برآورد');

  /* ------------------------------------------------- sheet 2: price sources */
  const pAoa: XLSXT.CellObject[][] = [];
  const pMerges: XLSXT.Range[] = [];
  const pRows: Partial<XLSXT.RowInfo>[] = [];
  const pAdd = (cells: XLSXT.CellObject[], hpt?: number) => {
    pAoa.push(cells);
    pRows.push(hpt ? { hpt } : {});
    return pAoa.length - 1;
  };

  pAdd([
    cell('منابع قیمت — شفافیت کامل داده‌ها', {
      font: { name: FONT, sz: 15, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: NAVY }, patternType: 'solid' },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    }),
  ], 34);
  pMerges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } });

  pAdd([
    cell(`تاریخ سند: ${today}   |   ${jalaliISO()}   |   تولید: ${APP_NAME} ${APP_VERSION}`, {
      font: { name: FONT, sz: 10, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '14544A' }, patternType: 'solid' },
    }),
  ], 20);
  pMerges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 6 } });
  pAdd([], 6);

  pAdd(
    ['مصالح', 'واحد', 'قیمت (تومان)', 'وضعیت منبع', 'بروزرسانی', 'منبع / مرجع', 'یادداشت'].map((t) =>
      cell(t, {
        font: { name: FONT, sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: NAVY }, patternType: 'solid' },
        alignment: { horizontal: 'center' },
      }),
    ),
    26,
  );

  prices.forEach((p, i) => {
    const zebra = i % 2 === 1;
    const fillStyle: CellStyle['fill'] = zebra ? { fgColor: { rgb: SOFT }, patternType: 'solid' } : undefined;
    const base: CellStyle = fillStyle ? { fill: fillStyle } : {};
    pAdd(
      [
        cell(p.def.name, base),
        cell(p.def.unit, { ...base, alignment: { horizontal: 'center' } }),
        cell(p.price, base, { z: '#,##0' }),
        cell(STATUS_FA[p.status], {
          ...base,
          font: { name: FONT, sz: 10, bold: true, color: { rgb: p.status === 'live' ? GREEN : p.status === 'manual' ? 'B54708' : '2563EB' } },
          alignment: { horizontal: 'center' },
        }),
        cell(faStamp(market.getSnapshot().updatedAt[p.def.id]), { ...base, font: { name: FONT, sz: 9, color: { rgb: MUTED } }, alignment: { horizontal: 'center' } }),
        cell(p.def.sourceName + (p.def.sourceUrl ? ` (${p.def.sourceUrl})` : ''), {
          ...base,
          font: { name: FONT, sz: 9, color: { rgb: MUTED } },
        }),
        cell(p.def.sourceNote, { ...base, font: { name: FONT, sz: 9, color: { rgb: MUTED } } }),
      ],
      24,
    );
  });

  pAdd([], 6);
  pAdd([
    cell(
      'توضیح صداقت داده: اقلام با وضعیت «لحظه‌ای» در این نشست از ahanonline.com دریافت شده‌اند؛ اقلام «مبنای معتبر» بر اساس آخرین قیمت عمومی منبع اعلام‌شده هستند و اقلام «ورود دستی» قیمت عمومی ندارند و باید توسط کاربر تکمیل شوند.',
      {
        font: { name: FONT, sz: 9, italic: true, color: { rgb: '8a6d1a' } },
        fill: { fgColor: { rgb: 'FDF3E3' }, patternType: 'solid' },
      },
    ),
  ], 40);
  pMerges.push({ s: { r: pAoa.length - 1, c: 0 }, e: { r: pAoa.length - 1, c: 6 } });

  const ws2 = XLSX.utils.aoa_to_sheet(pAoa as unknown[][]);
  ws2['!merges'] = pMerges;
  ws2['!rows'] = pRows as XLSXT.RowInfo[];
  normNums(ws2);
  autofit(ws2, pAoa);
  XLSX.utils.book_append_sheet(wb, ws2, 'منابع قیمت');

  /* ------------------------------------------------------- sheet 3: ریزمتره */
  const rAoa: XLSXT.CellObject[][] = [];
  const rHeights: Partial<XLSXT.RowInfo>[] = [];
  const rAdd = (cells: XLSXT.CellObject[], hpt?: number) => {
    rAoa.push(cells);
    rHeights.push(hpt ? { hpt } : {});
    return rAoa.length - 1;
  };
  rAdd([cell(`ریزمتره — تفکیک مقادیر با ضریب باطله ۵٪ | ${projectName}`, { font: { name: FONT, sz: 14, bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: NAVY }, patternType: 'solid' }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true } })], 46);
  const rHead = rAdd(['شرح عملیات', 'واحد', 'مقدار خالص', 'ضریب', 'مقدار با باطله'].map((t) => cell(t, { font: { name: FONT, sz: 11, bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: NAVY }, patternType: 'solid' }, alignment: { horizontal: 'center' } })), 24);
  rows.forEach((r, i) => {
    const zebra = i % 2 === 1;
    const base: CellStyle = zebra ? { fill: { fgColor: { rgb: SOFT }, patternType: 'solid' } } : {};
    rAdd([
      cell(r.title, base),
      cell(r.unit, { ...base, alignment: { horizontal: 'center' } }),
      cell(r.qty, { ...base, alignment: { horizontal: 'center' } }, { z: '#,##0.00' }),
      cell(1.05, { ...base, alignment: { horizontal: 'center' } }, { z: '0.00' }),
      cell(r.qty * 1.05, { ...base, font: { name: FONT, sz: 11, bold: true, color: { rgb: INK } }, alignment: { horizontal: 'center' } }, { z: '#,##0.00' }),
    ], 20);
  });
  const rws = XLSX.utils.aoa_to_sheet(rAoa as unknown[][]);
  rws['!rows'] = rHeights as XLSXT.RowInfo[];
  rows.forEach((_r, i) => {
    const rn = rHead + 2 + i;
    const c = rws[`E${rn}`];
    if (c) c.f = `PRODUCT(C${rn},D${rn})`;
  });
  normNums(rws);
  autofit(rws, rAoa);
  XLSX.utils.book_append_sheet(wb, rws, 'ریزمتره');

  /* --------------------------------------------------- sheet 4: خلاصه برآورد */
  // «مقدار کل» هر گروه = SUM of the matching «مقدار با باطله» cells in ریزمتره
  // (live cross-sheet links — no hand-typed quantities)
  const sumAgg = new Map<string, { title: string; unit: string; qty: number; price: number; refs: number[] }>();
  rows.forEach((r, i) => {
    const cur = sumAgg.get(r.materialId) ?? { title: r.title, unit: r.unit, qty: 0, price: r.unitPrice, refs: [] };
    cur.qty += r.qty;
    cur.refs.push(3 + i); // ریزمتره Excel row of this BOQ line
    sumAgg.set(r.materialId, cur);
  });
  const sumList = [...sumAgg.values()];
  const wasteTotal = sumList.reduce((s, g) => s + g.qty * 1.05 * g.price, 0);
  const sAoa: XLSXT.CellObject[][] = [];
  const sHeights: Partial<XLSXT.RowInfo>[] = [];
  const sAdd = (cells: XLSXT.CellObject[], hpt?: number) => {
    sAoa.push(cells);
    sHeights.push(hpt ? { hpt } : {});
    return sAoa.length - 1;
  };
  sAdd([cell(`خلاصه برآورد بر اساس قیمت روز بازار | ${projectName}`, { font: { name: FONT, sz: 14, bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: NAVY }, patternType: 'solid' }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true } })], 60);
  const sHead = sAdd(['گروه مصالح', 'واحد', 'مقدار کل', 'فی (تومان)', 'مبلغ کل (تومان)'].map((t) => cell(t, { font: { name: FONT, sz: 11, bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: NAVY }, patternType: 'solid' }, alignment: { horizontal: 'center' } })), 24);
  sumList.forEach((g, i) => {
    const zebra = i % 2 === 1;
    const base: CellStyle = zebra ? { fill: { fgColor: { rgb: SOFT }, patternType: 'solid' } } : {};
    sAdd([
      cell(g.title, base),
      cell(g.unit, { ...base, alignment: { horizontal: 'center' } }),
      cell(g.qty * 1.05, { ...base, alignment: { horizontal: 'center' } }, { z: '#,##0.00' }),
      cell(g.price, { ...base, alignment: { horizontal: 'center' } }, { z: '#,##0' }),
      cell(g.qty * 1.05 * g.price, { ...base, font: { name: FONT, sz: 11, bold: true, color: { rgb: INK } }, alignment: { horizontal: 'center' } }, { z: '#,##0' }),
    ], 20);
  });
  const sTotalRow = sAdd([
    cell('جمع کل پروژه', { font: { name: FONT, sz: 13, bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: GREEN }, patternType: 'solid' } }),
    cell('', { fill: { fgColor: { rgb: GREEN }, patternType: 'solid' } }),
    cell('', { fill: { fgColor: { rgb: GREEN }, patternType: 'solid' } }),
    cell('', { fill: { fgColor: { rgb: GREEN }, patternType: 'solid' } }),
    cell(wasteTotal, { font: { name: FONT, sz: 13, bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: GREEN }, patternType: 'solid' }, alignment: { horizontal: 'center' } }, { z: '#,##0' }),
  ], 26);
  const sws = XLSX.utils.aoa_to_sheet(sAoa as unknown[][]);
  sws['!rows'] = sHeights as XLSXT.RowInfo[];
  sumList.forEach((g, i) => {
    const rn = sHead + 2 + i;
    const c = sws[`C${rn}`];
    // live link: group quantity = SUM of matching ریزمتره «مقدار با باطله» cells
    if (c) c.f = `SUM(${g.refs.map((x) => `'ریزمتره'!E${x}`).join(',')})`;
    const e = sws[`E${rn}`];
    if (e) e.f = `PRODUCT(C${rn},D${rn})`;
  });
  const st = sws[`E${sTotalRow + 1}`];
  if (st) st.f = `SUM(E${sHead + 2}:E${sHead + 1 + sumList.length})`;
  normNums(sws);
  autofit(sws, sAoa);
  XLSX.utils.book_append_sheet(wb, sws, 'خلاصه برآورد');

  // BBS sheet (لیستوفر) — round-33 polish: styled header, zebra, borders,
  // number formats, auto-fitted widths, RTL — identical design language to BOQ
  if (payload.result.bbs?.length) {
    const bAoa: XLSXT.CellObject[][] = [];
    const bHeights: Partial<XLSXT.RowInfo>[] = [];
    const bAdd = (cells: XLSXT.CellObject[], hpt?: number): number => {
      bAoa.push(cells);
      bHeights.push(hpt ? { hpt } : {});
      return bAoa.length - 1;
    };
    const bMerges: XLSXT.Range[] = [];
    const totalKg = payload.result.bbs.reduce((sm, b) => sm + b.weightKg, 0);
    bAdd([cell('لیستوفر — Bar Bending Schedule (BBS)', {
      font: { name: FONT, sz: 15, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: NAVY }, patternType: 'solid' },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    })], 34);
    bMerges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } });
    bAdd([cell(`${CALC_META[payload.result.type].title} — کد سند: ${payload.result.code} — تاریخ: ${jalaliDate()}`, {
      font: { name: FONT, sz: 10, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '14544A' }, patternType: 'solid' },
      alignment: { horizontal: 'center', vertical: 'center' },
    })], 20);
    bMerges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 5 } });
    bAdd(['مارک', 'شرح آرماتور', 'قطر (mm)', 'طول برش (mm)', 'تعداد', 'وزن (kg)'].map((t) =>
      cell(t, {
        font: { name: FONT, sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: NAVY }, patternType: 'solid' },
        alignment: { horizontal: 'center', vertical: 'center' },
      }),
    ), 24);
    payload.result.bbs.forEach((b, i) => {
      const base: CellStyle = i % 2 === 1 ? { fill: { fgColor: { rgb: SOFT }, patternType: 'solid' } } : {};
      bAdd([
        cell(b.mark, { ...base, font: { name: FONT, sz: 11, bold: true, color: { rgb: '14544A' } }, alignment: { horizontal: 'center' } }),
        cell(b.label, base),
        cell(b.dia, { ...base, alignment: { horizontal: 'center' } }, { z: '0' }),
        cell(Math.round(b.lenMm), { ...base, alignment: { horizontal: 'center' } }, { z: '#,##0' }),
        cell(b.count, { ...base, alignment: { horizontal: 'center' } }, { z: '#,##0' }),
        cell(+b.weightKg.toFixed(1), { ...base, font: { name: FONT, sz: 11, bold: true, color: { rgb: INK } }, alignment: { horizontal: 'center' } }, { z: '#,##0.0' }),
      ], 20);
    });
    bAdd([
      cell('جمع کل', { font: { name: FONT, sz: 12, bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: GREEN }, patternType: 'solid' }, alignment: { horizontal: 'center' } }),
      cell('', { fill: { fgColor: { rgb: GREEN }, patternType: 'solid' } }),
      cell('', { fill: { fgColor: { rgb: GREEN }, patternType: 'solid' } }),
      cell('', { fill: { fgColor: { rgb: GREEN }, patternType: 'solid' } }),
      cell('', { fill: { fgColor: { rgb: GREEN }, patternType: 'solid' } }),
      cell(+totalKg.toFixed(1), { font: { name: FONT, sz: 12, bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: GREEN }, patternType: 'solid' }, alignment: { horizontal: 'center' } }, { z: '#,##0.0' }),
    ], 26);
    const bws = XLSX.utils.aoa_to_sheet(bAoa as unknown[][]);
    bws['!merges'] = bMerges;
    bws['!rows'] = bHeights as XLSXT.RowInfo[];
    normNums(bws);
    autofit(bws, bAoa);
    XLSX.utils.book_append_sheet(wb, bws, 'لیستوفر');
  }

  setRtl(wb);
  return wb;
}

export function buildExcelBlob(payload: ExportPayload): Blob {
  const wb = buildExcelWorkbook(payload);
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true }) as Uint8Array;
  return new Blob([new Uint8Array(out)], { type: XLSX_MIME });
}

/* ======================================================================== */
/*  2) WORD                                                                  */
/* ======================================================================== */

const RTL = { bidirectional: true } as const;

function run(text: string, opts: { bold?: boolean; size?: number; color?: string; font?: string; rtl?: boolean } = {}): TextRun {
  return new TextRun({
    text,
    bold: opts.bold ?? false,
    size: (opts.size ?? 21) * 2,
    color: opts.color ?? '101828',
    font: opts.font ?? 'Vazirmatn',
    rightToLeft: opts.rtl ?? true,
  });
}

function para(text: string, opts: { bold?: boolean; size?: number; color?: string; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; spacing?: number; rtl?: boolean } = {}): Paragraph {
  return new Paragraph({
    children: [run(text, opts)],
    alignment: opts.align ?? AlignmentType.RIGHT,
    bidirectional: opts.rtl ?? true,
    spacing: { after: opts.spacing ?? 120, line: 320 },
  });
}

function heading(text: string, color = '0E3A34', size = 24): Paragraph {
  return new Paragraph({
    children: [run(text, { bold: true, size, color })],
    alignment: AlignmentType.RIGHT,
    ...RTL,
    spacing: { before: 240, after: 140 },
  });
}

const CELL_BORDER = {
  top: { style: BorderStyle.SINGLE, size: 4, color: 'D9DDE5' },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D9DDE5' },
  left: { style: BorderStyle.SINGLE, size: 4, color: 'D9DDE5' },
  right: { style: BorderStyle.SINGLE, size: 4, color: 'D9DDE5' },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'E7E9EE' },
  insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'E7E9EE' },
};

function tc(
  text: string,
  opts: { bold?: boolean; color?: string; fill?: string; size?: number; width?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {},
): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [run(text, { bold: opts.bold, color: opts.color, size: opts.size ?? 18 })],
        alignment: opts.align ?? AlignmentType.RIGHT,
        ...RTL,
        spacing: { after: 0 },
      }),
    ],
    shading: opts.fill ? { type: ShadingType.CLEAR, color: 'auto', fill: opts.fill } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    margins: { top: 90, bottom: 90, left: 110, right: 110 },
  });
}

function inputLabel(type: CalcResult['type'], key: string): string {
  const map: Record<string, string> = {
    L: type === 'beam' ? 'دهانه آزاد (متر)' : 'طول پلان (متر)',
    B: 'عرض پلان (متر)',
    H: 'ضخامت (متر)',
    Df: 'عمق استقرار (متر)',
    cs: 'ابعاد ستون در مقطع بحرانی (میلی‌متر)',
    c: 'چسبندگی خاک (کیلوپاسکال)',
    phi: 'زاویه اصطکاک داخلی (درجه)',
    gamma: 'وزن مخصوص خاک (کیلونیوتن بر متر مکعب)',
    P: 'بار محوری وارده (کیلونیوتن)',
    Fc: 'مقاومت فشاری بتن (مگاپاسکال)',
    Fy: 'مقاومت تسلیم فولاد (مگاپاسکال)',
    cover: 'پوشش بتنی (میلی‌متر)',
    barDia: 'قطر میلگرد (میلی‌متر)',
    FS: 'ضریب اطمینان طراحی',
    mixMode: 'نحوه تأمین بتن',
    b: 'عرض مقطع (میلی‌متر)',
    h: type === 'foundation' ? 'ضخامت (متر)' : 'ارتفاع مقطع (میلی‌متر)',
    wd: 'بار مرده وارد (کیلونیوتن بر متر)',
    wl: 'بار زنده وارد (کیلونیوتن بر متر)',
    stirrupDia: 'قطر خاموت (میلی‌متر)',
    support: 'نوع تکیه‌گاه',
    Pu: 'نیروی محوری نهایی (کیلونیوتن)',
    Mu: 'لنگر نهایی (کیلونیوتن متر)',
    Lc: 'ارتفاع آزاد (متر)',
    tieDia: 'قطر خاموت (میلی‌متر)',
    k: 'ضریب طول مؤثر',
  };
  return map[key] ?? key;
}

function fmtInput(key: string, value: unknown): string {
  if (key === 'mixMode') return value === 'ready' ? 'بتن آماده با پمپ' : 'بتن درجا';
  if (key === 'support') return value === 'simple' ? 'دو سر مفصل' : 'پیوسته';
  if (typeof value === 'number') return faNum(value, Number.isInteger(value) ? 0 : 2);
  return String(value);
}

export async function buildWordBlob(payload: ExportPayload): Promise<Blob> {
  const { result, rows, total, prices, projectName, client } = payload;
  const meta = CALC_META[result.type];
  const today = jalaliDate();
  const children: (Paragraph | Table)[] = [];

  /* cover */
  children.push(
    new Paragraph({
      children: [run(`${APP_NAME} ${APP_VERSION}`, { bold: true, size: 44, color: 'C9A227' })],
      alignment: AlignmentType.CENTER,
      ...RTL,
      spacing: { before: 1200, after: 200 },
    }),
    new Paragraph({
      children: [run('━━━━━━━━━━━━━━━━━━━━', { color: '0F9D6C', size: 20 })],
      alignment: AlignmentType.CENTER,
      ...RTL,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [run(`گزارش فنی و متره و برآورد ${meta.title}`, { bold: true, size: 32, color: '0E3A34' })],
      alignment: AlignmentType.CENTER,
      ...RTL,
      spacing: { after: 160 },
    }),
    new Paragraph({
      children: [run(`${projectName}${client ? ` — کارفرما: ${client}` : ''}`, { size: 22, color: '5B6F68' })],
      alignment: AlignmentType.CENTER,
      ...RTL,
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [run(`تاریخ: ${today}  |  کد سند: ${result.code}  |  ${jalaliISO()}`, { size: 20, color: '93A49C' })],
      alignment: AlignmentType.CENTER,
      ...RTL,
      spacing: { after: 600 },
    }),
  );

  const coverRows: [string, string][] = [
    ['پروژه', projectName],
    ...(client ? ([['کارفرما', client]] as [string, string][]) : []),
    ['کد سند', result.code],
    ['تاریخ صدور', `${today} (${jalaliISO()})`],
    ['موتور محاسبه', `${APP_NAME} Engine ${APP_VERSION}`],
    ['مراجع طراحی', 'مبحث ششم، هفتم و نهم مقررات ملی ساختمان + آیین‌نامه ۲۸۰۰'],
  ];
  children.push(
    new Table({
      rows: coverRows.map(
        ([k, v]) =>
          new TableRow({
            children: [tc(k, { bold: true, fill: 'F7F8FA', width: 32 }), tc(v, { width: 68 })],
          }),
      ),
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: CELL_BORDER,
    }),
  );

  /* §1 specifications */
  children.push(heading('۱. مشخصات و ورودی‌های طراحی'));
  const inputRows = Object.entries(result.input as unknown as Record<string, unknown>).map(
    ([k, v]) =>
      new TableRow({
        children: [tc(inputLabel(result.type, k), { bold: true, fill: 'F7F8FA', width: 45 }), tc(fmtInput(k, v), { width: 55 })],
      }),
  );
  children.push(new Table({ rows: inputRows, width: { size: 100, type: WidthType.PERCENTAGE }, borders: CELL_BORDER }));

  /* §2 engineering assessment */
  children.push(heading('۲. ارزیابی مهندسی'));
  children.push(para(result.assessment, { size: 21 }));
  children.push(
    new Table({
      rows: [
        new TableRow({
          children: [
            tc(result.verdict.title, {
              bold: true,
              color: 'FFFFFF',
              fill: result.verdict.ok ? '047857' : 'D92D20',
              width: 35,
            }),
            tc(result.verdict.text, { width: 65 }),
          ],
        }),
      ],
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: CELL_BORDER,
    }),
  );

  /* §3 deterministic calculation book (trace) */
  children.push(heading('۳. دفترچه محاسبات شفاف (فرضیات و روابط)'));
  const traceRows = [
    new TableRow({
      tableHeader: true,
      children: [
        tc('گام', { bold: true, color: 'FFFFFF', fill: '0E3A34', align: AlignmentType.CENTER, width: 8 }),
        tc('عنوان', { bold: true, color: 'FFFFFF', fill: '0E3A34', width: 30 }),
        tc('رابطه ریاضی', { bold: true, color: 'FFFFFF', fill: '0E3A34', width: 34 }),
        tc('نتیجه', { bold: true, color: 'FFFFFF', fill: '0E3A34', width: 28 }),
      ],
    }),
    ...result.trace.map(
      (t) =>
        new TableRow({
          children: [
            tc(faNum(t.step, 0), { align: AlignmentType.CENTER, width: 8 }),
            tc(t.title, { width: 30 }),
            tc(t.formula, { width: 34, size: 16 }),
            tc(t.result, { bold: true, width: 28 }),
          ],
        }),
    ),
  ];
  children.push(new Table({ rows: traceRows, width: { size: 100, type: WidthType.PERCENTAGE }, borders: CELL_BORDER }));

  /* §4 normative checks */
  children.push(heading('۴. نتایج کنترل‌های آیین‌نامه‌ای'));
  const checkColor = (st: string): string => (st === 'ok' ? '0F9D6C' : st === 'warn' ? 'B54708' : 'D92D20');
  const checkFa = (st: string): string => (st === 'ok' ? 'قابل قبول' : st === 'warn' ? 'هشدار' : 'بحرانی');
  const checkRows = [
    new TableRow({
      tableHeader: true,
      children: [
        tc('کنترل', { bold: true, color: 'FFFFFF', fill: '0E3A34', width: 40 }),
        tc('مقدار', { bold: true, color: 'FFFFFF', fill: '0E3A34', width: 32 }),
        tc('وضعیت', { bold: true, color: 'FFFFFF', fill: '0E3A34', align: AlignmentType.CENTER, width: 14 }),
        tc('مرجع', { bold: true, color: 'FFFFFF', fill: '0E3A34', width: 14 }),
      ],
    }),
    ...result.checks.map(
      (c) =>
        new TableRow({
          children: [
            tc(c.label, { width: 40 }),
            tc(c.value, { width: 32 }),
            tc(checkFa(c.status), { bold: true, color: checkColor(c.status), align: AlignmentType.CENTER, width: 14 }),
            tc(c.ref, { width: 14, size: 16 }),
          ],
        }),
    ),
  ];
  children.push(new Table({ rows: checkRows, width: { size: 100, type: WidthType.PERCENTAGE }, borders: CELL_BORDER }));

  /* §5 P-M interaction key points (column only) */
  if (result.type === 'column') {
    const cin = result.input as import('./engine').ColumnInput;
    const kp = pmKeyPoints(result.extras.b, result.extras.h, cin.Fc, cin.Fy, cin.cover, cin.barDia, result.extras.nBars);
    children.push(heading('۵. نقاط کلیدی نمودار برهم‌کنش P-M'));
    children.push(
      para(
        `نقاط کنترل منحنی برهم‌کنش با سازوکار سازگاری کرنش (بتن C${faNum(cin.Fc, 0)} و فولاد A${faNum(cin.Fy, 0)}) برای مقطع طراحی ${faNum(result.extras.b, 0)}×${faNum(result.extras.h, 0)} میلی‌متر با ${faNum(result.extras.nBars, 0)} میلگرد طولی محاسبه شده است؛ نقطه بالانس در کرنش تسلیم εt=εy و عمق محور خنثی cb=${faNum(kp.cb, 0)} میلی‌متر به دست آمد.`,
        { size: 20 },
      ),
    );
    children.push(
      new Table({
        rows: [
          new TableRow({
            tableHeader: true,
            children: [
              tc('نقطه کلیدی', { bold: true, color: 'FFFFFF', fill: '0E3A34', width: 34 }),
              tc('φPn (kN)', { bold: true, color: 'FFFFFF', fill: '0E3A34', align: AlignmentType.CENTER, width: 22 }),
              tc('φMn (kN·m)', { bold: true, color: 'FFFFFF', fill: '0E3A34', align: AlignmentType.CENTER, width: 22 }),
              tc('شرح', { bold: true, color: 'FFFFFF', fill: '0E3A34', width: 22 }),
            ],
          }),
          new TableRow({
            children: [
              tc('باربری محوری خالص', { bold: true, width: 34 }),
              tc(faNum(kp.P0, 0), { align: AlignmentType.CENTER, bold: true, width: 22 }),
              tc('۰', { align: AlignmentType.CENTER, width: 22 }),
              tc('فشار خالص با φ=۰٫۶۵ (خاموت‌دار)', { width: 22, size: 16 }),
            ],
          }),
          new TableRow({
            children: [
              tc('نقطه بالانس (Balance)', { bold: true, width: 34, fill: 'F7F8FA' }),
              tc(faNum(kp.Pb, 0), { align: AlignmentType.CENTER, bold: true, width: 22, fill: 'F7F8FA' }),
              tc(faNum(kp.Mb, 0), { align: AlignmentType.CENTER, bold: true, width: 22, fill: 'F7F8FA' }),
              tc(`εt=εy ؛ cb=${faNum(kp.cb, 0)} mm`, { width: 22, size: 16, fill: 'F7F8FA' }),
            ],
          }),
          new TableRow({
            children: [
              tc('خمش خالص', { bold: true, width: 34 }),
              tc('۰', { align: AlignmentType.CENTER, width: 22 }),
              tc(faNum(kp.M0, 0), { align: AlignmentType.CENTER, bold: true, width: 22 }),
              tc('لنگر مجاز بدون نیروی محوری', { width: 22, size: 16 }),
            ],
          }),
        ],
        layout: TableLayoutType.AUTOFIT,
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: CELL_BORDER,
      }),
    );
  }

  /* §5 BOQ */
  children.push(heading('۷. جدول متره و برآورد (BOQ)'));
  const boqHeader = new TableRow({
    tableHeader: true,
    children: [
      tc('ردیف', { bold: true, color: 'FFFFFF', fill: '0E3A34', align: AlignmentType.CENTER, width: 8 }),
      tc('شرح عملیات', { bold: true, color: 'FFFFFF', fill: '0E3A34', width: 32 }),
      tc('واحد', { bold: true, color: 'FFFFFF', fill: '0E3A34', align: AlignmentType.CENTER, width: 10 }),
      tc('مقدار', { bold: true, color: 'FFFFFF', fill: '0E3A34', align: AlignmentType.CENTER, width: 12 }),
      tc('فی (تومان)', { bold: true, color: 'FFFFFF', fill: '0E3A34', align: AlignmentType.CENTER, width: 16 }),
      tc('مبلغ کل (تومان)', { bold: true, color: 'FFFFFF', fill: '0E3A34', align: AlignmentType.CENTER, width: 22 }),
    ],
  });
  const boqRows = rows.map(
    (r, i) =>
      new TableRow({
        children: [
          tc(toFa(i + 1), { align: AlignmentType.CENTER, width: 8, fill: i % 2 === 1 ? 'F7F8FA' : undefined }),
          tc(r.title, { width: 32, fill: i % 2 === 1 ? 'F7F8FA' : undefined }),
          tc(r.unit, { align: AlignmentType.CENTER, width: 10, fill: i % 2 === 1 ? 'F7F8FA' : undefined }),
          tc(faNum(r.qty, 2), { align: AlignmentType.CENTER, width: 12, fill: i % 2 === 1 ? 'F7F8FA' : undefined }),
          tc(faNum(r.unitPrice), { align: AlignmentType.CENTER, width: 16, fill: i % 2 === 1 ? 'F7F8FA' : undefined }),
          tc(faNum(r.amount), { align: AlignmentType.CENTER, width: 22, bold: true, fill: i % 2 === 1 ? 'F7F8FA' : undefined }),
        ],
      }),
  );
  const totalRow = new TableRow({
    children: [
      tc('جمع کل', { bold: true, color: 'FFFFFF', fill: '047857', width: 62 }),
      tc(faNum(total), { bold: true, color: 'FFFFFF', fill: '047857', align: AlignmentType.CENTER, width: 38 }),
    ],
  });
  children.push(new Table({ rows: [boqHeader, ...boqRows, totalRow], width: { size: 100, type: WidthType.PERCENTAGE }, borders: CELL_BORDER }));

  /* §4 price validity & sources */
  children.push(heading('۴. اعتبار قیمت‌ها و منابع داده'));
  children.push(
    para(
      `قیمت‌های فولاد (میلگرد، تیرآهن و ورق) از وب‌سایت آهن‌آنلاین به نشانی ahanonline.com استعلام شده است. قیمت بتن آماده، بتن مگر، سیمان پاکتی، شن و ماسه بر مبنای آخرین نرخ عمومی اعلام‌شده از منابع اعلام‌شده در جدول زیر است. اقلام قالب‌بندی و خاک‌برداری قیمت واحد عمومی ندارند و در این سند با نرخ برآوردی متداول کارگاهی (قابل ویرایش در صفحه بازار) محاسبه شده‌اند. این گزارش هیچ ادعایی درباره قیمت لحظه‌ای ندارد مگر آنکه وضعیت منبع «لحظه‌ای» باشد.`,
    ),
  );
  const priceHeader = new TableRow({
    tableHeader: true,
    children: [
      tc('مصالح', { bold: true, color: 'FFFFFF', fill: '0E3A34', width: 30 }),
      tc('واحد', { bold: true, color: 'FFFFFF', fill: '0E3A34', align: AlignmentType.CENTER, width: 12 }),
      tc('قیمت (تومان)', { bold: true, color: 'FFFFFF', fill: '0E3A34', align: AlignmentType.CENTER, width: 16 }),
      tc('وضعیت', { bold: true, color: 'FFFFFF', fill: '0E3A34', align: AlignmentType.CENTER, width: 16 }),
      tc('منبع', { bold: true, color: 'FFFFFF', fill: '0E3A34', width: 26 }),
    ],
  });
  const priceRows = prices.map(
    (p, i) =>
      new TableRow({
        children: [
          tc(p.def.name, { width: 30, fill: i % 2 === 1 ? 'F7F8FA' : undefined }),
          tc(p.def.unit, { align: AlignmentType.CENTER, width: 12, fill: i % 2 === 1 ? 'F7F8FA' : undefined }),
          tc(faNum(p.price), { align: AlignmentType.CENTER, width: 16, fill: i % 2 === 1 ? 'F7F8FA' : undefined }),
          tc(STATUS_FA[p.status], { align: AlignmentType.CENTER, width: 16, fill: i % 2 === 1 ? 'F7F8FA' : undefined }),
          tc(p.def.sourceName, { width: 26, fill: i % 2 === 1 ? 'F7F8FA' : undefined }),
        ],
      }),
  );
  children.push(new Table({ rows: [priceHeader, ...priceRows], width: { size: 100, type: WidthType.PERCENTAGE }, borders: CELL_BORDER }));

  /* certificate + signatures */
  children.push(heading('گواهی‌نامه صدور'));
  children.push(
    para(
      `این گزارش توسط موتور محاسباتی ${APP_NAME} ${APP_VERSION} بر پایه ورودی‌های ثبت‌شده توسط کاربر و منابع قیمتی فوق تولید شده است و صرفاً جنبه برآورد اولیه و مطالعاتی دارد؛ جایگزین محاسبات مهرشده مهندس محاسب ذی‌صلاح نیست.`,
      { size: 20 },
    ),
  );
  children.push(
    new Table({
      rows: [
        new TableRow({
          children: [
            tc('تهیه‌کننده', { bold: true, fill: 'F7F8FA', width: 25 }),
            tc(`${APP_NAME} Engine ${APP_VERSION}`, { width: 25 }),
            tc('مهندس طراح', { bold: true, fill: 'F7F8FA', width: 25 }),
            tc('.........................  مهر و امضا', { width: 25 }),
          ],
        }),
        new TableRow({
          children: [
            tc('تاریخ', { bold: true, fill: 'F7F8FA', width: 25 }),
            tc(today, { width: 25 }),
            tc('ناظر پروژه', { bold: true, fill: 'F7F8FA', width: 25 }),
            tc('.........................  مهر و امضا', { width: 25 }),
          ],
        }),
      ],
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: CELL_BORDER,
    }),
  );

  const doc = new Document({
    creator: `${APP_NAME} ${APP_VERSION}`,
    title: `گزارش فنی ${meta.title} — ${projectName}`,
    description: `Technical report generated by ${APP_NAME} ${APP_VERSION}`,
    styles: {
      default: {
        document: { run: { font: 'Vazirmatn', size: 21, rightToLeft: true } },
      },
    },
    sections: [
      {
        properties: {
          page: { margin: { top: 900, bottom: 900, left: 900, right: 900 } },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: `${APP_NAME} ${APP_VERSION} — گزارش مهندسی ${meta.title}`, font: 'Vazirmatn', size: 16, color: '0F5257', rightToLeft: true }),
                ],
                alignment: AlignmentType.RIGHT,
                border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'C9A227' } },
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: 'صفحه ', font: 'Vazirmatn', size: 16, color: '93A49C', rightToLeft: true }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '93A49C' }),
                  new TextRun({ text: ' — تولیدشده توسط CivilGenius', font: 'Vazirmatn', size: 16, color: '93A49C', rightToLeft: true }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return Packer.toBlob(doc);
}

/* ======================================================================== */
/*  3) DXF (AutoCAD R2010 / AC1024)                                          */
/* ======================================================================== */

/**
 * AutoCAD R2010 drawing. Delegates to the dedicated, AutoCAD-validated writer
 * in lib/dxf.ts (full HEADER/TABLES/BLOCKS/OBJECTS + real DIMENSION entities).
 */
export function buildDxfBlob(result: CalcResult, payload: ExportPayload): Blob {
  const text = buildDxfText(result, { projectName: payload.projectName, rows: payload.rows.length });
  return new Blob([text], { type: DXF_MIME });
}
/* ======================================================================== */
/*  4) delivery helpers                                                      */
/* ======================================================================== */

async function recordAndDownload(blob: Blob, name: string, kind: VaultDoc['kind'], onProgress?: (step: string) => void): Promise<boolean> {
  onProgress?.('ذخیره در بایگانی درون‌برنامه‌ای');
  await vaultPut({
    id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    kind,
    size: blob.size,
    at: Date.now(),
    mime: blob.type,
    dataUrl: await blobToDataUrl(blob),
  }).catch(() => false);
  onProgress?.('شروع دانلود مستقیم');
  return downloadBlobDirect(blob, name);
}

export interface DeliveryResult {
  excel: { name: string; blob: Blob; size: number };
  word: { name: string; blob: Blob; size: number };
  dxf: { name: string; blob: Blob; size: number };
  total: number;
}

export async function buildAllBlobs(payload: ExportPayload): Promise<DeliveryResult> {
  const date = new Date();
  const excelName = docName(payload.result.type, 'boq', date);
  const wordName = docName(payload.result.type, 'report', date);
  const dxfName = docName(payload.result.type, 'drawing', date);
  const excel = buildExcelBlob(payload);
  const word = await buildWordBlob(payload);
  const dxf = buildDxfBlob(payload.result, payload);
  return {
    excel: { name: excelName, blob: excel, size: excel.size },
    word: { name: wordName, blob: word, size: word.size },
    dxf: { name: dxfName, blob: dxf, size: dxf.size },
    total: payload.total,
  };
}

export async function exportAllBundle(
  payload: ExportPayload,
  onProgress?: (step: string) => void,
): Promise<DeliveryResult> {
  const bundle = await buildAllBlobs(payload);
  await recordAndDownload(bundle.excel.blob, bundle.excel.name, 'xlsx', onProgress);
  await new Promise((r) => setTimeout(r, 400));
  await recordAndDownload(bundle.word.blob, bundle.word.name, 'docx', onProgress);
  await new Promise((r) => setTimeout(r, 400));
  await recordAndDownload(bundle.dxf.blob, bundle.dxf.name, 'dxf', onProgress);
  return bundle;
}

export async function exportExcel(payload: ExportPayload): Promise<string> {
  const blob = buildExcelBlob(payload);
  const name = docName(payload.result.type, 'boq');
  await recordAndDownload(blob, name, 'xlsx');
  return name;
}

export async function exportWord(payload: ExportPayload): Promise<string> {
  const blob = await buildWordBlob(payload);
  const name = docName(payload.result.type, 'report');
  await recordAndDownload(blob, name, 'docx');
  return name;
}

export async function exportDxf(payload: ExportPayload): Promise<string> {
  const blob = buildDxfBlob(payload.result, payload);
  const name = docName(payload.result.type, 'drawing');
  await recordAndDownload(blob, name, 'dxf');
  return name;
}

/* ------------------------------------------------- procurement worksheet -- */

export interface ProcurementRow {
  materialId: string;
  name: string;
  unit: string;
  qty: number;
  unitPrice: number;
  amount: number;
  status: SourceType;
  source: string;
}

export function buildProcurementWorkbook(rows: ProcurementRow[], title: string, code: string): XLSXT.WorkBook {
  const wb = XLSX.utils.book_new();
  const aoa: XLSXT.CellObject[][] = [];
  const merges: XLSXT.Range[] = [];
  const heights: Partial<XLSXT.RowInfo>[] = [];
  const add = (cells: XLSXT.CellObject[], hpt?: number) => {
    aoa.push(cells);
    heights.push(hpt ? { hpt } : {});
    return aoa.length - 1;
  };

  add([
    cell(`${title} — برنامه خرید مصالح`, {
      font: { name: FONT, sz: 15, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: NAVY }, patternType: 'solid' },
    }),
  ], 30);
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } });
  add([
    cell(`${jalaliDate()}  |  کد: ${code}  |  ${APP_NAME} ${APP_VERSION}`, {
      font: { name: FONT, sz: 10, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '14544A' }, patternType: 'solid' },
    }),
  ], 20);
  merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 6 } });
  add([], 6);
  add(
    ['ردیف', 'مصالح', 'واحد', 'مقدار (با ۵٪ پرت)', 'فی (تومان)', 'مبلغ (تومان)', 'منبع'].map((t) =>
      cell(t, {
        font: { name: FONT, sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: NAVY }, patternType: 'solid' },
        alignment: { horizontal: 'center' },
      }),
    ),
    26,
  );

  let total = 0;
  rows.forEach((r, i) => {
    total += r.amount;
    const fillStyle: CellStyle['fill'] = i % 2 === 1 ? { fgColor: { rgb: SOFT }, patternType: 'solid' } : undefined;
    const base: CellStyle = fillStyle ? { fill: fillStyle } : {};
    add(
      [
        cell(i + 1, { ...base, alignment: { horizontal: 'center' } }, { z: '0' }),
        cell(r.name, base),
        cell(r.unit, { ...base, alignment: { horizontal: 'center' } }),
        cell(r.qty, { ...base, alignment: { horizontal: 'center' } }, { z: '#,##0.00' }),
        cell(r.unitPrice, base, { z: '#,##0' }),
        cell(r.amount, { ...base, font: { name: FONT, sz: 11, bold: true } }, { z: '#,##0' }),
        cell(`${r.source} — ${STATUS_FA[r.status]}`, { ...base, font: { name: FONT, sz: 9, color: { rgb: MUTED } } }),
      ],
      22,
    );
  });

  const ti = add([
    cell('جمع کل خرید', {
      font: { name: FONT, sz: 13, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: GREEN }, patternType: 'solid' },
    }),
    cell('', { fill: { fgColor: { rgb: GREEN }, patternType: 'solid' } }),
    cell('', { fill: { fgColor: { rgb: GREEN }, patternType: 'solid' } }),
    cell('', { fill: { fgColor: { rgb: GREEN }, patternType: 'solid' } }),
    cell('', { fill: { fgColor: { rgb: GREEN }, patternType: 'solid' } }),
    cell(total, {
      font: { name: FONT, sz: 13, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: GREEN }, patternType: 'solid' },
      alignment: { horizontal: 'center' },
    }, { z: '#,##0' }),
    cell('', { fill: { fgColor: { rgb: GREEN }, patternType: 'solid' } }),
  ], 28);
  merges.push({ s: { r: ti, c: 0 }, e: { r: ti, c: 4 } });

  const ws = XLSX.utils.aoa_to_sheet(aoa as unknown[][]);
  ws['!merges'] = merges;
  ws['!rows'] = heights as XLSXT.RowInfo[];
  // live formulas: amount = qty × unit price, grand total = SUM(amounts)
  rows.forEach((_r, i) => {
    const rn = 5 + i;
    const c = ws[`F${rn}`];
    if (c) c.f = `D${rn}*E${rn}`;
  });
  const tc2 = ws[`F${ti + 1}`];
  if (tc2) tc2.f = `SUM(F5:F${4 + rows.length})`;
  normNums(ws);
  autofit(ws, aoa);
  XLSX.utils.book_append_sheet(wb, ws, 'برنامه خرید');
  setRtl(wb);
  return wb;
}

export function buildProcurementBlob(rows: ProcurementRow[], title: string, code: string): Blob {
  const out = XLSX.write(buildProcurementWorkbook(rows, title, code), { bookType: 'xlsx', type: 'array', cellStyles: true }) as Uint8Array;
  return new Blob([new Uint8Array(out)], { type: XLSX_MIME });
}

/* ---------------------------------------------------------- price rows --- */

export function toPriceRows(
  prices: { def: MaterialDef; price: number; status: SourceType }[],
): PriceRow[] {
  return prices.map((p) => ({ def: p.def, price: p.price, status: p.status }));
}

export function materialDef(id: string): MaterialDef | undefined {
  return MATERIAL_BY_ID[id as keyof typeof MATERIAL_BY_ID];
}


