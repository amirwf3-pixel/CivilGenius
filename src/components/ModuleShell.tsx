
/* ============================================================================
 * CivilGenius v20 — ModuleShell: shared engineering page layout
 *   inputs → staged compute button → verdict → metrics grid → sketch → BOQ
 * ========================================================================== */

import { type ReactNode } from 'react';
import { Activity, CircleCheck, CircleX, RotateCcw, TriangleAlert, Wand2 } from 'lucide-react';
import type { CalcResult } from '../lib/engine';
import { COMPUTE_STAGES, useStore, type StageState } from '../lib/store';
import { market } from '../lib/market';
import { faNum } from '../lib/format';
import { BOQ } from './BOQ';
import { CalcBook, CodeRefPanel } from './CalcBook';
import { Chip } from './ui';
import { Sketch } from './Sketches';
import { smartOptimize } from '../lib/smartOptimizer';

function ComputeButton({ stage, onCompute, onReset }: { stage: StageState; onCompute: () => void; onReset: () => void }): ReactNode {
  const pct = stage.busy ? Math.round(((stage.step + 1) / COMPUTE_STAGES.length) * 100) : 0;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={onCompute}
          disabled={stage.busy}
          className="group relative inline-flex min-w-[210px] flex-1 items-center justify-center gap-2.5 overflow-hidden rounded-xl bg-emerald px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald/25 transition-all hover:bg-forest active:scale-[0.98] disabled:cursor-wait disabled:opacity-90 sm:flex-none"
        >
          {stage.busy ? (
            <>
              <span className="size-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
              {stage.label}
            </>
          ) : (
            <>
              <Activity size={17} />
              محاسبه و صدور اسناد
            </>
          )}
          {stage.busy ? (
            <span className="absolute inset-x-0 bottom-0 h-1 bg-white/25">
              <span className="block h-full bg-white transition-all duration-200" style={{ width: `${pct}%` }} />
            </span>
          ) : null}
        </button>
        <button
          onClick={onReset}
          className="inline-flex items-center gap-2 rounded-xl border border-line-2 bg-panel px-4 py-3.5 text-[13px] font-semibold text-muted transition hover:border-navy hover:text-navy"
        >
          <RotateCcw size={15} />
          بازنشانی
        </button>
      </div>
      {stage.error ? (
        <p className="flex items-center gap-2 rounded-lg border border-[#fecdca] bg-bad-soft px-3 py-2 text-[12px] text-bad">
          <CircleX size={15} />
          {stage.error}
        </p>
      ) : null}
    </div>
  );
}

export function ModuleShell({
  title,
  subtitle,
  icon,
  fields,
  stage,
  onCompute,
  onReset,
  result,
  extra,
  reference,
  onAutoFix,
  onSample,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  fields: ReactNode;
  stage: StageState;
  onCompute: () => void;
  onReset: () => void;
  result: CalcResult | null;
  extra?: ReactNode;
  reference?: string;
  onAutoFix?: (patch: Record<string, number>) => void;
  /** one-click enterprise demo preset (round-32) */
  onSample?: () => void;
}): ReactNode {
  const store = useStore();
  const missing = market.missingManual();
  /* v24: universal pass guarantee — every failing check (including warn) must have autofix; smart optimizer iterates until all green */
  const failingChecks = result ? result.checks.filter((c) => c.status !== 'ok') : [];
  const smartCount = failingChecks.length;
  const mergedFix: Record<string, number> = result
    ? result.checks.reduce<Record<string, number>>((acc, c) => (c.status !== 'ok' && c.autofix ? { ...acc, ...c.autofix } : acc), {})
    : {};

  const handleSmartFix = (): void => {
    if (!result || !onAutoFix) return;
    try {
      const curInput = (store.inputs as any)[result.type];
      if (!curInput) {
        onAutoFix(mergedFix);
        return;
      }
      const opt = smartOptimize(result.type, curInput);
      if (opt.allOk) {
        // patch is diff of optimized vs current, but passing full optimized as patch works because onAutoFix merges
        const patch: Record<string, number> = {};
        for (const k of Object.keys(opt.input as any)) {
          const v = (opt.input as any)[k];
          if (typeof v === 'number' && (curInput as any)[k] !== v) patch[k] = v;
        }
        // if patch empty (should not), fallback to mergedFix
        onAutoFix(Object.keys(patch).length ? patch : mergedFix);
      } else {
        // fallback to merged fix if optimizer could not reach all ok (edge case)
        onAutoFix(mergedFix);
      }
    } catch {
      onAutoFix(mergedFix);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <header className="rise flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-navy text-gold">{icon}</span>
          <div>
            <h1 className="text-lg font-bold text-ink sm:text-xl">{title}</h1>
            <p className="mt-0.5 max-w-2xl text-[12.5px] leading-6 text-muted">{subtitle}</p>
            {reference ? <p className="mt-1 text-[11px] text-faint">{reference}</p> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onSample ? (
            <button
              onClick={onSample}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gold/60 bg-panel px-3 py-2 text-[11.5px] font-bold text-gold-2 transition hover:bg-gold hover:text-navy"
            >
              <Wand2 size={14} />
              بارگذاری پروژه نمونه سازمانی
            </button>
          ) : null}
          <Chip tone="neutral">{store.projectName || 'پروژه بدون نام'}</Chip>
          {result ? <Chip tone="green">کد سند: {result.code}</Chip> : <Chip tone="neutral">محاسبه‌نشده — آماده</Chip>}
        </div>
      </header>

      {missing.length ? (
        <a
          href="#/market"
          className="rise flex items-center gap-2.5 rounded-xl border border-[#fde68a] bg-warn-soft px-4 py-3 text-[12.5px] text-warn transition hover:border-gold"
        >
          <TriangleAlert size={16} />
          <span>
            قیمت <b>قالب‌بندی</b> و <b>خاک‌برداری</b> منبع عمومی ندارد — برای برآورد دقیق، نرخ توافقی کارگاه را دستی وارد کنید.
          </span>
          <span className="mr-auto shrink-0 font-semibold underline">ورود قیمت دستی</span>
        </a>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        {/* inputs */}
        <section className="glass h-max p-4 sm:p-5">
          <h2 className="mb-4 flex items-center gap-2 text-[13px] font-bold text-ink">
            <span className="size-1.5 rounded-full bg-gold" />
            ورودی‌های طراحی
          </h2>
          <div className="space-y-4">{fields}</div>
          <div className="mt-5 border-t border-line pt-4">
            <ComputeButton stage={stage} onCompute={onCompute} onReset={onReset} />
          </div>
        </section>

        {/* results */}
        <section className="space-y-5">
          {!result ? (
            <div className="bp-grid grid min-h-[320px] place-items-center rounded-2xl border border-dashed border-line-2 bg-panel-2 p-8 text-center">
              <div>
                <span className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-navy-soft text-navy">{icon}</span>
                <h3 className="text-sm font-bold text-ink">هنوز محاسبه‌ای انجام نشده است</h3>
                <p className="mx-auto mt-1.5 max-w-md text-[12px] leading-6 text-muted">
                  ورودی‌ها را تنظیم کنید و دکمه «محاسبه و صدور اسناد» را بزنید. خروجی شامل ارزیابی مهندسی، متره و برآورد با قیمت
                  روز بازار و سه فایل قابل ویرایش (Excel، Word، DXF) است.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div
                className={`rise flex flex-wrap items-start justify-between gap-3 rounded-2xl border p-4 ${
                  result.verdict.ok ? 'border-mint bg-emerald-soft' : 'border-[#fecdca] bg-bad-soft'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {result.verdict.ok ? <CircleCheck size={20} className="text-forest" /> : <CircleX size={20} className="text-bad" />}
                  <div>
                    <h3 className={`text-[13.5px] font-bold ${result.verdict.ok ? 'text-forest' : 'text-bad'}`}>{result.verdict.title}</h3>
                    <p className="mt-0.5 max-w-2xl text-[12px] leading-6 text-muted">{result.verdict.text}</p>
                  </div>
                </div>
              </div>

              {onAutoFix && smartCount > 0 ? (
                <div className="rise flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold/60 bg-gradient-to-l from-navy to-[#14544a] p-4 text-white">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gold text-navy"><Wand2 size={17} /></span>
                    <div>
                      <h3 className="text-[13px] font-bold">بهینه‌سازی هوشمند — {faNum(smartCount, 0)} مورد قابل اصلاح</h3>
                      <p className="mt-0.5 text-[11.5px] leading-5 text-white/70">یک کلیک: قطر/فاصله میلگرد، ضخامت و محصورشدگی ویژه طبق مبحث نهم تنظیم و نشان‌های زرد/نارنجی به سبز تبدیل می‌شوند.</p>
                    </div>
                  </div>
                  <button
                    onClick={handleSmartFix}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gold px-4 py-2.5 text-[12px] font-bold text-navy transition hover:brightness-110"
                  >
                    <Wand2 size={14} />
                    اعمال بهینه‌سازی هوشمند
                  </button>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {result.metrics.map((m) => (
                  <div
                    key={m.label}
                    className={`glass border p-3 ${
                      m.tone === 'bad' ? 'border-[#fecdca]' : m.tone === 'warn' ? 'border-[#fde68a]' : m.tone === 'ok' ? 'border-mint' : 'border-line'
                    }`}
                  >
                    <div className="text-[10.5px] font-medium text-muted">{m.label}</div>
                    <div
                      className={`mt-1 text-[15px] font-bold tnum ${
                        m.tone === 'bad' ? 'text-bad' : m.tone === 'warn' ? 'text-warn' : m.tone === 'ok' ? 'text-forest' : 'text-ink'
                      }`}
                    >
                      {m.value}
                      {m.unit ? <span className="mr-1 text-[10px] font-medium text-faint">{m.unit}</span> : null}
                    </div>
                    {m.hint ? <div className="mt-0.5 text-[10px] text-faint">{m.hint}</div> : null}
                  </div>
                ))}
              </div>

              <div className="glass overflow-hidden">
                <div className="border-b border-line bg-panel-2 px-4 py-2.5">
                  <h3 className="text-[13px] font-bold text-ink">نقشه ترسیمی زنده</h3>
                </div>
                <div className="bp-grid p-3">
                  <Sketch diagram={result.diagram} />
                </div>
              </div>

              <CalcBook result={result} onAutoFix={onAutoFix} />

              <CodeRefPanel />

              {extra}

              <BOQ result={result} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}


