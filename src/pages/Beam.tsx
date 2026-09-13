
/* ============================================================================
 * CivilGenius v20 — Beam design page (BMD/SFD included)
 * ========================================================================== */

import { Waves } from 'lucide-react';
import { DEFAULT_BEAM, type BeamInput } from '../lib/engine';
import { faNum } from '../lib/format';
import { buildSampleProject, useStageCompute, useStore } from '../lib/store';
import { Field, SelectField } from '../components/Field';
import { ModuleShell } from '../components/ModuleShell';
import { BbsTable } from '../components/Bbs';
import { FormSection } from '../components/ui';

export function BeamPage() {
  const store = useStore();
  const input = store.inputs.beam;
  const { stage, run } = useStageCompute();
  const set = <K extends keyof BeamInput>(key: K, value: BeamInput[K]): void => store.setInput('beam', { ...input, [key]: value });
  const result = store.results.beam ?? null;

  /** one-click enterprise demo preset: fills proven inputs + computes (round-32) */
  const loadSample = (): void => {
    const s = buildSampleProject();
    const ni = s.beam;
    store.setInput('beam', ni);
    void run('beam', ni, (r) => store.setResult('beam', r));
  };

  return (
    <ModuleShell
      title="طراحی تیر بتنی"
      subtitle="لنگر و برش نهایی با ترکیب بار 1.2D+1.6L، محاسبه نسبت آرماتور، طراحی خاموت، کنترل خیز و نمودارهای لنگر و برش."
      reference="مراجع: مبحث ششم (بارها) و مبحث نهم مقررات ملی ساختمان (طرح بتن آرمه)"
      icon={<Waves size={20} />}
      stage={stage}
      onCompute={() => void run('beam', input, (r) => store.setResult('beam', r))}
      onAutoFix={(patch) => { const ni = { ...input, ...patch }; store.setInput('beam', ni); void run('beam', ni, (r) => store.setResult('beam', r)); }}
      onSample={loadSample}
      onReset={() => store.setInput('beam', { ...DEFAULT_BEAM })}
      result={result}
      fields={
        <>
          <FormSection title="مشخصات هندسی مقطع">
            <Field label="دهانه آزاد (L)" value={input.L} onChange={(v) => set('L', v)} min={1} max={40} step={0.1} unit="متر" decimals={2} />
            <Field label="عرض مقطع (b)" value={input.b} onChange={(v) => set('b', v)} min={100} max={2000} step={10} unit="میلی‌متر" />
            <Field label="ارتفاع مقطع (h)" value={input.h} onChange={(v) => set('h', v)} min={150} max={4000} step={10} unit="میلی‌متر" />
            <div className="col-span-2">
              <SelectField label="نوع تکیه‌گاه" value={input.support} onChange={(v) => set('support', v as BeamInput['support'])} options={[{ value: 'simple', label: 'دو سر مفصل (M = wL²/8)' }, { value: 'continuous', label: 'پیوسته — دهانه میانی (M = wL²/12)' }]} />
            </div>
          </FormSection>
          <FormSection title="مشخصات مصالح">
            <Field label="مقاومت بتن (fc)" tip="مبحث نهم: حداقل fc برای اعضای خمشی ۲۰ مگاپاسکال (C20)." value={input.Fc} onChange={(v) => set('Fc', v)} min={20} max={50} step={1} unit="مگاپاسکال" />
            <Field label="تسلیم فولاد (fy)" value={input.Fy} onChange={(v) => set('Fy', v)} min={240} max={500} step={10} unit="مگاپاسکال" />
            <Field label="پوشش بتنی" tip="مبحث نهم جدول ۹-۳-۱: پوشش خاموت/میلگرد تیر در معرض هوا حداقل ۴۰ میلی‌متر." value={input.cover} onChange={(v) => set('cover', v)} min={20} max={80} step={5} unit="میلی‌متر" />
          </FormSection>
          <FormSection title="بارگذاری و تنظیمات میلگرد">
            <Field label="بار مرده وارد (wd)" value={input.wd} onChange={(v) => set('wd', v)} min={1} max={500} step={1} unit="kN/m" />
            <Field label="بار زنده وارد (wl)" value={input.wl} onChange={(v) => set('wl', v)} min={1} max={300} step={1} unit="kN/m" />
            <Field label="لنگر پیچشی (Tu)" tip="مبحث نهم بند ۹-۱۵-۸: زیر آستانه φ·Tcr/4 از طراحی پیچشی صرف‌نظر می‌شود." value={input.Tu} onChange={(v) => set('Tu', v)} min={0} max={300} step={1} unit="kN·m" />
            <Field label="قطر میلگرد اصلی" value={input.barDia} onChange={(v) => set('barDia', v)} min={12} max={36} step={2} unit="میلی‌متر" />
            <Field label="تعداد سفره‌های کششی" value={input.tensionLayers} onChange={(v) => set('tensionLayers', v)} min={1} max={2} step={1} unit="سفره" />
            <Field label="میلگرد تقویتی بالا (تعداد)" value={input.compBars} onChange={(v) => set('compBars', v)} min={0} max={8} step={1} unit="عدد" />
            <Field label="قطر میلگرد تقویتی" value={input.compBarDia} onChange={(v) => set('compBarDia', v)} min={12} max={36} step={2} unit="میلی‌متر" />
            <Field label="قطر خاموت" value={input.stirrupDia} onChange={(v) => set('stirrupDia', v)} min={8} max={16} step={2} unit="میلی‌متر" />
            <Field label="تعداد شاخه‌های خاموت" value={input.stirrupLegs} onChange={(v) => set('stirrupLegs', v)} min={2} max={6} step={1} unit="شاخه" />
            <Field label="فاصله خاموت‌ها (s)" tip="ACI: حداکثر d/2 یا ۳۰۰ میلی‌متر. مقدار ۰ یعنی محاسبه خودکار." value={input.stirrupSpacing} onChange={(v) => set('stirrupSpacing', v)} min={0} max={600} step={25} unit="mm" />
          </FormSection>
        </>
      }
      extra={
        result ? (
          <div className="space-y-3">
            <div className="glass p-4">
              <h3 className="mb-1 text-[13px] font-bold text-ink">نمودار لنگر (BMD) و برش (SFD)</h3>
              <p className="mb-3 text-[11px] text-faint tnum">
                بار نهایی {faNum(result.extras.wu, 2)} kN/m — لنگر بیشینه {faNum(result.extras.Mu, 1)} kN·m — برش بیشینه {faNum(result.extras.Vu, 1)} kN
              </p>
              <ShearMoment wu={result.extras.wu} L={input.L} continuous={input.support === 'continuous'} Mu={result.extras.Mu} Vu={result.extras.Vu} d={result.diagram.kind === 'beam' ? result.diagram.dEff : input.h * 0.9} />
            </div>
            <BbsTable result={result} />
          </div>
        ) : null
      }
    />
  );
}

/** translucent rounded card behind a diagram value label */
function ValueChip({ x, y, text, anchor = 'middle', color = '#101828' }: { x: number; y: number; text: string; anchor?: 'middle' | 'start' | 'end'; color?: string }) {
  const wpx = text.length * 5.4 + 14;
  const rx = anchor === 'middle' ? x - wpx / 2 : anchor === 'start' ? x : x - wpx;
  return (
    <g>
      <rect x={rx} y={y - 10.5} width={wpx} height={15.5} rx={4.5} fill="#ffffff" fillOpacity={0.88} stroke="#e7e9ee" strokeWidth={0.8} />
      <text x={x} y={y} textAnchor={anchor} fontSize={10} fontWeight={700} fill={color} className="tnum">
        {text}
      </text>
    </g>
  );
}

function ShearMoment({
  wu,
  L,
  continuous,
  Mu,
  Vu,
  d,
}: {
  wu: number;
  L: number;
  continuous: boolean;
  Mu: number;
  Vu: number;
  d: number;
}) {
  const W = 660;
  const H = 260;
  const ox = 60;
  const span = W - ox - 40;
  const baseY = 92;
  const sfdTop = 176;
  const N = 60;

  const moment = (x: number): number =>
    continuous ? (wu * (6 * L * x - 6 * x * x - L * L)) / 12 : (wu * x * (L - x)) / 2;
  const shear = (x: number): number => wu * (L / 2 - x);

  const mMax = Math.max(
    1e-6,
    ...Array.from({ length: N }, (_, i) => Math.abs(moment(((i * L) / (N - 1)) / 1))),
  );
  const vScale = 34 / Math.max(1e-6, Math.abs(Vu));

  const bmdPts = Array.from({ length: N }, (_, i) => {
    const x = (i * L) / (N - 1);
    const px = ox + (x / L) * span;
    const py = baseY - (Math.abs(moment(x)) / mMax) * 46;
    return `${px.toFixed(1)},${py.toFixed(1)}`;
  }).join(' ');

  const sfdPts = [0, 1].map((i) => {
    const x = i * L;
    const px = ox + (x / L) * span;
    const py = sfdTop - shear(x) * vScale;
    return `${px.toFixed(1)},${py.toFixed(1)}`;
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="نمودار لنگر و برش">
      {/* axis */}
      <line x1={ox} y1={baseY} x2={ox + span} y2={baseY} stroke="#98a2b3" strokeWidth="1.4" />
      <line x1={ox} y1={sfdTop} x2={ox + span} y2={sfdTop} stroke="#98a2b3" strokeWidth="1.4" />
      <text x={12} y={baseY - 20} fontSize="11" fill="#101828" fontWeight="700">
        BMD
      </text>
      <text x={12} y={sfdTop - 14} fontSize="11" fill="#101828" fontWeight="700">
        SFD
      </text>

      {/* bending moment */}
      <polyline points={bmdPts} fill="none" stroke="#d97706" strokeWidth="2.2" />
      <line x1={ox + span / 2} y1={baseY} x2={ox + span / 2} y2={baseY - 46} stroke="#d97706" strokeDasharray="3 3" strokeWidth="1" />
      <ValueChip x={ox + span / 2 + 8} y={baseY - 50} anchor="start" text={`Mu,max+ = ${faNum(Mu, 1)} kN·m`} color="#b45309" />
      {continuous ? (
        <>
          <ValueChip x={ox - 6} y={baseY + 20} anchor="start" text={`Mu,max− = ${faNum((wu * L * L) / 12, 1)} kN·m`} color="#b45309" />
          <ValueChip x={ox + span + 6} y={baseY + 20} anchor="end" text={`Mu,max− = ${faNum((wu * L * L) / 12, 1)} kN·m`} color="#b45309" />
        </>
      ) : null}

      {/* shear */}
      <polygon
        points={`${ox},${sfdTop} ${sfdPts[0]} ${sfdPts[1]} ${ox + span},${sfdTop}`}
        fill="#2563eb"
        fillOpacity="0.12"
      />
      <polyline points={sfdPts.join(' ')} fill="none" stroke="#2563eb" strokeWidth="2.2" />
      <ValueChip x={ox + 6} y={sfdTop - 10} anchor="start" text={`Vu,max = ${faNum(Vu, 1)} kN`} color="#2563eb" />
      <ValueChip x={ox + span - 6} y={sfdTop + 20} anchor="end" text={`Vu,max = ${faNum(Vu, 1)} kN`} color="#2563eb" />
      {/* critical shear section at effective depth d from each support face */}
      <line x1={ox + (d / 1000 / L) * span} y1={8} x2={ox + (d / 1000 / L) * span} y2={sfdTop + 30} stroke="#d97706" strokeWidth={1} strokeDasharray="4 3" />
      <line x1={ox + span - (d / 1000 / L) * span} y1={8} x2={ox + span - (d / 1000 / L) * span} y2={sfdTop + 30} stroke="#d97706" strokeWidth={1} strokeDasharray="4 3" />
      <text x={ox + (d / 1000 / L) * span + 3} y={16} fontSize={9} fontWeight={700} fill="#b45309" className="tnum">
        d = {faNum(d, 0)} mm
      </text>
      <text x={ox + span - (d / 1000 / L) * span - 3} y={16} textAnchor="end" fontSize={9} fontWeight={700} fill="#b45309" className="tnum">
        d = {faNum(d, 0)} mm
      </text>

      {/* span dim */}
      <line x1={ox} y1={sfdTop + 40} x2={ox + span} y2={sfdTop + 40} stroke="#98a2b3" strokeWidth="1" />
      <text x={ox + span / 2} y={sfdTop + 56} fontSize="10.5" fill="#667085" textAnchor="middle" className="tnum">
        L = {faNum(L, 2)} m
      </text>
      <text x={12} y={baseY + 40} fontSize="10" fill="#98a2b3">
        kN·m
      </text>
      <text x={12} y={sfdTop + 34} fontSize="10" fill="#98a2b3">
        kN
      </text>
      {/* supports */}
      <polygon points={`${ox},${baseY} ${ox - 9},${baseY - 14} ${ox + 9},${baseY - 14}`} fill="#e7e9ee" stroke="#667085" />
      <polygon points={`${ox + span},${baseY} ${ox + span - 9},${baseY - 14} ${ox + span + 9},${baseY - 14}`} fill="#e7e9ee" stroke="#667085" />
    </svg>
  );
}


