
/* ============================================================================
 * CivilGenius v23 — Beam-column joint (چشمه اتصال) design page:
 * panel shear φVn ≥ Vu (ACI 18.8 / مبحث نهم) + internal confinement hoops.
 * ========================================================================== */

import { Combine } from 'lucide-react';
import { DEFAULT_JOINT, type JointInput } from '../lib/modules';
import { faNum } from '../lib/format';
import { buildSampleProject, useStageCompute, useStore } from '../lib/store';
import { BbsTable } from '../components/Bbs';
import { Field, SelectField } from '../components/Field';
import { ModuleShell } from '../components/ModuleShell';
import { Chip, FormSection } from '../components/ui';

export function JointPage() {
  const store = useStore();
  const input = store.inputs.joint;
  const { stage, run } = useStageCompute();
  const set = <K extends keyof JointInput>(key: K, value: JointInput[K]): void =>
    store.setInput('joint', { ...input, [key]: value });
  const result = store.results.joint ?? null;

  /** one-click enterprise demo preset: fills proven inputs + computes (round-32) */
  const loadSample = (): void => {
    const s = buildSampleProject();
    const ni = s.joint;
    store.setInput('joint', ni);
    void run('joint', ni, (r) => store.setResult('joint', r));
  };


  return (
    <ModuleShell
      title="طراحی چشمه اتصال تیر به ستون"
      subtitle="کنترل ظرفیت برشی چشمه (φVn ≥ Vu) و تعیین تعداد و گام خاموت‌های محصورکننده داخلی — با نمای زنده خاموت‌های متراکم."
      reference="مراجع: مبحث نهم (اتصالات ویژه) — ACI 318-19 بند 18.8"
      icon={<Combine size={20} />}
      stage={stage}
      onCompute={() => void run('joint', input, (r) => store.setResult('joint', r))}
      onAutoFix={(patch) => {
        const ni = { ...input, ...patch };
        store.setInput('joint', ni);
        void run('joint', ni, (r) => store.setResult('joint', r));
      }}
      onSample={loadSample}
      onReset={() => store.setInput('joint', { ...DEFAULT_JOINT })}
      result={result}
      fields={
        <>
          <FormSection title="هندسه اعضا">
            <Field label="عرض ستون (bc)" value={input.colB} onChange={(v) => set('colB', v)} min={300} max={1200} step={25} unit="mm" />
            <Field label="ارتفاع ستون (hc)" value={input.colH} onChange={(v) => set('colH', v)} min={300} max={1200} step={25} unit="mm" />
            <Field label="عرض تیر (bb)" value={input.beamB} onChange={(v) => set('beamB', v)} min={200} max={800} step={25} unit="mm" />
            <Field label="ارتفاع تیر (hb)" value={input.beamH} onChange={(v) => set('beamH', v)} min={300} max={1000} step={25} unit="mm" />
            <SelectField
              label="تعداد وجوه مقید"
              value={String(input.faces)}
              onChange={(v) => set('faces', Number(v) as JointInput['faces'])}
              options={[
                { value: '4', label: '۴ وجه (داخلی)' },
                { value: '3', label: '۳ وجه' },
                { value: '2', label: '۲ وجه (کنج)' },
              ]}
            />
          </FormSection>
          <FormSection title="بار و مصالح">
            <Field label="برش ورودی چشمه (Vu)" value={input.Vu} onChange={(v) => set('Vu', v)} min={100} max={6000} step={50} unit="kN" />
            <Field label="مقاومت بتن (fc)" value={input.Fc} onChange={(v) => set('Fc', v)} min={20} max={50} step={1} unit="MPa" />
            <Field label="تسلیم فولاد (fy)" value={input.Fy} onChange={(v) => set('Fy', v)} min={240} max={500} step={10} unit="MPa" />
            <Field label="قطر خاموت چشمه" value={input.hoopDia} onChange={(v) => set('hoopDia', v)} min={8} max={16} step={2} unit="mm" />
            <Field label="گام خاموت داخل چشمه" value={input.hoopS} onChange={(v) => set('hoopS', v)} min={50} max={200} step={10} unit="mm" />
          </FormSection>
        </>
      }
      extra={
        <div className="space-y-3">
          {result ? (
            <div className="glass flex flex-wrap items-center gap-2 p-3">
              <Chip tone={input.Vu <= result.extras.phiVn ? 'ok' : 'bad'}>φVn = {faNum(result.extras.phiVn, 0)} kN</Chip>
              <Chip tone="neutral">γ = {faNum(result.extras.gamma, 1)}</Chip>
              <Chip tone="warn">{faNum(result.extras.nHoops, 0)} ردیف خاموت محصورکننده</Chip>
            </div>
          ) : null}
          {result ? <BbsTable result={result} /> : null}
        </div>
      }
    />
  );
}


