
/* ============================================================================
 * CivilGenius v25 — مرجع‌شناسی آیین‌نامه‌ای (Code Reference Registry)
 * ----------------------------------------------------------------------------
 * Single source of truth for the Persian code citations attached to every
 * design parameter / formula in the engine. Each entry carries:
 *   - ref    : Persian clause/table reference as displayed in the CalcBook
 *   - note   : what the rule does
 *   - status : 'verified' (chapter-level anchor certain) | 'manual' (exact
 *              clause/table number requires a physical code-book check)
 *
 * IMPORTANT (صداقت مرجع): the chapter-level anchors (مبحث ششم/هفتم/نهم مقررات
 * ملی ساختمان, آیین‌نامه ۲۸۰۰, ACI 318) are certain. Exact numeric sub-clause
 * and table numbers for the ۱۳۹۹/۱۴۰۰ revisions are reproduced as best-effort
 * from the code structure; wherever the exact number could not be confirmed
 * against the printed code book, the entry is flagged:
 *   "REFERENCE REQUIRES MANUAL CODE-BOOK VERIFICATION"
 * ========================================================================== */

export interface CodeRef {
  key: string;
  parameter: string;
  ref: string;
  note: string;
  status: 'verified' | 'manual';
}

export const MANUAL = 'REFERENCE REQUIRES MANUAL CODE-BOOK VERIFICATION';

export const CODE_REFS: CodeRef[] = [
  // ---------- مبحث ششم (بارها) ----------
  { key: 'load-combo', parameter: 'ترکیب بار نهایی 1.2D + 1.6L', ref: 'مبحث ششم مقررات ملی ساختمان — ترکیبات بار (ویرایش ۱۳۹۸)', note: 'ترکیب بار پایه برای اعضای بتنی بدون زلزله', status: 'verified' },
  { key: 'live-load', parameter: 'بار زنده مسکونی/اداری/تجاری', ref: 'مبحث ششم — جدول بارهای زنده (جدول ۶-۵-۱ ویرایش ۱۳۹۸)', note: 'مقادیر بار زنده بر حسب کاربری', status: 'manual' },

  // ---------- مبحث هفتم (پی) ----------
  { key: 'terzaghi', parameter: 'ظرفیت باربری نهایی qult (ترزاگی)', ref: 'مبحث هفتم مقررات ملی ساختمان — ظرفیت باربری (ویرایش ۱۴۰۰)', note: 'رابطه ترزاگی با ضرایب شکل مستطیلی', status: 'verified' },
  { key: 'bearing-fs', parameter: 'ضریب اطمینان ظرفیت باربری FS=3', ref: 'مبحث هفتم — ضریب اطمینان مجاز تنش خاک', note: 'FS=3 برای حالت استاتیکی', status: 'manual' },

  // ---------- مبحث نهم (بتن آرمه) ----------
  { key: 'flex-phi', parameter: 'ضریب کاهش مقاومت خمشی φ=0.9', ref: 'مبحث نهم بند ۹-۱۴-۲-۲ (ویرایش ۱۳۹۹) / ACI 21.2.2', note: 'مقاطع کشش‌محور', status: 'manual' },
  { key: 'shear-vc', parameter: 'ظرفیت برش بتن Vc=0.17√fc·b·d', ref: 'مبحث نهم بند ۹-۱۵-۲-۱ (ویرایش ۱۳۹۹) / ACI 22.5.5.1', note: 'برش بتن بدون محاسبه دقیق‌تر', status: 'manual' },
  { key: 'shear-vs', parameter: 'خاموت برشی Vs = Av·fy·d/s', ref: 'مبحث نهم بند ۹-۱۵-۲-۲ (ویرایش ۱۳۹۹) / ACI 22.5.10', note: 'مقاومت برشی آرماتور عرضی', status: 'manual' },
  { key: 'asmin-beam', parameter: 'حداقل آرماتور خمشی تیر max(0.25√fc/fy, 1.4/fy)·b·d', ref: 'مبحث نهم بند ۹-۱۴-۲-۱-۱ (ویرایش ۱۳۹۹) / ACI 9.6.1.2', note: 'حداقل آرماتور کششی مقاطع خمشی', status: 'manual' },
  { key: 'rho-max', parameter: 'حداکثر نسبت آرماتور 0.75·ρb', ref: 'مبحث نهم بند ۹-۱۴-۲-۱-۲ (ویرایش ۱۳۹۹) / ACI 21.2.2', note: 'حد تنش کششی کنترل‌شده', status: 'manual' },
  { key: 'bar-clear-spacing', parameter: 'فاصله آزاد میلگردها max(db, 25mm)', ref: 'مبحث نهم بند ۹-۱۴-۲-۱-۳ (ویرایش ۱۳۹۹) / ACI 25.2.1', note: 'فاصله آزاد بین میلگردهای موازی', status: 'manual' },
  { key: 'stirrup-spacing-max', parameter: 'حداکثر فاصله خاموت min(d/2, 300mm)', ref: 'مبحث نهم بند ۹-۱۵-۲-۳ (ویرایش ۱۳۹۹) / ACI 9.7.6.2', note: 'حداکثر گام خاموت', status: 'manual' },
  { key: 'stirrup-min', parameter: 'حداقل خاموت Av,min', ref: 'مبحث نهم بند ۹-۱۵-۲-۴ (ویرایش ۱۳۹۹) / ACI 9.6.3.3', note: 'حداقل آرماتور عرضی', status: 'manual' },
  { key: 'deflection-limit', parameter: 'حد خیز L/240', ref: 'مبحث نهم بند ۹-۲۱-۲ (ویرایش ۱۳۹۹)', note: 'خیز مجاز اعضای با دیوارهای شکننده', status: 'manual' },
  { key: 'ductility', parameter: 'ضابطه شکل‌پذیری c/dt ≤ 0.375', ref: 'مبحث نهم بند ۹-۱۴-۲-۳ (ویرایش ۱۳۹۹) / ACI 21.2.2', note: 'کرنش خالص کششی', status: 'manual' },
  { key: 'slab-asmin-temp', parameter: 'آرماتور حرارتی دال 0.0018·b·h', ref: 'مبحث نهم بند ۹-۱۴-۲-۱ (ویرایش ۱۳۹۹) / ACI 24.4.3.2', note: 'آرماتور جمع‌شدگی و حرارت', status: 'verified' },
  { key: 'slab-hmin', parameter: 'حداقل ضخامت دال یک‌طرفه L/20', ref: 'مبحث نهم بند ۹-۲۱-۳ (ویرایش ۱۳۹۹) / ACI جدول 7.3.1.1', note: 'ضخامت حداقل دال برای کنترل خیز', status: 'manual' },
  { key: 'column-rho-range', parameter: 'درصد آرماتور ستون 1%–8%', ref: 'مبحث نهم بند ۹-۱۴-۱-۲ (ویرایش ۱۳۹۹) / ACI 10.6.1.1', note: 'حداقل و حداکثر آرماتور طولی ستون', status: 'manual' },
  { key: 'column-ties', parameter: 'فاصله خاموت ستون min(16db, 48dt, min dim)', ref: 'مبحث نهم بند ۹-۱۴-۱-۳ (ویرایش ۱۳۹۹) / ACI 25.7.2.1', note: 'گام خاموت ستون خاموت‌دار', status: 'manual' },
  { key: 'column-critical-zone', parameter: 'خاموت ناحیه بحرانی min(h/4, 6db, 100)', ref: 'مبحث نهم بند ۹-۱۴-۱-۴ (ویرایش ۱۳۹۹) / ACI 18.7.5', note: 'محصورشدگی ناحیه بحرانی لرزه‌ای', status: 'manual' },
  { key: 'slenderness', parameter: 'حد لاغری kl/r ≤ 22 و بزرگ‌نمایی لنگر', ref: 'مبحث نهم بند ۹-۱۴-۱-۱ (ویرایش ۱۳۹۹) / ACI 6.6.4', note: 'اثر لاغری ستون', status: 'manual' },
  { key: 'dev-length', parameter: 'طول توسعه Ld = (fy·ψt·ψe·ψs/(1.7·λ·√fc))·db', ref: 'مبحث نهم بند ۹-۱۸-۲ (ویرایش ۱۳۹۹) / ACI 25.4.2.3', note: 'طول مهاری میلگرد آجدار در کشش (حداقل 300mm)', status: 'manual' },
  { key: 'torsion-threshold', parameter: 'آستانه پیچش φ·Tcr/4', ref: 'مبحث نهم بند ۹-۱۵-۸-۲ (ویرایش ۱۳۹۹) / ACI 22.7.4.2', note: 'زیر آستانه از طراحی پیچشی صرف‌نظر می‌شود', status: 'manual' },
  { key: 'torsion-interaction', parameter: 'تعامل برش + پیچش √((Vu/bwd)²+(Tu·ph/1.7Aoh²)²) ≤ φ(…)', ref: 'مبحث نهم بند ۹-۱۵-۸-۵ (ویرایش ۱۳۹۹) / ACI 22.7.7.1', note: 'کنترل همزمان برش و پیچش', status: 'manual' },
  { key: 'torsion-rebar', parameter: 'خاموت بسته At/s و میلگرد طولی Al', ref: 'مبحث نهم بند ۹-۱۵-۸-۶ (ویرایش ۱۳۹۹) / ACI 22.7.6.1', note: 'آرماتور پیچشی عرضی و طولی (θ=45°)', status: 'manual' },
  { key: 'torsion-min', parameter: 'حداقل آرماتور پیچشی 0.175·bw/fyt و 0.42√fc·Acp/fy', ref: 'مبحث نهم بند ۹-۱۵-۸-۷ (ویرایش ۱۳۹۹) / ACI 22.7.6.2', note: 'حداقل آرماتور پیچشی', status: 'manual' },
  { key: 'wall-shear', parameter: 'ظرفیت برش دیوار Vn=Acv(0.17√fc+ρh·fy)', ref: 'مبحث نهم بند ۹-۱۴-۳ (ویرایش ۱۳۹۹) / ACI 18.10.4', note: 'برش دیوار برشی', status: 'manual' },
  { key: 'wall-boundary', parameter: 'المان مرزی σ > 0.2fc', ref: 'مبحث نهم بند ۹-۱۴-۳-۳ (ویرایش ۱۳۹۹) / ACI 18.10.6', note: 'نیاز المان مرزی محصورشده', status: 'manual' },
  { key: 'joint-shear', parameter: 'ظرفیت برش چشمه γ·√fc·Aj', ref: 'مبحث نهم بند ۹-۱۴-۵ (ویرایش ۱۳۹۹) / ACI 18.8', note: 'برش چشمه اتصال تیر-ستون', status: 'manual' },
  { key: 'foundation-asmin', parameter: 'حداقل آرماتور فونداسیون 0.0018·b·d', ref: 'مبحث نهم بند ۹-۱۴-۲-۱ (ویرایش ۱۳۹۹) / ACI 7.6.1.1', note: 'حداقل آرماتور گسترده فونداسیون', status: 'manual' },
  { key: 'foundation-spacing', parameter: 'فاصله شبکه فونداسیون [120, 300] mm', ref: 'مبحث نهم بند ۹-۱۴-۲-۴ (ویرایش ۱۳۹۹)', note: 'محدوده مجاز گام میلگرد فونداسیون', status: 'manual' },
  { key: 'cover-soil', parameter: 'پوشش بتنی روی خاک 75mm', ref: 'مبحث نهم جدول ۹-۳-۱ (ویرایش ۱۳۹۹) / ACI جدول 20.5.1.3.1', note: 'پوشش بتن در تماس با خاک', status: 'manual' },
  { key: 'cover-beam', parameter: 'پوشش تیر در معرض هوا 40mm', ref: 'مبحث نهم جدول ۹-۳-۱ (ویرایش ۱۳۹۹) / ACI 20.5.1.3', note: 'پوشش خاموت و میلگرد تیر', status: 'manual' },
  { key: 'stair-geometry', parameter: 'هندسه پله (قامه/کف) ~ 170–180mm', ref: 'مبحث سوم مقررات ملی — پله‌ها (ویرایش ۱۳۹۸)', note: 'ارگونومی پله', status: 'verified' },
  { key: 'drift', parameter: 'دریفت مجاز 2% ارتفاع طبقه', ref: 'آیین‌نامه ۲۸۰۰ (ویرایش ۴) — بند ۳-۵', note: 'حد جابه‌جایی نسبی طبقات', status: 'manual' },
  { key: 'seismic-hoops', parameter: 'خاموت بسته ۱۳۵° ناحیه بحرانی min(d/4, 8db, 24dt, 300)', ref: 'مبحث نهم بند ۹-۱۴-۴ (ویرایش ۱۳۹۹) / ACI 18.6.4', note: 'جزئیات لرزه‌ای تیر', status: 'manual' },
];

export function codeRef(key: string): CodeRef | undefined {
  return CODE_REFS.find((c) => c.key === key);
}

export function unresolvedRefs(): CodeRef[] {
  return CODE_REFS.filter((c) => c.status === 'manual');
}
