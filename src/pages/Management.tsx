
/* ============================================================================
 * CivilGenius v20 — Construction Management ("اتاق فرمان پروژه")
 *   Gantt schedule · cost S-curve · budget donut · procurement table
 *   team productivity rates: rebar 700 kg/d · formwork 45 m²/d
 *                            concrete 55 m³/d · excavation 500 m³/d (+2d cure)
 *   phase offsets: columns start at 65% of foundation, beams at 45% of columns
 * ========================================================================== */

import { useMemo, useState, type ReactNode } from 'react';
import { Building2, Download, FolderInput, FolderOpen, Percent, Save, Trash2, Upload } from 'lucide-react';
import { CALC_META, priceBOQ, type CalcResult, type CalcType } from '../lib/engine';
import { faMoney, faNum, faStamp, jalaliDate, projectCode } from '../lib/format';
import { market, useMarket, type MaterialId } from '../lib/market';
import { buildProcurementBlob, procurementDocName, type ProcurementRow } from '../lib/exporters';
import { downloadBlobDirect } from '../lib/fileio';
import { buildSampleProject, useStore, type Multipliers } from '../lib/store';
import { deleteProject, exportProjectJSON, listProjects, parseProjectJSON, saveProject, type ProjectFile } from '../lib/projects';
import { Donut, type DonutSegment } from '../components/Donut';
import { XYChart } from '../components/XYChart';
import { Button, Card, Chip, EmptyState, SectionHead } from '../components/ui';

const RATE: Partial<Record<MaterialId, number>> = {
  rebar: 700, // kg/day
  formwork: 45, // m²/day
  concrete: 55, // m³/day
  lean: 55,
  excavation: 500, // m³/day
  cement: 60,
  sand: 40,
  gravel: 40,
};
const CURE_DAYS = 2;
const WASTE = 0.05;

interface Activity {
  id: string;
  label: string;
  start: number;
  end: number;
  cost: number;
  color: string;
}

interface Agg {
  materialId: MaterialId;
  qty: number;
  cost: number;
}

function durationFor(materialId: MaterialId, qty: number): number {
  const rate = RATE[materialId];
  if (!rate) return 3;
  return Math.max(1, qty / rate);
}

function buildSchedule(
  results: Partial<Record<CalcType, CalcResult>>,
  mult: Multipliers,
  priceOf: (id: MaterialId) => number,
): { activities: Activity[]; total: number; agg: Agg[] } {
  const aggMap = new Map<MaterialId, number>();
  const costByMaterial = new Map<MaterialId, number>();

  const push = (result: CalcResult | undefined, count: number): void => {
    if (!result || count <= 0) return;
    const snap = market.getSnapshot();
    const { rows } = priceBOQ(
      result.boq,
      (id) => priceOf(id),
      (id) => snap.live[id].status,
      (id) => ({ name: market.def(id).sourceName, url: market.def(id).sourceUrl }),
    );
    for (const r of rows) {
      aggMap.set(r.materialId, (aggMap.get(r.materialId) ?? 0) + r.qty * count);
      costByMaterial.set(r.materialId, (costByMaterial.get(r.materialId) ?? 0) + r.amount * count);
    }
  };

  push(results.foundation, mult.foundations);
  push(results.beam, mult.beams);
  push(results.column, mult.columns);
  push(results.slab, mult.slabs);
  push(results.wall, mult.walls);
  push(results.stair, mult.stairs);
  push(results.joint, mult.joints);

  const agg: Agg[] = [...aggMap.entries()].map(([materialId, qty]) => ({
    materialId,
    qty,
    cost: costByMaterial.get(materialId) ?? 0,
  }));

  const costOf = (ids: MaterialId[]): number => agg.filter((a) => ids.includes(a.materialId)).reduce((s, a) => s + a.cost, 0);
  const durOf = (id: MaterialId): number => durationFor(id, agg.find((a) => a.materialId === id)?.qty ?? 0);

  const dExc = durOf('excavation');
  const dLean = durOf('lean');
  const dFnd = Math.max(durOf('concrete'), durOf('rebar')) + CURE_DAYS;
  const fndStart = dExc + dLean;
  const fndEnd = fndStart + dFnd;

  const colStart = fndStart + dFnd * 0.65;
  const dCol = Math.max(durOf('formwork'), 2) * Math.max(1, mult.columns / 4);
  const colEnd = colStart + dCol;

  const beamStart = colStart + dCol * 0.45;
  const dBeam = Math.max(durOf('concrete'), 2) * Math.max(1, mult.beams / 6);
  const beamEnd = beamStart + dBeam;

  const activities: Activity[] = [
    { id: 'exc', label: 'خاک‌برداری و تسطیح', start: 0, end: dExc, cost: costOf(['excavation']), color: '#b45309' },
    { id: 'lean', label: 'بتن مگر', start: dExc, end: dExc + dLean, cost: costOf(['lean']), color: '#d97706' },
    { id: 'fnd', label: 'فونداسیون (آرماتور، بتن، قالب)', start: fndStart, end: fndEnd, cost: costOf(['concrete', 'rebar', 'formwork', 'cement', 'sand', 'gravel']), color: '#047857' },
    { id: 'col', label: 'ستون‌ها', start: colStart, end: colEnd, cost: costOf(['formwork']) * (mult.columns / Math.max(1, mult.beams + mult.columns)), color: '#2563eb' },
    { id: 'beam', label: 'تیرها و سقف', start: beamStart, end: beamEnd, cost: costOf(['concrete']) * (mult.beams / Math.max(1, mult.beams + mult.columns)), color: '#7c3aed' },
  ].map((a) => ({ ...a, end: Math.max(a.end, a.start + 1), cost: Math.max(0, a.cost) }));

  const total = agg.reduce((s, a) => s + a.cost, 0);
  return { activities, total, agg };
}

function buildSCurve(activities: Activity[], days: number): { t: number; v: number }[] {
  const pts: { t: number; v: number }[] = [];
  let cum = 0;
  const step = Math.max(1, days / 60);
  for (let d = 0; d <= days + step; d += step) {
    let total = 0;
    for (const a of activities) {
      const dur = Math.max(0.001, a.end - a.start);
      const frac = Math.min(1, Math.max(0, (d - a.start) / dur));
      total += a.cost * frac;
    }
    cum = total;
    pts.push({ t: d, v: Math.round(cum) });
  }
  return pts;
}


export function ProjectsPanel(): ReactNode {
  const store = useStore();
  const [items, setItems] = useState<ProjectFile[]>(() => listProjects());
  const refresh = (): void => setItems(listProjects());

  const current = (): ProjectFile => ({
    v: 22,
    name: store.projectName || 'پروژه بدون نام',
    client: store.client,
    savedAt: Date.now(),
    inputs: { ...store.inputs },
    multipliers: { ...store.multipliers },
  });

  const doSave = (): void => {
    saveProject(current());
    refresh();
    store.pushToast('پروژه در حافظه مرورگر ذخیره شد', 'ok');
  };
  const doLoad = (p: ProjectFile): void => {
    store.setProjectName(p.name);
    store.setClient(p.client);
    store.setInput('foundation', { ...p.inputs.foundation });
    store.setInput('beam', { ...p.inputs.beam });
    store.setInput('column', { ...p.inputs.column });
    store.setMultipliers({ ...p.multipliers });
    store.pushToast(`پروژه «${p.name}» بارگذاری شد`, 'ok');
  };
  const doExport = (): void => {
    const p = current();
    void downloadBlobDirect(exportProjectJSON(p), `CivilGenius_Project_${p.name}.json`);
  };
  const onImport = (file: File): void => {
    void file.text().then((txt) => {
      try {
        doLoad(parseProjectJSON(txt));
        refresh();
      } catch {
        store.pushToast('فایل پروژه نامعتبر است', 'bad');
      }
    });
  };

  return (
    <Card className="p-4">
      <SectionHead title="مدیریت و ذخیره پروژه‌ها" subtitle="ذخیره در LocalStorage مرورگر، بارگذاری پروژه‌های قبلی و جابه‌جایی با فایل JSON." icon={<FolderOpen size={17} />} />
      <div className="mb-3 flex flex-wrap gap-2">
        <Button variant="green" size="sm" icon={<Save size={15} />} onClick={doSave}>
          ذخیره پروژه فعلی
        </Button>
        <Button variant="outline" size="sm" icon={<Download size={15} />} onClick={doExport}>
          خروجی JSON
        </Button>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-line-2 bg-panel px-3.5 py-2 text-[12px] font-semibold text-muted transition hover:border-navy hover:text-navy">
          <Upload size={15} />
          ورود JSON
          <input type="file" accept=".json,application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ''; }} />
        </label>
      </div>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line-2 bg-panel-2 p-3 text-[11.5px] text-faint">هنوز پروژه‌ای ذخیره نشده است.</p>
      ) : (
        <div className="max-h-56 space-y-2 overflow-y-auto">
          {items.map((it) => (
            <div key={it.name} className="flex items-center gap-3 rounded-xl border border-line bg-panel-2 p-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-bold text-ink">{it.name}</div>
                <div className="mt-0.5 text-[10.5px] text-faint tnum">{it.client || '—'} · {faStamp(it.savedAt)}</div>
              </div>
              <Button variant="outline" size="sm" onClick={() => doLoad(it)}>بارگذاری</Button>
              <button className="rounded-lg p-2 text-bad transition hover:bg-bad-soft" onClick={() => { deleteProject(it.name); refresh(); }} aria-label="حذف">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function ManagementPage() {
  const store = useStore();
  useMarket(); // re-render on price changes
  const [mult, setMult] = useState<Multipliers>(store.multipliers);
  const snap = market.getSnapshot();

  const { activities, total, agg } = useMemo(
    () => buildSchedule(store.results, mult, (id) => snap.prices[id]),
    [store.results, mult, snap.prices],
  );

  const maxDay = Math.max(1, ...activities.map((a) => a.end));
  const sCurve = useMemo(() => buildSCurve(activities, maxDay), [activities, maxDay]);

  const segments: DonutSegment[] = [
    { label: 'خاک‌برداری', value: agg.filter((a) => a.materialId === 'excavation').reduce((s, a) => s + a.cost, 0), color: '#b45309' },
    { label: 'بتن (مگر و سازه‌ای)', value: agg.filter((a) => ['concrete', 'lean', 'cement', 'sand', 'gravel'].includes(a.materialId)).reduce((s, a) => s + a.cost, 0), color: '#059669' },
    { label: 'آرماتور', value: agg.filter((a) => a.materialId === 'rebar').reduce((s, a) => s + a.cost, 0), color: '#d92d20' },
    { label: 'قالب‌بندی', value: agg.filter((a) => a.materialId === 'formwork').reduce((s, a) => s + a.cost, 0), color: '#2563eb' },
  ];

  const procurement: ProcurementRow[] = agg.map((a) => {
    const def = market.def(a.materialId);
    const qty = a.qty * (1 + WASTE);
    return {
      materialId: a.materialId,
      name: def.name,
      unit: def.unit,
      qty,
      unitPrice: snap.prices[a.materialId],
      amount: qty * snap.prices[a.materialId],
      status: snap.live[a.materialId].status,
      source: def.sourceName,
    };
  });
  const procurementTotal = procurement.reduce((s, r) => s + r.amount, 0);

  const hasResults = Boolean(store.results.foundation || store.results.beam || store.results.column || store.results.slab || store.results.wall || store.results.stair || store.results.joint);

  const exportProcurement = (): void => {
    const blob = buildProcurementBlob(procurement, store.projectName || 'پروژه', projectCode('PRC'));
    const name = procurementDocName();
    const ok = downloadBlobDirect(blob, name);
    store.pushToast(ok ? 'برنامه خرید مستقیماً در پوشه Downloads ذخیره شد' : 'مرورگر اجازه دانلود نداد', ok ? 'ok' : 'warn');
  };

  const loadSample = (): void => {
    const s = buildSampleProject();
    store.setProjectName(s.projectName);
    store.setClient(s.client);
    store.setInput('foundation', s.foundation);
    store.setInput('beam', s.beam);
    store.setInput('column', s.column);
    setMult(s.multipliers);
    store.setMultipliers(s.multipliers);
    store.pushToast('پروژه نمونه بارگذاری شد — برای دیدن برنامه زمان‌بندی، سه عضو را محاسبه کنید', 'info');
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <header className="rise flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-forest text-white">
            <Building2 size={20} />
          </span>
          <div>
            <h1 className="text-lg font-bold text-ink sm:text-xl">اتاق فرمان پروژه</h1>
            <p className="mt-0.5 max-w-2xl text-[12.5px] leading-6 text-muted">
              برنامه زمان‌بندی، منحنی S جریان هزینه، تخصیص بودجه و برنامه خرید مصالح بر پایه خروجی محاسبات و نرخ روز بازار.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" icon={<FolderInput size={16} />} onClick={loadSample}>
            پروژه نمونه ارائه
          </Button>
          <Button variant="green" icon={<Download size={16} />} onClick={exportProcurement} disabled={!hasResults}>
            خروجی برنامه خرید
          </Button>
        </div>
      </header>

      <ProjectsPanel />

      {/* multipliers */}
      <Card className="p-4">
        <SectionHead title="تعداد اعضا در پروژه" subtitle="خروجی هر عضو در تعداد آن ضرب و در برنامه خرید تجمیع می‌شود." icon={<Percent size={17} />} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {(
            [
              ['foundations', 'فونداسیون'],
              ['beams', 'تیر'],
              ['columns', 'ستون'],
              ['slabs', 'سقف'],
              ['walls', 'دیوار برشی'],
              ['stairs', 'رمپ/پله'],
              ['joints', 'چشمه اتصال'],
            ] as [keyof Multipliers, string][]
          ).map(([key, label]) => (
            <div key={key} className="rounded-xl border border-line bg-panel-2 p-3">
              <div className="mb-1.5 flex items-center justify-between text-[12px]">
                <span className="font-medium text-ink">{label}</span>
                <span className="font-bold text-forest tnum">{faNum(mult[key], 0)}</span>
              </div>
              <input
                type="range"
                min={1}
                max={key === 'foundations' ? 20 : 200}
                step={1}
                value={mult[key]}
                className="range-gold"
                onChange={(e) => {
                  const next = { ...mult, [key]: Number(e.target.value) };
                  setMult(next);
                  store.setMultipliers(next);
                }}
              />
            </div>
          ))}
        </div>
      </Card>

      {!hasResults ? (
        <EmptyState
          title="هنوز محاسبه‌ای ثبت نشده است"
          text="برای ساخت برنامه زمان‌بندی و برنامه خرید، ابتدا فونداسیون، تیر و ستون را محاسبه کنید یا «پروژه نمونه ارائه» را بارگذاری کنید."
          icon={<Building2 size={26} />}
          action={
            <a href="#/foundation">
              <Button variant="green">شروع از طراحی فونداسیون</Button>
            </a>
          }
        />
      ) : (
        <>
          {/* Gantt */}
          <Card className="p-4">
            <SectionHead
              title="برنامه زمان‌بندی (Gantt)"
              subtitle="بر پایه نرخ بهره‌وری تیم: آرماتور ۷۰۰ کیلوگرم/روز، قالب ۴۵ متر مربع/روز، بتن ۵۵ متر مکعب/روز، خاک‌برداری ۵۰۰ متر مکعب/روز + ۲ روز عمل‌آوری"
              icon={<Building2 size={17} />}
              action={<Chip tone="green">جمعاً {faNum(maxDay, 0)} روز</Chip>}
            />
            <div className="space-y-2.5">
              {activities.map((a) => {
                const left = (a.start / maxDay) * 100;
                const width = Math.max(2, ((a.end - a.start) / maxDay) * 100);
                return (
                  <div key={a.id} className="flex items-center gap-3">
                    <span className="w-40 shrink-0 truncate text-[11.5px] font-medium text-ink sm:w-52">{a.label}</span>
                    <div className="relative h-6 flex-1 overflow-hidden rounded-lg bg-panel-2">
                      <div
                        className="absolute inset-y-0 flex items-center justify-center rounded-lg text-[10px] font-bold text-white transition-all duration-700"
                        style={{ left: `${left}%`, width: `${width}%`, background: a.color }}
                        title={`${faNum(a.start, 0)} تا ${faNum(a.end, 0)} روز`}
                      >
                        {width > 12 ? `${faNum(a.end - a.start, 0)} روز` : ''}
                      </div>
                    </div>
                    <span className="w-24 shrink-0 text-left text-[10.5px] text-faint tnum">{faMoney(a.cost)}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex justify-between border-t border-line pt-2 text-[10.5px] text-faint tnum">
              <span>روز ۰</span>
              <span>روز {faNum(maxDay / 2, 0)}</span>
              <span>روز {faNum(maxDay, 0)}</span>
            </div>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* S-curve */}
            <Card className="p-4">
              <SectionHead title="منحنی S جریان هزینه" subtitle="تجمعی بر حسب روز — برای برنامه‌ریزی نقدینگی" icon={<Percent size={17} />} />
              <XYChart points={sCurve} color="#059669" height={210} yLabel="تومان" />
            </Card>
            {/* donut */}
            <Card className="p-4">
              <SectionHead title="تخصیص بودجه" subtitle="سهم هر گروه عملیات از کل هزینه" icon={<Percent size={17} />} />
              <Donut segments={segments} centerValue={faNum(Math.round(total))} />
            </Card>
          </div>

          {/* procurement */}
          <Card className="overflow-hidden">
            <div className="border-b border-line bg-panel-2 px-4 py-3">
              <SectionHead
                title="برنامه خرید مصالح"
                subtitle={`با احتساب ۵٪ پرت — ${jalaliDate()}`}
                icon={<Download size={17} />}
                action={<Chip tone="green">{faMoney(procurementTotal)}</Chip>}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-right text-[12.5px]">
                <thead>
                  <tr className="bg-navy text-white">
                    {['مصالح', 'واحد', 'مقدار با پرت', 'فی (تومان)', 'مبلغ', 'منبع'].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-[11.5px] font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {procurement.map((r, i) => (
                    <tr key={r.materialId} className={`border-b border-line ${i % 2 ? 'bg-panel-2' : ''}`}>
                      <td className="px-3 py-2.5 font-semibold text-ink">{r.name}</td>
                      <td className="px-3 py-2.5 text-center text-muted">{r.unit}</td>
                      <td className="px-3 py-2.5 text-center tnum">{faNum(r.qty, 2)}</td>
                      <td className="px-3 py-2.5 text-center text-muted tnum">{faNum(r.unitPrice)}</td>
                      <td className="px-3 py-2.5 text-center font-bold text-ink tnum">{faNum(r.amount)}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={r.status === 'live' ? 'text-forest' : r.status === 'manual' ? 'text-warn' : 'text-blue'}>
                          {r.source}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-forest text-white">
                    <td colSpan={4} className="px-3 py-3 text-[13px] font-bold">
                      جمع کل خرید
                    </td>
                    <td className="px-3 py-3 text-center text-[14px] font-bold tnum">{faNum(procurementTotal)}</td>
                    <td className="px-3 py-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          <div className="grid gap-3 sm:grid-cols-3">
            {(Object.keys(store.results) as ('foundation' | 'beam' | 'column')[]).map((k) => {
              const r = store.results[k];
              if (!r) return null;
              return (
                <Card key={k} className="p-3.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[12.5px] font-bold text-ink">{CALC_META[k].title}</h3>
                    <Chip tone={r.verdict.ok ? 'ok' : 'bad'}>{r.verdict.ok ? 'ایمن' : 'نیاز به اصلاح'}</Chip>
                  </div>
                  <p className="mt-1 truncate text-[10.5px] text-faint" dir="ltr">
                    {r.code}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                    {r.metrics.slice(0, 4).map((m) => (
                      <div key={m.label} className="rounded-lg bg-panel-2 p-2">
                        <div className="truncate text-[10px] text-faint">{m.label}</div>
                        <div className="font-bold text-ink tnum">
                          {m.value} <span className="text-[9.5px] font-normal text-faint">{m.unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}


