
/* ============================================================================
 * CivilGenius v23 — Slab systems design page (joist-block / waffle / solid /
 * hollow-core) with live section canvas, D/C checks, BOQ + BBS.
 * ========================================================================== */

import { Layers } from 'lucide-react';
import { DEFAULT_SLAB, type SlabInput } from '../lib/modules';
import { faNum } from '../lib/format';
import { buildSampleProject, useStageCompute, useStore } from '../lib/store';
import { BbsTable } from '../components/Bbs';
import { Field, SelectField } from '../components/Field';
import { ModuleShell } from '../components/ModuleShell';
import { Chip, FormSection } from '../components/ui';

export function SlabPage() {
  const store = useStore();
  const input = store.inputs.slab;
  const { stage, run } = useStageCompute();
  const set = <K extends keyof SlabInput>(key: K, value: SlabInput[K]): void =>
    store.setInput('slab', { ...input, [key]: value });
  const result = store.results.slab ?? null;

  /** one-click enterprise demo preset: fills proven inputs + computes (round-32) */
  const loadSample = (): void => {
    const s = buildSampleProject();
    const ni = s.slab;
    store.setInput('slab', ni);
    void run('slab', ni, (r) => store.setResult('slab', r));
  };


  return (
    <ModuleShell
      title="طراحی جامع سیستم‌های سقف"
      subtitle="تیرچه-بلوک، وافل، دال بتنی و دال مجوف — میلگرد کششی، منفی سرتیرچه‌ها، شبکه حرارتی/مونس، تای‌بیم و کنترل افتادگی/خیز."
      reference="مراجع: مبحث نهم مقررات ملی (دال‌ها) — ضوابط دستورالعمل تیرچه و سقف وافل"
      icon={<Layers size={20} />}
      stage={stage}
      onCompute={() => void run('slab', input, (r) => store.setResult('slab', r))}
      onAutoFix={(patch) => {
        const ni = { ...input, ...patch };
        store.setInput('slab', ni);
        void run('slab', ni, (r) => store.setResult('slab', r));
      }}
      onSample={loadSample}
      onReset={() => store.setInput('slab', { ...DEFAULT_SLAB })}
      result={result}
      fields={
        <>
          <FormSection title="نوع سیستم و هندسه">
            <SelectField
              label="نوع سقف"
              value={input.system}
              onChange={(v) => set('system', v as SlabInput['system'])}
              options={[
                { value: 'joist', label: 'تیرچه-بلوک' },
                { value: 'waffle', label: 'وافل (Waffle)' },
                { value: 'solid', label: 'دال بتنی' },
                { value: 'hollow', label: 'دال مجوف' },
              ]}
            />
            <Field label="دهانه آزاد (L)" value={input.L} onChange={(v) => set('L', v)} min={2} max={12} step={0.1} unit="متر" decimals={2} />
            <Field label="ضخامت کل دال (h)" value={input.h} onChange={(v) => set('h', v)} min={120} max={600} step={10} unit="میلی‌متر" />
            <Field label="فاصله تیرچه/وافل" value={input.joistSpacing} onChange={(v) => set('joistSpacing', v)} min={400} max={750} step={25} unit="mm" />
          </FormSection>
          <FormSection title="بارگذاری و مصالح">
            <Field label="بار مرده افزوده (DL)" value={input.DL} onChange={(v) => set('DL', v)} min={0.5} max={8} step={0.25} unit="kN/m²" decimals={2} />
            <Field label="بار زنده (LL)" value={input.LL} onChange={(v) => set('LL', v)} min={1} max={10} step={0.5} unit="kN/m²" decimals={2} />
            <Field label="مقاومت بتن (fc)" value={input.Fc} onChange={(v) => set('Fc', v)} min={20} max={50} step={1} unit="MPa" />
            <Field label="تسلیم فولاد (fy)" value={input.Fy} onChange={(v) => set('Fy', v)} min={240} max={500} step={10} unit="MPa" />
            <Field label="پوشش بتنی" value={input.cover} onChange={(v) => set('cover', v)} min={15} max={50} step={5} unit="mm" />
          </FormSection>
          <FormSection title="قطر میلگردها">
            <Field label="میلگرد کششی پایین" value={input.barDia} onChange={(v) => set('barDia', v)} min={8} max={20} step={2} unit="mm" />
            <Field label="میلگرد منفی سرتیرچه" value={input.negDia} onChange={(v) => set('negDia', v)} min={8} max={16} step={2} unit="mm" />
            <Field label="حرارتی/مونس" value={input.tempDia} onChange={(v) => set('tempDia', v)} min={6} max={12} step={2} unit="mm" />
          </FormSection>
        </>
      }
      extra={
        <div className="space-y-3">
          {result ? (
            <>
              <div className="glass flex flex-wrap items-center gap-2 p-3">
                <Chip tone="ok">پایین: Ø{faNum(input.barDia, 0)} @ {faNum(result.extras.sMain, 0)}</Chip>
                <Chip tone="warn">منفی: @ {faNum(result.extras.sNeg, 0)}</Chip>
                <Chip tone="neutral">حرارتی/مونس: @ {faNum(result.extras.sT, 0)}</Chip>
                <Chip tone={result.extras.defl <= result.extras.deflAllow ? 'ok' : 'bad'}>
                  خیز {faNum(result.extras.defl, 1)} / مجاز {faNum(result.extras.deflAllow, 1)} mm
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


