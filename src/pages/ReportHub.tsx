
/* ============================================================================
 * CivilGenius v23 — smart calculation-book hub (/report-generator)
 *   • aggregates every computed module (foundation/beam/column/slab/wall/
 *     stair/joint) into one printable official calculation book
 *   • company logo / client / license number / custom letterhead
 *   • چاپ / PDF (window.print) + self-contained HTML + Word downloads
 * ========================================================================== */

import { useRef, useState, type ReactNode } from 'react';
import { Download, FileStack, FileText, Image as ImageIcon, Printer, X } from 'lucide-react';
import { CALC_META, type CalcResult, type CalcType } from '../lib/engine';
import { faNum, jalaliDate, jalaliNumSlug } from '../lib/format';
import { useStore } from '../lib/store';
import { Button, Card, Chip, SectionHead } from '../components/ui';
import { APP_NAME, APP_VERSION } from '../lib/version';

const ORDER: CalcType[] = ['foundation', 'beam', 'column', 'slab', 'wall', 'stair', 'ramp', 'joint'];

interface HubConfig {
  company: string;
  engineer: string;
  license: string;
  letterhead: string;
  logo: string; // dataURL
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function sectionHtml(r: CalcResult): string {
  const m = CALC_META[r.type];
  const rows = r.trace
    .map(
      (t) =>
        `<tr><td>${t.step}</td><td>${esc(t.title)}${t.ref ? ` <i>(${esc(t.ref)})</i>` : ''}</td><td dir="ltr" style="font-family:monospace">${esc(t.formula)}</td><td>${esc(t.result)}</td></tr>`,
    )
    .join('');
  const checks = r.checks
    .map((c) => {
      const st = c.status === 'ok' ? '✅' : c.status === 'warn' ? '⚠️' : '❌';
      const dc = typeof c.dc === 'number' ? faNum(c.dc, 2) : '—';
      const bar =
        typeof c.dc === 'number'
          ? `<span style="display:inline-block;width:90px;height:8px;background:#eee;border-radius:4px;vertical-align:middle"><span style="display:block;height:8px;border-radius:4px;width:${Math.min(100, (c.dc / 1.5) * 100)}%;background:${c.dc <= 1 ? '#059669' : '#dc2626'}"></span></span>`
          : '';
      return `<tr><td>${st}</td><td>${esc(c.label)}</td><td>${esc(c.value)}</td><td>${dc} ${bar}</td><td>${esc(c.ref)}</td></tr>`;
    })
    .join('');
  const bbs = r.bbs?.length
    ? `<h4>لیستوفر (BBS)</h4><table><tr><th>مارک</th><th>شرح</th><th>قطر</th><th>طول برش</th><th>تعداد</th><th>وزن kg</th></tr>${r.bbs
        .map((b) => `<tr><td>${b.mark}</td><td>${esc(b.label)}</td><td>${faNum(b.dia, 0)}</td><td>${faNum(b.lenMm, 0)}</td><td>${faNum(b.count, 0)}</td><td>${faNum(b.weightKg, 1)}</td></tr>`)
        .join('')}</table>`
    : '';
  const boq = `<h4>متره و برآورد</h4><table><tr><th>شرح</th><th>واحد</th><th>مقدار</th></tr>${r.boq
    .map((b) => `<tr><td>${esc(b.title)}</td><td>${esc(b.unit)}</td><td>${faNum(b.qty, 2)}</td></tr>`)
    .join('')}</table>`;
  return `<section class="mod"><h2>فصل ${esc(m.title)} <span class="code">(${esc(r.code)})</span></h2>
<p class="verdict">${esc(r.verdict.title)} — ${esc(r.verdict.text)}</p>
<h4>دفترچه محاسبات شفاف</h4>
<table><tr><th>#</th><th>گام</th><th>فرمول</th><th>نتیجه</th></tr>${rows}</table>
<h4>کنترل‌های آیین‌نامه‌ای + D/C</h4>
<table><tr><th>وضعیت</th><th>کنترل</th><th>مقدار</th><th>D/C</th><th>مرجع</th></tr>${checks}</table>
${bbs}${boq}</section>`;
}

export function buildReportHtml(cfg: HubConfig, results: Partial<Record<CalcType, CalcResult>>, projectName: string, client: string): string {
  const secs = ORDER.filter((t) => results[t]).map((t) => sectionHtml(results[t]!)).join('\n');
  const n = ORDER.filter((t) => results[t]).length;
  return `<!doctype html><html dir="rtl" lang="fa"><head><meta charset="utf-8"><title>دفترچه محاسبات ${esc(projectName)}</title>
<style>
 body{font-family:Tahoma,'Segoe UI',sans-serif;color:#101828;margin:28px;line-height:1.9;font-size:13px}
 header{border:2px solid #14544a;border-radius:12px;padding:14px 18px;display:flex;gap:14px;align-items:center}
 header img{width:64px;height:64px;object-fit:contain;border-radius:10px}
 h1{font-size:17px;margin:0;color:#14544a} h2{color:#14544a;border-bottom:2px solid #d1fae5;padding-bottom:6px;margin-top:26px}
 h4{margin:14px 0 6px;color:#065f46} .code{font-size:11px;color:#667085}
 table{width:100%;border-collapse:collapse;font-size:11.5px;margin:6px 0 10px}
 th,td{border:1px solid #d5dbe3;padding:5px 8px;text-align:right;vertical-align:top}
 th{background:#eef7f2;color:#065f46} .verdict{background:#f0fdf6;border:1px solid #bbf7d0;border-radius:8px;padding:8px 12px}
 .meta{color:#475467;font-size:11px} section.mod{page-break-inside:auto} tr{page-break-inside:avoid}
 @page{margin:16mm}
</style></head><body>
<header>
 ${cfg.logo ? `<img src="${cfg.logo}" alt="logo">` : ''}
 <div style="flex:1">
   <h1>${esc(cfg.company || 'دفتر مهندسی')}</h1>
   <div class="meta">${esc(cfg.letterhead || 'دفترچه محاسبات رسمی سازه بتنی — مباحث ششم/هفتم/نهم مقررات ملی و آیین‌نامه ۲۸۰۰')}</div>
   <div class="meta">مهندس محاسب: ${esc(cfg.engineer || '—')} | شماره نظام مهندسی: ${esc(cfg.license || '—')}</div>
 </div>
 <div class="meta" style="text-align:left">تاریخ: ${jalaliDate()}<br>پروژه: ${esc(projectName)}<br>${esc(client)}</div>
</header>
<h2>فهرست مطالب</h2><ol>${ORDER.filter((t) => results[t]).map((t) => `<li>فصل ${esc(CALC_META[t].title)} — کد ${esc(results[t]!.code)}</li>`).join('')}</ol>
${secs || '<p>هنوز محاسبه‌ای انجام نشده است — از ماژول‌های طراحی، خروجی بگیرید.</p>'}
<footer class="meta" style="margin-top:24px;border-top:1px solid #d5dbe3;padding-top:8px">تولید: ${APP_NAME} ${APP_VERSION} — ${n} فصل — این دفترچه جنبه محاسباتی دارد و ممیزی نهایی با مهندس مهرشده است.</footer>
</body></html>`;
}

export function ReportHubPage(): ReactNode {
  const store = useStore();
  const [cfg, setCfg] = useState<HubConfig>({ company: '', engineer: '', license: '', letterhead: '', logo: '' });
  const [tab, setTab] = useState<'preview' | 'settings'>('preview');
  const fileRef = useRef<HTMLInputElement | null>(null);

  const html = buildReportHtml(cfg, store.results, store.projectName, store.client);
  const count = ORDER.filter((t) => store.results[t]).length;

  const download = (kind: 'html' | 'word'): void => {
    const name = `CivilGenius_Report_دفترچه_محاسبات_${jalaliNumSlug()}.${kind === 'html' ? 'html' : 'doc'}`;
    const word =
      kind === 'word'
        ? html.replace('<html dir="rtl" lang="fa">', '<html xmlns:w="urn:schemas-microsoft-com:office:word" dir="rtl" lang="fa">')
        : html;
    const blob = new Blob(['\ufeff' + word], { type: kind === 'html' ? 'text/html;charset=utf-8' : 'application/msword' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
    store.pushToast(`فایل ${name} ذخیره شد`, 'ok');
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <header className="rise flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-navy text-gold">
            <FileStack size={20} />
          </span>
          <div>
            <h1 className="text-lg font-bold text-ink sm:text-xl">هاب تولید هوشمند دفترچه محاسبات رسمی</h1>
            <p className="mt-0.5 max-w-2xl text-[12.5px] leading-6 text-muted">
              تمام فصل‌های محاسبه‌شده (فونداسیون، تیر، ستون، سقف، دیوار برشی، رمپ/راهپله و چشمه اتصال) در یک دفترچه یکپارچه با سربرگ
              اختصاصی، قابل چاپ/PDF، HTML خودکفا و Word.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip tone="ok">{faNum(count, 0)} فصل آماده</Chip>
          <Button variant="outline" icon={<Printer size={15} />} onClick={() => window.print()}>
            چاپ / ذخیره PDF
          </Button>
          <Button variant="outline" icon={<Download size={15} />} onClick={() => download('html')}>
            دانلود HTML
          </Button>
          <Button variant="green" icon={<FileText size={15} />} onClick={() => download('word')}>
            دانلود Word
          </Button>
        </div>
      </header>

      <Card className="p-3">
        <div className="flex gap-1">
          <button
            onClick={() => setTab('preview')}
            className={`rounded-lg px-3 py-2 text-[12px] font-bold transition ${tab === 'preview' ? 'bg-emerald-deep text-white' : 'text-muted hover:text-ink'}`}
          >
            پیش‌نمایش دفترچه
          </button>
          <button
            onClick={() => setTab('settings')}
            className={`rounded-lg px-3 py-2 text-[12px] font-bold transition ${tab === 'settings' ? 'bg-emerald-deep text-white' : 'text-muted hover:text-ink'}`}
          >
            سربرگ و لوگو
          </button>
        </div>
      </Card>

      {tab === 'settings' ? (
        <Card className="p-4">
          <SectionHead title="تنظیمات سربرگ رسمی" subtitle="لوگو، نام شرکت/مهندس، شماره نظام مهندسی و متن سربرگ" icon={<ImageIcon size={17} />} />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-medium text-ink">نام شرکت / دفتر مهندسی</span>
              <input className="field-input focus:field-input-focus" value={cfg.company} onChange={(e) => setCfg({ ...cfg, company: e.target.value })} placeholder="مثلاً: دفتر مهندسی سازه پایدار" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-medium text-ink">مهندس محاسب</span>
              <input className="field-input focus:field-input-focus" value={cfg.engineer} onChange={(e) => setCfg({ ...cfg, engineer: e.target.value })} placeholder="نام و نام خانوادگی" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-medium text-ink">شماره نظام مهندسی</span>
              <input className="field-input focus:field-input-focus" value={cfg.license} onChange={(e) => setCfg({ ...cfg, license: e.target.value })} placeholder="مثلاً: ۱۰۱۲۳۴۵۶" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-medium text-ink">متن سربرگ اختصاصی</span>
              <input className="field-input focus:field-input-focus" value={cfg.letterhead} onChange={(e) => setCfg({ ...cfg, letterhead: e.target.value })} placeholder="عنوان رسمی دفترچه" />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const rd = new FileReader();
                rd.onload = (): void => setCfg((c) => ({ ...c, logo: String(rd.result) }));
                rd.readAsDataURL(f);
              }}
            />
            <Button variant="outline" icon={<ImageIcon size={15} />} onClick={() => fileRef.current?.click()}>
              بارگذاری لوگو
            </Button>
            {cfg.logo ? (
              <>
                <img src={cfg.logo} alt="لوگو" className="size-12 rounded-lg border border-line bg-white object-contain p-1" />
                <Button variant="ghost" icon={<X size={14} />} onClick={() => setCfg({ ...cfg, logo: '' })}>
                  حذف لوگو
                </Button>
              </>
            ) : null}
            <span className="text-[11px] text-faint">کارفرما و نام پروژه از تنظیمات پروژه (هدر اپلیکیشن) خوانده می‌شود.</span>
          </div>
        </Card>
      ) : null}

      <div className="print-area glass overflow-hidden p-0">
        <iframe title="پیش‌نمایش دفترچه محاسبات" srcDoc={html} className="h-[70vh] w-full bg-white" />
      </div>
    </div>
  );
}


