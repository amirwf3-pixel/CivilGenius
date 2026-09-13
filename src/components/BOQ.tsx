
/* ============================================================================
 * CivilGenius v20 — BOQ table + Delivery Center
 *   • per-file cards (Excel / Word / DXF) with real download + share
 *   • "دانلود پکیج کامل" sequential bundle
 *   • DXF preview modal (view + copy full text)
 *   • IndexedDB vault archive with re-download / delete
 * ========================================================================== */

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Archive, ChartPie, Download, Eye, FileSpreadsheet, FileText, Gauge, PackageOpen, RefreshCw, Ruler, Trash2, TriangleAlert } from 'lucide-react';
import type { CalcResult, PricedRow } from '../lib/engine';
import { priceBOQ } from '../lib/engine';
import { faMoney, faNum, jalaliDate } from '../lib/format';
import { market, useMarket } from '../lib/market';
import {
  buildDxfBlob,
  buildExcelBlob,
  buildWordBlob,
  docName,
  docMime,
  exportAllBundle,
  type DeliveryResult,
  type ExportPayload,
} from '../lib/exporters';
import { dataUrlToBlob, downloadBlobDirect, vaultClear, vaultDelete, vaultList, type VaultDoc } from '../lib/fileio';
import { useStore } from '../lib/store';
import { Button, Card, Chip, LiveDot, SectionHead } from './ui';

function usePayload(result: CalcResult): { payload: ExportPayload; rows: PricedRow[]; total: number } {
  const snap = useMarket();
  const store = useStore();
  const { rows, total } = priceBOQ(
    result.boq,
    (id) => snap.prices[id],
    (id) => snap.live[id].status,
    (id) => ({ name: market.def(id).sourceName, url: market.def(id).sourceUrl }),
  );
  return {
    rows,
    total,
    payload: {
      result,
      rows,
      total,
      prices: market.priceTable().map((p) => ({ def: p.def, price: p.price, status: p.status })),
      projectName: store.projectName,
      client: store.client,
    },
  };
}

/** round-33: BBS lives inside the main Excel workbook (لیستوفر sheet) — no
 *  separate card; cards keep only title+icon (fine print removed). */
const FILE_META: Record<'excel' | 'word' | 'dxf', { title: string; color: string; icon: ReactNode }> = {
  excel: { title: 'متره و برآورد (Excel)', color: 'text-forest', icon: <FileSpreadsheet size={20} /> },
  word: { title: 'گزارش فنی (Word)', color: 'text-blue', icon: <FileText size={20} /> },
  dxf: { title: 'نقشه اتوکد (DXF R12)', color: 'text-gold-2', icon: <Ruler size={20} /> },
};

export function BOQ({ result }: { result: CalcResult }): ReactNode {
  const { payload, rows, total } = usePayload(result);
  const store = useStore();
  const [busy, setBusy] = useState<string | null>(null);
  const [vault, setVault] = useState<VaultDoc[]>([]);
  const [preview, setPreview] = useState<{ text: string; name: string } | null>(null);
  const [bundle, setBundle] = useState<DeliveryResult | null>(null);

  const refreshVault = useCallback(async () => {
    setVault(await vaultList());
  }, []);

  useEffect(() => {
    void refreshVault();
  }, [refreshVault, bundle]);

  const notify = (text: string, tone: 'ok' | 'info' | 'warn' | 'bad' = 'ok') => store.pushToast(text, tone);

  const doExport = async (kind: 'excel' | 'word' | 'dxf'): Promise<void> => {
    setBusy(kind);
    try {
      let blob: Blob;
      let name: string;
      if (kind === 'excel') {
        blob = buildExcelBlob(payload);
        name = docName(result.type, 'boq');
      } else if (kind === 'word') {
        blob = await buildWordBlob(payload);
        name = docName(result.type, 'report');
      } else {
        blob = buildDxfBlob(result, payload);
        name = docName(result.type, 'drawing');
      }
      const done = downloadBlobDirect(blob, name);
      if (done) {
        notify('فایل مستقیماً در پوشه Downloads ذخیره شد');
      } else {
        notify('مرورگر اجازه دانلود نداد — از بایگانی درون‌برنامه‌ای استفاده کنید', 'warn');
      }
    } catch (err) {
      notify(`خطا در ساخت فایل: ${err instanceof Error ? err.message : 'نامشخص'}`, 'bad');
    } finally {
      setBusy(null);
    }
  };

  const doBundle = async (): Promise<void> => {
    setBusy('all');
    try {
      const res = await exportAllBundle(payload, (step) => store.pushToast(step, 'info'));
      setBundle(res);
      notify('سه فایل (Excel، Word، DXF) مستقیماً در پوشه Downloads ذخیره شد');
    } catch (err) {
      notify(`خطا در تولید پکیج: ${err instanceof Error ? err.message : 'نامشخص'}`, 'bad');
    } finally {
      setBusy(null);
    }
  };

  const showDxfPreview = async (): Promise<void> => {
    const blob = buildDxfBlob(result, payload);
    const text = await blob.text();
    setPreview({ text, name: docName(result.type, 'drawing') });
  };

  const manualPending = rows.filter((r) => r.status === 'manual' && r.unitPrice <= 0).length;

  const totalCost = total > 0 ? total : 1;
  const CODE_TIP: Record<string, string> = {
    'میلگرد': 'مبحث نهم، بند ۹-۷: حداقل درصد میلگرد و فاصله‌گذاری آرماتور مطابق جدول ۹-۷-۱.',
    'بتن': 'مبحث نهم، بند ۹-۳: پوشش بتنی و کیفیت بتن بر اساس جدول ۹-۳-۱.',
    'formwork': 'قالب‌بندی بر اساس مبحث نهم و دستورالعمل‌های اجرا.',
  };
  const costShare = [...rows]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map((r) => ({
      title: r.title,
      pct: (r.amount / totalCost) * 100,
      tip: r.status === 'live' ? 'قیمت به‌روز از ahanonline.com' : r.status === 'reference' ? 'مبنای معتبر اعلام‌شده' : 'ورود دستی — تکمیل کنید',
    }));
  const consAgg = new Map<string, { title: string; qty: number; unit: string; tip: string }>();
  for (const r of rows) {
    const cur = consAgg.get(r.materialId) ?? { title: r.title, qty: 0, unit: r.unit, tip: CODE_TIP[r.title] ?? 'برآورد مقدار بر اساس خروجی موتور محاسباتی' };
    cur.qty += r.qty;
    consAgg.set(r.materialId, cur);
  }
  const consList = [...consAgg.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);
  const maxQty = consList[0]?.qty || 1;
  const consumption = consList.map((c) => ({ ...c, pct: (c.qty / maxQty) * 100 }));

  return (
    <section className="space-y-5">
      {/* ---------------------------------------------------------- BOQ table */}
      <div className="glass overflow-hidden">
        <div className="border-b border-line bg-panel-2 px-4 py-3">
          <SectionHead
            title="متره و برآورد"
            subtitle={`تاریخ سند: ${jalaliDate()} — کد: ${result.code}`}
            icon={<Ruler size={17} />}
            action={
              <span className="flex items-center gap-2.5">
                <Button
                  size="sm"
                  variant="outline"
                  icon={<RefreshCw size={14} />}
                  onClick={() => {
                    market.tick();
                    notify('قیمت‌ها با آخرین نرخ‌های ذخیره‌شده بازمحاسبه شد', 'info');
                  }}
                >
                  بروزرسانی کلی قیمت‌ها
                </Button>
                <Chip tone={manualPending ? 'warn' : 'green'}>{faMoney(total)}</Chip>
              </span>
            }
          />
        </div>
        {manualPending > 0 ? (
          <div className="flex items-center gap-2 border-b border-[#fde68a] bg-warn-soft px-4 py-2.5 text-[12px] text-warn">
            <TriangleAlert size={15} />
            <span>{faNum(manualPending, 0)} قلم قیمت دستی وارد نشده است — تا تکمیل، با نرخ پیشنهادی محاسبه می‌شود.</span>
            <a href="#/market" className="mr-auto font-semibold underline">
              ورود قیمت دستی
            </a>
          </div>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-right text-[12.5px]">
            <thead>
              <tr className="bg-navy text-white">
                {['ردیف', 'شرح عملیات', 'واحد', 'مقدار', 'فی (تومان)', 'مبلغ کل', 'منبع قیمت'].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-[11.5px] font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.code}-${i}`} className={`border-b border-line ${i % 2 ? 'bg-panel-2' : ''}`}>
                  <td className="px-3 py-2.5 text-center text-faint tnum">{faNum(i + 1)}</td>
                  <td className="px-3 py-2.5">
                    <div className="font-semibold text-ink">{r.title}</div>
                    <div className="mt-0.5 text-[11px] text-faint">{r.detail}</div>
                  </td>
                  <td className="px-3 py-2.5 text-center text-muted">{r.unit}</td>
                  <td className="px-3 py-2.5 text-center font-semibold text-ink tnum">{faNum(r.qty, 2)}</td>
                  <td className="px-3 py-2.5 text-center text-muted tnum">{faNum(r.unitPrice)}</td>
                  <td className="px-3 py-2.5 text-center font-bold text-ink tnum">{faNum(r.amount)}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className="inline-flex items-center gap-1.5 text-[11px]">
                      <LiveDot tone={r.status === 'live' ? 'ok' : r.status === 'reference' ? 'info' : 'warn'} pulse={false} />
                      <span className={r.status === 'live' ? 'text-forest' : r.status === 'manual' ? 'text-warn' : 'text-blue'}>
                        {r.status === 'live' ? 'به‌روز' : r.status === 'reference' ? 'مبنای معتبر' : 'دستی وارد کنید'}
                      </span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-forest text-white">
                <td colSpan={5} className="px-3 py-3 text-[13px] font-bold">
                  جمع کل پروژه
                </td>
                <td className="px-3 py-3 text-center text-[14px] font-bold tnum">{faNum(total)}</td>
                <td className="px-3 py-3 text-center text-[11px] opacity-90">تومان</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ------------------------------------------------- cost dashboard */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-3 flex items-center gap-2 text-[13px] font-bold text-ink">
            <ChartPie size={16} className="text-emerald" />
            سهم هزینه به تفکیک اقلام
          </h3>
          <div className="space-y-3">
            {costShare.map((c) => (
              <div key={c.title} title={c.tip}>
                <div className="mb-1 flex items-center justify-between text-[11.5px]">
                  <span className="font-medium text-muted">{c.title}</span>
                  <span className="font-bold text-ink tnum">{faNum(c.pct, 1)}٪</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-gradient-to-l from-emerald to-forest" style={{ width: `${Math.max(2, c.pct)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-4">
          <h3 className="mb-3 flex items-center gap-2 text-[13px] font-bold text-ink">
            <Gauge size={16} className="text-gold" />
            مصرف مصالح (مقدار برآوردی)
          </h3>
          <div className="space-y-3">
            {consumption.map((c) => (
              <div key={c.title} title={c.tip}>
                <div className="mb-1 flex items-center justify-between text-[11.5px]">
                  <span className="font-medium text-muted">{c.title}</span>
                  <span className="font-bold text-ink tnum">{faNum(c.qty, 1)} {c.unit}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-gradient-to-l from-gold to-gold-2" style={{ width: `${c.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* --------------------------------------------------- delivery center */}
      <div className="overflow-hidden rounded-2xl border border-line bg-gradient-to-l from-navy via-navy-2 to-[#14544a] p-5 text-white sm:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold">
              <PackageOpen size={18} className="text-gold" />
              مرکز تحویل اسناد
            </h3>
            <p className="mt-1 text-[12px] text-white/70">سه فایل قابل ویرایش — ذخیره مستقیم در Downloads + بایگانی درون‌برنامه‌ای.</p>
          </div>
          <Button variant="green" size="lg" onClick={doBundle} disabled={busy !== null} icon={<Download size={17} />}>
            {busy === 'all' ? 'در حال تولید…' : 'دانلود پکیج کامل'}
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(Object.keys(FILE_META) as ('excel' | 'word' | 'dxf')[]).map((k) => {
            const meta = FILE_META[k];
            const name = docName(result.type, k === 'excel' ? 'boq' : k === 'word' ? 'report' : 'drawing');
            const size = bundle ? bundle[k].size : 0;
            return (
              <div key={k} className="rounded-xl border border-white/12 bg-white/8 p-3.5 backdrop-blur-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`grid size-9 place-items-center rounded-lg bg-white/10 ${meta.color}`}>{meta.icon}</span>
                    <div>
                      <div className="text-[13px] font-bold">{meta.title}</div>
                      <div className="mt-0.5 text-[10px] text-white/55">
                        {size ? `${faNum(Math.round(size / 1024), 1)} کیلوبایت` : docMime(k === 'excel' ? 'boq' : k === 'word' ? 'report' : 'drawing')}
                      </div>
                    </div>
                  </div>
                  {k === 'dxf' ? (
                    <button
                      onClick={() => void showDxfPreview()}
                      className="grid size-8 place-items-center rounded-lg bg-white/10 text-white/80 transition hover:bg-white/20"
                      title="پیش‌نمایش متن DXF"
                    >
                      <Eye size={15} />
                    </button>
                  ) : null}
                </div>
                <div className="mt-2.5 truncate rounded-md bg-black/25 px-2 py-1 text-[10px] text-white/70" dir="rtl" title={name}>
                  {name}
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="gold"
                    className="flex-1"
                    disabled={busy !== null}
                    onClick={() => void doExport(k)}
                    icon={<Download size={14} />}
                  >
                    {busy === k ? 'در حال تولید…' : 'دانلود'}
                  </Button>

                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* -------------------------------------------------------- vault list */}
      <div className="glass p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
            <Archive size={16} className="text-navy" />
            بایگانی درون‌برنامه‌ای
            <Chip tone="neutral">{faNum(vault.length, 0)} سند</Chip>
          </h3>
          {vault.length ? (
            <Button
              size="sm"
              variant="ghost"
              icon={<Trash2 size={14} />}
              onClick={() =>
                void (async () => {
                  await vaultClear();
                  await refreshVault();
                  notify('بایگانی پاک شد', 'info');
                })()
              }
            >
              پاک کردن همه
            </Button>
          ) : null}
        </div>
        {vault.length === 0 ? (
          <p className="text-[12px] text-faint">هنوز سندی تولید نشده است. با «دانلود پکیج کامل» شروع کنید.</p>
        ) : (
          <ul className="space-y-2">
            {vault.slice(0, 12).map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-panel-2 px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-semibold text-ink" dir="rtl">
                    {d.name}
                  </div>
                  <div className="text-[10.5px] text-faint tnum">
                    {faNum(Math.round(d.size / 1024), 1)} کیلوبایت — {new Date(d.at).toLocaleTimeString('fa-IR-u-nu-latn')}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    icon={<Download size={13} />}
                    onClick={() => {
                      const ok = downloadBlobDirect(dataUrlToBlob(d.dataUrl), d.name);
                      notify(ok ? 'از بایگانی دانلود شد' : 'دانلود ممکن نشد', ok ? 'ok' : 'warn');
                    }}
                  >
                    دانلود دوباره
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Trash2 size={13} />}
                    onClick={() =>
                      void (async () => {
                        await vaultDelete(d.id);
                        await refreshVault();
                      })()
                    }
                  >
                    حذف
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* --------------------------------------------------------- DXF modal */}
      {preview ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-navy/60 p-4 backdrop-blur-sm" onClick={() => setPreview(null)}>
          <div className="glass-strong flex max-h-[82vh] w-full max-w-3xl flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div>
                <h3 className="text-sm font-bold text-ink">پیش‌نمایش متن DXF</h3>
                <p className="truncate text-[11px] text-faint" dir="rtl">
                  {preview.name}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(preview.text)
                      .then(() => notify('متن DXF کپی شد'))
                      .catch(() => notify('کپی ممکن نشد', 'warn'))
                  }
                >
                  کپی کل متن
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setPreview(null)}>
                  بستن
                </Button>
              </div>
            </div>
            <pre className="flex-1 overflow-auto bg-[#0b1220] p-4 text-[11px] leading-5 text-emerald-soft" dir="ltr">
              {preview.text}
            </pre>
          </div>
        </div>
      ) : null}
    </section>
  );
}


