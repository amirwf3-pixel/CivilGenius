import { calculateBeam } from '../src/lib/engine';
import { calculateFoundation, calculateColumn, DEFAULT_FOUNDATION, DEFAULT_COLUMN } from '../src/lib/engine';

// verify BBS weight == BOQ rebar for all three modules
const t = calculateBeam({ L: 10, b: 400, h: 700, wd: 35, wl: 20, Fc: 30, Fy: 400, cover: 40, stirrupDia: 10, barDia: 20, stirrupSpacing: 120, stirrupLegs: 2, tensionLayers: 1, compBars: 3, compBarDia: 16, support: 'continuous', Tu: 60 });
const rb = t.boq.filter(b => b.code === 'RB' || b.code === 'ST').reduce((s,b)=>s+b.qty,0);
const bbsT = t.bbs!.reduce((s,b)=>s+b.weightKg,0);
console.log('BEAM: BOQ rebar(RB+ST)=', rb.toFixed(1), ' BBS total=', bbsT.toFixed(1), ' match=', Math.abs(rb-bbsT)<0.6);
t.boq.forEach(b=>console.log('   ', b.code, b.qty));

const f = calculateFoundation({ ...DEFAULT_FOUNDATION });
const fR = f.boq.find(b=>b.code==='RB')!.qty;
const fB = f.bbs!.reduce((s,b)=>s+b.weightKg,0);
console.log('FOUNDATION: BOQ rebar=', fR.toFixed(1), ' BBS total=', fB.toFixed(1), ' match=', Math.abs(fR-fB)<0.6);

const c = calculateColumn({ ...DEFAULT_COLUMN });
const cR = c.boq.filter(b=>b.code==='RB'||b.code==='ST').reduce((s,b)=>s+b.qty,0);
const cB = c.bbs!.reduce((s,b)=>s+b.weightKg,0);
console.log('COLUMN: BOQ rebar(RB+ST)=', cR.toFixed(1), ' BBS total=', cB.toFixed(1), ' match=', Math.abs(cR-cB)<0.6);
