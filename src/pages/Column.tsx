
/* ============================================================================
 * CivilGenius v20 — Column design page (P-M interaction + slenderness)
 * ========================================================================== */

import { useState } from 'react';
import { Columns3, Wand2 } from 'lucide-react';
import { DEFAULT_COLUMN, interactionCurve, phiAtDemand, pmSafetyFactor, type ColumnInput } from '../lib/engine';
import { faNum } from '../lib/format';
import { buildSampleProject, useStageCompute, useStore } from '../lib/store';
import { Field } from '../components/Field';
import { ModuleShell } from '../components/ModuleShell';
import { BbsTable } from '../components/Bbs';
import { Chip, FormSection } from '../components/ui';

export function ColumnPage() {
  const store = useStore();
  const input = store.inputs.column;
  const { stage, run } = useStageCompute();
  const set = <K extends keyof ColumnInput>(key: K, value: ColumnInput[K]): void =>
    store.setInput('column', { ...input, [key]: value });
  const result = store.results.column ?? null;

  /** one-click enterprise demo preset: fills proven inputs + computes (round-32) */
  const loadSample = (): void => {
    const s = buildSampleProject();
    const ni = s.column;
    store.setInput('column', ni);
    void run('column', ni, (r) => store.setResult('column', r));
  };

  const curve = interactionCurve(input.b, input.h, input.Fc, input.Fy, input.cover, input.barDia, result?.extras.nBars ?? 12);
  const demand = { x: result?.extras.MuDesign ?? input.Mu, y: result?.extras.Pu ?? input.Pu };
  const sf = pmSafetyFactor(demand.x, demand.y, curve.points);
  const phiDemand = result
    ? phiAtDemand(input.b, input.h, input.Fc, input.Fy, input.cover, input.barDia, result.extras.nBars ?? 12, demand.y)
    : 0.9;

  // slenderness quick action — section sized so that kl/r ≤ 22 (r = 0.3h for rectangles)
  const klOverR = (input.k * input.Lc * 1000) / (Math.min(input.b, input.h) / Math.sqrt(12));
  const isSlender = klOverR > 22;
  const suggH = Math.min(3000, Math.ceil(((input.k * input.Lc * 1000) / (0.3 * 22)) / 50) * 50);

  return (
    <ModuleShell
      title="طراحی ستون بتنی"
      subtitle="ترسیم نمودار تعامل P-M، بررسی نقطه تقاضا با آزمون نقطه‌درچندضلعی، اثر لاغری و بزرگ‌نمایی لنگر، طراحی خاموت و آرماتور طولی."
      reference="مراجع: مبحث نهم مقررات ملی ساختمان (ستون‌ها) — نمودار تعامل با ضرایب کاهش مقاومت ACI"
      icon={<Columns3 size={20} />}
      stage={stage}
      onCompute={() => void run('column', input, (r) => store.setResult('column', r))}
      onAutoFix={(patch) => { const ni = { ...input, ...patch }; store.setInput('column', ni); void run('column', ni, (r) => store.setResult('column', r)); }}
      onSample={loadSample}
      onReset={() => store.setInput('column', { ...DEFAULT_COLUMN })}
      result={result}
      fields={
        <>
          <FormSection title="مشخصات هندسی مقطع">
            <Field label="عرض مقطع (b)" value={input.b} onChange={(v) => set('b', v)} min={150} max={3000} step={10} unit="میلی‌متر" />
            <Field label="ارتفاع مقطع (h)" value={input.h} onChange={(v) => set('h', v)} min={150} max={3000} step={10} unit="میلی‌متر" />
            <Field label="ارتفاع آزاد (Lc)" value={input.Lc} onChange={(v) => set('Lc', v)} min={1.5} max={20} step={0.1} unit="متر" decimals={2} />
            <Field label="ضریب طول مؤثر (k)" tip="مبحث نهم/ACI: ستون دوسرگیردار k≈۰٫۷، یک‌سرگیردار ۰٫۸۵، مفصلی ۱٫۰، طره ۲٫۰." value={input.k} onChange={(v) => set('k', v)} min={0.5} max={2} step={0.05} unit="" decimals={2} />
          </FormSection>
          <FormSection title="مشخصات مصالح">
            <Field label="مقاومت بتن (fc)" value={input.Fc} onChange={(v) => set('Fc', v)} min={20} max={50} step={1} unit="مگاپاسکال" />
            <Field label="تسلیم فولاد (fy)" value={input.Fy} onChange={(v) => set('Fy', v)} min={240} max={500} step={10} unit="مگاپاسکال" />
            <Field label="پوشش بتنی" tip="مبحث نهم: پوشش ستون حداقل ۴۰ میلی‌متر." value={input.cover} onChange={(v) => set('cover', v)} min={20} max={80} step={5} unit="میلی‌متر" />
          </FormSection>
          <FormSection title="بارگذاری و تنظیمات میلگرد">
            <Field label="نیروی محوری نهایی (Pu)" value={input.Pu} onChange={(v) => set('Pu', v)} min={50} max={100000} step={10} unit="کیلونیوتن" />
            <Field label="لنگر نهایی (Mu)" value={input.Mu} onChange={(v) => set('Mu', v)} min={1} max={200000} step={5} unit="kN·m" />
            <Field label="قطر میلگرد طولی" value={input.barDia} onChange={(v) => set('barDia', v)} min={12} max={36} step={2} unit="میلی‌متر" />
            <Field label="تعداد میلگردهای طولی" tip="۰ = خودکار؛ مقادیر زوج (حداقل ۴) تا ρ≥۱٪." value={input.nBars} onChange={(v) => set('nBars', v)} min={0} max={40} step={2} unit="عدد" />
            <Field label="قطر خاموت" value={input.tieDia} onChange={(v) => set('tieDia', v)} min={8} max={16} step={2} unit="میلی‌متر" />
            <Field label="فاصله خاموت معمولی (s)" tip="۰ = خودکار بر اساس min(16db,48dt,کوچک‌ترین بعد)." value={input.tieSpacing} onChange={(v) => set('tieSpacing', v)} min={0} max={600} step={25} unit="mm" />
            <Field label="خاموت ناحیه بحرانی (s0)" tip="۰ = خودکار بر اساس min(h/4,6db,100)." value={input.critSpacing} onChange={(v) => set('critSpacing', v)} min={0} max={200} step={25} unit="mm" />
          </FormSection>
        </>
      }
      extra={
        <div className="space-y-3">
          {isSlender ? (
            <div className="glass border-[#fde68a] bg-warn-soft/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-[11.5px] font-semibold leading-5 text-warn">
                  ستون لاغر است (kl/r = {faNum(klOverR, 1)} &gt; ۲۲) — بزرگ‌نمایی لنگر فعال است.
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-ink tnum">
                    پیش‌نمایش: h ≥ {faNum(suggH, 0)} mm
                  </span>
                  <button
                    onClick={() => {
                      const ni = { ...input, h: suggH };
                      store.setInput('column', ni);
                      void run('column', ni, (r) => store.setResult('column', r));
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-deep px-3 py-2 text-[11px] font-bold text-white transition hover:bg-forest"
                  >
                    <Wand2 size={13} />
                    پیشنهاد خودکار ابعاد ایمن
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          <div className="glass p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[13px] font-bold text-ink">نمودار تعامل P-M مقطع</h3>
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="neutral">آرماتور ترسیمی: {faNum(curve.total, 0)} میلگرد</Chip>
              <Chip tone={sf >= 1.15 ? 'ok' : sf >= 1 ? 'warn' : 'bad'}>ضریب اطمینان {faNum(sf, 2)}</Chip>
            </div>
          </div>
          <PMChart
            points={curve.points.map((p) => ({ x: p.M, y: p.P }))}
            nominal={curve.nominal.map((p) => ({ x: p.M, y: p.P }))}
            demand={demand}
            sf={sf}
            phi={phiDemand}
          />
          <p className="mt-2 text-[11px] leading-5 text-faint">
            نقطه طلایی تقاضای طراحی ({faNum(demand.x, 1)} kN·m، {faNum(demand.y, 0)} kN) است. اگر داخل منحنی باشد، مقطع ایمن است؛
            نسبت فاصله تا منحنی به‌عنوان ضریب اطمینان گزارش می‌شود. روی نقطه تقاضا کلیک یا نشانگر را نگه دارید تا Pu، Mu، SF و φ حاکم نمایش داده شود.
          </p>
          </div>
          {result ? <BbsTable result={result} /> : null}
        </div>
      }
    />
  );
}

function PMChart({
  points,
  nominal,
  demand,
  sf,
  phi,
}: {
  points: { x: number; y: number }[];
  nominal: { x: number; y: number }[];
  demand: { x: number; y: number };
  sf: number;
  phi: number;
}) {
  const [hover, setHover] = useState(false);
  const W = 660;
  const H = 340;
  const padL = 62;
  const padB = 40;
  const padT = 16;
  const padR = 18;

  const xs = [...points.map((p) => p.x), demand.x, 0];
  const ys = [...points.map((p) => p.y), demand.y, 0];
  const xMin = Math.min(...xs) * 1.05;
  const xMax = Math.max(...xs) * 1.1 || 1;
  const yMin = Math.min(...ys) * 1.05;
  const yMax = Math.max(...ys) * 1.1 || 1;

  const sx = (x: number) => padL + ((x - xMin) / Math.max(1e-9, xMax - xMin)) * (W - padL - padR);
  const sy = (y: number) => padT + (1 - (y - yMin) / Math.max(1e-9, yMax - yMin)) * (H - padT - padB);

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
  const nomPath = nominal.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
  const gridX = [0, 0.25, 0.5, 0.75, 1].map((f) => xMin + f * (xMax - xMin));
  const gridY = [0, 0.25, 0.5, 0.75, 1].map((f) => yMin + f * (yMax - yMin));
  const ok = sf >= 1;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="نمودار تعامل P-M">
      {gridY.map((g, i) => (
        <g key={`y${i}`}>
          <line x1={padL} x2={W - padR} y1={sy(g)} y2={sy(g)} stroke="#e7e9ee" />
          <text x={padL - 8} y={sy(g) + 4} fontSize="9.5" fill="#98a2b3" textAnchor="end" className="tnum">
            {faNum(g, 0)}
          </text>
        </g>
      ))}
      {gridX.map((g, i) => (
        <g key={`x${i}`}>
          <line x1={sx(g)} x2={sx(g)} y1={padT} y2={H - padB} stroke="#e7e9ee" />
          <text x={sx(g)} y={H - padB + 16} fontSize="9.5" fill="#98a2b3" textAnchor="middle" className="tnum">
            {faNum(g, 0)}
          </text>
        </g>
      ))}
      <path d={nomPath} fill="none" stroke="#98a2b3" strokeWidth="1.4" strokeDasharray="5 4" />
      <path d={path} fill="#04785718" stroke="#047857" strokeWidth="2.4" className="chart-draw" strokeLinejoin="round" />
      {/* legend */}
      <line x1={W - padR - 210} y1={padT + 6} x2={W - padR - 190} y2={padT + 6} stroke="#98a2b3" strokeWidth="1.4" strokeDasharray="5 4" />
      <text x={W - padR - 186} y={padT + 9} fontSize="9.5" fill="#667085" textAnchor="start">
        منحنی اسمی Pn–Mn
      </text>
      <line x1={W - padR - 100} y1={padT + 6} x2={W - padR - 80} y2={padT + 6} stroke="#047857" strokeWidth="2.4" />
      <text x={W - padR - 76} y={padT + 9} fontSize="9.5" fill="#065f46" fontWeight="700" textAnchor="start">
        φPn–φMn طراحی
      </text>
      <line x1={padL} y1={sy(0)} x2={W - padR} y2={sy(0)} stroke="#98a2b3" strokeWidth="1" strokeDasharray="4 3" />
      <line x1={sx(0)} y1={padT} x2={sx(0)} y2={H - padB} stroke="#98a2b3" strokeWidth="1" strokeDasharray="4 3" />
      {/* ray to the demand point */}
      <line x1={sx(0)} y1={sy(0)} x2={sx(demand.x)} y2={sy(demand.y)} stroke="#d97706" strokeWidth="1.2" strokeDasharray="5 4" />
      <g
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={() => setHover((v) => !v)}
        style={{ cursor: 'pointer' }}
      >
        <circle cx={sx(demand.x)} cy={sy(demand.y)} r="14" fill={ok ? '#d97706' : '#d92d20'} fillOpacity="0.1" />
        <circle cx={sx(demand.x)} cy={sy(demand.y)} r="8" fill={ok ? '#d97706' : '#d92d20'} fillOpacity="0.16" />
        <circle cx={sx(demand.x)} cy={sy(demand.y)} r="4.6" fill={ok ? '#d97706' : '#d92d20'} stroke="#fff" strokeWidth="1.6" />
        <title>نقطه تقاضا — برای جزئیات کلیک کنید</title>
      </g>
      <text x={sx(demand.x) + 12} y={sy(demand.y) - 8} fontSize="10.5" fontWeight="700" fill={ok ? '#b45309' : '#d92d20'} className="tnum">
        تقاضا
      </text>
      {hover ? (
        <g>
          <rect x={Math.min(sx(demand.x) + 14, W - padR - 170)} y={Math.max(padT, sy(demand.y) - 70)} width={164} height={74} rx={9} fill="#101828" fillOpacity="0.94" />
          <text x={Math.min(sx(demand.x) + 14, W - padR - 170) + 10} y={Math.max(padT, sy(demand.y) - 70) + 18} fontSize="10.5" fill="#fbbf24" fontWeight="700" className="tnum">
            Pu = {faNum(demand.y, 0)} kN
          </text>
          <text x={Math.min(sx(demand.x) + 14, W - padR - 170) + 10} y={Math.max(padT, sy(demand.y) - 70) + 34} fontSize="10.5" fill="#a7f3d0" fontWeight="700" className="tnum">
            Mu = {faNum(demand.x, 1)} kN·m
          </text>
          <text x={Math.min(sx(demand.x) + 14, W - padR - 170) + 10} y={Math.max(padT, sy(demand.y) - 70) + 50} fontSize="10.5" fill="#e2e8f0" className="tnum">
            ضریب اطمینان SF = {faNum(sf, 2)}
          </text>
          <text x={Math.min(sx(demand.x) + 14, W - padR - 170) + 10} y={Math.max(padT, sy(demand.y) - 70) + 66} fontSize="10.5" fill="#e2e8f0" className="tnum">
            φ حاکم = {faNum(phi, 2)}
          </text>
        </g>
      ) : null}
      <text x={W / 2} y={H - 8} fontSize="10.5" fill="#667085" textAnchor="middle">
        لنگر (kN·m)
      </text>
      <text x={16} y={H / 2} fontSize="10.5" fill="#667085" transform={`rotate(-90 16 ${H / 2})`} textAnchor="middle">
        نیروی محوری (kN)
      </text>
    </svg>
  );
}


