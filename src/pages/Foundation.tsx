
/* ============================================================================
 * CivilGenius v20 — Foundation design page (limits expanded in round 6)
 * ========================================================================== */

import { Ruler, TrendingUp } from 'lucide-react';
import { calculateFoundation, DEFAULT_FOUNDATION, priceBOQ, type FoundationInput } from '../lib/engine';
import { faMoney, faNum } from '../lib/format';
import { market, useMarket } from '../lib/market';
import { buildSampleProject, useStageCompute, useStore } from '../lib/store';
import { Field, SelectField } from '../components/Field';
import { ModuleShell } from '../components/ModuleShell';
import { BbsTable } from '../components/Bbs';
import { FormSection } from '../components/ui';
import { useMemo, type ReactElement, type ReactNode } from 'react';

export function FoundationPage() {
  const store = useStore();
  const input = store.inputs.foundation;
  const { stage, run } = useStageCompute();

  const set = <K extends keyof FoundationInput>(key: K, value: FoundationInput[K]): void =>
    store.setInput('foundation', { ...input, [key]: value });

  /** one-click enterprise demo preset: fills proven inputs + computes (round-32) */
  const loadSample = (): void => {
    const s = buildSampleProject();
    const ni = s.foundation;
    store.setInput('foundation', ni);
    void run('foundation', ni, (r) => store.setResult('foundation', r));
  };

  return (
    <ModuleShell
      title="طراحی فونداسیون گسترده"
      subtitle="ظرفیت باربری خاک با روابط ترزاگی، کنترل تنش مجاز، برش یک‌طرفه و طراحی شبکه آرماتور دو طرفه با متره و برآورد روز."
      reference="مراجع: مبحث هفتم مقررات ملی ساختمان (پی و پی‌سازی) — روش ترزاگی با ضریب شکل مستطیل"
      icon={<Ruler size={20} />}
      stage={stage}
      onCompute={() => void run('foundation', input, (r) => store.setResult('foundation', r))}
      onAutoFix={(patch) => { const ni = { ...input, ...patch }; store.setInput('foundation', ni); void run('foundation', ni, (r) => store.setResult('foundation', r)); }}
      onSample={loadSample}
      onReset={() => store.setInput('foundation', { ...DEFAULT_FOUNDATION })}
      result={store.results.foundation ?? null}
      fields={
        <>
          <FormSection title="مشخصات هندسی مقطع">
            <Field label="طول پلان (L)" value={input.L} onChange={(v) => set('L', v)} min={2} max={80} step={0.5} unit="متر" decimals={2} />
            <Field label="عرض پلان (B)" value={input.B} onChange={(v) => set('B', v)} min={2} max={50} step={0.5} unit="متر" decimals={2} />
            <Field label="ضخامت فونداسیون (H)" value={input.H} onChange={(v) => set('H', v)} min={0.3} max={5} step={0.1} unit="متر" decimals={2} />
            <Field label="عمق استقرار (Df)" value={input.Df} onChange={(v) => set('Df', v)} min={0} max={8} step={0.1} unit="متر" decimals={2} />
            <Field label="ابعاد ستون" value={input.cs} onChange={(v) => set('cs', v)} min={200} max={2000} step={50} unit="میلی‌متر" />
          </FormSection>
          <FormSection title="مشخصات مصالح و خاک">
            <Field label="چسبندگی خاک (c)" tip="مبحث هفتم: چسبندگی مؤثر خاک؛ در خاک‌های دانه‌ای c≈۰ و در رس‌ها تا ۱۰۰+ کیلوپاسکال." value={input.c} onChange={(v) => set('c', v)} min={0} max={200} step={5} unit="کیلوپاسکال" />
            <Field label="زاویه اصطکاک (φ)" tip="مبحث هفتم: φ برای ماسه متراکم ۳۶–۴۰، ماسه سست ۳۰–۳۴ و رس ۲۰–۳۰ درجه." value={input.phi} onChange={(v) => set('phi', v)} min={0} max={45} step={1} unit="درجه" />
            <Field label="وزن مخصوص خاک (γ)" tip="مبحث هفتم: γ اشباع تا ۲۰ و خشک حدود ۱۷ کیلونیوتن بر متر مکعب." value={input.gamma} onChange={(v) => set('gamma', v)} min={10} max={35} step={0.5} unit="kN/m³" decimals={1} />
            <Field label="مقاومت بتن (fc)" value={input.Fc} onChange={(v) => set('Fc', v)} min={20} max={50} step={1} unit="مگاپاسکال" />
            <Field label="تسلیم فولاد (fy)" value={input.Fy} onChange={(v) => set('Fy', v)} min={240} max={500} step={10} unit="مگاپاسکال" />
            <Field label="پوشش بتنی" tip="مبحث نهم جدول ۹-۳-۱: حداقل پوشش آرماتور در مجاورت خاک ۷۵ میلی‌متر." value={input.cover} onChange={(v) => set('cover', v)} min={30} max={100} step={5} unit="میلی‌متر" />
            <div className="col-span-2">
              <SelectField label="نحوه تأمین بتن" value={input.mixMode} onChange={(v) => set('mixMode', v as FoundationInput['mixMode'])} options={[{ value: 'ready', label: 'بتن آماده با پمپ (C25)' }, { value: 'site', label: 'بتن درجا — سیمان پاکتی + شن + ماسه' }]} hint="در حالت درجا، اقلام سیمان، شن و ماسه جداگانه در متره آورده می‌شوند." />
            </div>
          </FormSection>
          <FormSection title="بارگذاری و تنظیمات میلگرد">
            <Field label="بار محوری وارده (P)" value={input.P} onChange={(v) => set('P', v)} min={50} max={200000} step={50} unit="کیلونیوتن" />
            <Field label="ضریب اطمینان" tip="مبحث هفتم: ضریب اطمینان باربری معمولاً ۳." value={input.FS} onChange={(v) => set('FS', v)} min={2} max={4} step={0.5} unit="" decimals={1} />
            <Field label="قطر میلگرد" tip="مبحث نهم: حداقل سایز میلگرد شبکه فونداسیون ۱۲ میلی‌متر (A3)." value={input.barDia} onChange={(v) => set('barDia', v)} min={12} max={32} step={2} unit="میلی‌متر" />
            <Field label="فاصله میلگردهای سفره (s)" tip="۰ = محاسبه خودکار از لنگر بحرانی." value={input.spacing} onChange={(v) => set('spacing', v)} min={0} max={300} step={25} unit="mm" />
          </FormSection>
        </>
      }
      extra={
        store.results.foundation ? (
          <div className="space-y-4"><div className="glass p-4">
            <h3 className="mb-3 text-[13px] font-bold text-ink">نسبت تنش وارده به ظرفیت مجاز</h3>
            <UtilizationBar ratio={store.results.foundation.extras.utilization} qNet={store.results.foundation.extras.qNet} qallow={store.results.foundation.extras.qallow} />
            <p className="mt-2 text-[11px] leading-5 text-faint">
              تنش وارده {faNum(store.results.foundation.extras.qNet, 1)} کیلوپاسکال در برابر تنش مجاز {faNum(store.results.foundation.extras.qallow, 0)}{' '}
              کیلوپاسکال. محدوده سبز تا ۸۵٪ ظرفیت است.
            </p>
          </div>
          <Sensitivity input={input} />
          <BbsTable result={store.results.foundation} />
          </div>
        ) : null
      }
    />
  );
}

function UtilizationBar({ ratio, qNet, qallow }: { ratio: number; qNet: number; qallow: number }) {
  const pct = Math.min(100, ratio * 100);
  const color = ratio <= 0.85 ? '#059669' : ratio <= 1 ? '#d97706' : '#d92d20';
  return (
    <div>
      <div className="relative h-3 overflow-hidden rounded-full bg-[#eef0f4]">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
        <div className="absolute inset-y-0 right-[85%] w-px bg-navy/25" />
      </div>
      <div className="mt-1.5 flex justify-between text-[10.5px] text-faint tnum">
        <span>{faNum(qNet, 1)} kPa وارده</span>
        <span className="font-bold" style={{ color }}>
          {faNum(ratio * 100, 1)}٪
        </span>
        <span>{faNum(qallow, 0)} kPa مجاز</span>
      </div>
    </div>
  );
}

function Sensitivity({ input }: { input: FoundationInput }): ReactNode {
  const snap = useMarket();
  const data = useMemo(() => {
    const totalFor = (r: ReturnType<typeof calculateFoundation>, mult = (_id: string, p: number) => p): number =>
      priceBOQ(
        r.boq,
        (id) => mult(id, snap.prices[id]),
        (id) => snap.live[id].status,
        (id) => ({ name: market.def(id).sourceName, url: market.def(id).sourceUrl }),
      ).total;
    const dias = [12, 14, 16, 18, 20].map((d) => ({ label: `Ø${d}`, value: totalFor(calculateFoundation({ ...input, barDia: d })) }));
    const grades = [
      { label: 'C25', m: 1 },
      { label: 'C30', m: 1.06 },
      { label: 'C35', m: 1.12 },
    ].map((g) => ({ label: g.label, value: totalFor(calculateFoundation(input), (id, p) => (id === 'concrete' || id === 'lean' || id === 'cement' ? p * g.m : p)) }));
    return { dias, grades };
  }, [input, snap]);

  const max = Math.max(...data.dias.map((d) => d.value), ...data.grades.map((g) => g.value), 1);
  const bars = (list: { label: string; value: number }[]): ReactElement => (
    <div className="space-y-2">
      {list.map((b) => (
        <div key={b.label}>
          <div className="mb-0.5 flex justify-between text-[10.5px]">
            <span className="font-semibold text-muted" dir="ltr">{b.label}</span>
            <span className="font-bold text-ink tnum">{faMoney(b.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-gradient-to-l from-emerald to-forest" style={{ width: `${(b.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="glass p-4">
      <h3 className="mb-3 flex items-center gap-2 text-[13px] font-bold text-ink">
        <TrendingUp size={16} className="text-gold" />
        تحلیل حساسیت هزینه کل
      </h3>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <div className="mb-2 text-[11px] font-semibold text-muted">با تغییر سایز میلگرد شبکه</div>
          {bars(data.dias)}
        </div>
        <div>
          <div className="mb-2 text-[11px] font-semibold text-muted">با تغییر رده بتن</div>
          {bars(data.grades)}
        </div>
      </div>
    </div>
  );
}


