import { calculateBeam } from '../src/lib/engine';
import type { BeamInput } from '../src/lib/engine';

// narrow beam with many bars -> barfit must report dc = requiredWidth/availWidth > 1
const narrow: BeamInput = { L: 10, b: 250, h: 700, wd: 35, wl: 20, Fc: 30, Fy: 400, cover: 40, stirrupDia: 10, barDia: 20, stirrupSpacing: 120, stirrupLegs: 2, tensionLayers: 1, compBars: 3, compBarDia: 16, support: 'continuous', Tu: 0 };
const r = calculateBeam(narrow);
const bf = r.checks.find((c) => c.id === 'barfit')!;
console.log('narrow beam barfit:', bf.status, bf.value, 'dc=', bf.dc?.toFixed(3), '(expect > 1.0)');
console.log('  requiredWidth=', r.extras.requiredWidth, 'availWidth=', r.extras.availWidth, 'nBars=', r.extras.nBars);

// torsion chain
const t = calculateBeam({ ...narrow, b: 400, Tu: 60 });
const tor = t.checks.find((c) => c.id === 'torsion')!;
console.log('\ntorsion beam Tu=60:', tor.status, '|', tor.value, '| dc=', tor.dc?.toFixed(3));
console.log('  torsionReq=', t.extras.torsionReq, 'AtOverS=', (t.extras.AtOverS as number).toFixed(4), 'Al=', Math.round(t.extras.Al as number), 'nTorsionLong=', t.extras.nTorsionLong, 'Tthreshold(kNm)=', (t.extras.Tthreshold as number).toFixed(2));
console.log('  BBS marks:', t.bbs!.map(b => b.mark + ':' + b.dia + 'x' + b.count).join(' '));
console.log('  BOQ rebar qty=', t.boq.find(b => b.code === 'RB')!.qty, 'kg | BBS total=', t.bbs!.reduce((s,b)=>s+b.weightKg,0).toFixed(1), 'kg');
console.log('  diagram torsion=', t.diagram.kind === 'beam' ? t.diagram.torsion : 'n/a', 'nTorsionLong=', t.diagram.kind === 'beam' ? t.diagram.nTorsionLong : 'n/a');
