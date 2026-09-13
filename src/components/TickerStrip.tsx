
/* ============================================================================
 * CivilGenius v20 — fixed price ticker (CSS marquee, no JS animation loop)
 * ========================================================================== */

import { type ReactNode } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { faCompactToman } from '../lib/format';
import { MATERIALS, useMarket } from '../lib/market';

function TickerItem({ id }: { id: (typeof MATERIALS)[number]['id'] }): ReactNode {
  const snap = useMarket();
  const price = snap.prices[id];
  const prev = snap.prev[id];
  const def = snap.live[id];
  const delta = price - prev;
  const up = delta >= 0;
  const statusColor = def.status === 'live' ? 'text-emerald' : def.status === 'reference' ? 'text-blue' : 'text-gold-2';
  return (
    <span className="inline-flex shrink-0 items-center gap-2 border-l border-white/10 px-4 text-[11.5px]">
      <span className={`size-1.5 rounded-full ${def.status === 'live' ? 'bg-emerald' : def.status === 'reference' ? 'bg-blue' : 'bg-gold'}`} />
      <span className="text-white/75">{MATERIALS.find((m) => m.id === id)?.name}</span>
      <span className="font-mono font-bold text-white tnum">{faCompactToman(price)}</span>
      <span className="text-white/40">تومان</span>
      <span className={`inline-flex items-center gap-0.5 font-mono text-[10.5px] ${up ? 'text-emerald' : 'text-bad'} ${statusColor}`}>
        {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
        {faCompactToman(Math.abs(delta))}
      </span>
    </span>
  );
}

export function TickerStrip(): ReactNode {
  const items = MATERIALS.map((m) => m.id);
  return (
    <div className="relative z-30 h-9 overflow-hidden border-b border-white/10 bg-navy lg:mr-64" dir="rtl">
      <div className="marquee-track h-9 items-center whitespace-nowrap">
        {[...items, ...items].map((id, i) => (
          <TickerItem key={`${id}-${i}`} id={id} />
        ))}
      </div>
    </div>
  );
}


