# CivilGenius

> **CivilGenius is an engineering-focused portfolio prototype** — a single-page, RTL Persian web application for conceptual structural design of 8 concrete elements, with deterministic calculation traces, bar-bending schedules, quantity take-off and multi-format document delivery.

**It is NOT:**

- ❌ certified or code-approved engineering software,
- ❌ a substitute for a licensed (مهرشده) structural engineer,
- ❌ a claim of complete Iranian national-code compliance.

All outputs are **estimate-level engineering documents** intended for study, comparison and portfolio demonstration. Final design decisions and code compliance remain the sole responsibility of a licensed engineer.

---

## What it does

| # | Module | Scope (simplified models) |
|---|---|---|
| 1 | Foundation (فونداسیون) | Terzaghi bearing capacity, allowable stress, one-way shear, two-way rebar mat design |
| 2 | Beam (تیر) | 1.2D+1.6L ultimate moment/shear, rebar ratio, stirrup design, deflection control, BMD/SFD |
| 3 | Column (ستون) | P-M interaction diagram (point-in-polygon demand check), slenderness & moment magnification, ties + longitudinal rebar |
| 4 | Slab (سقف) | Joist-and-block, waffle, solid & hollow slabs — tension/negative/temperature steel, tie beams, deflection |
| 5 | Shear wall (دیوار برشی) | Horizontal/vertical steel, boundary elements with constraining pins, shear-friction, drift |
| 6 | Stair (راه‌پله) | Minimum thickness for deflection, longitudinal/transverse rebar, 90° anchorage hooks |
| 7 | Ramp (رمپ) | Sloped slab, minimum thickness, rebar layout |
| 8 | Joint panel (چشمه اتصال) | Joint shear capacity φVn ≥ Vu, confining hoop rows/spacing |

**Workflow per module:** enter realistic inputs (fields stay in sync with sliders) → **Calculate & issue documents** → verdict banner (acceptable / needs revision) → normative design checks with demand/capacity (D/C) bars → step-by-step **calculation book** (دفترچه محاسبات) → **BBS** (bar bending schedule) → **BOQ** priced with market data → delivery center (Word / Excel / DXF).

A one-click **smart optimizer** proposes code-aligned fixes for failing checks (rebar diameter/spacing, thickness, confinement) and re-verifies to all-green.

## Portfolio demo (≈3 clicks to a full result)

1. Dashboard → **«پروژه نمونه ارائه»** — loads a credible 5-story residential sample (`ساختمان مسکونی ۵ طبقه`) into **all 8 modules** with per-element quantity multipliers.
2. Open any module card → **«بارگذاری پروژه نمونه سازمانی»** (already loaded by step 1) → **«محاسبه و صدور اسناد»**.
3. Inspect the verdict, checks, calculation trace, BBS/BOQ and export Word/Excel/DXF from the delivery center.

The sample is deterministic and physically plausible; several modules intentionally surface WARN/FAIL paths so reviewers can see the check/fix loop working.

## Technology stack

- **React 19 + TypeScript** (strict), hash routing — zero backend, runs fully client-side
- **Tailwind CSS v4** design tokens, Vazirmatn + Space Grotesk typography (RTL-first)
- **Vite 7** + `vite-plugin-singlefile` → the production build is a single portable `dist/index.html`
- **docx** (real `.docx`), **xlsx-js-style** (styled workbooks), **KaTeX** (formula rendering), **lucide-react** icons, hand-rolled SVG charts/sketches
- Verification suite in `scripts/` (see below)

## Pricing & provenance concept

Material prices carry an explicit **source status** — never implied to be real-time:

| Status | Meaning |
|---|---|
| به‌روز (live) | latest successful query from the declared public source (ahanonline.com) during this session |
| مبنای معتبر (reference) | last declared public rate for the source — offline-safe |
| ورود دستی (manual) | no public rate; user-entered estimate |

Every generated document embeds provenance: document code, generation date, price-source table and an explicit data-honesty paragraph. Quantities and prices are **estimate-level** budget figures, not tender documents.

## Engineering scope & known limitations (read before judging results)

- **Gravity-oriented scope.** Seismic and wind are **not implemented as full analysis engines**; the advisor can answer code questions about them, but no lateral analysis is performed. Demand values (P, M, V) are user-supplied.
- **Foundations:** geotechnical scope is limited to Terzaghi bearing-capacity relations and simplified checks — no settlement modelling, no deep foundations.
- **Shear walls:** simplified sectional model (boundary elements, shear-friction, drift ratio check) — not a full wall analysis element.
- **Slabs:** coefficient/simplified models per slab system — not finite-element analysis.
- **Stairs/ramps:** minimum-thickness + rebar layout models; no dynamic/vibration checks.
- **Joint panels:** shear-capacity and confinement check only.
- **Code references** (مبحث ششم/هفتم/نهم، آیین‌نامه ۲۸۰۰، ACI 318) are manually curated in-app; clause numbers are presented with an integrity label — exact clause/table alignment with the printed editions requires verification.
- **Market prices** depend on a third-party fetch chain and can be stale or unavailable; the source-status labels above are authoritative.
- **Outputs are estimates.** BBS/BOQ/pricing support comparison and budgeting, not procurement or construction.

## Run it

Requires **Node.js ≥ 20.19** (tested on 22.x) and npm.

```bash
npm install        # installs dependencies from package-lock.json
npm run dev        # development server → http://localhost:5173
npm run build      # production single-file build → dist/index.html
npm run preview    # serve the production build
```

Optional runtime network: Vazirmatn/Space Grotesk font CDNs (system-font fallback offline), market-price queries, and a user-supplied Groq API key for the advisor's live-LLM mode (the offline RAG knowledge base works without it).

## Verification suite

| Script | Purpose |
|---|---|
| `npm run typecheck` | strict TypeScript gate |
| `npm run smoke` | renders every real page/component |
| `scripts/identity-8x8.ts` | 8/8 cross-surface identity (metrics ↔ trace ↔ BBS ↔ drawings) for all modules |
| `scripts/smart-stress.ts` | 24-profile optimizer stress matrix |
| `scripts/round33-check.ts`, `scripts/verify-round26.ts` | historical regression gates (flexure/spacing semantics, one-click auto-fix) |
| `scripts/gen-xlsx-check.ts`, `scripts/xlsx-bbs.tsx` | styled Excel + BBS workbook generation |
| `scripts/dxf-audit.tsx` | DXF sheet-layout engine audit |
| `scripts/katex-check.tsx`, `scripts/advisor-check.tsx`, `scripts/dispatch-check.tsx` | formula rendering, advisor, document dispatch |

Known harness-only limitation: `scripts/e2e-mount.tsx` fails on Node ≥ 21 due to a jsdom/Node `navigator` getter incompatibility — a harness issue, not a product defect.

## Project status

| Phase | Status |
|---|---|
| Phase 10C engineering gates | PASS |
| Phase 11B / 11C engineering gates | PASS |
| Phase 12 UI/UX + Visual Polish Wave B | restored & verified (this tree) |
| Phase 13 release packaging | this commit |

Application version: **v24** — single source of truth in [`src/lib/version.ts`](src/lib/version.ts).

## Repository map

```
src/lib/        engine.ts · modules.ts (8 calculators) · smartOptimizer.ts · market.ts
                livePrices.ts · exporters.ts (Word/Excel/DXF) · dxf.ts · projects.ts · store.ts
src/pages/      Dashboard · Foundation · Beam · Column · Slab · Wall · Stair · Ramp · Joint
                Market · Management (اتاق فرمان) · ReportHub · Advisor
src/components/ ModuleShell · CalcBook · Bbs · BOQ · Sketches · charts · ui primitives
scripts/        verification & regression gates
```

## License

**Not yet specified.** This repository currently has no open-source license; all rights are reserved by the repository owner pending a licensing decision. Contact the owner before reuse.

---

*CivilGenius — built as a professional engineering portfolio prototype. Results shown in demos are deterministic sample calculations, not certified design documents.*
