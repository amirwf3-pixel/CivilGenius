// P1-2.3 evidence: solid-slab ramp deflection feasibility boundary (t capped 400 mm)
function rampDefl(H: number, Lr: number, t: number, DL: number, LL: number, Fc: number): { Ls: number; defl: number; allow: number; ok: boolean } {
  const Ls = Math.sqrt(H * H + Lr * Lr);
  const cos = Lr / Ls;
  const sw = (25 * t) / 1000 / cos;            // self weight along incline
  const wu = 1.2 * (DL + sw) + 1.6 * LL;
  const Ec = 4700 * Math.sqrt(Fc);
  const heff = t;
  const Ie = 0.35 * ((1000 * heff ** 3) / 12);
  const defl = (5 * (wu * cos) * Math.pow(Ls * 1000, 4)) / (384 * Ec * Ie);
  const allow = (Ls * 1000) / 250;
  return { Ls, defl, allow, ok: defl <= allow };
}
// heavy ramp: DL=3, LL=5, Fc=25. Find max feasible Ls at t=400 for slope 12.5% (H/Lr=0.125)
const rows: string[] = [];
for (const Lr of [6, 7, 8, 9, 10, 12]) {
  const H = 0.125 * Lr;
  let feasible = false;
  for (let t = 120; t <= 400; t += 10) { if (rampDefl(H, Lr, t, 3, 5, 25).ok) { feasible = true; break; } }
  const at400 = rampDefl(H, Lr, 400, 3, 5, 25);
  rows.push(`Lr=${Lr} H=${H.toFixed(1)} Ls=${at400.Ls.toFixed(2)} t<=400 feasible=${feasible}  δ@400=${at400.defl.toFixed(1)} vs allow=${at400.allow.toFixed(1)} (dc=${(at400.defl/at400.allow).toFixed(2)})`);
}
console.log(rows.join('\n'));
// binary search the boundary Lr* at slope 12.5%, t=400, DL=3/LL=5/Fc=25
let lo = 6, hi = 12;
for (let i = 0; i < 30; i++) {
  const mid = (lo + hi) / 2;
  const H = 0.125 * mid;
  let ok = false;
  for (let t = 120; t <= 400; t += 10) { if (rampDefl(H, mid, t, 3, 5, 25).ok) { ok = true; break; } }
  if (ok) lo = mid; else hi = mid;
}
console.log(`\nFeasibility boundary (slope 12.5%, DL=3,LL=5,Fc=25, t<=400): Lr* ≈ ${lo.toFixed(2)} m (Ls ≈ ${Math.sqrt((0.125*lo)**2 + lo**2).toFixed(2)} m)`);
