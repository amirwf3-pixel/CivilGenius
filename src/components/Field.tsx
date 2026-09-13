
/* ============================================================================
 * CivilGenius v20 — Field: number input + slider, always in sync
 * (round-6 requirement: input limits expanded well beyond the old maxima)
 * ========================================================================== */

import { useEffect, useState, type ReactNode } from 'react';
import { Info } from 'lucide-react';
import { faNum, parseNum, toFa } from '../lib/format';
import { clamp } from '../lib/format';

export function Field({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  hint,
  tip,
  decimals = 0,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  hint?: string;
  /** floating code tip (مبحث نهم) shown on hover */
  tip?: string;
  decimals?: number;
}): ReactNode {
  const [draft, setDraft] = useState(() => toFa(value.toLocaleString('en-US', { maximumFractionDigits: decimals })));

  useEffect(() => {
    setDraft(toFa(value.toLocaleString('en-US', { maximumFractionDigits: decimals })));
  }, [value, decimals]);

  const commit = (raw: string): void => {
    const parsed = parseNum(raw);
    if (!Number.isFinite(parsed)) {
      setDraft(toFa(value.toLocaleString('en-US', { maximumFractionDigits: decimals })));
      return;
    }
    const next = clamp(parsed, min, max);
    onChange(next);
    setDraft(toFa(next.toLocaleString('en-US', { maximumFractionDigits: decimals })));
  };

  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-[12px] font-medium text-ink">
          {label}
          {tip ? (
            <span className="group relative inline-flex">
              <Info size={12} className="cursor-help text-faint transition group-hover:text-emerald" />
              <span className="pointer-events-none absolute right-0 top-4 z-30 hidden w-56 rounded-lg border border-line bg-navy p-2 text-[10px] font-normal leading-5 text-white shadow-xl group-hover:block">
                {tip}
              </span>
            </span>
          ) : null}
        </span>
        {unit ? <span className="text-[10px] text-faint">{unit}</span> : null}
      </span>
      <input
        type="text"
        inputMode="decimal"
        dir="rtl"
        className="field-input tnum text-center focus:field-input-focus"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
      <input
        type="range"
        className="range-gold mt-2"
        min={min}
        max={max}
        step={step}
        value={clamp(value, min, max)}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
      />
      <span className="mt-1 flex items-center justify-between text-[10px] text-faint tnum">
        <span>{faNum(min, decimals)}</span>
        {hint ? <span className="text-gold-2">{hint}</span> : null}
        <span>{faNum(max, decimals)}</span>
      </span>
    </label>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  hint?: string;
}): ReactNode {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium text-ink">{label}</span>
      <select
        className="field-input focus:field-input-focus"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint ? <span className="mt-1 block text-[10px] text-faint">{hint}</span> : null}
    </label>
  );
}


