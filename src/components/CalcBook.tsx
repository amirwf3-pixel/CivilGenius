
/* ============================================================================
 * CivilGenius v22 — deterministic, traceable calculation book
 *   • step-by-step formulas (LTR mono) with substituted values
 *   • normative design checks (مبحث نهم / ACI 318) with live badges + fix hints
 * ========================================================================== */

import { type ReactNode } from 'react';
import { BookOpen, CircleAlert, CircleCheck, CircleX, LibraryBig, ScrollText, TriangleAlert, Wand2 } from 'lucide-react';
import type { CalcResult } from '../lib/engine';
import { faNum } from '../lib/format';
import { CODE_REFS, MANUAL } from '../lib/codes';
import { Card } from './ui';

const CHECK_TONE = {
  ok: { icon: <CircleCheck size={16} className="text-forest" />, cls: 'border-mint bg-emerald-soft/60 text-forest' },
  warn: { icon: <CircleAlert size={16} className="text-warn" />, cls: 'border-[#fde68a] bg-warn-soft/60 text-warn' },
  bad: { icon: <CircleX size={16} className="text-bad" />, cls: 'border-[#fecdca] bg-bad-soft/60 text-bad' },
} as const;

export function CalcBook({ result, onAutoFix }: { result: CalcResult; onAutoFix?: (patch: Record<string, number>) => void }): ReactNode {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {/* traceable steps */}
      <Card className="p-4">
        <h3 className="mb-3 flex items-center gap-2 text-[13px] font-bold text-ink">
          <BookOpen size={16} className="text-emerald" />
          دفترچه محاسبات شفاف (گام‌به‌گام)
        </h3>
        <ol className="max-h-[420px] space-y-2.5 overflow-y-auto pl-1">
          {result.trace.map((t) => (
            <li key={t.step} className="rounded-xl border border-line bg-panel-2 p-3">
              <div className="flex items-center gap-2">
                <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-navy text-[11px] font-bold text-gold">{t.step}</span>
                <span className="text-[12px] font-semibold text-ink">{t.title}</span>
                {t.ref ? <span className="mr-auto shrink-0 rounded-md bg-navy-soft px-1.5 py-0.5 text-[9.5px] font-semibold text-navy">{t.ref}</span> : null}
              </div>
              <div dir="ltr" className="mt-1.5 rounded-lg bg-navy px-2.5 py-1.5 text-left font-mono text-[11px] text-mint">
                {t.formula}
              </div>
              {t.detail ? <div className="mt-1 text-[10.5px] leading-5 text-muted">{t.detail}</div> : null}
              <div className="mt-1 text-[11.5px] font-bold text-forest tnum">= {t.result}</div>
            </li>
          ))}
        </ol>
      </Card>

      {/* normative checks */}
      <Card className="p-4">
        <h3 className="mb-3 flex items-center gap-2 text-[13px] font-bold text-ink">
          <ScrollText size={16} className="text-gold" />
          کنترل‌های آیین‌نامه‌ای (مبحث نهم / ACI 318)
        </h3>
        <div className="space-y-2.5">
          {result.checks.map((c) => (
            <div key={c.id} className={`rounded-xl border p-3 ${CHECK_TONE[c.status].cls}`}>
              <div className="flex items-center gap-2">
                {CHECK_TONE[c.status].icon}
                <span className="text-[12px] font-bold">{c.label}</span>
                <span className="mr-auto shrink-0 rounded-md bg-white/60 px-1.5 py-0.5 text-[9.5px] font-semibold text-muted">{c.ref}</span>
              </div>
              <div className="mt-1 text-[11.5px] font-semibold tnum">{c.value}</div>
              {typeof c.dc === 'number' ? (
                <div className="mt-2">
                  <div className="mb-1 flex items-center justify-between text-[10px] font-semibold">
                    <span>نسبت تقاضا به ظرفیت (D/C)</span>
                    <span className="tnum">{faNum(c.dc, 2)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/60">
                    <div
                      className={`h-full rounded-full transition-all ${c.dc <= 1 ? 'bg-emerald' : 'bg-bad'}`}
                      style={{ width: `${Math.min(100, (c.dc / 1.5) * 100)}%` }}
                    />
                  </div>
                </div>
              ) : null}
              {c.status !== 'ok' && c.fix ? <div className="mt-1 text-[10.5px] leading-5 opacity-90">راه‌حل: {c.fix}</div> : null}
              {c.status !== 'ok' && c.suggestion ? <div className="mt-1 text-[10.5px] font-semibold leading-5">{c.suggestion}</div> : null}
              {c.status !== 'ok' && c.autofix && onAutoFix ? (
                <button
                  onClick={() => onAutoFix(c.autofix!)}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-emerald-deep px-2.5 py-1.5 text-[10.5px] font-bold text-white transition hover:bg-forest"
                >
                  <Wand2 size={12} />
                  اعمال پیشنهاد هوشمند
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * مرجع‌شناسی آیین‌نامه‌ای — attaches an explicit Persian clause/table number
 * to EVERY design parameter. Unconfirmed exact numbers are flagged
 * "REFERENCE REQUIRES MANUAL CODE-BOOK VERIFICATION" (صداقت مرجع).
 * -------------------------------------------------------------------------- */
export function CodeRefPanel(): ReactNode {
  const manual = CODE_REFS.filter((r) => r.status === 'manual');
  const verified = CODE_REFS.filter((r) => r.status === 'verified');
  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <LibraryBig size={16} className="text-gold" />
        <h3 className="text-[13px] font-bold text-ink">مرجع‌شناسی کامل پارامترهای طراحی (بند/جدول صریح آیین‌نامه)</h3>
        <span className="mr-auto rounded-md bg-navy-soft px-2 py-0.5 text-[10px] font-semibold text-navy">{CODE_REFS.length} پارامتر</span>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-panel-2 px-2.5 py-1.5 text-[10.5px] text-muted">
        <TriangleAlert size={13} className="shrink-0 text-warn" />
        شماره‌های فصلی (مبحث ششم/هفتم/نهم، آیین‌نامه ۲۸۰۰، ACI 318) قطعی است؛ شماره بند و جدول دقیقِ ویرایش‌های ۱۳۹۹/۱۴۰۰ تا تأیید نهایی با متن چاپی، با برچسب
        <span className="font-bold text-warn">{MANUAL}</span>
        درج می‌شود.
      </div>

      <div className="max-h-[360px] overflow-y-auto rounded-xl border border-line">
        <table className="w-full border-collapse text-right">
          <thead className="sticky top-0 bg-navy text-mint">
            <tr className="text-[10.5px]">
              <th className="px-3 py-2 font-bold">پارامتر طراحی</th>
              <th className="px-3 py-2 font-bold">مرجع (بند/جدول)</th>
              <th className="px-3 py-2 font-bold">وضعیت</th>
            </tr>
          </thead>
          <tbody className="text-[10.5px]">
            {[...verified, ...manual].map((r) => (
              <tr key={r.key} className="border-t border-line align-top">
                <td className="px-3 py-2 font-semibold text-ink">{r.parameter}</td>
                <td className="px-3 py-2 leading-5 text-muted">{r.ref}</td>
                <td className="px-3 py-2">
                  {r.status === 'verified' ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-soft px-1.5 py-0.5 text-[9.5px] font-bold text-forest">
                      <CircleCheck size={11} /> قطعی
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md bg-warn-soft px-1.5 py-0.5 text-[9.5px] font-bold text-warn">
                      <TriangleAlert size={11} /> نیاز به تأیید دفترچه
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 text-[10px] leading-5 text-muted">
        پارامترهای دارای وضعیت «نیاز به تأیید دفترچه»: {manual.map((m) => m.parameter).join('، ')}.
      </div>
    </Card>
  );
}


