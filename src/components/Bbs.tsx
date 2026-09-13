
/* ============================================================================
 * CivilGenius v23 — Bar-Bending-Schedule (لیستوفر) table, shared by all
 * new modules and the report generator hub.
 * ========================================================================== */

import { type ReactNode } from 'react';
import { ListOrdered } from 'lucide-react';
import type { CalcResult } from '../lib/engine';
import { faNum } from '../lib/format';

export function BbsTable({ result }: { result: CalcResult }): ReactNode {
  if (!result.bbs?.length) return null;
  const total = result.bbs.reduce((s, b) => s + b.weightKg, 0);
  return (
    <div className="glass overflow-hidden">
      <div className="border-b border-line bg-panel-2 px-4 py-2.5">
        <h3 className="flex items-center gap-2 text-[13px] font-bold text-ink">
          <ListOrdered size={15} className="text-gold" />
          لیستوفر (Bar Bending Schedule)
          <span className="mr-auto rounded-md bg-navy-soft px-1.5 py-0.5 text-[10px] font-semibold text-navy tnum">
            جمع: {faNum(total, 0)} kg
          </span>
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-right text-[12px]">
          <thead>
            <tr className="bg-navy text-white">
              {['مارک', 'شرح', 'قطر (mm)', 'طول برش (mm)', 'تعداد', 'وزن (kg)'].map((h) => (
                <th key={h} className="px-3 py-2 text-[11px] font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.bbs.map((b, i) => (
              <tr key={b.mark} className={`border-b border-line ${i % 2 ? 'bg-panel-2' : ''}`}>
                <td className="px-3 py-2 text-center font-bold text-forest">{b.mark}</td>
                <td className="px-3 py-2 text-ink">{b.label}</td>
                <td className="px-3 py-2 text-center tnum">{faNum(b.dia, 0)}</td>
                <td className="px-3 py-2 text-center tnum">{faNum(b.lenMm, 0)}</td>
                <td className="px-3 py-2 text-center tnum">{faNum(b.count, 0)}</td>
                <td className="px-3 py-2 text-center font-semibold text-ink tnum">{faNum(b.weightKg, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


