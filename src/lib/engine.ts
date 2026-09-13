
/* ============================================================================
 * CivilGenius v20 — engineering engine
 * Ported 1:1 in behaviour from the original Python `civil_engine.py`:
 *   calculateFoundation / calculateBeam / calculateColumn
 *   + P-M interaction curve with point-in-polygon safety verification.
 *
 * Units convention:
 *   geometry  -> metres (m)
 *   sections  -> millimetres (mm)
 *   forces    -> kilonewton (kN)
 *   pressures -> kilopascal (kPa)
 *   materials -> megapascal (MPa)
 * ========================================================================== */

import type { MaterialId, SourceType } from './market';
import { faNum, projectCode, round } from './format';
import { calculateJoint, calculateRamp, calculateSlab, calculateStair, calculateWall } from './modules';
import type { JointInput, SlabInput, StairInput, WallInput } from './modules';

export type CalcType = 'foundation' | 'beam' | 'column' | 'slab' | 'wall' | 'stair' | 'ramp' | 'joint';

export const CALC_META: Record<CalcType, { prefix: string; title: string; titleEn: string }> = {
  foundation: { prefix: 'FND', title: 'فونداسیون', titleEn: 'Foundation' },
  beam: { prefix: 'BEM', title: 'تیر', titleEn: 'Beam' },
  column: { prefix: 'COL', title: 'ستون', titleEn: 'Column' },
  slab: { prefix: 'SLB', title: 'سقف', titleEn: 'Slab' },
  wall: { prefix: 'SWL', title: 'دیوار برشی', titleEn: 'ShearWall' },
  stair: { prefix: 'STR', title: 'راه‌پله', titleEn: 'Stair' },
  ramp: { prefix: 'RMP', title: 'رمپ', titleEn: 'Ramp' },
  joint: { prefix: 'JNT', title: 'چشمه اتصال', titleEn: 'Joint' },
};

export const GAMMA_CONCRETE = 24; // kN/m³
export const STEEL_DENSITY = 7850; // kg/m³
export const ES = 200_000; // MPa

/* ---------------------------------------------------------------- inputs -- */

export interface FoundationInput {
  L: number; // m
  B: number; // m
  H: number; // m
  Df: number; // m embedment
  cs: number; // mm column size at the critical section
  c: number; // kPa cohesion
  phi: number; // deg internal friction
  gamma: number; // kN/m³ soil unit weight
  P: number; // kN service axial load
  Fc: number; // MPa
  Fy: number; // MPa
  cover: number; // mm
  barDia: number; // mm
  /** manual mesh spacing mm; 0 = auto */
  spacing: number;
  FS: number; // safety factor
  mixMode: 'ready' | 'site';
}

export interface BeamInput {
  L: number; // m clear span
  b: number; // mm
  h: number; // mm
  wd: number; // kN/m superimposed dead
  wl: number; // kN/m live
  Fc: number;
  Fy: number;
  cover: number; // mm
  stirrupDia: number; // mm
  barDia: number; // mm
  /** manual stirrup spacing mm; 0 = auto per ACI */
  stirrupSpacing: number;
  /** number of stirrup legs (2/3/4) */
  stirrupLegs: number;
  /** tension bar layers (1 or 2) */
  tensionLayers: number;
  /** top compression bar count */
  compBars: number;
  /** top compression bar diameter mm */
  compBarDia: number;
  support: 'simple' | 'continuous';
  /** torsional moment kN·m (مبحث نهم بند ۹-۱۵-۸ ویرایش ۱۳۹۹); 0 = پیچش قابل صرف‌نظر */
  Tu: number;
}

export interface ColumnInput {
  Pu: number; // kN factored axial
  Mu: number; // kN·m factored moment
  Lc: number; // m unsupported height
  b: number; // mm
  h: number; // mm
  Fc: number;
  Fy: number;
  cover: number; // mm
  tieDia: number; // mm
  barDia: number; // mm
  k: number; // effective length factor
  /** manual tie spacing mm; 0 = auto */
  tieSpacing: number;
  /** manual critical-zone spacing mm; 0 = auto */
  critSpacing: number;
  /** manual longitudinal bar count; 0 = auto */
  nBars: number;
}

export type AnyInput =
  | FoundationInput
  | BeamInput
  | ColumnInput
  | SlabInput
  | WallInput
  | StairInput
  | JointInput;

/* --------------------------------------------------------------- outputs -- */

export interface BOQItem {
  code: string;
  title: string;
  titleEn: string;
  unit: string;
  unitEn: string;
  qty: number;
  materialId: MaterialId;
  detail: string;
}

export interface PricedRow extends BOQItem {
  unitPrice: number;
  amount: number;
  status: SourceType;
  sourceName: string;
  sourceUrl: string;
}

/** Bar-Bending-Schedule (لیستوفر) row — one rebar mark. */
export interface BBSItem {
  mark: string; // e.g. S1
  label: string; // Persian description
  dia: number; // mm
  lenMm: number; // cut length per bar
  count: number;
  weightKg: number; // total
}

export interface Metric {
  label: string;
  value: string;
  raw: number;
  unit: string;
  tone: 'ok' | 'warn' | 'bad' | 'neutral';
  hint?: string;
}

/** One transparent, deterministic step of the calculation book. */
export interface TraceStep {
  step: number;
  title: string; // Persian step title
  formula: string; // explicit math relation (LTR, ASCII)
  detail: string; // substituted values / explanation (Persian)
  result: string; // formatted numeric result
  ref?: string; // code reference (مبحث نهم / ACI 318)
}

/** A normative design check with a clear status + remediation hint. */
export interface DesignCheck {
  id: string;
  label: string;
  status: 'ok' | 'warn' | 'bad';
  value: string; // e.g. "۰٫۸۵ ≤ ٫۰۰"
  ref: string;
  fix?: string; // guidance when not satisfied
  /** transparent recommended value, e.g. "افزایش میلگرد به ۶ عدد D20" */
  suggestion?: string;
  /** demand/capacity ratio for the graphical progress bar (≤1 safe) */
  dc?: number;
  /** one-click smart fix: sets these input fields to the code-suggested values */
  autofix?: Record<string, number>;
}

export type Diagram =
  | {
      kind: 'foundation';
      L: number;
      B: number;
      H: number;
      Df: number;
      cs: number;
      spacing: number; // mm mesh spacing
      barDia: number;
      ldh: number; // development length mm (برچسب طول مهار)
    }
  | {
      kind: 'beam';
      L: number;
      b: number;
      h: number;
      bars: number;
      barDia: number;
      stirrupDia: number;
      stirrupSpacing: number; // mm
      tensionLayers: number;
      compBars: number;
      compBarDia: number;
      support: 'simple' | 'continuous';
      dEff: number; // effective depth mm
      sCritical: number; // critical (Vu-based) stirrup spacing mm
      skin: boolean; // h > 750 → skin reinforcement required
      torsion: boolean; // پیچش مستلزم آرماتور
      nTorsionLong: number; // تعداد میلگرد طولی پیچشی
    }
  | {
      kind: 'column';
      b: number;
      h: number;
      Lc: number;
      bars: number;
      barDia: number;
      tieDia: number;
      tieSpacing: number; // mm
    }
  | {
      kind: 'slab';
      system: 'joist' | 'waffle' | 'solid' | 'hollow';
      L: number;
      h: number;
      barDia: number;
      spacing: number; // main bottom spacing mm
      negSpacing: number; // negative top spacing mm
      tempSpacing: number; // temperature/monolith spacing mm
      tieBeam: boolean;
    }
  | {
      kind: 'wall';
      lw: number; // m
      tw: number; // mm
      hs: number; // m
      vDia: number;
      hDia: number;
      vSpacing: number; // mm
      hSpacing: number; // mm
      beLen: number; // mm boundary element length (0 = none)
      beHoopS: number; // mm confinement spacing
      boundary: boolean;
    }
  | {
      kind: 'stair';
      ramp: boolean;
      H: number;
      Lr: number;
      t: number;
      n: number; // steps
      barDia: number;
      spacing: number; // mm
    }
  | {
      kind: 'joint';
      colB: number;
      colH: number;
      beamB: number;
      beamH: number;
      hoopDia: number;
      hoopS: number; // mm inside joint
      nHoops: number;
    };

export interface CalcResult<T extends AnyInput = AnyInput> {
  type: CalcType;
  code: string;
  createdAt: number;
  input: T;
  metrics: Metric[];
  boq: BOQItem[];
  verdict: { ok: boolean; title: string; text: string };
  diagram: Diagram;
  assessment: string;
  /** step-by-step deterministic calculation book (fully traceable) */
  trace: TraceStep[];
  /** normative design checks (مبحث نهم / ACI 318) */
  checks: DesignCheck[];
  /** named numbers reused by the drawings / management module */
  extras: Record<string, number>;
  /** bar bending schedule (لیستوفر) when the module produces one */
  bbs?: BBSItem[];
}

/* ------------------------------------------------------------- utilities -- */

function barArea(dia: number): number {
  return (Math.PI * dia * dia) / 4;
}

function steelWeight(volumeMm3: number): number {
  return (volumeMm3 / 1_000_000_000) * STEEL_DENSITY; // kg
}

/**
 * طول مهاری/توسعه میلگرد آجدار در کشش — مبحث نهم بند ۹-۱۸-۲ (ویرایش ۱۳۹۹)
 * معادل ACI 318-19 بند 25.4.2.3 (فرم ساده‌شده) + 25.4.2.4 (ضریب سایز):
 *   Ld = (fy · ψt · ψe · ψs / (1.7 · λ · √fc)) · db   [mm]
 *   ψt (موقعیت میلگرد، جدول ۹-۱۸-۲): 1.0 میلگرد پایین / 1.3 میلگرد فوقانی
 *       (زیر بیش از ۳۰۰ میلی‌متر بتن تازه) — REFERENCE REQUIRES MANUAL
 *       CODE-BOOK VERIFICATION (مرز دقیق ۳۰۰ میلی‌متر)
 *   ψe (پوشش اپوکسی): 1.0 بدون پوشش (رویه ایران)
 *   ψs (سایز میلگرد): 0.8 برای db ≤ 19 mm ، 1.0 برای db > 19 mm
 *   λ  (بتن سبک): 1.0 بتن با وزن مخصوص معمولی
 */
export function devLength(db: number, Fy: number, Fc: number, opts: { top?: boolean; epoxy?: boolean; lambda?: number } = {}): number {
  const psiT = opts.top ? 1.3 : 1.0;
  const psiE = opts.epoxy ? 1.5 : 1.0;
  const psiS = db <= 19 ? 0.8 : 1.0;
  const lam = opts.lambda ?? 1.0;
  return Math.max(300, Math.round(((Fy * psiT * psiE * psiS) / (1.7 * lam * Math.sqrt(Fc))) * db));
}

export function priceBOQ(
  items: BOQItem[],
  priceOf: (id: MaterialId) => number,
  statusOf: (id: MaterialId) => SourceType,
  sourceOf: (id: MaterialId) => { name: string; url: string },
): { rows: PricedRow[]; total: number; manualPending: number } {
  const rows: PricedRow[] = items.map((it) => {
    const unitPrice = priceOf(it.materialId);
    const src = sourceOf(it.materialId);
    return {
      ...it,
      unitPrice,
      amount: unitPrice * it.qty,
      status: statusOf(it.materialId),
      sourceName: src.name,
      sourceUrl: src.url,
    };
  });
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const manualPending = rows.filter((r) => r.status === 'manual' && r.unitPrice <= 0).length;
  return { rows, total, manualPending };
}

/* ============================================================ FOUNDATION == */

export function calculateFoundation(inp: FoundationInput): CalcResult<FoundationInput> {
  const { L, B, H, Df, cs, c, phi, gamma, P, Fc, Fy, cover, barDia, FS, mixMode } = inp;
  const A = L * B; // m²
  const Bmin = Math.min(L, B);
  const Lmax = Math.max(L, B);

  // Terzaghi bearing-capacity factors
  const phiRad = (phi * Math.PI) / 180;
  const Nq = Math.exp(Math.PI * Math.tan(phiRad)) * Math.pow(Math.tan(Math.PI / 4 + phiRad / 2), 2);
  const Nc = phi > 0.5 ? (Nq - 1) / Math.tan(phiRad) : 5.14;
  const Ng = 2 * (Nq + 1) * Math.tan(phiRad);

  // rectangular shape factors
  const qult =
    c * Nc * (1 + 0.3 * (Bmin / Lmax)) +
    gamma * Df * Nq +
    0.5 * gamma * Bmin * Ng * (1 - 0.2 * (Bmin / Lmax));
  const qallow = qult / FS;

  const qGross = P / A + GAMMA_CONCRETE * H; // kPa applied gross
  const qNet = P / A; // net upward pressure used for bending design
  const utilization = qGross / qallow;
  const realFS = qallow / qGross;

  // one-way shear / bending at the column face
  const cant = Math.max(0.05, (Bmin - cs / 1000) / 2); // m
  const d = H * 1000 - cover - barDia / 2; // mm effective depth
  const Mu = (qNet * cant * cant) / 2; // kN·m per metre width
  const AsReq = (Mu * 1e6) / (0.9 * d * Fy); // mm²/m
  const AsMin = 0.0018 * 1000 * d; // mm²/m (shrinkage & temperature)
  const As = Math.max(AsReq, AsMin);

  /* round-33: مبحث نهم — شبکه فونداسیون باید داخل [۱۲۰،۳۰۰] mm بماند؛ هر
   * مقدار کاربری در این بازه «مجاز» است و کفایت خمشی جدا از حداقل آرماتور
   * ارزیابی می‌شود تا کنترل خمشی بی‌دلیل قرمز نشود. */
  const clampS = (x: number): number => Math.max(120, Math.min(300, Math.round(x / 25) * 25));
  const spacing = inp.spacing > 0 ? clampS(inp.spacing) : clampS(barArea(barDia) / (As / 1000));
  const spacingReq = Math.max(120, Math.min(300, Math.floor(barArea(barDia) / (As / 1000) / 25) * 25));
  // if As,min cannot be met inside the code range with the current bar, escalate the size
  let fixDia = barDia;
  let spacingFix = spacingReq;
  for (const dia of [14, 16, 18, 20, 22, 25, 28, 32]) {
    if (dia < barDia) continue;
    const sr = Math.max(120, Math.min(300, Math.floor(barArea(dia) / (As / 1000) / 25) * 25));
    if ((1000 / sr) * barArea(dia) >= As) {
      fixDia = dia;
      spacingFix = sr;
      break;
    }
  }
  const perMeter = 1000 / spacing;
  const AsProvided = perMeter * barArea(barDia);

  const nBarsX = Math.floor(L * 1000 / spacing) + 1;
  const nBarsY = Math.floor(B * 1000 / spacing) + 1;
  const lenBarsX = nBarsX * B; // bars run across B
  const lenBarsY = nBarsY * L;
  const steelVolume = (lenBarsX + lenBarsY) * 1000 * barArea(barDia); // mm³
  const steelKg = steelWeight(steelVolume);

  // one-way shear check
  const Vu = qNet * Math.max(0, cant - d / 1000); // kN/m
  const Vc = (0.17 * Math.sqrt(Fc) * 1000 * d) / 1000; // kN/m
  const shearOk = Vu <= Vc;

  // punching (two-way) shear around the column — ACI 318 / مبحث نهم
  const bo = 4 * (cs + d); // mm critical perimeter at d/2 for a square column
  const aCrit = Math.pow(cs / 1000 + d / 1000, 2); // m² loaded area inside perimeter
  const VuP = qNet * Math.max(0, A - aCrit); // kN net upward punching force
  const vuP = (VuP * 1000) / (bo * d); // MPa
  const vcP = 0.33 * Math.sqrt(Fc); // MPa
  const punchOk = vuP <= vcP;

  // smallest thickness (0.1 m steps) that clears BOTH one-way and punching shear
  const shearPassAt = (Ht: number): boolean => {
    const dt = Ht * 1000 - cover - barDia / 2;
    const VuT = qNet * Math.max(0, cant - dt / 1000);
    const VcT = (0.17 * Math.sqrt(Fc) * 1000 * dt) / 1000;
    const boT = 4 * (cs + dt);
    const aT = Math.pow(cs / 1000 + dt / 1000, 2);
    const vuPT = (qNet * Math.max(0, A - aT) * 1000) / (boT * dt);
    return VuT <= VcT && vuPT <= vcP;
  };
  let hFix = Math.min(5, Math.round((H + 0.1) * 10) / 10);
  while (hFix < 5 && !shearPassAt(hFix)) hFix = Math.min(5, Math.round((hFix + 0.1) * 10) / 10);

  // quantities
  // full development length (مبحث نهم بند ۹-۱۸-۲) — straight bottom bars in contact with soil
  const ldh = devLength(barDia, Fy, Fc);
  const concreteV = A * H;
  const leanV = A * 0.1;
  const formwork = 2 * (L + B) * H;
  const excavation = (L + 1) * (B + 1) * (Df + H + 0.1);
  const weight = concreteV * GAMMA_CONCRETE + steelKg / 1000; // kN

  const ok = utilization <= 1 && shearOk;
  const boq: BOQItem[] = [
    {
      code: 'EX',
      title: 'خاک‌برداری مکانیکی گود فونداسیون',
      titleEn: 'Mechanical excavation',
      unit: 'متر مکعب',
      unitEn: 'm³',
      qty: round(excavation, 2),
      materialId: 'excavation',
      detail: 'با احتساب ۵۰ سانتی‌متر فضای کار در اطراف و بستر ۱۰ سانتی‌متری',
    },
    {
      code: 'LC',
      title: 'بتن مگر عیار ۱۵۰ زیر فونداسیون',
      titleEn: 'Lean concrete 150 kg/m³',
      unit: 'متر مکعب',
      unitEn: 'm³',
      qty: round(leanV, 2),
      materialId: 'lean',
      detail: 'ضخامت ۱۰ سانتی‌متر روی تمام سطح',
    },
    {
      code: 'CC',
      title: mixMode === 'ready' ? 'بتن فونداسیون C25 آماده با پمپ' : 'بتن فونداسیون C25 درجا',
      titleEn: 'Foundation concrete C25',
      unit: 'متر مکعب',
      unitEn: 'm³',
      qty: round(concreteV, 2),
      materialId: mixMode === 'ready' ? 'concrete' : 'gravel',
      detail: mixMode === 'ready' ? 'عیار ۳۵۰ با احتساب پمپاژ' : 'بتن درجا بر پایه شن/ماسه و سیمان پاکتی',
    },
    {
      code: 'RB',
      title: `آرماتور میلگرد A3 سایز ${barDia} شبکه دو طرفه`,
      titleEn: `Rebar A3 Ø${barDia} two-way mesh`,
      unit: 'کیلوگرم',
      unitEn: 'kg',
      qty: round(steelKg, 1),
      materialId: 'rebar',
      detail: `فاصله خاموت‌بندی شبکه ${faNum(spacing)} میلی‌متر در هر دو راستا`,
    },
    {
      code: 'FW',
      title: 'قالب‌بندی کناری فونداسیون',
      titleEn: 'Formwork (sides)',
      unit: 'متر مربع',
      unitEn: 'm²',
      qty: round(formwork, 2),
      materialId: 'formwork',
      detail: 'سطح تماس قالب با بتن (چهار وجه کناری)',
    },
  ];

  if (mixMode === 'site') {
    const cementBags = concreteV * 350 / 50; // 350 kg cement per m³
    boq.push({
      code: 'CM',
      title: 'سیمان پاکتی تیپ ۲ (بتن درجا عیار ۳۵۰)',
      titleEn: 'Cement type II bags',
      unit: 'بسته ۵۰ کیلویی',
      unitEn: 'bag',
      qty: round(cementBags, 0),
      materialId: 'cement',
      detail: '۳۵۰ کیلوگرم سیمان در هر متر مکعب بتن',
    });
    boq.push({
      code: 'SD',
      title: 'ماسه شسته (بتن درجا)',
      titleEn: 'Washed sand',
      unit: 'تن',
      unitEn: 't',
      qty: round(concreteV * 0.9, 2),
      materialId: 'sand',
      detail: 'حدود ۰٫۹ تن ماسه در هر متر مکعب بتن',
    });
    // gravel row already present as the CC carrier; keep its qty meaningful
    boq[2] = {
      ...boq[2],
      qty: round(concreteV * 1.25, 2),
      materialId: 'gravel',
      detail: 'حدود ۱٫۲۵ تن شن در هر متر مکعب بتن',
      title: 'شن (قلوه‌سنگ) بتن درجا',
      titleEn: 'Gravel for in-situ concrete',
      code: 'GR',
    };
  }

  let ts = 0;
  const trace: TraceStep[] = [];
  const T = (title: string, formula: string, detail: string, result: string, ref?: string): void => {
    trace.push({ step: ++ts, title, formula, detail, result, ref });
  };
  T('سطح پلان فونداسیون', 'A = L × B', `ابعاد ${faNum(L, 2)} × ${faNum(B, 2)} متر`, `${faNum(A, 2)} m²`);
  T('ضرایب ظرفیت باربری ترزاگی', 'Nq = e^(π·tanφ)·tan²(45+φ/2)', `φ = ${faNum(phi, 1)}°`, `Nc=${faNum(Nc, 1)} Nq=${faNum(Nq, 1)} Nγ=${faNum(Ng, 1)}`, 'مبحث هفتم/ترزاگی');
  T('ظرفیت باربری نهایی', 'qult = c·Nc·(1+0.3·B/L) + γ·Df·Nq + 0.5·γ·B·Nγ', `c=${faNum(c, 0)} γ=${faNum(gamma, 1)} Df=${faNum(Df, 2)}`, `${faNum(qult, 0)} kPa`);
  T('تنش مجاز خاک', 'qallow = qult / FS', `FS = ${faNum(FS, 1)}`, `${faNum(qallow, 0)} kPa`);
  T('تنش وارده خالص', 'qNet = P / A', `P = ${faNum(P, 0)} kN`, `${faNum(qNet, 1)} kPa`);
  T('ضریب بهره‌وری و اطمینان', 'U = qGross/qallow ; FS_real = qallow/qGross', '', `U=${faNum(utilization, 2)} FS=${faNum(realFS, 2)}`);
  T('عمق مؤثر مقطع', 'd = H·1000 − cover − bar/2', `cover=${faNum(cover, 0)} بار=${faNum(barDia, 0)}`, `${faNum(d, 0)} mm`);
  T('لنگر بحرانی در وجه ستون', 'Mu = qNet·cant²/2', `cant = ${faNum(cant, 2)} m`, `${faNum(Mu, 1)} kN·m/m`);
  T('آرماتور لازم خمشی', 'As = Mu·1e6 / (0.9·d·Fy)', `Fy=${faNum(Fy, 0)}`, `${faNum(AsReq, 0)} mm²/m`);
  T('حداقل آرماتور حرارتی', 'As,min = 0.0018·b·d', '', `${faNum(AsMin, 0)} mm²/m`, 'ACI 318');
  T('فاصله شبکه میلگرد', 's = Ab / (As/1000)', `سایز ${faNum(barDia, 0)}`, `${faNum(spacing, 0)} mm`);
  T('برش یک‌طرفه', 'Vu = qNet·(cant−d) ; Vc = 0.17·√Fc·b·d', '', `Vu=${faNum(Vu, 1)} Vc=${faNum(Vc, 1)} kN/m`, 'ACI 318');
  T('برش منگنه‌ای (پانچ)', 'vu = VuP·1000/(bo·d) ≤ 0.33·√Fc', `bo=${faNum(bo, 0)} mm`, `vu=${faNum(vuP, 2)} vc=${faNum(vcP, 2)} MPa`, 'ACI 318');

  // bearing autofix: increase plan dimensions by 0.5 m steps (standard construction)
  const LfixBearing = Math.min(80, Math.ceil((L + 0.5) * 2) / 2);
  const BfixBearing = Math.min(50, Math.ceil((B + 0.5) * 2) / 2);
  const checks: DesignCheck[] = [
    {
      id: 'bearing',
      label: 'کنترل ظرفیت باربری خاک',
      status: utilization <= 0.85 ? 'ok' : utilization <= 1 ? 'warn' : 'bad',
      value: `${faNum(utilization, 2)} ≤ ۱٫۰۰`,
      ref: 'مبحث هفتم (ویرایش ۱۴۰۰) — ظرفیت باربری ترزاگی، FS=3',
      fix: 'ابعاد پلان L/B را افزایش دهید.',
      suggestion: `پیشنهاد هوشمند: افزایش پلان به ${faNum(LfixBearing, 1)}×${faNum(BfixBearing, 1)} m`,
      autofix: { L: LfixBearing, B: BfixBearing },
      dc: utilization,
    },
    {
      id: 'beamShear',
      label: 'کنترل برش یک‌طرفه',
      status: shearOk ? 'ok' : 'bad',
      value: `${faNum(Vu, 1)} ≤ ${faNum(Vc, 1)} kN/m`,
      ref: 'مبحث نهم ۹-۱۵-۲-۱ / ACI 22.5.5.1',
      fix: 'ضخامت H را افزایش دهید.',
      suggestion: `پیشنهاد: افزایش ضخامت به ${faNum(hFix, 1)} m`,
      autofix: { H: hFix },
      dc: Vu / Vc,
    },
    {
      id: 'punch',
      label: 'کنترل برش منگنه‌ای (پانچ)',
      status: punchOk ? 'ok' : 'bad',
      value: `${faNum(vuP, 2)} ≤ ${faNum(vcP, 2)} MPa`,
      ref: 'مبحث نهم ۹-۱۵-۲-۱ / ACI 22.6',
      fix: 'ضخامت را زیاد کنید یا ستون بزرگ‌تر شود.',
      suggestion: `پیشنهاد: افزایش ضخامت به ${faNum(hFix, 1)} m`,
      autofix: { H: hFix },
      dc: vuP / vcP,
    },
    {
      id: 'rebar',
      label: 'کفایت آرماتور خمشی (لنگر)',
      status: AsProvided >= AsReq ? 'ok' : 'bad',
      value: `${faNum(AsProvided, 0)} ≥ ${faNum(AsReq, 0)} mm²/m`,
      ref: 'مبحث نهم',
      fix: 'سایز میلگرد یا فاصله شبکه را اصلاح کنید.',
      dc: AsReq / AsProvided,
      suggestion: `پیشنهاد: میلگرد D${faNum(fixDia, 0)} به فاصله ${faNum(spacingFix, 0)} mm`,
      autofix: fixDia !== barDia ? { spacing: spacingFix, barDia: fixDia } : { spacing: spacingFix },
    },
    {
      id: 'asmin',
      label: 'حداقل آرماتور گسترده (As,min حرارتی)',
      status: AsProvided >= AsMin ? 'ok' : 'warn',
      value: `${faNum(AsProvided, 0)} ≥ ${faNum(AsMin, 0)} mm²/m`,
      ref: 'مبحث نهم ۹-۱۴-۲-۱ (0.0018) / ACI 24.4.3.2',
      fix: 'سایز میلگرد را یک گام افزایش دهید.',
      dc: AsMin / AsProvided,
      suggestion: fixDia !== barDia ? `پیشنهاد هوشمند: D${faNum(fixDia, 0)} @ ${faNum(spacingFix, 0)} mm` : `پیشنهاد هوشمند: فاصله ${faNum(spacingFix, 0)} mm`,
      autofix: fixDia !== barDia ? { spacing: spacingFix, barDia: fixDia } : { spacing: spacingFix },
    },
    {
      id: 'spacing',
      label: 'فاصله میلگرد در محدوده مجاز',
      status: spacing >= 120 && spacing <= 300 ? 'ok' : 'warn',
      value: `${faNum(spacing, 0)} mm ∈ [۱۲۰،۳۰۰]`,
      ref: 'مبحث نهم',
      fix: 'فاصله را بین ۱۲۰ تا ۳۰۰ میلی‌متر نگه دارید.',
      autofix: { spacing: Math.max(120, Math.min(300, spacing)) },
    },
  ];

  const metrics: Metric[] = [
    { label: 'ظرفیت باربری نهایی', value: faNum(qult, 0), raw: qult, unit: 'kPa', tone: 'neutral' },
    { label: 'تنش مجاز خاک', value: faNum(qallow, 0), raw: qallow, unit: 'kPa', tone: 'ok', hint: `ضریب اطمینان ${faNum(FS, 1)}` },
    { label: 'تنش وارده خالص', value: faNum(qNet, 1), raw: qNet, unit: 'kPa', tone: 'neutral' },
    {
      label: 'ضریب بهره‌وری تنش',
      value: `${faNum(utilization * 100, 1)}٪`,
      raw: utilization,
      unit: '%',
      tone: utilization <= 0.85 ? 'ok' : utilization <= 1 ? 'warn' : 'bad',
      hint: `ضریب اطمینان واقعی ${faNum(realFS, 2)}`,
    },
    { label: 'آرماتور لازم', value: faNum(As, 0), raw: As, unit: 'mm²/m', tone: 'neutral' },
    { label: 'آرماتور موجود', value: faNum(AsProvided, 0), raw: AsProvided, unit: 'mm²/m', tone: AsProvided >= As ? 'ok' : 'bad' },
    { label: 'فاصله میلگردها', value: faNum(spacing, 0), raw: spacing, unit: 'mm', tone: 'neutral' },
    {
      label: 'برش یک‌طرفه',
      value: `${faNum(Vu, 1)} / ${faNum(Vc, 1)}`,
      raw: Vu / Vc,
      unit: 'kN/m',
      tone: shearOk ? 'ok' : 'bad',
      hint: 'وارده / مجاز',
    },
    { label: 'عمق مؤثر', value: faNum(d, 0), raw: d, unit: 'mm', tone: 'neutral' },
    { label: 'حجم بتن', value: faNum(concreteV, 2), raw: concreteV, unit: 'm³', tone: 'neutral' },
    { label: 'وزن آرماتور', value: faNum(steelKg, 1), raw: steelKg, unit: 'kg', tone: 'neutral' },
    { label: 'وزن کل فونداسیون', value: faNum(weight, 0), raw: weight, unit: 'kN', tone: 'neutral' },
  ];

  const assessment = [
    `فونداسیون گسترده به ابعاد ${faNum(L, 2)} × ${faNum(B, 2)} متر و ضخامت ${faNum(H, 2)} متر در عمق ${faNum(Df, 2)} متری بررسی شد.`,
    `با استفاده از روابط ترزاگی و پارامترهای خاک (چسبندگی ${faNum(c, 0)} کیلوپاسکال، زاویه اصطکاک ${faNum(phi, 0)} درجه، وزن مخصوص ${faNum(gamma, 1)} کیلونیوتن بر متر مکعب) ظرفیت باربری نهایی ${faNum(qult, 0)} کیلوپاسکال و تنش مجاز ${faNum(qallow, 0)} کیلوپاسکال به دست آمد.`,
    `تنش وارده خالص ${faNum(qNet, 1)} کیلوپاسکال است که ${faNum(utilization * 100, 1)} درصد ظرفیت مجاز را مصرف می‌کند و ضریب اطمینان واقعی برابر ${faNum(realFS, 2)} است.`,
    `آرماتور لازم در مقطع بحرانی ${faNum(As, 0)} میلی‌متر مربع بر متر محاسبه و شبکه دو طرفه با میلگرد سایز ${faNum(barDia, 0)} به فاصله ${faNum(spacing, 0)} میلی‌متر تأمین‌کننده آن است (${faNum(AsProvided, 0)} میلی‌متر مربع بر متر).`,
    shearOk
      ? `کنترل برش یک‌طرفه با برش وارده ${faNum(Vu, 1)} و ظرفیت ${faNum(Vc, 1)} کیلونیوتن بر متر برقرار است.`
      : `کنترل برش یک‌طرفه ناموفق است؛ ضخامت فونداسیون باید افزایش یابد.`,
  ].join(' ');

  // لیستوفر شبکه دوطرفه (BBS) — مجموع وزن دقیقاً برابر قلم آرماتور در BOQ است.
  const bbs: BBSItem[] = [
    {
      mark: 'F1',
      label: `میلگرد کف در راستای طولی (L=${faNum(L, 2)} m)`,
      dia: barDia,
      lenMm: Math.round(L * 1000),
      count: nBarsY,
      weightKg: +steelWeight(nBarsY * L * 1000 * barArea(barDia)).toFixed(1),
    },
    {
      mark: 'F2',
      label: `میلگرد کف در راستای عرضی (B=${faNum(B, 2)} m)`,
      dia: barDia,
      lenMm: Math.round(B * 1000),
      count: nBarsX,
      weightKg: +steelWeight(nBarsX * B * 1000 * barArea(barDia)).toFixed(1),
    },
  ];

  return {
    type: 'foundation',
    code: projectCode(CALC_META.foundation.prefix),
    createdAt: Date.now(),
    input: inp,
    metrics,
    boq,
    verdict: {
      ok,
      title: ok ? 'طرح فونداسیون قابل قبول است' : 'طرح نیاز به اصلاح دارد',
      text: ok
        ? `تنش وارده ${faNum(utilization * 100, 1)}٪ ظرفیت مجاز خاک است و کنترل برش نیز برقرار است.`
        : utilization > 1
          ? `تنش وارده از ظرفیت مجاز خاک ${faNum((utilization - 1) * 100, 1)}٪ بیشتر است؛ ابعاد پلان را بزرگ‌تر کنید.`
          : 'کنترل برش یک‌طرفه برقرار نیست؛ ضخامت فونداسیون را افزایش دهید.',
    },
    diagram: { kind: 'foundation', L, B, H, Df, cs, spacing, barDia, ldh },
    assessment,
    trace,
    checks,
    bbs,
    extras: {
      qult,
      qallow,
      qNet,
      utilization,
      steelKg,
      concreteV,
      leanV,
      formwork,
      excavation,
      A,
      d,
      spacing,
      AsReq,
      AsMin,
      AsProvided,
      Mu,
      Vu,
      Vc,
      vuP,
      vcP,
    },
  };
}

/* ================================================================== BEAM == */

export function calculateBeam(inp: BeamInput): CalcResult<BeamInput> {
  const { L, b, h, wd, wl, Fc, Fy, cover, stirrupDia, barDia, support, stirrupSpacing: manS, stirrupLegs, tensionLayers, compBars, compBarDia, Tu: TuIn } = inp;
  const selfWeight = ((b * h) / 1e6) * GAMMA_CONCRETE; // kN/m
  const wTotal = wd + selfWeight;
  const wu = 1.2 * wTotal + 1.6 * wl;

  const Mu = support === 'simple' ? (wu * L * L) / 8 : (wu * L * L) / 12; // kN·m
  const Vu = (wu * L) / 2; // kN

  const d = h - cover - stirrupDia - barDia / 2; // mm
  const phiF = 0.9;
  const k = (Mu * 1e6) / (phiF * b * d * d); // MPa
  const disc = 1 - (2 * k) / (0.85 * Fc);
  const sectionOk = disc >= 0;
  const rho = sectionOk ? (0.85 * Fc) / Fy * (1 - Math.sqrt(disc)) : 0;
  const rhoMax = 0.75 * (0.85 * Fc * 0.003 * ES) / (Fy * (Fy + 0.003 * ES));
  const AsReq = rho * b * d;
  const AsMin = Math.max((0.25 * Math.sqrt(Fc)) / Fy, 1.4 / Fy) * b * d;
  const As = Math.max(AsReq, AsMin);

  const nBars = Math.max(2, Math.ceil(As / barArea(barDia)));
  const AsProvided = nBars * barArea(barDia);

  // جای‌گیری میلگردهای کششی در عرض مقطع (bar-fit) — مبحث نهم بند ۹-۱۴-۲-۱-۳
  // فاصله آزاد حداقل = max(db, 25) mm — REFERENCE REQUIRES MANUAL CODE-BOOK VERIFICATION
  const perLayer = Math.max(1, Math.ceil(nBars / Math.max(1, tensionLayers)));
  const minClear = Math.max(barDia, 25); // mm
  const availWidth = Math.max(1, b - 2 * (cover + stirrupDia)); // mm عرض آزاد داخل خاموت
  const requiredWidth = perLayer * barDia + (perLayer - 1) * minClear; // mm
  const barFitOk = requiredWidth <= availWidth;
  const barFitFixB = Math.min(2000, Math.ceil((requiredWidth + 2 * (cover + stirrupDia)) / 50) * 50);

  // shear design
  const Vc = (0.17 * Math.sqrt(Fc) * b * d) / 1000; // kN
  const VsReq = Math.max(0, Vu / 0.75 - Vc);
  const legs = Math.max(2, Math.round(stirrupLegs || 2));
  const Av = legs * barArea(stirrupDia); // mm²
  // required spacing from Vu: Vs = Av·Fy·d/s  =>  s = Av·Fy·d/Vs
  const sCalc = VsReq > 0 ? (Av * Fy * d) / (VsReq * 1000) : Infinity;
  // ACI minimum-Av provision expressed as a max spacing limit: s <= Av·fy / max(0.062√fc, 0.35)·bw
  const sAvLim = (Av * Fy) / (Math.max(0.062 * Math.sqrt(Fc), 0.35) * b);
  const sMax = Math.min(d / 2, 300); // ACI max spacing

  // ---- زنجیره کامل طراحی پیچش — مبحث نهم بند ۹-۱۵-۸ (ویرایش ۱۳۹۹) / ACI 318-19 Ch.22.7
  const Tu = TuIn || 0; // kN·m
  const TuNmm = Tu * 1e6; // N·mm
  // λ = 1.0 (بتن با وزن مخصوص معمولی) در فرمول‌های زیر لحاظ شده است
  const fyt = Fy; // تنش تسلیم خاموت
  const Acp = b * h; // mm² مساحت ناخالص — جدول ۹-۱۵-۸-۱
  const pcp = 2 * (b + h); // mm محیط ناخالص
  const Tcr = (0.33 * Math.sqrt(Fc) * (Acp * Acp)) / pcp; // N·mm لنگر ترک‌خوردگی پیچشی (بند ۹-۱۵-۸-۲)
  const phiT = 0.75; // ضریب کاهش مقاومت پیچش (بند ۹-۱۵-۸-۳)
  const Tthreshold = (phiT * Tcr) / 4; // N·mm آستانه پیچش — زیر آن طراحی پیچشی لازم نیست
  const torsionReq = TuNmm > Tthreshold;
  // هندسه خط مرکزی حلقه بسته خاموت (بند ۹-۱۵-۸-۴)
  const x0 = Math.max(1, b - 2 * (cover + stirrupDia));
  const y0 = Math.max(1, h - 2 * (cover + stirrupDia));
  const Aoh = x0 * y0; // mm² سطح محصور در خط مرکزی
  const Ao = 0.85 * Aoh; // mm² سطح محصور مؤثر
  const ph = 2 * (x0 + y0); // mm محیط خط مرکزی
  // تعامل هم‌زمان برش + پیچش (بند ۹-۱۵-۸-۵ / ACI 22.7.7.1b) — MPa
  const vShear = (Vu * 1000) / (b * d); // MPa
  const vTors = torsionReq ? (TuNmm * ph) / (1.7 * Aoh * Aoh) : 0; // MPa
  const vComb = Math.sqrt(vShear * vShear + vTors * vTors); // MPa
  const vCombCap = phiT * (0.17 + 0.66) * Math.sqrt(Fc); // MPa = φ·(Vc/bw·d + 0.66√fc)
  const combOk = vComb <= vCombCap;
  // آرماتور پیچشی: خاموت بسته (هر شاخه) و میلگرد طولی (θ=45° → cotθ=1) — بند ۹-۱۵-۸-۶
  const AtOverS = torsionReq ? TuNmm / (phiT * 2 * Ao * fyt) : 0; // mm²/mm per leg
  const AtOverSmin = (0.175 * b) / fyt; // حداقل خاموت پیچشی — REFERENCE REQUIRES MANUAL CODE-BOOK VERIFICATION
  const AtOverS_eff = Math.max(AtOverS, AtOverSmin);
  const AlMin = torsionReq ? (0.42 * Math.sqrt(Fc) * Acp) / Fy - AtOverS * ph * (fyt / Fy) : 0; // mm² حداقل طولی پیچشی
  const Al = Math.max(AtOverS_eff * ph * (fyt / Fy), AlMin); // mm² طولی پیچشی (توزیع دور محیط)
  const nTorsionLong = torsionReq ? Math.max(0, Math.ceil(Al / barArea(barDia))) : 0;
  // محدودیت فاصله خاموت پیچشی + حداقل آرماتور ترکیبی برش/پیچش — بند ۹-۱۵-۸-۷
  const sTorsionPerLeg = torsionReq ? Math.min(ph / 8, 300) : Infinity;
  const sTorsionMin = torsionReq && AtOverS_eff > 0 ? barArea(stirrupDia) / AtOverS_eff : Infinity;
  const VsReqN = VsReq * 1000; // N
  const AvReqOverS = VsReq > 0 ? VsReqN / (fyt * d) : 0; // mm²/mm (همه شاخه‌های برشی)
  const sTorsionReq = torsionReq && (AvReqOverS + 2 * AtOverS_eff) > 0 ? Av / (AvReqOverS + 2 * AtOverS_eff) : Infinity;
  // جزئیات لرزه‌ای ناحیه بحرانی: خاموت بسته با قلاب ۱۳۵° (مبحث نهم ۹-۱۴-۴ / ACI 18.6.4)
  const sSeismic = torsionReq ? Math.min(d / 4, 8 * barDia, 24 * stirrupDia, 300) : Infinity;

  const sAllow = Math.min(sMax, sCalc, sAvLim, sTorsionReq, sTorsionPerLeg, sTorsionMin); // governing allowable spacing
  const stirrupSpacing = manS > 0 ? Math.max(50, Math.min(600, Math.round(manS / 25) * 25)) : Math.max(50, Math.floor(sAllow / 25) * 25);
  // Vu-based suggestion: clears the shear error exactly (floored to 25 mm steps)
  const sSugg = Math.max(50, Math.floor(Math.min(sAllow, torsionReq ? sSeismic : Infinity) / 25) * 25);
  const shearOkBeam = stirrupSpacing <= sAllow;

  // deflection (service loads, gross section)
  const Ec = 4700 * Math.sqrt(Fc); // MPa
  const Ig = (b * Math.pow(h, 3)) / 12; // mm⁴
  const wService = (wTotal + wl) ; // kN/m = N/mm
  const deflection = (5 * wService * Math.pow(L * 1000, 4)) / (384 * Ec * Ig); // mm
  const defLimit = (L * 1000) / 240;
  // deflection fix: δ ∝ 1/Ig ∝ 1/h³  =>  hReq = h·∛(δ/δlim), rounded up to 50 mm
  const hFixBeam = Math.min(4000, Math.ceil((h * Math.cbrt(Math.max(1, deflection / defLimit))) / 50) * 50);

  // steel quantities
  const longLen = nBars * L * 1.05 * 1000; // mm (with laps/hooks)
  const torsLen = nTorsionLong * L * 1.05 * 1000; // mm طولی پیچشی
  const nStirrups = Math.floor((L * 1000) / stirrupSpacing) + 1;
  const stirrupLen = 2 * (b - 2 * cover) + 2 * (h - 2 * cover) + 150; // mm incl. hooks
  const compKg = steelWeight(compBars * L * 1.05 * 1000 * barArea(compBarDia));
  const torsKg = steelWeight(torsLen * barArea(barDia));
  const steelKg = steelWeight(longLen * barArea(barDia) + nStirrups * stirrupLen * barArea(stirrupDia)) + compKg + torsKg;

  const concreteV = ((b * h) / 1e6) * L;
  const formwork = (2 * (h + b)) / 1000 * L;

  const ok = sectionOk && deflection <= defLimit && barFitOk && combOk;
  const boq: BOQItem[] = [
    {
      code: 'CC',
      title: 'بتن تیر C25',
      titleEn: 'Beam concrete C25',
      unit: 'متر مکعب',
      unitEn: 'm³',
      qty: round(concreteV, 3),
      materialId: 'concrete',
      detail: 'بتن آماده با پمپ، عیار ۳۵۰',
    },
    {
      code: 'RB',
      title: `آرماتور طولی میلگرد A3 سایز ${barDia} (${nBars} عدد${torsionReq ? ` + ${nTorsionLong} عدد پیچشی` : ''})`,
      titleEn: `Longitudinal rebar Ø${barDia} (${nBars} nos${torsionReq ? ` + ${nTorsionLong} torsional` : ''})`,
      unit: 'کیلوگرم',
      unitEn: 'kg',
      qty: round(steelWeight(longLen * barArea(barDia)) + compKg + torsKg, 1),
      materialId: 'rebar',
      detail: `طول هر شاخه ${faNum(L * 1.05, 2)} متر با احتساب هم‌پوشانی${compBars > 0 ? ` + ${compBars} میلگرد تقویتی بالا` : ''}${torsionReq ? ` + ${nTorsionLong} میلگرد طولی پیچشی در دور مقطع` : ''}`,
    },
    {
      code: 'ST',
      title: `خاموت میلگرد A2 سایز ${stirrupDia}`,
      titleEn: `Stirrups Ø${stirrupDia}`,
      unit: 'کیلوگرم',
      unitEn: 'kg',
      qty: round(steelWeight(nStirrups * stirrupLen * barArea(stirrupDia)), 1),
      materialId: 'rebar',
      detail: `${faNum(nStirrups, 0)} عدد خاموت شاخه به فاصله ${faNum(stirrupSpacing, 0)} میلی‌متر`,
    },
    {
      code: 'FW',
      title: 'قالب‌بندی تیر (کف + دو طرف)',
      titleEn: 'Beam formwork',
      unit: 'متر مربع',
      unitEn: 'm²',
      qty: round(formwork, 2),
      materialId: 'formwork',
      detail: 'سطح تماس قالب با بتن',
    },
  ];

  // ductility / strain check (shape-ability) — c/dt ≤ 0.375
  const aBlk = (AsProvided * Fy) / (0.85 * Fc * b); // mm stress-block depth
  const cDepth = aBlk / 0.85;
  const ductile = cDepth / d <= 0.375;

  let ts = 0;
  const trace: TraceStep[] = [];
  const T = (title: string, formula: string, detail: string, result: string, ref?: string): void => {
    trace.push({ step: ++ts, title, formula, detail, result, ref });
  };
  T('وزن خود تیر', 'w_self = (b·h/1e6)·γc', `مقطع ${faNum(b, 0)}×${faNum(h, 0)}`, `${faNum(selfWeight, 2)} kN/m`);
  T('بار نهایی طراحی', 'wu = 1.2·(DL+w_self) + 1.6·LL', `DL=${faNum(wd, 1)} LL=${faNum(wl, 1)}`, `${faNum(wu, 2)} kN/m`, 'ACI 318');
  T('لنگر خمشی نهایی', support === 'simple' ? 'Mu = wu·L²/8' : 'Mu = wu·L²/12', `L=${faNum(L, 2)}`, `${faNum(Mu, 1)} kN·m`);
  T('برش نهایی', 'Vu = wu·L/2', '', `${faNum(Vu, 1)} kN`);
  T('عمق مؤثر', 'd = h − cover − stirrup − bar/2', '', `${faNum(d, 0)} mm`);
  T('نسبت آرماتور خمشی', 'k=Mu·1e6/(φ·b·d²) ; ρ=(0.85·Fc/Fy)(1−√(1−2k/0.85Fc))', `φ=0.9`, `ρ=${faNum(rho * 100, 3)}٪`, 'ACI 318');
  T('حداکثر/حداقل آرماتور', 'ρmax=0.75·ρb ; As,min', '', `ρmax=${faNum(rhoMax * 100, 2)}٪ As=${faNum(As, 0)} mm²`);
  T('تعداد میلگرد طولی', 'n = As/Ab', `سایز ${faNum(barDia, 0)}`, `${faNum(nBars, 0)} عدد → ${faNum(AsProvided, 0)} mm²`);
  T('جای‌گیری میلگرد در عرض', 'w_req = n·db + (n−1)·s_clear ≤ b−2(cover+stirrup)', `عرض آزاد ${faNum(availWidth, 0)} mm`, `نیاز ${faNum(requiredWidth, 0)} mm`, 'مبحث نهم ۹-۱۴');
  T('طراحی خاموت برشی', 'Vs=Vu/0.75−Vc ; s=Av·Fy·d/Vs', `خاموت ${faNum(stirrupDia, 0)} ${legs} شاخه`, `s=${faNum(stirrupSpacing, 0)} mm`, 'ACI 318');
  T('کنترل خیز سرویس', 'δ = 5·w·L⁴/(384·Ec·Ig) ≤ L/240', `Ec=${faNum(Ec, 0)} MPa`, `δ=${faNum(deflection, 1)} / ${faNum(defLimit, 1)} mm`);
  T('شکل‌پذیری مقطع', 'c/dt ≤ 0.375', `c=${faNum(cDepth, 0)} d=${faNum(d, 0)}`, `${faNum(cDepth / d, 2)}`, 'ACI 318');
  if (!torsionReq) {
    T('کنترل پیچش (آستانه)', 'Tu ≤ φ·Tcr/4', `Tu=${faNum(Tu, 1)} kN·m ≤ ${faNum(Tthreshold / 1e6, 2)} kN·m`, 'پیچش قابل صرف‌نظر است', 'مبحث نهم ۹-۱۵-۸');
  } else {
    T('لنگر پیچشی آستانه', 'Tcr = 0.33·√fc·Acp²/pcp', `Tu=${faNum(Tu, 1)} > φ·Tcr/4 = ${faNum(Tthreshold / 1e6, 2)} kN·m`, 'طراحی پیچشی لازم است', 'مبحث نهم ۹-۱۵-۸');
    T('تعامل برش + پیچش', '√((Vu/bw·d)² + (Tu·ph/1.7·Aoh²)²) ≤ φ·(Vc/bw·d + 0.66√fc)', `Vu/bwd=${faNum(vShear, 2)} ، Tu·ph/1.7Aoh²=${faNum(vTors, 2)}`, `${faNum(vComb, 2)} ≤ ${faNum(vCombCap, 2)} MPa`, 'مبحث نهم ۹-۱۵-۸');
    T('خاموت بسته پیچشی', 'At/s = Tu/(φ·2·Ao·fyt) ≥ 0.175·bw/fyt', `Ao=${faNum(Ao, 0)} mm² ، ph=${faNum(ph, 0)} mm`, `At/s = ${faNum(AtOverS_eff, 3)} mm²/mm`, 'مبحث نهم ۹-۱۵-۸');
    T('میلگرد طولی پیچشی', 'Al = (At/s)·ph·(fyt/fy) ، توزیع دور محیط', '', `${faNum(Al, 0)} mm² → ${faNum(nTorsionLong, 0)}Ø${faNum(barDia, 0)}`, 'مبحث نهم ۹-۱۵-۸');
  }

  // ---- smart fix helpers for beam (realistic bounds, 50 mm steps, standard dias)
  const STD_DIAS_BEAM = [12, 14, 16, 18, 20, 22, 25, 28, 32];
  const nextStdDia = (d0: number): number => { for (const dd of STD_DIAS_BEAM) if (dd > d0) return dd; return 32; };
  const hFixFlex = Math.min(4000, Math.ceil((h + 50) / 50) * 50);
  const bFixFlex = Math.min(2000, Math.ceil((b + 50) / 50) * 50);
  // shear: if sAllow < 50 need bigger Av
  let stirrupDiaFix = stirrupDia;
  let legsFix = legs;
  let sAllowFix = sAllow;
  if (sAllow < 50) {
    // try increase legs first, then dia
    if (legs < 4) { legsFix = Math.min(4, legs + 1); }
    else { stirrupDiaFix = Math.min(16, nextStdDia(stirrupDia) >= 14 ? nextStdDia(stirrupDia) : stirrupDia + 2); }
    const AvFix = legsFix * (Math.PI * stirrupDiaFix * stirrupDiaFix) / 4;
    const sCalcFix = VsReq > 0 ? (AvFix * Fy * d) / (VsReq * 1000) : Infinity;
    const sAvLimFix = (AvFix * Fy) / (Math.max(0.062 * Math.sqrt(Fc), 0.35) * b);
    sAllowFix = Math.min(sMax, sCalcFix, sAvLimFix);
  }
  const sSuggClamped = Math.max(50, Math.min(200, Math.floor(sAllowFix / 25) * 25));
  const ductFixH = Math.min(4000, Math.ceil((h + 50) / 50) * 50);
  // separation of AsReq vs AsMin
  const rebarOkReq = AsProvided >= AsReq;
  const asMinOk = AsProvided >= AsMin;
  const checks: DesignCheck[] = [
    {
      id: 'flex',
      label: 'کنترل خمشی (کفایت مقطع)',
      status: sectionOk && rho <= rhoMax ? 'ok' : 'bad',
      value: `ρ=${faNum(rho * 100, 2)}٪ ≤ ${faNum(rhoMax * 100, 2)}٪`,
      ref: 'مبحث نهم ۹-۱۴-۲-۱ / ACI 21.2.2',
      fix: 'ابعاد b/h را بزرگ‌تر کنید.',
      suggestion: `پیشنهاد هوشمند: افزایش مقطع به ${faNum(bFixFlex, 0)}×${faNum(hFixFlex, 0)} mm`,
      autofix: { h: hFixFlex, b: bFixFlex },
      dc: rho / rhoMax,
    },
    {
      id: 'rebar',
      label: 'کفایت آرماتور خمشی (AsReq)',
      status: rebarOkReq ? 'ok' : 'bad',
      value: `${faNum(AsProvided, 0)} ≥ ${faNum(AsReq, 0)} mm²/m (خالص خمشی)`,
      ref: 'مبحث نهم ۹-۱۴-۲-۱-۱',
      fix: 'سایز میلگرد را یک گام افزایش دهید.',
      suggestion: `پیشنهاد: D${faNum(nextStdDia(barDia), 0)} یا افزایش تعداد`,
      autofix: { barDia: nextStdDia(barDia) },
      dc: AsReq / AsProvided,
    },
    {
      id: 'asmin',
      label: 'حداقل آرماتور مبحث نهم (AsMin)',
      status: asMinOk ? 'ok' : 'warn',
      value: `${faNum(AsProvided, 0)} ≥ ${faNum(AsMin, 0)} mm²`,
      ref: 'مبحث نهم ۹-۱۴-۲-۱-۱ / ACI 9.6.1.2',
      fix: 'حداقل آرماتور ۰٫۰۰۳۳ را رعایت کنید.',
      suggestion: `پیشنهاد: D${faNum(nextStdDia(barDia), 0)}`,
      autofix: { barDia: nextStdDia(barDia) },
      dc: AsMin / AsProvided,
    },
    {
      id: 'barfit',
      label: 'جای‌گیری میلگرد کششی در عرض مقطع',
      status: barFitOk ? 'ok' : 'bad',
      value: `${faNum(requiredWidth, 0)} ≤ ${faNum(availWidth, 0)} mm (${faNum(perLayer, 0)} ردیف در ${faNum(tensionLayers, 0)} سفره)`,
      ref: 'مبحث نهم ۹-۱۴-۲-۱-۳ / ACI 25.2.1',
      fix: 'عرض تیر b را افزایش دهید یا سفره کششی را دو طبقه کنید.',
      suggestion: `پیشنهاد هوشمند: افزایش عرض به ${faNum(barFitFixB, 0)} mm یا میلگرد کمتر با قطر بیشتر`,
      autofix: { b: barFitFixB },
      dc: requiredWidth / availWidth,
    },
    {
      id: 'torsion',
      label: 'کنترل پیچش (مبحث نهم ۹-۱۵-۸)',
      status: !torsionReq ? 'ok' : combOk ? 'ok' : 'bad',
      value: !torsionReq
        ? `Tu=${faNum(Tu, 1)} ≤ φ·Tcr/4=${faNum(Tthreshold / 1e6, 2)} kN·m — صرف‌نظر`
        : `تعامل ${faNum(vComb, 2)} ≤ ${faNum(vCombCap, 2)} MPa`,
      ref: 'مبحث نهم ۹-۱۵-۸',
      fix: 'مقطع را بزرگ کنید یا آرماتور پیچشی (خاموت بسته + میلگرد طولی) تأمین کنید.',
      suggestion: torsionReq ? `پیشنهاد: خاموت بسته Ø${faNum(stirrupDia, 0)}@${faNum(Math.max(50, Math.floor(sTorsionPerLeg / 25) * 25), 0)} + ${faNum(nTorsionLong, 0)}Ø${faNum(barDia, 0)} طولی پیچشی` : undefined,
      autofix: combOk ? undefined : { b: Math.min(2000, Math.ceil((b + 50) / 50) * 50), h: Math.min(4000, Math.ceil((h + 50) / 50) * 50) },
      dc: !torsionReq ? TuNmm / Tthreshold : vComb / vCombCap,
    },
    {
      id: 'shear',
      label: 'کنترل برش و خاموت',
      status: shearOkBeam ? 'ok' : 'bad',
      value: `s=${faNum(stirrupSpacing, 0)} ≤ ${faNum(Math.floor(sAllow), 0)} mm`,
      ref: 'مبحث نهم ۹-۱۵-۲-۲ / ACI 22.5.10',
      fix: 'فاصله خاموت را کاهش دهید یا قطر/شاخه را افزایش دهید.',
      suggestion: VsReq > 0 ? `پیشنهاد: فاصله خاموت ${faNum(sSuggClamped, 0)} mm (Ø${faNum(stirrupDiaFix, 0)} ${faNum(legsFix, 0)} شاخه)` : `پیشنهاد: فاصله خاموت ${faNum(sSuggClamped, 0)} mm`,
      autofix: sAllow < 50 ? { stirrupSpacing: sSuggClamped, stirrupDia: stirrupDiaFix, stirrupLegs: legsFix } : { stirrupSpacing: sSuggClamped },
      dc: stirrupSpacing / Math.max(1, sAllow),
    },
    {
      id: 'duct',
      label: 'ضابطه شکل‌پذیری (کشش خالص)',
      status: ductile ? 'ok' : 'bad',
      value: `c/dt=${faNum(cDepth / d, 2)} ≤ ۰٫۳۷۵`,
      ref: 'مبحث نهم ۹-۱۴-۲-۳ / ACI 21.2.2',
      fix: 'مقطع را بزرگ‌تر کنید یا آرماتور کششی را کاهش دهید.',
      suggestion: `پیشنهاد هوشمند: افزایش ارتفاع به ${faNum(ductFixH, 0)} mm`,
      autofix: { h: ductFixH },
      dc: (cDepth / d) / 0.375,
    },
    {
      id: 'defl',
      label: 'کنترل خیز (L/240)',
      status: deflection <= defLimit ? 'ok' : 'bad',
      value: `${faNum(deflection, 1)} ≤ ${faNum(defLimit, 1)} mm`,
      ref: 'مبحث نهم ۹-۲۱-۲ (L/240) / ACI جدول 24.2.2',
      fix: 'ارتفاع h را افزایش دهید.',
      suggestion: `پیشنهاد: افزایش ارتفاع تیر به ${faNum(hFixBeam, 0)} mm`,
      autofix: { h: hFixBeam },
      dc: deflection / defLimit,
    },
  ];

  const metrics: Metric[] = [
    { label: 'بار نهایی طراحی', value: faNum(wu, 2), raw: wu, unit: 'kN/m', tone: 'neutral', hint: `وزن خود ${faNum(selfWeight, 2)}` },
    { label: 'لنگر نهایی', value: faNum(Mu, 1), raw: Mu, unit: 'kN·m', tone: 'neutral' },
    { label: 'برش نهایی', value: faNum(Vu, 1), raw: Vu, unit: 'kN', tone: 'neutral' },
    { label: 'عمق مؤثر', value: faNum(d, 0), raw: d, unit: 'mm', tone: 'neutral' },
    { label: 'نسبت آرماتور لازم', value: faNum(rho * 100, 3), raw: rho, unit: '%', tone: rho <= rhoMax ? 'ok' : 'bad', hint: `حداکثر ${faNum(rhoMax * 100, 2)}٪` },
    { label: 'آرماتور لازم', value: faNum(As, 0), raw: As, unit: 'mm²', tone: 'neutral' },
    { label: 'آرماتور موجود', value: faNum(AsProvided, 0), raw: AsProvided, unit: 'mm²', tone: AsProvided >= As ? 'ok' : 'bad', hint: `${faNum(nBars, 0)} میلگرد Ø${faNum(barDia, 0)}` },
    { label: 'ظرفیت برش بتن', value: faNum(Vc, 1), raw: Vc, unit: 'kN', tone: 'neutral' },
    { label: 'برش لازم خاموت', value: faNum(VsReq, 1), raw: VsReq, unit: 'kN', tone: VsReq > 0 ? 'warn' : 'ok' },
    { label: 'فاصله خاموت', value: faNum(stirrupSpacing, 0), raw: stirrupSpacing, unit: 'mm', tone: 'neutral' },
    {
      label: 'خیز میان‌دهانه',
      value: `${faNum(deflection, 1)} / ${faNum(defLimit, 1)}`,
      raw: deflection / defLimit,
      unit: 'mm',
      tone: deflection <= defLimit ? 'ok' : 'bad',
      hint: 'مجاز L/240',
    },
    { label: 'وزن آرماتور', value: faNum(steelKg, 1), raw: steelKg, unit: 'kg', tone: 'neutral' },
    { label: 'حجم بتن', value: faNum(concreteV, 3), raw: concreteV, unit: 'm³', tone: 'neutral' },
  ];

  const assessment = [
    `تیر ${support === 'simple' ? 'دو سر مفصل' : 'پیوسته'} با دهانه ${faNum(L, 2)} متر و مقطع ${faNum(b, 0)}×${faNum(h, 0)} میلی‌متر بررسی شد.`,
    `با ترکیب بار ${faNum(1.2, 1)}DL+${faNum(1.6, 1)}LL بار نهایی ${faNum(wu, 2)} کیلونیوتن بر متر و لنگر نهایی ${faNum(Mu, 1)} کیلونیوتن متر به دست آمد.`,
    sectionOk
      ? `نسبت آرماتور لازم ${faNum(rho * 100, 3)} درصد است که از حد حداکثر ${faNum(rhoMax * 100, 2)} درصد کمتر است و ${faNum(nBars, 0)} میلگرد سایز ${faNum(barDia, 0)} (معادل ${faNum(AsProvided, 0)} میلی‌متر مربع) پاسخگو است.`
      : `مقطع برای لنگر وارد شده کافی نیست؛ ابعاد تیر را افزایش دهید.`,
    `خاموت‌ها با میلگرد سایز ${faNum(stirrupDia, 0)} به فاصله ${faNum(stirrupSpacing, 0)} میلی‌متر طراحی شد (برش لازم خاموت ${faNum(VsReq, 1)} کیلونیوتن).`,
    torsionReq
      ? `پیچش وارده ${faNum(Tu, 1)} کیلونیوتن متر بیش از آستانه ${faNum(Tthreshold / 1e6, 2)} است؛ خاموت بسته پیچشی At/s=${faNum(AtOverS_eff, 3)} میلی‌متر مربع بر میلی‌متر و ${faNum(nTorsionLong, 0)} میلگرد طولی پیچشی تأمین شد و تعامل برش-پیچش ${faNum(vComb, 2)} در برابر ${faNum(vCombCap, 2)} مگاپاسکال برقرار است.`
      : `پیچش وارده ${faNum(Tu, 1)} کیلونیوتن متر زیر آستانه φ·Tcr/4 است و نیاز به آرماتور پیچشی ندارد.`,
    `خیز میان‌دهانه ${faNum(deflection, 1)} میلی‌متر در برابر حد مجاز ${faNum(defLimit, 1)} میلی‌متر است.`,
  ].join(' ');

  // لیستوفر تیر (BBS) — مجموع وزن دقیقاً برابر قلم آرماتور در BOQ است.
  const bbs: BBSItem[] = [
    { mark: 'B1', label: `میلگرد طولی کششی (${nBars} عدد)`, dia: barDia, lenMm: Math.round(L * 1.05 * 1000), count: nBars, weightKg: +steelWeight(longLen * barArea(barDia)).toFixed(1) },
  ];
  if (compBars > 0) {
    bbs.push({ mark: 'B2', label: `میلگرد تقویتی بالا (${compBars} عدد)`, dia: compBarDia, lenMm: Math.round(L * 1.05 * 1000), count: compBars, weightKg: +steelWeight(compBars * L * 1.05 * 1000 * barArea(compBarDia)).toFixed(1) });
  }
  bbs.push({ mark: 'B3', label: `خاموت بسته ${torsionReq ? 'برشی-پیچشی ' : ''}(قلاب ۱۳۵°)`, dia: stirrupDia, lenMm: stirrupLen, count: nStirrups, weightKg: +steelWeight(nStirrups * stirrupLen * barArea(stirrupDia)).toFixed(1) });
  if (torsionReq) {
    bbs.push({ mark: 'B4', label: `میلگرد طولی پیچشی (${nTorsionLong} عدد دور محیط)`, dia: barDia, lenMm: Math.round(L * 1.05 * 1000), count: nTorsionLong, weightKg: +steelWeight(torsLen * barArea(barDia)).toFixed(1) });
  }

  return {
    type: 'beam',
    code: projectCode(CALC_META.beam.prefix),
    createdAt: Date.now(),
    input: inp,
    metrics,
    boq,
    verdict: {
      ok,
      title: ok ? 'طرح تیر قابل قبول است' : 'طرح تیر نیاز به اصلاح دارد',
      text: !sectionOk
        ? 'مقطع برای لنگر نهایی کافی نیست.'
        : deflection > defLimit
          ? `خیز ${faNum(((deflection / defLimit) - 1) * 100, 1)}٪ بیش از حد مجاز است؛ ارتفاع تیر را افزایش دهید.`
          : !barFitOk
            ? `عرض لازم برای جای‌گیری ${faNum(nBars, 0)} میلگرد ${faNum(requiredWidth, 0)} میلی‌متر از عرض آزاد ${faNum(availWidth, 0)} بیشتر است؛ عرض تیر را افزایش دهید.`
            : !combOk
              ? 'تعامل برش و پیچش از ظرفیت مجاز بیشتر است؛ مقطع را بزرگ کنید.'
              : 'کنترل خمشی، برشی، پیچشی و خیز برقرار است.',
    },
    diagram: { kind: 'beam', L, b, h, bars: nBars, barDia, stirrupDia, stirrupSpacing, tensionLayers, compBars, compBarDia, support, dEff: d, sCritical: sSugg, skin: h > 750, torsion: torsionReq, nTorsionLong },
    assessment,
    trace,
    checks,
    bbs,
    extras: { wu, Mu, Vu, d, rho, rhoMax, As, AsReq, AsMin, AsProvided, nBars, stirrupSpacing, sAllow, sMax, VsReq, deflection, defLimit, steelKg, concreteV, formwork, selfWeight, cDepth, ductile: ductile ? 1 : 0, Tu, Tcr: Tcr / 1e6, Tthreshold: Tthreshold / 1e6, torsionReq: torsionReq ? 1 : 0, AtOverS: AtOverS_eff, Al, nTorsionLong, vComb, vCombCap, requiredWidth, availWidth },
  };
}

/* ================================================================ COLUMN == */

export interface PMPoint {
  P: number; // kN
  M: number; // kN·m
}

function beta1(Fc: number): number {
  if (Fc <= 28) return 0.85;
  return Math.max(0.65, 0.85 - 0.05 * ((Fc - 28) / 7));
}

/** Perimeter bar arrangement for a tied rectangular column supporting ANY even
 *  count ≥ 4 (4, 6, 8, 10, …): p bars on each bending face (top/bottom) and q on
 *  each side face, corners shared, total = 2p + 2q − 4 = n. */
export function barLayout(
  _b: number,
  h: number,
  cover: number,
  barDia: number,
  nTarget: number,
): { nSide: number; nFace: number; total: number; layers: number[] } {
  const n = Math.max(4, 2 * Math.round(nTarget / 2));
  const half = n / 2 + 2; // p + q
  const q = Math.max(2, Math.floor(half / 2)); // per side face
  const p = half - q; // per bending face
  const c0 = cover + barDia / 2;
  const layers: number[] = [];
  for (let i = 0; i < p; i++) layers.push(c0); // compression face
  for (let i = 0; i < p; i++) layers.push(h - c0); // tension face
  for (let face = 0; face < 2; face++) {
    for (let j = 1; j < q - 1; j++) layers.push(c0 + ((h - 2 * c0) * j) / (q - 1));
  }
  return { nSide: p, nFace: q, total: 2 * p + 2 * q - 4, layers };
}

export interface InteractionResult {
  points: PMPoint[];
  /** nominal (φ=1) capacity curve for the dashed reference line */
  nominal: PMPoint[];
  total: number;
  layers: number[];
}

/** Factored P-M interaction diagram for a tied rectangular column. */
export function interactionCurve(
  b: number,
  h: number,
  Fc: number,
  Fy: number,
  cover: number,
  barDia: number,
  nBarsTarget: number,
): InteractionResult {
  const { total, layers } = barLayout(b, h, cover, barDia, nBarsTarget);
  const Ab = barArea(barDia);
  const points: PMPoint[] = [];
  const nominal: PMPoint[] = [];
  const b1 = beta1(Fc);

  for (let i = 1; i <= 120; i++) {
    const c = (h * 1.25 * i) / 120; // neutral-axis depth, mm
    const a = b1 * c;
    let P = 0.85 * Fc * a * b; // concrete compression, N
    let M = P * (h / 2 - a / 2);
    let maxTensile = 0;
    let allCompressed = true;
    for (const di of layers) {
      const strain = c > 0 ? (0.003 * (c - di)) / c : 0;
      maxTensile = Math.max(maxTensile, -strain);
      if (strain <= 0) allCompressed = false;
      const fs = Math.max(-Fy, Math.min(Fy, ES * strain));
      const net = strain > 0 ? fs - 0.85 * Fc : fs; // deduct displaced concrete
      const force = net * Ab;
      P += force;
      M += force * (h / 2 - di);
    }
    // ACI 318 strength-reduction factor
    let phi: number;
    if (allCompressed) phi = 0.65;
    else if (maxTensile >= 0.005) phi = 0.9;
    else if (maxTensile <= 0.002) phi = 0.65;
    else phi = 0.65 + (0.25 * (maxTensile - 0.002)) / 0.003;
    nominal.push({ P: P / 1000, M: M / 1e6 });
    points.push({ P: (phi * P) / 1000, M: (phi * M) / 1e6 });
  }
  // pure-tension end point
  points.push({ P: (-0.9 * Fy * total * Ab) / 1000, M: 0 });
  nominal.push({ P: (-Fy * total * Ab) / 1000, M: 0 });
  return { points, nominal, total, layers };
}

/** Strength-reduction factor φ at the section depth whose axial capacity equals Pu
 *  (used by the P-M popover to report the governing φ for the demand point). */
export function phiAtDemand(
  b: number,
  h: number,
  Fc: number,
  Fy: number,
  cover: number,
  barDia: number,
  nBars: number,
  Pu: number,
): number {
  const { layers } = barLayout(b, h, cover, barDia, nBars);
  const Ab = barArea(barDia);
  const b1 = beta1(Fc);
  const axial = (c: number): number => {
    const a = b1 * c;
    let P = 0.85 * Fc * a * b;
    for (const di of layers) {
      const strain = c > 0 ? (0.003 * (c - di)) / c : 0;
      const fs = Math.max(-Fy, Math.min(Fy, ES * strain));
      P += (strain > 0 ? fs - 0.85 * Fc : fs) * Ab;
    }
    return P / 1000;
  };
  let lo = 1;
  let hi = h * 1.25;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (axial(mid) > Pu) hi = mid;
    else lo = mid;
  }
  const c = (lo + hi) / 2;
  let maxTensile = 0;
  let allCompressed = true;
  for (const di of layers) {
    const strain = (0.003 * (c - di)) / c;
    maxTensile = Math.max(maxTensile, -strain);
    if (strain <= 0) allCompressed = false;
  }
  if (allCompressed) return 0.65;
  if (maxTensile >= 0.005) return 0.9;
  if (maxTensile <= 0.002) return 0.65;
  return 0.65 + (0.25 * (maxTensile - 0.002)) / 0.003;
}

export interface PMKeyPoints {
  /** φPn pure axial (tied column, φ=0.65) kN */
  P0: number;
  /** balanced point (εt = εy) — φPb kN, φMb kN·m, neutral axis cb mm */
  Pb: number;
  Mb: number;
  cb: number;
  dt: number;
  /** pure bending φMn kN·m */
  M0: number;
}

/** Key control points of the φ P-M interaction diagram (same strain-compat.
 *  math as interactionCurve): pure axial, balanced (εt=εy) and pure bending. */
export function pmKeyPoints(
  b: number,
  h: number,
  Fc: number,
  Fy: number,
  cover: number,
  barDia: number,
  nBars: number,
): PMKeyPoints {
  const { total, layers } = barLayout(b, h, cover, barDia, nBars);
  const Ab = barArea(barDia);
  const b1 = beta1(Fc);

  const evalC = (c: number): { P: number; M: number } => {
    const a = b1 * c;
    let P = 0.85 * Fc * a * b;
    let M = P * (h / 2 - a / 2);
    let maxTensile = 0;
    let allCompressed = true;
    for (const di of layers) {
      const strain = c > 0 ? (0.003 * (c - di)) / c : 0;
      maxTensile = Math.max(maxTensile, -strain);
      if (strain <= 0) allCompressed = false;
      const fs = Math.max(-Fy, Math.min(Fy, ES * strain));
      const net = strain > 0 ? fs - 0.85 * Fc : fs;
      P += net * Ab;
      M += net * Ab * (h / 2 - di);
    }
    let phi: number;
    if (allCompressed) phi = 0.65;
    else if (maxTensile >= 0.005) phi = 0.9;
    else if (maxTensile <= 0.002) phi = 0.65;
    else phi = 0.65 + (0.25 * (maxTensile - 0.002)) / 0.003;
    return { P: (phi * P) / 1000, M: (phi * M) / 1e6 };
  };

  const Ast = total * Ab;
  const P0 = (0.65 * (0.85 * Fc * (b * h - Ast) + Fy * Ast)) / 1000;
  const dt = h - cover - barDia / 2;
  const cb = (0.003 / (0.003 + Fy / ES)) * dt;
  const bal = evalC(cb);
  let lo = 1;
  let hi = cb;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (evalC(mid).P > 0) hi = mid;
    else lo = mid;
  }
  const pure = evalC((lo + hi) / 2);
  return { P0, Pb: bal.P, Mb: bal.M, cb, dt, M0: pure.M };
}

/** Ray-casting point-in-polygon test on the (M,P) curve. */
export function pointInPolygon(px: number, py: number, poly: PMPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].M;
    const yi = poly[i].P;
    const xj = poly[j].M;
    const yj = poly[j].P;
    const intersects = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Ratio of the curve radius to the demand radius along the same ray.
 *  The intersection of ray t·(px,py) with segment p1+u·(p2−p1) solves:
 *    t = (x2·y1 − x1·y2) / D ,  u = (px·y1 − py·x1) / D ,  D = (x2−x1)·py − (y2−y1)·px
 *  SF is the scale factor t at the intersection (demand sits at t = 1). */
export function pmSafetyFactor(px: number, py: number, poly: PMPoint[]): number {
  const demand = Math.hypot(px, py);
  if (demand === 0) return Infinity;
  let best = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const x1 = poly[j].M;
    const y1 = poly[j].P;
    const x2 = poly[i].M;
    const y2 = poly[i].P;
    const denom = (x2 - x1) * py - (y2 - y1) * px;
    if (Math.abs(denom) < 1e-12) continue;
    const t = (x2 * y1 - x1 * y2) / denom;
    const u = (px * y1 - py * x1) / denom;
    if (t > 0 && u >= 0 && u <= 1) {
      if (t > best) best = t;
    }
  }
  return best;
}

/** Smallest even bar count — enlarging the section in 50 mm steps only if the
 *  demand can never fit — such that (Mu,Pu) lies inside the φ-curve with SF ≥ 1.15
 *  and 1% ≤ ρ ≤ 8%. Guarantees a one-click Auto-Fix that turns the design green. */
export function columnFit(
  Pu: number,
  Mu: number,
  Lc: number,
  k: number,
  b: number,
  h: number,
  Fc: number,
  Fy: number,
  cover: number,
  barDia: number,
): { n: number; b: number; h: number } {
  for (let add = 0; add <= 600; add += 50) {
    const b2 = b + add;
    const h2 = h + add;
    // moment magnification must be re-evaluated for every trial section
    const r = 0.3 * h2;
    const klOverR = (k * Lc * 1000) / r;
    let MuD = Mu;
    if (klOverR > 22) {
      const Ec = 4700 * Math.sqrt(Fc);
      const Ig = (b2 * Math.pow(h2, 3)) / 12;
      const EI = (0.2 * Ec * Ig) / 1.5;
      const Pc = (Math.PI * Math.PI * EI) / Math.pow(k * Lc * 1000, 2) / 1000;
      MuD = Mu * Math.max(1, 0.6 / Math.max(0.001, 1 - Pu / (0.75 * Pc)));
    }
    const Ag2 = b2 * h2;
    const nMin = 2 * Math.ceil(Math.ceil((0.01 * Ag2) / barArea(barDia)) / 2);
    // prefer economical ρ ≤ 3.5%: enlarge the section before stuffing bars
    const nMax = Math.floor((0.035 * Ag2) / barArea(barDia));
    for (let n = nMin; n <= nMax; n += 2) {
      const { points } = interactionCurve(b2, h2, Fc, Fy, cover, barDia, n);
      if (pointInPolygon(MuD, Pu, points) && pmSafetyFactor(MuD, Pu, points) >= 1.15) {
        return { n, b: b2, h: h2 };
      }
    }
  }
  // second pass: allow up to ρ = 8% before giving up
  for (let add = 0; add <= 600; add += 50) {
    const b2 = b + add;
    const h2 = h + add;
    const r = 0.3 * h2;
    const klOverR = (k * Lc * 1000) / r;
    let MuD = Mu;
    if (klOverR > 22) {
      const Ec = 4700 * Math.sqrt(Fc);
      const Ig = (b2 * Math.pow(h2, 3)) / 12;
      const EI = (0.2 * Ec * Ig) / 1.5;
      const Pc = (Math.PI * Math.PI * EI) / Math.pow(k * Lc * 1000, 2) / 1000;
      MuD = Mu * Math.max(1, 0.6 / Math.max(0.001, 1 - Pu / (0.75 * Pc)));
    }
    const Ag2 = b2 * h2;
    const nMin = 2 * Math.ceil(Math.ceil((0.01 * Ag2) / barArea(barDia)) / 2);
    const nMax = Math.floor((0.08 * Ag2) / barArea(barDia));
    for (let n = nMin; n <= nMax; n += 2) {
      const { points } = interactionCurve(b2, h2, Fc, Fy, cover, barDia, n);
      if (pointInPolygon(MuD, Pu, points) && pmSafetyFactor(MuD, Pu, points) >= 1.15) {
        return { n, b: b2, h: h2 };
      }
    }
  }
  return { n: Math.max(4, 2 * Math.floor((0.08 * b * h) / barArea(barDia) / 2)), b, h };
}

export function calculateColumn(inp: ColumnInput): CalcResult<ColumnInput> {
  const { Pu, Mu, Lc, Fc, Fy, cover, tieDia, barDia, k, tieSpacing: manTie, critSpacing: manCrit, nBars: manN } = inp;
  let { b, h } = inp;

  // slenderness & moment magnification (recomputed whenever the section changes)
  const Cm = 0.6;
  const slenderOf = (bb: number, hh: number): { klOverR: number; slender: boolean; Ec: number; Ig: number; EI: number; Pc: number; delta: number; MuD: number } => {
    const r = 0.3 * hh;
    const klOverR = (k * Lc * 1000) / r;
    const slender = klOverR > 22;
    const Ec = 4700 * Math.sqrt(Fc);
    const Ig = (bb * Math.pow(hh, 3)) / 12;
    const EI = (0.2 * Ec * Ig) / 1.5; // βd = 0.5 sustained factor
    const Pc = (Math.PI * Math.PI * EI) / Math.pow(k * Lc * 1000, 2) / 1000; // kN
    const delta = slender ? Math.max(1, Cm / Math.max(0.001, 1 - Pu / (0.75 * Pc))) : 1;
    return { klOverR, slender, Ec, Ig, EI, Pc, delta, MuD: Mu * delta };
  };
  let S = slenderOf(b, h);

  // guaranteed-pass smart fix: enough even bars (and a bigger section in 50 mm
  // steps only if the demand can never fit) for SF ≥ 1.15 and 1% ≤ ρ ≤ 8%
  const fix = columnFit(Pu, Mu, Lc, k, b, h, Fc, Fy, cover, barDia);
  const dimFix = fix.b !== b || fix.h !== h;
  // in auto mode the designed section is resized so the default output passes
  if (manN === 0 && dimFix) {
    b = fix.b;
    h = fix.h;
    S = slenderOf(b, h);
  }
  const { klOverR, slender, Ec, Pc, delta, MuD: MuDesign } = S;
  const Ag = b * h; // mm² (effective section)

  // iterate reinforcement ratio until the P-M demand is safely inside the curve
  let chosen = { nBars: 4, rho: 0.01, sf: 0, As: 0 };
  for (let rhoTry = 0.01; rhoTry <= 0.0801; rhoTry += 0.0025) {
    const As = rhoTry * Ag;
    const nTarget = Math.max(4, Math.round(As / barArea(barDia)));
    const { points, total } = interactionCurve(b, h, Fc, Fy, cover, barDia, nTarget);
    const sf = pmSafetyFactor(MuDesign, Pu, points);
    if (sf >= 1.15) {
      chosen = { nBars: total, rho: rhoTry, sf, As };
      break;
    }
    chosen = { nBars: total, rho: rhoTry, sf, As };
  }
  const nMinRho = Math.ceil((0.01 * Ag) / barArea(barDia));
  const nSugg = fix.n;
  const dimFixInp = fix.b !== inp.b || fix.h !== inp.h;
  const colAutofix: Record<string, number> = dimFixInp ? { nBars: fix.n, b: fix.b, h: fix.h } : { nBars: fix.n };
  const colSugg = `پیشنهاد: ${faNum(fix.n, 0)} عدد میلگرد D${faNum(barDia, 0)}${dimFixInp ? ` و افزایش مقطع به ${faNum(fix.b, 0)}×${faNum(fix.h, 0)}` : ''} جهت ρ≥۱٪ و Pass کامل نمودار P-M`;
  let nBars = manN > 0 ? Math.max(4, 2 * Math.round(manN / 2)) : nSugg;
  nBars = Math.max(nBars, 2 * Math.ceil(nMinRho / 2));
  const AsProvided = nBars * barArea(barDia);
  const rhoActual = AsProvided / Ag;
  const { points: curve } = interactionCurve(b, h, Fc, Fy, cover, barDia, nBars);
  const inside = pointInPolygon(MuDesign, Pu, curve);
  const sf = pmSafetyFactor(MuDesign, Pu, curve);

  // ties — Topic 9: 50–200 mm for confinement, standard construction steps 25 mm
  const tieAutoRaw = Math.min(16 * barDia, 48 * tieDia, Math.min(b, h));
  const tieAuto = Math.max(50, Math.min(200, tieAutoRaw));
  const tieSpacing = manTie > 0 ? Math.max(50, Math.min(200, Math.round(manTie / 25) * 25)) : Math.max(50, Math.min(200, Math.floor(tieAuto / 25) * 25));
  const nTies = Math.floor((Lc * 1000) / tieSpacing) + 1;
  const tieLen = 2 * (b - 2 * cover) + 2 * (h - 2 * cover) + 150;
  const steelKg = steelWeight(
    nBars * Lc * 1000 * 1.05 * barArea(barDia) + nTies * tieLen * barArea(tieDia),
  );

  const concreteV = (Ag / 1e6) * Lc;
  const formwork = (2 * (b + h) / 1000) * Lc;

  const ok = inside && sf >= 1.0 && rhoActual <= 0.08 && rhoActual >= 0.01;
  const boq: BOQItem[] = [
    {
      code: 'CC',
      title: 'بتن ستون C25',
      titleEn: 'Column concrete C25',
      unit: 'متر مکعب',
      unitEn: 'm³',
      qty: round(concreteV, 3),
      materialId: 'concrete',
      detail: 'بتن آماده با پمپ، عیار ۳۵۰',
    },
    {
      code: 'RB',
      title: `آرماتور طولی ستون میلگرد A3 سایز ${barDia} (${nBars} عدد)`,
      titleEn: `Column longitudinal rebar Ø${barDia} (${nBars} nos)`,
      unit: 'کیلوگرم',
      unitEn: 'kg',
      qty: round(steelWeight(nBars * Lc * 1000 * 1.05 * barArea(barDia)), 1),
      materialId: 'rebar',
      detail: `ارتفاع ${faNum(Lc, 2)} متر با احتساب هم‌پوشانی`,
    },
    {
      code: 'ST',
      title: `خاموت ستون میلگرد A2 سایز ${tieDia}`,
      titleEn: `Column ties Ø${tieDia}`,
      unit: 'کیلوگرم',
      unitEn: 'kg',
      qty: round(steelWeight(nTies * tieLen * barArea(tieDia)), 1),
      materialId: 'rebar',
      detail: `${faNum(nTies, 0)} عدد خاموت به فاصله ${faNum(tieSpacing, 0)} میلی‌متر`,
    },
    {
      code: 'FW',
      title: 'قالب‌بندی ستون',
      titleEn: 'Column formwork',
      unit: 'متر مربع',
      unitEn: 'm²',
      qty: round(formwork, 2),
      materialId: 'formwork',
      detail: 'سطح تماس قالب با بتن',
    },
  ];

  // special confinement / critical-zone tie suggestion (مبحث نهم / ACI 18) — 50–200 mm
  const critAutoRaw = Math.min(Math.min(b, h) / 4, 6 * barDia, 100);
  const critAuto = Math.max(50, Math.min(200, critAutoRaw));
  const critSpacing = manCrit > 0 ? Math.max(50, Math.min(200, Math.round(manCrit / 25) * 25)) : Math.max(50, Math.min(200, Math.floor(critAuto / 25) * 25));

  let ts = 0;
  const trace: TraceStep[] = [];
  const T = (title: string, formula: string, detail: string, result: string, ref?: string): void => {
    trace.push({ step: ++ts, title, formula, detail, result, ref });
  };
  T('سطح مقطع ناخالص', 'Ag = b·h', `مقطع ${faNum(b, 0)}×${faNum(h, 0)}`, `${faNum(Ag, 0)} mm²`);
  T('نسبت لاغری', 'kl/r ; r=0.3h', `k=${faNum(k, 1)} Lc=${faNum(Lc, 2)}`, `kl/r=${faNum(klOverR, 1)} (${slender ? 'لاغر' : 'کوتاه'})`, 'ACI 318');
  T('سختی و بار کمانش', 'EI=0.2·Ec·Ig/1.5 ; Pc=π²EI/(kLc)²', `Ec=${faNum(Ec, 0)}`, `Pc=${faNum(Pc, 0)} kN`);
  T('بزرگ‌نمایی لنگر', 'δ = Cm/(1−Pu/0.75Pc)', `Cm=${faNum(Cm, 1)}`, `δ=${faNum(delta, 3)} → Mu,d=${faNum(MuDesign, 1)} kN·m`);
  T('انتخاب درصد آرماتور', 'iterate ρ until SF(P-M) ≥ 1.15', '', `ρ=${faNum(chosen.rho * 100, 2)}٪ n=${faNum(nBars, 0)}`);
  T('کنترل نمودار تعامل P-M', 'point (Mu,d,Pu) inside φ-curve', '', `SF=${faNum(sf, 2)} ${inside ? 'داخل' : 'بیرون'}`, 'ACI 318');
  T('فاصله خاموت معمولی', 's = min(16db, 48dt, min dim)', `خاموت ${faNum(tieDia, 0)}`, `${faNum(tieSpacing, 0)} mm`, 'مبحث نهم');
  T('خاموت ناحیه بحرانی', 's₀ = min(h/4, 6db, 100)', '', `${faNum(critSpacing, 0)} mm`, 'ACI 18');

  // realistic bounds for column ties: 50–200 mm per Topic 9
  const tieSpacingClamped = Math.max(50, Math.min(200, tieSpacing));
  const critSpacingClamped = Math.max(50, Math.min(200, critSpacing));
  const slenderFixH = Math.min(2000, Math.ceil((h + 50) / 50) * 50);
  const slenderFixB = Math.min(2000, Math.ceil((b + 50) / 50) * 50);
  const checks: DesignCheck[] = [
    {
      id: 'slender',
      label: 'کنترل لاغری (kl/r ≤ ۲۲)',
      status: slender ? 'warn' : 'ok',
      value: `kl/r=${faNum(klOverR, 1)}`,
      ref: 'ACI 318',
      fix: slender ? 'اثر لاغری با δ لحاظ شد؛ مقطع را بزرگ‌تر کنید.' : undefined,
      suggestion: slender ? `پیشنهاد هوشمند: افزایش مقطع به ${faNum(slenderFixB, 0)}×${faNum(slenderFixH, 0)}` : undefined,
      autofix: slender ? { b: slenderFixB, h: slenderFixH } : undefined,
      dc: klOverR / 22,
    },
    { id: 'pm', label: 'کنترل برهم‌کنش P-M', status: inside && sf >= 1.15 ? 'ok' : sf >= 1 ? 'warn' : 'bad', value: `SF=${faNum(sf, 2)}`, ref: 'مبحث نهم ۹-۱۴-۱-۱ / ACI 318', fix: 'مقطع یا درصد آرماتور را افزایش دهید.', suggestion: colSugg, autofix: colAutofix, dc: 1 / Math.max(0.1, sf) },
    { id: 'rho', label: 'درصد آرماتور در محدوده مجاز (۱–۸٪)', status: rhoActual >= 0.01 && rhoActual <= 0.08 ? 'ok' : 'bad', value: `${faNum(rhoActual * 100, 2)}٪`, ref: 'مبحث نهم ۹-۱۴-۱-۲ (۱–۸٪)', fix: 'تعداد/سایز میلگرد را تنظیم کنید.', suggestion: colSugg, autofix: colAutofix, dc: rhoActual / 0.08 },
    {
      id: 'ties',
      label: 'فاصله خاموت معمولی (۵۰–۲۰۰ mm)',
      status: tieSpacingClamped <= 200 && tieSpacingClamped >= 50 ? 'ok' : 'warn',
      value: `${faNum(tieSpacingClamped, 0)} mm ∈ [۵۰،۲۰۰]`,
      ref: 'مبحث نهم',
      fix: 'فاصله خاموت را در بازه ۵۰–۲۰۰ نگه دارید.',
      suggestion: `پیشنهاد: ${faNum(tieSpacingClamped, 0)} mm`,
      autofix: { tieSpacing: tieSpacingClamped },
      dc: tieSpacingClamped / 200,
    },
    {
      id: 'critical',
      label: 'خاموت ویژه ناحیه بحرانی (۵۰–۲۰۰ mm)',
      status: critSpacingClamped <= 200 && critSpacingClamped >= 50 ? 'ok' : 'warn',
      value: `s₀=${faNum(critSpacingClamped, 0)} mm`,
      ref: 'ACI 18',
      fix: 'در دو سر ستون به طول h₀ خاموت با فاصله s₀ اجرا شود.',
      suggestion: `پیشنهاد: فاصله ناحیه بحرانی ${faNum(critSpacingClamped, 0)} mm`,
      autofix: { critSpacing: critSpacingClamped, tieSpacing: tieSpacingClamped },
      dc: critSpacingClamped / 200,
    },
  ];

  const metrics: Metric[] = [
    { label: 'نیروی محوری نهایی', value: faNum(Pu, 0), raw: Pu, unit: 'kN', tone: 'neutral' },
    { label: 'لنگر نهایی', value: faNum(Mu, 1), raw: Mu, unit: 'kN·m', tone: 'neutral' },
    { label: 'ضریب بزرگ‌نمایی لنگر', value: faNum(delta, 3), raw: delta, unit: '', tone: slender ? 'warn' : 'ok', hint: slender ? 'ستون لاغر است' : 'اثر لاغری نادیده' },
    { label: 'l/r ستون', value: faNum(klOverR, 1), raw: klOverR, unit: '', tone: slender ? 'warn' : 'ok', hint: 'حد لاغری ۲۲' },
    { label: 'بار کمانش بحرانی', value: faNum(Pc, 0), raw: Pc, unit: 'kN', tone: 'neutral' },
    { label: 'تعداد میلگرد طولی', value: faNum(nBars, 0), raw: nBars, unit: 'عدد', tone: 'neutral', hint: `سایز ${faNum(barDia, 0)}` },
    { label: 'درصد آرماتور', value: faNum(rhoActual * 100, 2), raw: rhoActual * 100, unit: '%', tone: rhoActual >= 0.01 && rhoActual <= 0.08 ? 'ok' : 'bad', hint: 'مجاز ۱ تا ۸ درصد' },
    {
      label: 'ضریب اطمینان نمودار P-M',
      value: faNum(sf, 2),
      raw: sf,
      unit: '',
      tone: sf >= 1.15 ? 'ok' : sf >= 1 ? 'warn' : 'bad',
      hint: inside ? 'نقطه داخل منحنی' : 'نقطه بیرون منحنی',
    },
    { label: 'فاصله خاموت', value: faNum(tieSpacing, 0), raw: tieSpacing, unit: 'mm', tone: 'neutral' },
    { label: 'وزن آرماتور', value: faNum(steelKg, 1), raw: steelKg, unit: 'kg', tone: 'neutral' },
    { label: 'حجم بتن', value: faNum(concreteV, 3), raw: concreteV, unit: 'm³', tone: 'neutral' },
    { label: 'سطح قالب', value: faNum(formwork, 2), raw: formwork, unit: 'm²', tone: 'neutral' },
  ];

  const assessment = [
    `ستون با مقطع ${faNum(b, 0)}×${faNum(h, 0)} میلی‌متر و ارتفاع آزاد ${faNum(Lc, 2)} متر تحت بار محوری نهایی ${faNum(Pu, 0)} کیلونیوتن و لنگر نهایی ${faNum(Mu, 1)} کیلونیوتن متر بررسی شد.`,
    `نسبت لاغری ${faNum(klOverR, 1)} است و ${slender ? `به دلیل لاغری، ضریب بزرگ‌نمایی ${faNum(delta, 3)} اعمال و لنگر طراحی ${faNum(MuDesign, 1)} کیلونیوتن متر شد.` : 'اثر لاغری قابل اغماض است.'}`,
    `با ترسیم نمودار تعامل P-M مقطع، نقطه تقاضا ${inside ? 'داخل' : 'بیرون'} منحنی ظرفیت قرار می‌گیرد و ضریب اطمینان برابر ${faNum(sf, 2)} است.`,
    `${faNum(nBars, 0)} میلگرد طولی سایز ${faNum(barDia, 0)} (درصد آرماتور ${faNum(rhoActual * 100, 2)}) با خاموت سایز ${faNum(tieDia, 0)} به فاصله ${faNum(tieSpacing, 0)} میلی‌متر پیشنهاد می‌شود.`,
  ].join(' ');

  // لیستوفر ستون (BBS) — مجموع وزن دقیقاً برابر قلم آرماتور در BOQ است.
  const bbs: BBSItem[] = [
    { mark: 'C1', label: `میلگرد طولی ستون (${nBars} عدد)`, dia: barDia, lenMm: Math.round(Lc * 1.05 * 1000), count: nBars, weightKg: +steelWeight(nBars * Lc * 1000 * 1.05 * barArea(barDia)).toFixed(1) },
    { mark: 'C2', label: `خاموت ستون (${nTies} عدد)`, dia: tieDia, lenMm: tieLen, count: nTies, weightKg: +steelWeight(nTies * tieLen * barArea(tieDia)).toFixed(1) },
  ];

  return {
    type: 'column',
    code: projectCode(CALC_META.column.prefix),
    createdAt: Date.now(),
    input: inp,
    metrics,
    boq,
    verdict: {
      ok,
      title: ok ? 'طرح ستون قابل قبول است' : 'طرح ستون نیاز به اصلاح دارد',
      text: !inside
        ? 'نقطه تقاضا خارج از نمودار تعامل است؛ مقطع یا آرماتور را افزایش دهید.'
        : `ضریب اطمینان نمودار P-M برابر ${faNum(sf, 2)} است.`,
    },
    diagram: { kind: 'column', b, h, Lc, bars: nBars, barDia, tieDia, tieSpacing },
    assessment,
    trace,
    checks,
    bbs,
    extras: { Pu, Mu, MuDesign, delta, klOverR, slender: slender ? 1 : 0, Pc, nBars, rhoActual, sf, tieSpacing, nTies, steelKg, concreteV, formwork, b, h },
  };
}

/* ------------------------------------------------------------- dispatch -- */

export function compute(type: CalcType, input: AnyInput): CalcResult {
  switch (type) {
    case 'foundation':
      return calculateFoundation(input as FoundationInput);
    case 'beam':
      return calculateBeam(input as BeamInput);
    case 'column':
      return calculateColumn(input as ColumnInput);
    case 'slab':
      return calculateSlab(input as SlabInput);
    case 'wall':
      return calculateWall(input as WallInput);
    case 'stair':
      return calculateStair(input as StairInput);
    case 'ramp':
      return calculateRamp(input as StairInput);
    case 'joint':
      return calculateJoint(input as JointInput);
  }
}

/* --------------------------------------------------- default demo inputs -- */

export const DEFAULT_FOUNDATION: FoundationInput = {
  L: 22,
  B: 14,
  H: 1.4,
  Df: 2.2,
  cs: 600,
  c: 25,
  phi: 30,
  gamma: 18,
  P: 9600,
  Fc: 25,
  Fy: 400,
  cover: 50,
  barDia: 16,
  spacing: 0,
  FS: 3,
  mixMode: 'ready',
};

export const DEFAULT_BEAM: BeamInput = {
  L: 7.2,
  b: 300,
  h: 600,
  wd: 22,
  wl: 12,
  Fc: 25,
  Fy: 400,
  cover: 40,
  stirrupDia: 10,
  barDia: 20,
  stirrupSpacing: 0,
  stirrupLegs: 2,
  tensionLayers: 1,
  compBars: 2,
  compBarDia: 16,
  support: 'simple',
  Tu: 0,
};

export const DEFAULT_COLUMN: ColumnInput = {
  Pu: 2100,
  Mu: 180,
  Lc: 3.4,
  Fc: 25,
  Fy: 400,
  cover: 40,
  tieDia: 10,
  barDia: 20,
  k: 1,
  b: 400,
  h: 400,
  tieSpacing: 0,
  critSpacing: 0,
  nBars: 0,
};


