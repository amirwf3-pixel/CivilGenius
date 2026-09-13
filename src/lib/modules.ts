
/* ============================================================================
 * CivilGenius v24 — comprehensive optimization for all 8 modules
 *   • Slab systems (joist-block / waffle / solid / hollow-core)
 *   • RC shear wall (horizontal/vertical rebar, boundary elements,
 *     shear-friction, drift)
 *   • Stair / ramp (deflection-governed slab, anchorage bends)
 *   • Beam-column joint (panel shear φVn ≥ Vu, confinement hoops)
 * All results are CalcResult so trace/CalcBook/BOQ/DXF/vault work for free.
 * مباحث نهم/ششم مقررات ملی + ACI 318 (simplified, deterministic)
 * Smart optimizer guarantees: every check has autofix, realistic bounds,
 * standard bar sizes, 50 mm geometry steps, separation AsReq/AsMin.
 * ========================================================================== */

import { faNum, projectCode } from './format';
import { CALC_META, devLength } from './engine';
import type { BBSItem, BOQItem, CalcResult, DesignCheck, TraceStep } from './engine';

const AB = (d: number): number => (Math.PI * d * d) / 4; // mm²
const KG = (mm3: number): number => mm3 * 7.85e-6; // steel kg

// --- standard realistic bounds per Topic 9 ---
const STD_DIAS = [12, 14, 16, 18, 20, 22, 25, 28, 32] as const;
const STD_STIRRUP_DIAS = [8, 10, 12, 14, 16] as const;
function nextStdDia(d: number): number {
  for (const x of STD_DIAS) if (x > d) return x;
  return 32;
}
function nextStirrupDia(d: number): number {
  for (const x of STD_STIRRUP_DIAS) if (x > d) return x;
  return 16;
}
function clampMainSpacing(s: number): number {
  return Math.max(100, Math.min(300, Math.round(s / 25) * 25));
}
function clampTieSpacing(s: number): number {
  return Math.max(50, Math.min(200, Math.round(s / 25) * 25));
}
function roundUp50(x: number): number {
  return Math.ceil(x / 50) * 50;
}
function roundUp10(x: number): number {
  return Math.ceil(x / 10) * 10;
}

/* ================================================================== SLAB == */

export interface SlabInput {
  system: 'joist' | 'waffle' | 'solid' | 'hollow';
  L: number; // one-way clear span, m
  h: number; // total slab depth, mm
  DL: number; // superimposed dead load, kN/m²
  LL: number; // live load, kN/m²
  Fc: number;
  Fy: number;
  cover: number;
  barDia: number; // main bottom bar
  negDia: number; // negative (support) bar
  tempDia: number; // temperature / monolith (مونس) bar
  joistSpacing: number; // mm (joist & waffle)
}

export const DEFAULT_SLAB: SlabInput = {
  system: 'joist',
  L: 5.5,
  h: 250,
  DL: 2.5,
  LL: 2,
  Fc: 25,
  Fy: 400,
  cover: 25,
  barDia: 12,
  negDia: 10,
  tempDia: 8,
  joistSpacing: 500,
};

const SLAB_NAME = { joist: 'تیرچه-بلوک', waffle: 'وافل', solid: 'دال بتنی', hollow: 'دال مجوف' } as const;

export function calculateSlab(i: SlabInput): CalcResult<SlabInput> {
  const { L, DL, LL, Fc, Fy } = i;
  const h = Math.max(120, Math.min(600, Math.round(i.h / 10) * 10));
  const b = 1000; // 1 m design strip
  const solidSw = (25 * h) / 1000;
  const sw =
    i.system === 'solid' ? solidSw : i.system === 'hollow' ? 0.7 * solidSw : i.system === 'joist' ? 0.55 * solidSw + 1.6 : 0.45 * solidSw + 1.4;
  const wu = 1.2 * (DL + sw) + 1.6 * LL; // kN/m²
  const ws = DL + sw + LL; // service, kN/m²
  const Mu = (wu * L * L) / 8; // kN·m per m
  const Vu = (wu * L) / 2; // kN per m
  const d = h - i.cover - i.barDia / 2 - 5;
  const Ec = 4700 * Math.sqrt(Fc);

  // flexure (per metre) — separation AsReq vs AsMin
  const AsReq = (Mu * 1e6) / (0.81 * Fy * d);
  const AsMin = Math.max((0.25 * Math.sqrt(Fc) * b * d) / Fy, (1.4 * b * d) / Fy);
  const As = Math.max(AsReq, AsMin);
  const AsT = 0.0018 * b * h; // temperature / monolith

  // main bars: ensure spacing 100–300 per Topic 9, realistic
  const nMainReq = Math.max(Math.ceil(As / AB(i.barDia)), Math.ceil(AsMin / AB(i.barDia)), Math.ceil(1000 / 300));
  const sMainRaw = Math.floor(1000 / nMainReq);
  const sMain = clampMainSpacing(sMainRaw);
  const AsProv = (1000 / sMain) * AB(i.barDia);

  const AsNeg = 0.33 * As;
  const nNeg = Math.max(Math.ceil(AsNeg / AB(i.negDia)), 3);
  const sNegRaw = Math.floor(1000 / nNeg);
  const sNeg = clampMainSpacing(Math.min(250, sNegRaw));
  const AsNegProv = (1000 / sNeg) * AB(i.negDia);

  const nT = Math.max(Math.ceil(AsT / AB(i.tempDia)), 4);
  const sTRaw = Math.floor(1000 / nT);
  const sT = clampMainSpacing(Math.min(300, sTRaw));
  const AsTProv = (1000 / sT) * AB(i.tempDia);

  // deflection
  const Ie = 0.35 * ((b * h ** 3) / 12);
  const defl = (5 * ws * Math.pow(L * 1000, 4)) / (384 * Ec * Ie); // mm
  const deflAllow = (L * 1000) / 250;

  // shear
  const Vc = (0.17 * Math.sqrt(Fc) * b * d) / 1000;
  const phiV = 0.75 * Vc;

  const tieBeam = i.system === 'joist' || i.system === 'waffle';
  // طول مهاری کامل — مبحث نهم بند ۹-۱۸-۲ (عوامل ψt/ψe/ψs/λ)
  const ld = devLength(i.barDia, Fy, Fc);
  const ldTop = devLength(i.barDia, Fy, Fc, { top: true });

  // smart fixes
  const hFixShear = (() => {
    let hh = h;
    for (let k = 0; k < 20; k++) {
      const dd = hh - i.cover - i.barDia / 2 - 5;
      const VcT = (0.17 * Math.sqrt(Fc) * b * dd) / 1000;
      if (Vu <= 0.75 * VcT) break;
      hh = Math.min(600, roundUp10(hh + 10));
    }
    return hh;
  })();
  const hFixDefl = (() => {
    if (defl <= deflAllow) return h;
    // δ ∝ 1/Ie ∝ 1/h³
    const ratio = defl / deflAllow;
    const hh = Math.min(600, roundUp10(h * Math.cbrt(ratio) * 1.05));
    return hh;
  })();
  const hFix = Math.max(hFixShear, hFixDefl);
  const barDiaFixFlex = AsProv < AsReq ? nextStdDia(i.barDia) : i.barDia;

  const trace: TraceStep[] = [
    { step: 1, title: 'بارگذاری نهایی (ترکیب بار)', formula: 'wu = 1.2(DL+sw) + 1.6(LL)', detail: `وزن خود سقف ${faNum(sw, 2)} kN/m² — دهانه ${faNum(L, 2)} m`, result: `wu = ${faNum(wu, 2)} kN/m²`, ref: 'مبحث ششم' },
    { step: 2, title: 'لنگر و برش طرح (نوار ۱ متری)', formula: 'Mu = wu·L²/8 , Vu = wu·L/2', detail: `Mu = ${faNum(wu, 2)}×${faNum(L, 2)}²/8`, result: `Mu = ${faNum(Mu, 1)} kN·m | Vu = ${faNum(Vu, 1)} kN`, ref: 'مبحث ششم' },
    { step: 3, title: 'میلگرد کششی پایین دال', formula: 'AsReq = Mu / (0.81·fy·d) ; AsMin = max(0.25√fc·b·d/fy, 1.4·b·d/fy)', detail: `d = ${faNum(d, 0)} mm — AsReq=${faNum(AsReq, 0)} AsMin=${faNum(AsMin, 0)}`, result: `As = ${faNum(As, 0)} mm²/m → Ø${faNum(i.barDia, 0)} @ ${faNum(sMain, 0)}`, ref: 'مبحث نهم' },
    { step: 4, title: 'میلگرد منفی سرتکیه‌ها', formula: 'As− ≈ 0.33·As', detail: 'گستره لنگر منفی L/4 از بر تکیه‌گاه', result: `Ø${faNum(i.negDia, 0)} @ ${faNum(sNeg, 0)} mm`, ref: 'مبحث نهم' },
    { step: 5, title: 'میلگرد حرارتی / مونس', formula: 'As,t = 0.0018·b·h', detail: `0.0018×1000×${faNum(h, 0)}`, result: `Ø${faNum(i.tempDia, 0)} @ ${faNum(sT, 0)} mm`, ref: 'مبحث نهم' },
    { step: 6, title: 'کنترل خیز چشمی (افتادگی)', formula: 'δ = 5·w·L⁴/(384·Ec·Ie)', detail: `Ie = 0.35·bh³/12 — مجاز L/250 = ${faNum(deflAllow, 1)} mm`, result: `δ = ${faNum(defl, 1)} mm`, ref: 'مبحث نهم' },
  ];
  if (tieBeam)
    trace.push({ step: 7, title: 'تای‌بیم (تیر عرضی) دو سر تیرچه‌ها', formula: '2Ø12 + Ø8@200 , b×h = 150×h', detail: 'پیوستگی دال و انتقال برش به تکیه‌گاه', result: 'الزامی در ابتدا و انتهای هر دهانه', ref: 'دستورالعمل تیرچه' });

  const checks: DesignCheck[] = [
    {
      id: 'flex',
      label: 'کفایت آرماتور کششی دال (AsReq)',
      status: AsProv >= AsReq ? 'ok' : 'bad',
      value: `${faNum(AsProv, 0)} ≥ ${faNum(AsReq, 0)} mm²/m`,
      ref: 'مبحث نهم ۹-۱۴-۲-۱',
      fix: 'فاصله میلگردها را کاهش دهید یا قطر را افزایش دهید.',
      suggestion: `پیشنهاد هوشمند: Ø${faNum(barDiaFixFlex, 0)} @ ${faNum(clampMainSpacing(sMain - 25), 0)} یا ضخامت ${faNum(hFix, 0)}`,
      autofix: AsProv < AsReq ? { barDia: barDiaFixFlex, h: hFix } : { h: h },
      dc: AsReq / AsProv,
    },
    {
      id: 'asmin',
      label: 'حداقل آرماتور دال (AsMin)',
      status: AsProv >= AsMin ? 'ok' : 'warn',
      value: `${faNum(AsProv, 0)} ≥ ${faNum(AsMin, 0)} mm²/m`,
      ref: 'مبحث نهم ۹-۱۴-۲-۱-۱ / ACI 9.6.1.2',
      fix: 'حداقل آرماتور را رعایت کنید.',
      suggestion: `پیشنهاد: Ø${faNum(nextStdDia(i.barDia), 0)}`,
      autofix: { barDia: nextStdDia(i.barDia) },
      dc: AsMin / AsProv,
    },
    {
      id: 'neg',
      label: 'آرماتور منفی سرتکیه‌ها',
      status: AsNegProv >= AsNeg ? 'ok' : 'bad',
      value: `${faNum(AsNegProv, 0)} ≥ ${faNum(AsNeg, 0)} mm²/m`,
      ref: 'مبحث نهم ۹-۱۴-۲-۱',
      fix: 'میلگرد منفی را تقویت کنید.',
      suggestion: `پیشنهاد هوشمند: Ø${faNum(nextStdDia(i.negDia), 0)} @ ${faNum(clampMainSpacing(sNeg - 25), 0)}`,
      autofix: { negDia: nextStdDia(i.negDia) },
      dc: AsNeg / AsNegProv,
    },
    {
      id: 'temp',
      label: 'شبکه حرارتی/مونس',
      status: AsTProv >= AsT ? 'ok' : 'bad',
      value: `${faNum(AsTProv, 0)} ≥ ${faNum(AsT, 0)} mm²/m`,
      ref: 'مبحث نهم ۹-۱۴-۲-۱ (0.0018) / ACI 24.4.3.2',
      fix: 'فاصله شبکه حرارتی را کم کنید.',
      suggestion: `پیشنهاد: Ø${faNum(nextStdDia(i.tempDia), 0)} @ ${faNum(clampMainSpacing(sT - 25), 0)}`,
      autofix: { tempDia: nextStdDia(i.tempDia) },
      dc: AsT / AsTProv,
    },
    {
      id: 'shear',
      label: 'کنترل برش دال',
      status: Vu <= phiV ? 'ok' : 'bad',
      value: `${faNum(Vu, 1)} ≤ ${faNum(phiV, 1)} kN`,
      ref: 'مبحث نهم ۹-۱۵-۲-۱ / ACI 22.5.5.1',
      fix: 'ضخامت دال را افزایش دهید.',
      suggestion: `پیشنهاد هوشمند: افزایش ضخامت به ${faNum(hFixShear, 0)} mm`,
      autofix: { h: hFixShear },
      dc: Vu / phiV,
    },
    {
      id: 'defl',
      label: 'خیز / افتادگی چشمی',
      status: defl <= deflAllow ? 'ok' : defl <= 1.2 * deflAllow ? 'warn' : 'bad',
      value: `${faNum(defl, 1)} ≤ ${faNum(deflAllow, 1)} mm`,
      ref: 'مبحث نهم ۹-۲۱-۲ / ACI جدول 24.2.2',
      fix: 'ضخامت را زیاد کنید یا دهانه مؤثر را کاهش دهید.',
      suggestion: `پیشنهاد هوشمند: ضخامت ${faNum(hFixDefl, 0)} mm`,
      autofix: { h: hFixDefl },
      dc: defl / deflAllow,
    },
    {
      id: 'spacing',
      label: 'فاصله میلگرد در محدوده مجاز [۱۰۰،۳۰۰]',
      status: sMain >= 100 && sMain <= 300 ? 'ok' : 'warn',
      value: `${faNum(sMain, 0)} mm ∈ [۱۰۰،۳۰۰]`,
      ref: 'مبحث نهم',
      fix: 'فاصله را بین ۱۰۰ تا ۳۰۰ نگه دارید.',
      suggestion: `پیشنهاد: ${faNum(clampMainSpacing(sMain), 0)} mm`,
      autofix: { barDia: sMain < 100 ? nextStdDia(i.barDia) : i.barDia },
      dc: sMain / 300,
    },
  ];

  const steelKg = KG((AsProv + AsNegProv + AsTProv) * L * 1000) + (tieBeam ? 2 * (4 * AB(12) + AB(8) * 2) * 1 * 7.85e-3 * 1000 : 0);
  const concM3 = (i.system === 'joist' ? 0.55 : i.system === 'waffle' ? 0.45 : i.system === 'hollow' ? 0.7 : 1) * (h / 1000) * L + (tieBeam ? 2 * 0.15 * (h / 1000) * 0.2 : 0);
  const blocks = tieBeam ? Math.round((1000 / i.joistSpacing) * (L / 0.4)) : 0;

  const boq: BOQItem[] = [
    { code: 'SLB-C', title: `بتن‌ریزی سقف ${SLAB_NAME[i.system]} عیار ۳۰۰`, titleEn: 'Slab concrete C25', unit: 'm³', unitEn: 'm³', qty: +concM3.toFixed(2), materialId: 'concrete', detail: `ضخامت ${faNum(h, 0)} mm دهانه ${faNum(L, 1)} m` },
    { code: 'SLB-R', title: 'آرماتوربندی دال (کششی، منفی، حرارتی' + (tieBeam ? '، تای‌بیم' : '') + ')', titleEn: 'Slab rebar', unit: 'kg', unitEn: 'kg', qty: +steelKg.toFixed(0), materialId: 'rebar', detail: `A3 Ø${faNum(i.barDia, 0)}/Ø${faNum(i.negDia, 0)}/Ø${faNum(i.tempDia, 0)}` },
    { code: 'SLB-F', title: 'قالب‌بندی کف سقف و شمع‌بندی', titleEn: 'Slab formwork', unit: 'm²', unitEn: 'm²', qty: +(L * (i.system === 'joist' || i.system === 'waffle' ? 0.5 : 1)).toFixed(1), materialId: 'formwork', detail: 'به ازای هر متر عرض نوار' },
  ];
  if (blocks) boq.push({ code: 'SLB-B', title: i.system === 'joist' ? 'بلوک سقفی ۴۰×۲۰×۲۰' : 'قالب وافل (پانل)', titleEn: 'Ceiling blocks/pans', unit: 'عدد', unitEn: 'pcs', qty: blocks, materialId: 'block', detail: `فاصله محور تا محور ${faNum(i.joistSpacing, 0)} mm` });

  const bbs: BBSItem[] = [
    { mark: 'S1', label: 'میلگرد کششی پایین دال', dia: i.barDia, lenMm: L * 1000 + 2 * ld, count: Math.ceil(1000 / sMain), weightKg: +KG(AB(i.barDia) * (L * 1000 + 2 * ld) * Math.ceil(1000 / sMain)).toFixed(1) },
    { mark: 'S2', label: 'میلگرد منفی سرتکیه‌ها (L/4)', dia: i.negDia, lenMm: (L * 1000) / 2 + ldTop, count: 2 * Math.ceil(1000 / sNeg), weightKg: +KG(AB(i.negDia) * ((L * 1000) / 2 + ldTop) * 2 * Math.ceil(1000 / sNeg)).toFixed(1) },
    { mark: 'S3', label: 'شبکه حرارتی/مونس', dia: i.tempDia, lenMm: L * 1000, count: Math.ceil(1000 / sT), weightKg: +KG(AB(i.tempDia) * L * 1000 * Math.ceil(1000 / sT)).toFixed(1) },
  ];
  if (tieBeam) bbs.push({ mark: 'S4', label: 'میلگرد تای‌بیم (تیر عرضی)', dia: 12, lenMm: 1000 + 2 * 200, count: 4, weightKg: +KG(AB(12) * 1400 * 4).toFixed(1) });

  const ok = checks.every((c) => c.status !== 'bad');
  return {
    type: 'slab',
    code: projectCode(CALC_META.slab.prefix),
    createdAt: Date.now(),
    input: i,
    metrics: [
      { label: 'لنگر طرح Mu', value: faNum(Mu, 1), raw: Mu, unit: 'kN·m', tone: 'neutral' },
      { label: 'آرماتور لازم AsReq', value: faNum(AsReq, 0), raw: AsReq, unit: 'mm²/m', tone: 'neutral' },
      { label: 'آرماتور حداقل AsMin', value: faNum(AsMin, 0), raw: AsMin, unit: 'mm²/m', tone: 'neutral' },
      { label: 'خیز بهره‌برداری', value: faNum(defl, 1), raw: defl, unit: 'mm', tone: defl <= deflAllow ? 'ok' : 'warn', hint: `مجاز ${faNum(deflAllow, 1)} mm` },
      { label: 'وزن فولاد', value: faNum(steelKg, 0), raw: steelKg, unit: 'kg/m', tone: 'neutral' },
    ],
    boq,
    verdict: ok
      ? { ok: true, title: 'سقف از نظر خمشی، برشی و خیز کنترل شد', text: `سیستم ${SLAB_NAME[i.system]} با Ø${faNum(i.barDia, 0)}@${faNum(sMain, 0)} پایین و Ø${faNum(i.negDia, 0)}@${faNum(sNeg, 0)} منفی قابل اجراست.` }
      : { ok: false, title: 'سقف نیاز به اصلاح دارد', text: 'کارت‌های قرمز را بررسی و ضخامت/آرماتور را مطابق پیشنهاد افزایش دهید.' },
    diagram: { kind: 'slab', system: i.system, L, h, barDia: i.barDia, spacing: sMain, negSpacing: sNeg, tempSpacing: sT, tieBeam },
    assessment: `دهانه ${faNum(L, 1)} m با ضخامت ${faNum(h, 0)} mm — نسبت خیز ${faNum(defl / deflAllow, 2)} — AsReq ${faNum(AsReq, 0)} vs AsMin ${faNum(AsMin, 0)}.`,
    trace,
    checks,
    extras: { Mu, Vu, As, AsReq, AsMin, AsProv, sMain, sNeg, sT, defl, deflAllow, steelKg, hFix, phiV },
    bbs,
  };
}

/* ============================================================ SHEAR WALL == */

export interface WallInput {
  lw: number; // wall length, m
  tw: number; // thickness, mm
  hs: number; // story height, m
  Pu: number;
  Mu: number;
  Vu: number;
  Fc: number;
  Fy: number;
  cover: number;
  vDia: number;
  hDia: number;
  hoopDia: number; // boundary confinement hoop bar size
  beForce: number; // 0 = auto per σ>0.2fc, 1 = force special confinement
  beLenMm: number; // 0 = auto per ACI 18.10.6 formula
  beHoopS: number; // 0 = auto (100 mm); confinement hoop spacing
  beVertDia: number; // boundary vertical bar diameter
  beVertCount: number; // vertical bars per boundary element (≥ 6 per ACI)
}

export const DEFAULT_WALL: WallInput = {
  lw: 4,
  tw: 250,
  hs: 3.2,
  Pu: 2600,
  Mu: 3800,
  Vu: 850,
  Fc: 30,
  Fy: 400,
  cover: 30,
  vDia: 14,
  hDia: 12,
  hoopDia: 10,
  beForce: 0,
  beLenMm: 0,
  beHoopS: 0,
  beVertDia: 16,
  beVertCount: 6,
};

export function calculateWall(i: WallInput): CalcResult<WallInput> {
  const lw = i.lw * 1000; // mm
  const tw = Math.max(150, Math.min(600, roundUp50(i.tw)));
  const hs = i.hs * 1000;
  const Ag = lw * tw;
  const Ec = 4700 * Math.sqrt(i.Fc);
  const Ig = (tw * lw ** 3) / 12;

  const sigma = (i.Pu * 1000) / Ag + (i.Mu * 1e6) / ((tw * lw * lw) / 6); // MPa extreme fiber
  const boundary = i.beForce === 1 || sigma > 0.2 * i.Fc;
  const c = (i.Pu * 1000 + 0.5 * (i.Mu * 1e6) / (0.8 * lw)) / (0.72 * i.Fc * tw); // rough NA
  const beLen = boundary ? Math.max(300, i.beLenMm > 0 ? i.beLenMm : Math.max(c - 0.1 * lw, c / 2, 300)) : 0;
  const beHoopSraw = boundary ? (i.beHoopS > 0 ? i.beHoopS : 100) : 100;
  const beHoopS = clampTieSpacing(beHoopSraw);
  const nBeBars = Math.max(4, Math.round(i.beVertCount));
  const beConfinedOk = !boundary || (beHoopS <= 100 && nBeBars >= 6 && i.beVertDia >= 14);

  // vertical steel from tension-compression couple
  const T = (i.Mu * 1e6) / (0.8 * lw) - (i.Pu * 1000) / 2;
  const AsVreq = Math.max(T, 0) / (0.9 * i.Fy) + 0.0025 * Ag;
  const AsVmin = 0.0025 * Ag;
  const nV = Math.max(Math.ceil(AsVreq / AB(i.vDia)), Math.ceil(AsVmin / AB(i.vDia)));
  const sVraw = Math.floor(lw / nV / 10) * 10;
  const sV = clampMainSpacing(Math.min(400, sVraw));
  const AsVprov = (lw / sV) * AB(i.vDia);

  const AsHreq = 0.0025 * Ag;
  const nH = Math.max(Math.ceil(AsHreq / AB(i.hDia)), Math.ceil(hs / 400));
  const sHraw = Math.floor(hs / nH / 10) * 10;
  const sH = clampMainSpacing(Math.min(400, sHraw));
  const rhoH = ((1000 / sH) * AB(i.hDia)) / (tw * 1000); // per mm? simplified
  // more accurate rhoH for check: AsHprov per unit height
  const AsHprovPerM = (1000 / sH) * AB(i.hDia);

  const Vn = (Ag * (0.17 * Math.sqrt(i.Fc) + rhoH * i.Fy)) / 1000; // kN
  const phiVn = 0.75 * Vn;
  const Vslide = (0.6 * (AsVprov * i.Fy + i.Pu * 1000)) / 1000;
  const phiVs = 0.75 * Vslide;

  const drift = (i.Vu * 1000 * Math.pow(hs, 3)) / (3 * Ec * Ig) + (1.2 * i.Vu * 1000 * hs) / (0.4 * Ec * Ag);
  const driftAllow = 0.02 * hs;

  // smart fixes
  const twFixShear = (() => {
    if (i.Vu <= phiVn) return tw;
    // increase tw by 50 mm steps up to 600
    for (let t = tw + 50; t <= 600; t += 50) {
      const AgT = lw * t;
      // recalc roughly — IgT not needed for shear, kept for drift calc elsewhere
      const rhoHT = rhoH; // keep same for quick check, will improve with more steel too
      const VnT = (AgT * (0.17 * Math.sqrt(i.Fc) + rhoHT * i.Fy)) / 1000;
      if (i.Vu <= 0.75 * VnT) return t;
    }
    return Math.min(600, roundUp50(tw + 50));
  })();
  const vDiaFix = AsVprov < AsVreq ? nextStdDia(i.vDia) : i.vDia;
  const hDiaFix = i.Vu > phiVn ? nextStdDia(i.hDia) : i.hDia;
  const lwFixDrift = drift > driftAllow ? +(i.lw + 0.5).toFixed(1) : i.lw;

  const trace: TraceStep[] = [
    { step: 1, title: 'تنش فیبر انتهایی (نیاز المان مرزی)', formula: 'σ = P/A + M/S', detail: `A = ${faNum(Ag / 1e6, 2)} m² — S = t·lw²/6`, result: `σ = ${faNum(sigma, 1)} MPa ↔ 0.2fc = ${faNum(0.2 * i.Fc, 1)}`, ref: 'ACI 18.10.6' },
    { step: 2, title: 'طول المان مرزی و محصورشدگی', formula: 'lbe = max(c−0.1lw, c/2)', detail: boundary ? `c ≈ ${faNum(c, 0)} mm → خاموت Ø${faNum(i.hoopDia, 0)}@${faNum(beHoopS, 0)} + سنجاق` : 'σ ≤ 0.2fc → المان مرزی الزامی نیست', result: boundary ? `lbe = ${faNum(beLen, 0)} mm` : '—', ref: 'ACI 18.10.6' },
    { step: 3, title: 'آرماتور عمودی (خمشی + حداقل)', formula: 'As,v = M/(0.8·lw·0.9·fy) − P/2·fy + 0.0025Ag', detail: `ρv,min = 0.25٪ دو لایه — AsReq=${faNum(AsVreq, 0)} AsMin=${faNum(AsVmin, 0)}`, result: `Ø${faNum(i.vDia, 0)} @ ${faNum(sV, 0)} mm`, ref: 'مبحث نهم' },
    { step: 4, title: 'آرماتور افقی', formula: 'ρh ≥ 0.0025', detail: `As,h = ${faNum(AsHreq, 0)} mm²`, result: `Ø${faNum(i.hDia, 0)} @ ${faNum(sH, 0)} mm`, ref: 'ACI 18.10.2' },
    { step: 5, title: 'ظرفیت برش دیوار', formula: 'Vn = Acv(0.17√fc + ρh·fy)', detail: `φ = 0.75 → φVn = ${faNum(phiVn, 0)} kN`, result: `Vu = ${faNum(i.Vu, 0)} kN`, ref: 'ACI 18.10.3' },
    { step: 6, title: 'برش لغزشی پایه دیوار', formula: 'Vn = μ(Avf·fy + N) , μ = 0.6', detail: 'سطح constructions joint بتن-به-بتن', result: `φVn = ${faNum(phiVs, 0)} kN`, ref: 'ACI 18.10.5' },
    { step: 7, title: 'کنترل دریفت طبقه', formula: 'δ = V·hs³/3EcIg + 1.2V·hs/GAc', detail: `مجاز ۲٪ ارتفاع طبقه = ${faNum(driftAllow, 0)} mm`, result: `δ = ${faNum(drift, 1)} mm`, ref: 'استاندارد ۲۸۰۰' },
  ];

  const checks: DesignCheck[] = [
    {
      id: 'shear',
      label: 'برش افقی دیوار',
      status: i.Vu <= phiVn ? 'ok' : 'bad',
      value: `${faNum(i.Vu, 0)} ≤ ${faNum(phiVn, 0)} kN`,
      ref: 'ACI 18.10.3',
      fix: 'ضخامت/آرماتور افقی را افزایش دهید.',
      suggestion: `پیشنهاد هوشمند: ضخامت ${faNum(twFixShear, 0)} mm و Ø${faNum(hDiaFix, 0)}`,
      autofix: { tw: twFixShear, hDia: hDiaFix },
      dc: i.Vu / phiVn,
    },
    {
      id: 'slide',
      label: 'برش لغزشی (Shear Friction)',
      status: i.Vu <= phiVs ? 'ok' : 'bad',
      value: `${faNum(i.Vu, 0)} ≤ ${faNum(phiVs, 0)} kN`,
      ref: 'ACI 18.10.5',
      fix: 'آرماتور عمودی پیوندی (Avf) را زیاد کنید.',
      suggestion: `پیشنهاد هوشمند: میلگرد عمودی D${faNum(vDiaFix, 0)}`,
      autofix: { vDia: vDiaFix },
      dc: i.Vu / phiVs,
    },
    {
      id: 'vsteel',
      label: 'کفایت آرماتور عمودی (AsReq vs AsMin)',
      status: AsVprov >= AsVreq ? 'ok' : 'bad',
      value: `${faNum(AsVprov, 0)} ≥ ${faNum(AsVreq, 0)} mm² (AsMin=${faNum(AsVmin, 0)})`,
      ref: 'مبحث نهم',
      fix: 'گام میلگرد عمودی را کم کنید یا قطر را افزایش دهید.',
      suggestion: `پیشنهاد هوشمند: D${faNum(vDiaFix, 0)} @ ${faNum(clampMainSpacing(sV - 25), 0)}`,
      autofix: { vDia: vDiaFix },
      dc: AsVreq / AsVprov,
    },
    {
      id: 'drift',
      label: 'دریفت طبقه',
      status: drift <= driftAllow ? 'ok' : drift <= 1.2 * driftAllow ? 'warn' : 'bad',
      value: `${faNum(drift, 1)} ≤ ${faNum(driftAllow, 0)} mm`,
      ref: '۲۸۰۰',
      fix: 'طول دیوار را افزایش دهید.',
      suggestion: `پیشنهاد هوشمند: طول دیوار ${faNum(lwFixDrift, 1)} m`,
      autofix: { lw: lwFixDrift },
      dc: drift / driftAllow,
    },
    {
      id: 'be',
      label: 'المان مرزی با محصورشدگی ویژه',
      status: !boundary ? 'ok' : beConfinedOk ? 'ok' : 'warn',
      value: boundary ? `lbe=${faNum(beLen, 0)} mm — خاموت Ø${faNum(i.hoopDia, 0)}@${faNum(beHoopS, 0)} — ${faNum(nBeBars, 0)}Ø${faNum(i.beVertDia, 0)}` : `σ/0.2fc = ${faNum(sigma / (0.2 * i.Fc), 2)} — لازم نیست`,
      ref: 'ACI 18.10.6',
      fix: 'محصورشدگی ویژه: خاموت @۱۰۰ + حداقل ۶Ø۱۴ در هر المان.',
      suggestion: boundary && !beConfinedOk ? `پیشنهاد هوشمند: المان مرزی ${faNum(beLen, 0)} mm با Ø${Math.max(14, i.beVertDia)}×${Math.max(6, nBeBars)} و خاموت @${Math.min(100, beHoopS)}` : '',
      autofix: boundary && !beConfinedOk ? { beForce: 1, beLenMm: Math.round(beLen), beHoopS: Math.min(100, beHoopS), beVertDia: Math.max(14, i.beVertDia), beVertCount: Math.max(6, nBeBars) } : undefined,
      dc: sigma / (0.2 * i.Fc),
    },
    {
      id: 'spacing',
      label: 'فاصله آرماتور در محدوده مجاز',
      status: sV >= 100 && sV <= 300 && sH >= 100 && sH <= 300 ? 'ok' : 'warn',
      value: `عمودی ${faNum(sV, 0)} افقی ${faNum(sH, 0)} ∈ [۱۰۰،۳۰۰]`,
      ref: 'مبحث نهم',
      fix: 'فاصله را در بازه ۱۰۰–۳۰۰ نگه دارید.',
      autofix: { vDia: sV < 100 ? nextStdDia(i.vDia) : i.vDia, hDia: sH < 100 ? nextStdDia(i.hDia) : i.hDia },
      dc: Math.max(sV, sH) / 300,
    },
  ];

  const nBe = boundary ? nBeBars : 0;
  const steelV = KG(AsVprov * hs) + KG((boundary ? nBe * AB(i.beVertDia) : 0) * hs);
  const steelH = KG(AsHprovPerM * hs);
  const hoopsKg = boundary ? KG(AB(i.hoopDia) * (2 * (Math.max(beLen, 300) + tw)) * Math.ceil(hs / beHoopS)) * 2 : 0;

  const boq: BOQItem[] = [
    { code: 'WAL-C', title: 'بتن دیوار برشی عیار ۳۵۰', titleEn: 'Shear wall concrete', unit: 'm³', unitEn: 'm³', qty: +((Ag * hs) / 1e9).toFixed(2), materialId: 'concrete', detail: `${faNum(i.lw, 1)}×${faNum(i.tw, 0)}×${faNum(i.hs, 1)}` },
    { code: 'WAL-R', title: 'آرماتور عمودی/افقی/المان مرزی دیوار', titleEn: 'Wall rebar', unit: 'kg', unitEn: 'kg', qty: +(steelV + steelH + hoopsKg).toFixed(0), materialId: 'rebar', detail: `ρv=ρh=0.25٪ ${boundary ? '+ المان مرزی' : ''}` },
    { code: 'WAL-F', title: 'قالب دوطرفه دیوار برشی', titleEn: 'Wall formwork', unit: 'm²', unitEn: 'm²', qty: +(2 * i.lw * i.hs).toFixed(1), materialId: 'formwork', detail: 'قالب فلزی مدولار' },
  ];

  const bbs: BBSItem[] = [
    { mark: 'W1', label: 'میلگرد عمودی دیوار', dia: i.vDia, lenMm: hs + 600, count: Math.round(lw / sV), weightKg: +KG(AB(i.vDia) * (hs + 600) * (lw / sV)).toFixed(1) },
    { mark: 'W2', label: 'میلگرد افقی دیوار', dia: i.hDia, lenMm: lw + 400, count: Math.round(hs / sH), weightKg: +KG(AB(i.hDia) * (lw + 400) * (hs / sH)).toFixed(1) },
  ];
  if (boundary) {
    bbs.push({ mark: 'W3', label: 'میلگرد مرزی المان انتهایی', dia: i.beVertDia, lenMm: hs + 600, count: 2 * nBe, weightKg: +KG(AB(i.beVertDia) * (hs + 600) * 2 * nBe).toFixed(1) });
    bbs.push({ mark: 'W4', label: 'خاموت + سنجاق محصورکننده مرزی', dia: i.hoopDia, lenMm: 2 * (Math.max(beLen, 300) + tw) - 4 * i.cover + 200, count: 2 * Math.ceil(hs / beHoopS), weightKg: +KG(AB(i.hoopDia) * (2 * (Math.max(beLen, 300) + tw)) * 2 * Math.ceil(hs / beHoopS)).toFixed(1) });
  }

  const ok = checks.every((c) => c.status !== 'bad');
  return {
    type: 'wall',
    code: projectCode(CALC_META.wall.prefix),
    createdAt: Date.now(),
    input: i,
    metrics: [
      { label: 'تنش فیبر انتهایی', value: faNum(sigma, 1), raw: sigma, unit: 'MPa', tone: boundary ? 'warn' : 'ok' },
      { label: 'ظرفیت برش φVn', value: faNum(phiVn, 0), raw: phiVn, unit: 'kN', tone: i.Vu <= phiVn ? 'ok' : 'bad' },
      { label: 'دریفت طبقه', value: faNum(drift, 1), raw: drift, unit: 'mm', tone: drift <= driftAllow ? 'ok' : 'warn' },
      { label: 'المان مرزی', value: boundary ? faNum(beLen, 0) : '—', raw: beLen, unit: 'mm', tone: boundary ? 'warn' : 'ok' },
    ],
    boq,
    verdict: ok
      ? { ok: true, title: 'دیوار برشی کنترل شد', text: `برش، لغزش، دریفت و آرماتورها در محدوده مجاز${boundary ? ' — با المان مرزی محصورشده' : ''}.` }
      : { ok: false, title: 'دیوار برشی نیاز به تقویت دارد', text: 'کارت‌های قرمز را بررسی کنید.' },
    diagram: { kind: 'wall', lw: i.lw, tw, hs: i.hs, vDia: i.vDia, hDia: i.hDia, vSpacing: sV, hSpacing: sH, beLen, beHoopS, boundary },
    assessment: `دیوار ${faNum(i.lw, 1)}×${faNum(i.tw, 0)} — D/C برش ${faNum(i.Vu / phiVn, 2)} — AsReq ${faNum(AsVreq, 0)} AsMin ${faNum(AsVmin, 0)}.`,
    trace,
    checks,
    extras: { sigma, phiVn, drift, beLen, sV, sH, boundary: boundary ? 1 : 0, driftAllow, AsVreq, AsVmin, AsVprov },
    bbs,
  };
}

/* =============================================================== STAIR == */

export interface StairInput {
  kind: 'stair' | 'ramp';
  H: number; // total rise, m
  Lr: number; // horizontal run, m
  bw: number; // width, m
  t: number; // slab thickness, mm
  DL: number; // finishes kN/m²
  LL: number;
  Fc: number;
  Fy: number;
  cover: number;
  barDia: number;
}

export const DEFAULT_STAIR: StairInput = { kind: 'stair', H: 3.2, Lr: 5.6, bw: 1.2, t: 180, DL: 2, LL: 5, Fc: 25, Fy: 400, cover: 25, barDia: 14 };

export function calculateStair(i: StairInput): CalcResult<StairInput> {
  const t = Math.max(120, Math.min(400, roundUp10(i.t)));
  const Ls = Math.sqrt(i.H ** 2 + i.Lr ** 2);
  const cos = i.Lr / Ls;
  const n = i.kind === 'stair' ? Math.max(4, Math.round(i.H / 0.18)) : 0;
  const riser = n ? (i.H / n) * 1000 : 0;
  const tread = n ? (i.Lr / n) * 1000 : 0;
  const swSteps = n ? (25 * (i.H / n)) / 2 : 0;
  const sw = (25 * t) / 1000 / cos + swSteps;
  const wu = 1.2 * (i.DL + sw) + 1.6 * i.LL;
  const w = wu * 1 * (i.bw >= 1 ? 1 : i.bw);
  const Mu = (w * i.Lr * i.Lr) / 8;
  const Vu = (w * i.Lr) / 2;
  const d = t - i.cover - i.barDia / 2;
  const AsReq = (Mu * 1e6) / (0.81 * i.Fy * d);
  const AsMin = Math.max((0.25 * Math.sqrt(i.Fc) * 1000 * d) / i.Fy, (1.4 * 1000 * d) / i.Fy);
  const As = Math.max(AsReq, AsMin);
  const nB = Math.max(Math.ceil(As / AB(i.barDia)), Math.ceil(AsMin / AB(i.barDia)));
  const sBraw = Math.floor(1000 / nB);
  const sB = clampMainSpacing(Math.min(200, sBraw));
  const AsProv = (1000 / sB) * AB(i.barDia);
  const AsDist = 0.0018 * 1000 * t;
  const nD = Math.max(Math.ceil(AsDist / AB(10)), 4);
  const sDraw = Math.floor(1000 / nD);
  const sD = clampMainSpacing(Math.min(250, sDraw));
  const Ec = 4700 * Math.sqrt(i.Fc);
  const heff = t + (n ? riser / 2 : 0);
  const Ie = 0.35 * ((1000 * heff ** 3) / 12);
  const defl = (5 * (wu * cos) * Math.pow(Ls * 1000, 4)) / (384 * Ec * Ie);
  const deflAllow = (Ls * 1000) / 250;
  const Vc = (0.17 * Math.sqrt(i.Fc) * 1000 * d) / 1000;
  // طول مهاری کامل — مبحث نهم بند ۹-۱۸-۲ (عوامل ψt/ψe/ψs/λ)
  const ld = devLength(i.barDia, i.Fy, i.Fc);

  // smart fixes
  const tFixShear = (() => {
    let tt = t;
    for (let k = 0; k < 20; k++) {
      const dd = tt - i.cover - i.barDia / 2;
      const VcT = (0.17 * Math.sqrt(i.Fc) * 1000 * dd) / 1000;
      if (Vu <= 0.75 * VcT) break;
      tt = Math.min(400, roundUp10(tt + 10));
    }
    return tt;
  })();
  const tFixDefl = (() => {
    if (defl <= deflAllow) return t;
    const ratio = defl / deflAllow;
    return Math.min(400, roundUp10(t * Math.cbrt(ratio) * 1.05));
  })();
  const tFix = Math.max(tFixShear, tFixDefl);
  const barDiaFix = AsProv < AsReq ? nextStdDia(i.barDia) : i.barDia;

  const trace: TraceStep[] = [
    { step: 1, title: 'هندسه رمپ/پله', formula: 'Ls = √(H²+L²)', detail: `${n ? `n = ${faNum(n, 0)} پله — قامه ${faNum(riser, 0)} / کف ${faNum(tread, 0)} mm` : 'رمپ شیبدار بدون پله'}`, result: `Ls = ${faNum(Ls, 2)} m`, ref: 'مبحث سوم/ارگونومی' },
    { step: 2, title: 'بار نهایی روی نوار ۱ متری', formula: 'wu = 1.2(DL+sw)+1.6LL', detail: `وزن خود دال شیبی + پله‌ها = ${faNum(sw, 2)} kN/m²`, result: `wu = ${faNum(wu, 2)} kN/m²`, ref: 'مبحث ششم' },
    { step: 3, title: 'لنگر و برش طرح', formula: 'Mu = w·L²/8 , Vu = w·L/2', detail: 'دهانه افقی مؤثر', result: `Mu = ${faNum(Mu, 1)} kN·m | Vu = ${faNum(Vu, 1)} kN`, ref: 'مبحث ششم' },
    { step: 4, title: 'آرماتور طولی دال پله', formula: 'AsReq = Mu/(0.81·fy·d) ; AsMin', detail: `d = ${faNum(d, 0)} mm — AsReq=${faNum(AsReq, 0)} AsMin=${faNum(AsMin, 0)}`, result: `Ø${faNum(i.barDia, 0)} @ ${faNum(sB, 0)} mm`, ref: 'مبحث نهم' },
    { step: 5, title: 'آرماتور عرضی (توزیع)', formula: 'As = 0.0018·b·t', detail: '', result: `Ø10 @ ${faNum(sD, 0)} mm`, ref: 'مبحث نهم' },
    { step: 6, title: 'کنترل خیز دال شیبی', formula: 'δ = 5wLs⁴/384EcIe', detail: `مجاز Ls/250 = ${faNum(deflAllow, 1)} mm`, result: `δ = ${faNum(defl, 1)} mm`, ref: 'مبحث نهم' },
    { step: 7, title: 'خم مهار در تکیه‌گاه‌ها', formula: 'Ld + خم ۹۰°', detail: `Ld ≈ ${faNum(ld, 0)} mm + برگشت 12db`, result: 'خم بالا و پایین در ابتدا و انتها الزامی', ref: 'مبحث نهم' },
  ];

  const checks: DesignCheck[] = [
    {
      id: 'flex',
      label: 'کفایت آرماتور طولی (AsReq)',
      status: AsProv >= AsReq ? 'ok' : 'bad',
      value: `${faNum(AsProv, 0)} ≥ ${faNum(AsReq, 0)} mm²/m`,
      ref: 'مبحث نهم',
      fix: 'گام میلگرد را کم کنید یا قطر را افزایش دهید.',
      suggestion: `پیشنهاد هوشمند: Ø${faNum(barDiaFix, 0)} @ ${faNum(clampMainSpacing(sB - 25), 0)} یا ضخامت ${faNum(tFix, 0)}`,
      autofix: { barDia: barDiaFix, t: tFix },
      dc: AsReq / AsProv,
    },
    {
      id: 'asmin',
      label: 'حداقل آرماتور دال پله',
      status: AsProv >= AsMin ? 'ok' : 'warn',
      value: `${faNum(AsProv, 0)} ≥ ${faNum(AsMin, 0)} mm²/m`,
      ref: 'مبحث نهم',
      fix: 'حداقل آرماتور را رعایت کنید.',
      suggestion: `پیشنهاد: Ø${faNum(nextStdDia(i.barDia), 0)}`,
      autofix: { barDia: nextStdDia(i.barDia) },
      dc: AsMin / AsProv,
    },
    {
      id: 'shear',
      label: 'کنترل برش دال',
      status: Vu <= 0.75 * Vc ? 'ok' : 'bad',
      value: `${faNum(Vu, 1)} ≤ ${faNum(0.75 * Vc, 1)} kN`,
      ref: 'ACI 318',
      fix: 'ضخامت دال را افزایش دهید.',
      suggestion: `پیشنهاد هوشمند: ضخامت ${faNum(tFixShear, 0)} mm`,
      autofix: { t: tFixShear },
      dc: Vu / (0.75 * Vc),
    },
    {
      id: 'defl',
      label: 'خیز دال رمپ/پله',
      status: defl <= deflAllow ? 'ok' : defl <= 1.2 * deflAllow ? 'warn' : 'bad',
      value: `${faNum(defl, 1)} ≤ ${faNum(deflAllow, 1)} mm`,
      ref: 'مبحث نهم',
      fix: 'ضخامت را به حداقل L/20 نزدیک کنید.',
      suggestion: `پیشنهاد هوشمند: ضخامت ${faNum(tFixDefl, 0)} mm`,
      autofix: { t: tFixDefl },
      dc: defl / deflAllow,
    },
    {
      id: 'spacing',
      label: 'فاصله میلگرد در محدوده مجاز [۱۰۰،۲۰۰]',
      status: sB >= 100 && sB <= 200 ? 'ok' : 'warn',
      value: `${faNum(sB, 0)} mm ∈ [۱۰۰،۲۰۰]`,
      ref: 'مبحث نهم',
      fix: 'فاصله را بین ۱۰۰ تا ۲۰۰ نگه دارید.',
      autofix: { barDia: sB < 100 ? nextStdDia(i.barDia) : i.barDia },
      dc: sB / 200,
    },
  ];

  const concM3 = ((t / 1000 / cos) * Ls + (i.kind === 'stair' ? (n * riser * tread) / 2 / 1e6 : 0)) * i.bw;
  const steelKg = KG((AsProv + AsDist) * Ls * 1000) * i.bw;

  const boq: BOQItem[] = [
    { code: 'STR-C', title: 'بتن دال پله/رمپ عیار ۳۰۰', titleEn: 'Stair concrete', unit: 'm³', unitEn: 'm³', qty: +concM3.toFixed(2), materialId: 'concrete', detail: `ضخامت ${faNum(t, 0)} mm` },
    { code: 'STR-R', title: 'آرماتور طولی با خم مهار + توزیع', titleEn: 'Stair rebar', unit: 'kg', unitEn: 'kg', qty: +steelKg.toFixed(0), materialId: 'rebar', detail: `Ø${faNum(i.barDia, 0)}@${faNum(sB, 0)} + Ø10@${faNum(sD, 0)}` },
    { code: 'STR-F', title: 'قالب‌بندی پله و کف رمپ', titleEn: 'Stair formwork', unit: 'm²', unitEn: 'm²', qty: +(i.bw * Ls + (n ? n * i.bw * (riser / 1000) : 0)).toFixed(1), materialId: 'formwork', detail: 'شامل قالب قائم پله‌ها' },
  ];

  const bbs: BBSItem[] = [
    { mark: 'T1', label: 'میلگرد طولی پایین با خم ۹۰° دوطرف', dia: i.barDia, lenMm: Ls * 1000 + 2 * (ld + 12 * i.barDia), count: Math.round((i.bw * 1000) / sB), weightKg: +KG(AB(i.barDia) * (Ls * 1000 + 2 * (ld + 12 * i.barDia)) * ((i.bw * 1000) / sB)).toFixed(1) },
    { mark: 'T2', label: 'میلگرد منفی سرتکیه‌ها', dia: i.barDia - 2 > 8 ? i.barDia - 2 : 10, lenMm: (Ls * 1000) / 4 + ld, count: 2 * Math.round((i.bw * 1000) / sB), weightKg: +KG(AB(12) * ((Ls * 1000) / 4 + ld) * 2 * ((i.bw * 1000) / sB)).toFixed(1) },
    { mark: 'T3', label: 'میلگرد توزیع عرضی', dia: 10, lenMm: i.bw * 1000, count: Math.round((Ls * 1000) / sD), weightKg: +KG(AB(10) * i.bw * 1000 * ((Ls * 1000) / sD)).toFixed(1) },
  ];

  const ok = checks.every((c) => c.status !== 'bad');
  return {
    type: 'stair',
    code: projectCode(CALC_META.stair.prefix),
    createdAt: Date.now(),
    input: i,
    metrics: [
      { label: 'طول شیب Ls', value: faNum(Ls, 2), raw: Ls, unit: 'm', tone: 'neutral' },
      { label: 'آرماتور لازم AsReq', value: faNum(AsReq, 0), raw: AsReq, unit: 'mm²/m', tone: 'neutral' },
      { label: 'خیز', value: faNum(defl, 1), raw: defl, unit: 'mm', tone: defl <= deflAllow ? 'ok' : 'warn' },
      { label: 'تعداد پله', value: faNum(n || 0, 0), raw: n, unit: 'عدد', tone: 'neutral' },
    ],
    boq,
    verdict: ok
      ? { ok: true, title: 'رمپ/راهپله کنترل شد', text: `دال ${faNum(t, 0)} mm با Ø${faNum(i.barDia, 0)}@${faNum(sB, 0)} و خم مهار کامل.` }
      : { ok: false, title: 'رمپ/راهپله نیاز به اصلاح دارد', text: 'کارت‌های قرمز را ببینید.' },
    diagram: { kind: 'stair', ramp: i.kind === 'ramp', H: i.H, Lr: i.Lr, t, n, barDia: i.barDia, spacing: sB },
    assessment: `شیب ${faNum((i.H / i.Lr) * 100, 0)}٪ — خیز نسبی ${faNum(defl / deflAllow, 2)} — AsReq ${faNum(AsReq, 0)} AsMin ${faNum(AsMin, 0)}.`,
    trace,
    checks,
    extras: { Ls, Mu, Vu, As, AsReq, AsMin, AsProv, sB, defl, deflAllow, n, tFix },
    bbs,
  };
}

/* =============================================================== JOINT == */

export interface JointInput {
  colB: number;
  colH: number;
  beamB: number;
  beamH: number;
  Vu: number; // joint shear demand kN
  Fc: number;
  Fy: number;
  hoopDia: number;
  hoopS: number; // provided spacing inside joint
  faces: 4 | 3 | 2; // confining beams
}

export const DEFAULT_JOINT: JointInput = { colB: 500, colH: 500, beamB: 350, beamH: 600, Vu: 1400, Fc: 30, Fy: 400, hoopDia: 10, hoopS: 100, faces: 4 };

export function calculateJoint(i: JointInput): CalcResult<JointInput> {
  const colB = Math.max(300, Math.min(1200, roundUp50(i.colB)));
  const colH = Math.max(300, Math.min(1200, roundUp50(i.colH)));
  const beamB = Math.max(200, Math.min(800, roundUp50(i.beamB)));
  const beamH = Math.max(300, Math.min(1000, roundUp50(i.beamH)));
  const Aj = colB * colH; // mm² panel
  const gamma = i.faces === 4 ? 1.5 : i.faces === 3 ? 1.2 : 1.0;
  const Vn = (gamma * Math.sqrt(i.Fc) * Aj) / 1000; // kN (ACI 18.8, MPa form)
  const phiVn = 0.85 * Vn;
  const reqS = i.faces === 4 ? 150 : 100;
  const reqSClamped = clampTieSpacing(reqS);
  const hoopS = clampTieSpacing(i.hoopS);
  const nHoops = Math.ceil(beamH / reqSClamped) + 1;
  const hoopOk = hoopS <= reqSClamped;
  const widthOk = beamB <= colB;
  const hoopLen = 2 * (colB + colH) - 8 * 30 + 200;

  // smart fixes
  const colFixShear = (() => {
    if (i.Vu <= phiVn) return { colB, colH };
    // increase column dimensions by 50 mm steps
    for (let add = 50; add <= 600; add += 50) {
      const cB = Math.min(1200, colB + add);
      const cH = Math.min(1200, colH + add);
      const AjT = cB * cH;
      const VnT = (gamma * Math.sqrt(i.Fc) * AjT) / 1000;
      if (i.Vu <= 0.85 * VnT) return { colB: cB, colH: cH };
    }
    return { colB: Math.min(1200, colB + 100), colH: Math.min(1200, colH + 100) };
  })();
  const hoopSFix = Math.min(reqSClamped, 100);
  const hoopDiaFix = hoopOk ? i.hoopDia : nextStirrupDia(i.hoopDia);

  const trace: TraceStep[] = [
    { step: 1, title: 'سطح مؤثر چشمه', formula: 'Aj = bc × hc', detail: `ستون ${faNum(colB, 0)}×${faNum(colH, 0)}`, result: `Aj = ${faNum(Aj / 1e4, 1)}×10⁴ mm²`, ref: 'ACI 18.8' },
    { step: 2, title: 'ضریب محصورشدگی γ', formula: 'γ = 1.5 / 1.2 / 1.0', detail: `تیرهای مقیدکننده: ${faNum(i.faces, 0)} وجه`, result: `γ = ${faNum(gamma, 1)}`, ref: 'ACI 18.8.4' },
    { step: 3, title: 'ظرفیت برش چشمه', formula: 'Vn = γ·√fc·Aj', detail: `φ = 0.85 → φVn = ${faNum(phiVn, 0)} kN`, result: `Vu = ${faNum(i.Vu, 0)} kN`, ref: 'مبحث نهم/ACI' },
    { step: 4, title: 'خاموت محصورکننده داخل چشمه', formula: 's ≤ min(150 if confined else 100)', detail: `خاموت Ø${faNum(i.hoopDia, 0)} فراهم: @${faNum(hoopS, 0)}`, result: `${faNum(nHoops, 0)} ردیف خاموت بسته + سنجاق`, ref: 'مبحث نهم' },
  ];

  const checks: DesignCheck[] = [
    {
      id: 'shear',
      label: 'ظرفیت برشی چشمه φVn ≥ Vu',
      status: i.Vu <= phiVn ? 'ok' : 'bad',
      value: `${faNum(i.Vu, 0)} ≤ ${faNum(phiVn, 0)} kN`,
      ref: 'ACI 18.8',
      fix: 'ابعاد ستون را بزرگ کنید یا γ را با مقیدسازی افزایش دهید.',
      suggestion: `پیشنهاد هوشمند: ستون ${faNum(colFixShear.colB, 0)}×${faNum(colFixShear.colH, 0)} mm`,
      autofix: { colB: colFixShear.colB, colH: colFixShear.colH },
      dc: i.Vu / phiVn,
    },
    {
      id: 'hoop',
      label: 'گام خاموت داخل چشمه (۵۰–۲۰۰ mm)',
      status: hoopOk ? 'ok' : 'bad',
      value: `${faNum(hoopS, 0)} ≤ ${faNum(reqSClamped, 0)} mm`,
      ref: 'مبحث نهم',
      fix: `گام را به ${faNum(reqSClamped, 0)} mm یا کمتر کاهش دهید.`,
      suggestion: `پیشنهاد هوشمند: خاموت Ø${faNum(hoopDiaFix, 0)} @ ${faNum(hoopSFix, 0)}`,
      autofix: { hoopS: hoopSFix, hoopDia: hoopDiaFix },
      dc: hoopS / reqSClamped,
    },
    {
      id: 'width',
      label: 'عرض تیر ≤ عرض ستون',
      status: widthOk ? 'ok' : 'warn',
      value: `${faNum(beamB, 0)} ≤ ${faNum(colB, 0)} mm`,
      ref: 'مبحث نهم',
      fix: 'ستون را هم‌راستای تیر عریض کنید.',
      suggestion: `پیشنهاد هوشمند: ستون ${faNum(Math.max(colB, beamB), 0)} mm`,
      autofix: { colB: Math.max(colB, beamB) },
      dc: beamB / colB,
    },
    {
      id: 'confinement',
      label: 'محصورشدگی چشمه (تعداد خاموت)',
      status: nHoops >= 2 ? 'ok' : 'warn',
      value: `${faNum(nHoops, 0)} ردیف خاموت`,
      ref: 'ACI 18.8',
      fix: 'حداقل ۲ ردیف خاموت محصورکننده در چشمه لازم است.',
      suggestion: `پیشنهاد: ${faNum(Math.max(2, nHoops), 0)} ردیف`,
      autofix: { hoopS: hoopSFix },
      dc: 2 / nHoops,
    },
  ];

  const hoopsKg = KG(AB(i.hoopDia) * hoopLen * nHoops);
  const boq: BOQItem[] = [
    { code: 'JNT-R', title: 'خاموت و سنجاق محصورکننده چشمه اتصال', titleEn: 'Joint confinement hoops', unit: 'kg', unitEn: 'kg', qty: +hoopsKg.toFixed(0), materialId: 'rebar', detail: `Ø${faNum(i.hoopDia, 0)}@${faNum(hoopS, 0)} — ${faNum(nHoops, 0)} ردیف` },
    { code: 'JNT-C', title: 'بتن ویژه ناحیه چشمه (اجرای پیوسته با ستون)', titleEn: 'Joint concrete', unit: 'm³', unitEn: 'm³', qty: +((Aj * beamH) / 1e9).toFixed(2), materialId: 'concrete', detail: 'هم‌عیار ستون' },
  ];

  const bbs: BBSItem[] = [{ mark: 'J1', label: 'خاموت بسته چشمه + سنجاق', dia: i.hoopDia, lenMm: hoopLen, count: nHoops, weightKg: +KG(AB(i.hoopDia) * hoopLen * nHoops).toFixed(1) }];

  const ok = checks.every((c) => c.status !== 'bad');
  return {
    type: 'joint',
    code: projectCode(CALC_META.joint.prefix),
    createdAt: Date.now(),
    input: i,
    metrics: [
      { label: 'ظرفیت φVn', value: faNum(phiVn, 0), raw: phiVn, unit: 'kN', tone: i.Vu <= phiVn ? 'ok' : 'bad' },
      { label: 'برش ورودی Vu', value: faNum(i.Vu, 0), raw: i.Vu, unit: 'kN', tone: 'neutral' },
      { label: 'خاموت داخل چشمه', value: faNum(nHoops, 0), raw: nHoops, unit: 'ردیف', tone: hoopOk ? 'ok' : 'warn' },
      { label: 'ضریب γ', value: faNum(gamma, 1), raw: gamma, unit: '', tone: 'neutral' },
    ],
    boq,
    verdict: ok
      ? { ok: true, title: 'چشمه اتصال ایمن است', text: `φVn = ${faNum(phiVn, 0)} kN ≥ Vu با ${faNum(nHoops, 0)} ردیف خاموت Ø${faNum(i.hoopDia, 0)}.` }
      : { ok: false, title: 'چشمه اتصال تقویت لازم دارد', text: 'ابعاد ستون یا محصورشدگی را اصلاح کنید.' },
    diagram: { kind: 'joint', colB, colH, beamB, beamH, hoopDia: i.hoopDia, hoopS, nHoops },
    assessment: `چشمه ${faNum(colB, 0)}×${faNum(colH, 0)} — φVn ${faNum(phiVn, 0)} kN — γ ${faNum(gamma, 1)} — ${faNum(nHoops, 0)} ردیف خاموت.`,
    trace,
    checks,
    extras: { phiVn, Vu: i.Vu, gamma, nHoops, Aj, hoopS, reqS: reqSClamped, colB, colH },
    bbs,
  };
}

/* ================================================================ RAMP === */
/* رمپ به‌عنوان ماژول مستقل (۸/۸): سطح ورودی مشابه پله، با kind اجباری 'ramp'.
 * نتیجه محاسباتی نوع CalcType='ramp' با پیشوند RMP و عنوان مستقل دارد. */

export const DEFAULT_RAMP: StairInput = { kind: 'ramp', H: 3.5, Lr: 7, bw: 1.5, t: 180, DL: 2, LL: 5, Fc: 25, Fy: 400, cover: 25, barDia: 14 };

export function calculateRamp(i: StairInput): CalcResult<StairInput> {
  const r = calculateStair({ ...i, kind: 'ramp' });
  return {
    ...r,
    type: 'ramp',
    code: projectCode(CALC_META.ramp.prefix),
    input: { ...i, kind: 'ramp' },
    verdict: { ...r.verdict, title: r.verdict.ok ? 'رمپ کنترل شد' : 'رمپ نیاز به اصلاح دارد' },
  };
}

/** next standard bar size up (round-33 smart optimizer) — kept for compatibility */
export function nextDia(d: number): number {
  for (const x of [12, 14, 16, 18, 20, 22, 25, 28]) if (x > d) return x;
  return 28;
}


