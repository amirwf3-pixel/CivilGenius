
/* ============================================================================
 * CivilGenius v23 — Stair / ramp design page: deflection-governed slab,
 * longitudinal + distribution steel, 90° anchorage bends at supports.
 * ========================================================================== */

import { Footprints } from 'lucide-react';
import { DEFAULT_STAIR, type StairInput } from '../lib/modules';
import { faNum } from '../lib/format';
import { buildSampleProject, useStageCompute, useStore } from '../lib/store';
import { BbsTable } from '../components/Bbs';
import { Field, SelectField } from '../components/Field';
import { ModuleShell } from '../components/ModuleShell';
import { Chip, FormSection } from '../components/ui';

export function StairPage() {
  const store = useStore();
  const input = store.inputs.stair;
  const { stage, run } = useStageCompute();
  const set = <K extends keyof StairInput>(key: K, value: StairInput[K]): void =>
    store.setInput('stair', { ...input, [key]: value });
  const result = store.results.stair ?? null;

  /** one-click enterprise demo preset: fills proven inputs + computes (round-32) */
  const loadSample = (): void => {
    const s = buildSampleProject();
    const ni = s.stair;
    store.setInput('stair', ni);
    void run('stair', ni, (r) => store.setResult('stair', r));
  };


  return (
    <ModuleShell
      title="طراحی رمپ و راهپله"
      subtitle="ضخامت حداقل دال برای کنترل خیز، آرماتور طولی و عرضی و خم‌های مهار ۹۰ درجه در تکیه‌گاه‌ها — با مقطع طولی زنده."
      reference="مراجع: مبحث نهم (دال‌ها و خیز) — مبحث سوم (هندسه پله/رمپ)"
      icon={<Footprints size={20} />}
      stage={stage}
      onCompute={() => void run('stair', input, (r) => store.setResult('stair', r))}
      onAutoFix={(patch) => {
        const ni = { ...input, ...patch };
        store.setInput('stair', ni);
        void run('stair', ni, (r) => store.setResult('stair', r));
      }}
      onSample={loadSample}
      onReset={() => store.setInput('stair', { ...DEFAULT_STAIR })}
      result={result}
      fields={
        <>
          <FormSection title="هندسه">
            <SelectField
              label="نوع عضو"
              value={input.kind}
              onChange={(v) => set('kind', v as StairInput['kind'])}
              options={[
                { value: 'stair', label: 'راهپله' },
                { value: 'ramp', label: 'رمپ شیبدار' },
              ]}
            />
            <Field label="ارتفاع صعود (H)" value={input.H} onChange={(v) => set('H', v)} min={1} max={6} step={0.1} unit="متر" decimals={2} />
            <Field label="پیشروی افقی (L)" value={input.Lr} onChange={(v) => set('Lr', v)} min={2} max={14} step={0.1} unit="متر" decimals={2} />
            <Field label="عرض رمپ/پله (b)" value={input.bw} onChange={(v) => set('bw', v)} min={0.9} max={4} step={0.1} unit="متر" decimals={2} />
            <Field label="ضخامت دال (t)" value={input.t} onChange={(v) => set('t', v)} min={120} max={400} step={10} unit="mm" />
          </FormSection>
          <FormSection title="بارگذاری و مصالح">
            <Field label="بار مرده نازک‌کاری (DL)" value={input.DL} onChange={(v) => set('DL', v)} min={0.5} max={6} step={0.25} unit="kN/m²" decimals={2} />
            <Field label="بار زنده (LL)" value={input.LL} onChange={(v) => set('LL', v)} min={2} max={10} step={0.5} unit="kN/m²" decimals={2} />
            <Field label="مقاومت بتن (fc)" value={input.Fc} onChange={(v) => set('Fc', v)} min={20} max={50} step={1} unit="MPa" />
            <Field label="تسلیم فولاد (fy)" value={input.Fy} onChange={(v) => set('Fy', v)} min={240} max={500} step={10} unit="MPa" />
            <Field label="پوشش بتنی" value={input.cover} onChange={(v) => set('cover', v)} min={15} max={50} step={5} unit="mm" />
            <Field label="میلگرد طولی" value={input.barDia} onChange={(v) => set('barDia', v)} min={10} max={25} step={2} unit="mm" />
          </FormSection>
        </>
      }
      extra={
        <div className="space-y-3">
          {result ? (
            <>
              <div className="glass flex flex-wrap items-center gap-2 p-3">
                <Chip tone="ok">طولی Ø{faNum(input.barDia, 0)} @ {faNum(result.extras.sB, 0)}</Chip>
                <Chip tone="neutral">شیب {faNum((input.H / input.Lr) * 100, 0)}٪</Chip>
                <Chip tone={result.extras.defl <= (result.extras as Record<string, number>).deflAllow ? 'ok' : 'warn'}>
                  خیز {faNum(result.extras.defl, 1)} mm
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


