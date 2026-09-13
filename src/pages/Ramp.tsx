
/* ============================================================================
 * CivilGenius v25 — Ramp design page (independent module, 8/8).
 * Ramp slab governed by deflection; longitudinal + distribution steel with
 * 90° anchorage bends. Uses the same engine chain as stair with kind='ramp'.
 * ========================================================================== */

import { MoveUpRight } from 'lucide-react';
import { DEFAULT_RAMP, type StairInput } from '../lib/modules';
import { faNum } from '../lib/format';
import { buildSampleProject, useStageCompute, useStore } from '../lib/store';
import { BbsTable } from '../components/Bbs';
import { Field } from '../components/Field';
import { ModuleShell } from '../components/ModuleShell';
import { Chip, FormSection } from '../components/ui';

export function RampPage() {
  const store = useStore();
  const input = store.inputs.ramp;
  const { stage, run } = useStageCompute();
  const set = <K extends keyof StairInput>(key: K, value: StairInput[K]): void =>
    store.setInput('ramp', { ...input, [key]: value });
  const result = store.results.ramp ?? null;

  /** one-click enterprise demo preset */
  const loadSample = (): void => {
    const s = buildSampleProject();
    const ni = { ...s.ramp, kind: 'ramp' as const };
    store.setInput('ramp', ni);
    void run('ramp', ni, (r) => store.setResult('ramp', r));
  };

  return (
    <ModuleShell
      title="طراحی رمپ"
      subtitle="دال شیبدار رمپ با ضخامت حداقل برای کنترل خیز، آرماتور طولی و عرضی و خم‌های مهار ۹۰ درجه در تکیه‌گاه‌ها."
      reference="مراجع: مبحث نهم (دال‌ها و خیز) — مبحث سوم (هندسه رمپ)"
      icon={<MoveUpRight size={20} />}
      stage={stage}
      onCompute={() => void run('ramp', input, (r) => store.setResult('ramp', r))}
      onAutoFix={(patch) => {
        const ni = { ...input, ...patch };
        store.setInput('ramp', ni);
        void run('ramp', ni, (r) => store.setResult('ramp', r));
      }}
      onSample={loadSample}
      onReset={() => store.setInput('ramp', { ...DEFAULT_RAMP })}
      result={result}
      fields={
        <>
          <FormSection title="هندسه رمپ">
            <Field label="ارتفاع صعود (H)" value={input.H} onChange={(v) => set('H', v)} min={1} max={6} step={0.1} unit="متر" decimals={2} />
            <Field label="پیشروی افقی (L)" value={input.Lr} onChange={(v) => set('Lr', v)} min={2} max={14} step={0.1} unit="متر" decimals={2} />
            <Field label="عرض رمپ (b)" value={input.bw} onChange={(v) => set('bw', v)} min={0.9} max={4} step={0.1} unit="متر" decimals={2} />
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
