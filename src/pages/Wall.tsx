
/* ============================================================================
 * CivilGenius v23 — RC shear wall design page: horizontal/vertical rebar,
 * boundary elements + crossties, shear-friction, drift. Live plan canvas.
 * ========================================================================== */

import { Building2 } from 'lucide-react';
import { DEFAULT_WALL, type WallInput } from '../lib/modules';
import { faNum } from '../lib/format';
import { buildSampleProject, useStageCompute, useStore } from '../lib/store';
import { BbsTable } from '../components/Bbs';
import { Field, SelectField } from '../components/Field';
import { ModuleShell } from '../components/ModuleShell';
import { Chip, FormSection } from '../components/ui';

export function WallPage() {
  const store = useStore();
  const input = store.inputs.wall;
  const { stage, run } = useStageCompute();
  const set = <K extends keyof WallInput>(key: K, value: WallInput[K]): void =>
    store.setInput('wall', { ...input, [key]: value });
  const result = store.results.wall ?? null;

  /** one-click enterprise demo preset: fills proven inputs + computes (round-32) */
  const loadSample = (): void => {
    const s = buildSampleProject();
    const ni = s.wall;
    store.setInput('wall', ni);
    void run('wall', ni, (r) => store.setResult('wall', r));
  };


  return (
    <ModuleShell
      title="طراحی دیوار برشی بتن آرمه"
      subtitle="آرماتور افقی/عمودی، تعیین طول و آرماتورگذاری المان‌های مرزی با سنجاق، کنترل برش لغزشی و دریفت طبق مبحث نهم / ACI 318."
      reference="مراجع: مبحث نهم (دیوارهای برشی) — ACI 318-19 فصل 18 — استاندارد ۲۸۰۰ (دریفت)"
      icon={<Building2 size={20} />}
      stage={stage}
      onCompute={() => void run('wall', input, (r) => store.setResult('wall', r))}
      onAutoFix={(patch) => {
        const ni = { ...input, ...patch };
        store.setInput('wall', ni);
        void run('wall', ni, (r) => store.setResult('wall', r));
      }}
      onSample={loadSample}
      onReset={() => store.setInput('wall', { ...DEFAULT_WALL })}
      result={result}
      fields={
        <>
          <FormSection title="هندسه دیوار">
            <Field label="طول دیوار (lw)" value={input.lw} onChange={(v) => set('lw', v)} min={1.5} max={12} step={0.1} unit="متر" decimals={2} />
            <Field label="ضخامت (tw)" value={input.tw} onChange={(v) => set('tw', v)} min={150} max={600} step={10} unit="mm" />
            <Field label="ارتفاع طبقه (hs)" value={input.hs} onChange={(v) => set('hs', v)} min={2.4} max={6} step={0.1} unit="متر" decimals={2} />
          </FormSection>
          <FormSection title="بارهای نهایی">
            <Field label="نیروی محوری Pu" value={input.Pu} onChange={(v) => set('Pu', v)} min={100} max={20000} step={50} unit="kN" />
            <Field label="لنگر Mu" value={input.Mu} onChange={(v) => set('Mu', v)} min={100} max={30000} step={50} unit="kN·m" />
            <Field label="برش Vu" value={input.Vu} onChange={(v) => set('Vu', v)} min={50} max={5000} step={25} unit="kN" />
          </FormSection>
          <FormSection title="مصالح و آرماتور">
            <Field label="مقاومت بتن (fc)" value={input.Fc} onChange={(v) => set('Fc', v)} min={20} max={50} step={1} unit="MPa" />
            <Field label="تسلیم فولاد (fy)" value={input.Fy} onChange={(v) => set('Fy', v)} min={240} max={500} step={10} unit="MPa" />
            <Field label="پوشش بتنی" value={input.cover} onChange={(v) => set('cover', v)} min={20} max={60} step={5} unit="mm" />
            <Field label="میلگرد عمودی" value={input.vDia} onChange={(v) => set('vDia', v)} min={10} max={25} step={2} unit="mm" />
            <Field label="میلگرد افقی" value={input.hDia} onChange={(v) => set('hDia', v)} min={8} max={20} step={2} unit="mm" />
            <Field label="خاموت المان مرزی" value={input.hoopDia} onChange={(v) => set('hoopDia', v)} min={8} max={16} step={2} unit="mm" />
          </FormSection>
          <FormSection title="المان مرزی (محصورشدگی ویژه)">
            <SelectField
              label="حالت المان مرزی"
              value={String(input.beForce)}
              onChange={(v) => set('beForce', Number(v))}
              options={[
                { value: '0', label: 'خودکار (بر اساس σ > 0.2fc)' },
                { value: '1', label: 'اعمال محصورشدگی ویژه (دستی)' },
              ]}
            />
            <Field label="طول المان مرزی (0=خودکار)" value={input.beLenMm} onChange={(v) => set('beLenMm', v)} min={0} max={1200} step={50} unit="mm" />
            <Field label="گام خاموت محصورکننده (0=خودکار)" value={input.beHoopS} onChange={(v) => set('beHoopS', v)} min={0} max={150} step={10} unit="mm" />
            <Field label="میلگرد عمودی المان مرزی" value={input.beVertDia} onChange={(v) => set('beVertDia', v)} min={12} max={25} step={2} unit="mm" />
            <Field label="تعداد میلگرد هر المان (≥۶)" value={input.beVertCount} onChange={(v) => set('beVertCount', v)} min={4} max={16} step={2} unit="عدد" />
          </FormSection>
        </>
      }
      extra={
        <div className="space-y-3">
          {result ? (
            <>
              <div className="glass flex flex-wrap items-center gap-2 p-3">
                <Chip tone="ok">عمودی @ {faNum(result.extras.sV, 0)}</Chip>
                <Chip tone="ok">افقی @ {faNum(result.extras.sH, 0)}</Chip>
                <Chip tone={result.extras.boundary ? 'warn' : 'ok'}>
                  {result.extras.boundary ? `المان مرزی ${faNum(result.extras.beLen, 0)} mm` : 'المان مرزی لازم نیست'}
                </Chip>
              </div>
              <BbsTable result={result} />
            </>
          ) : null}
        </div>
      }
    />
  );
}
