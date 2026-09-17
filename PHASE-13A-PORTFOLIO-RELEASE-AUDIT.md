# PHASE 13A — PORTFOLIO / DEMO / RELEASE AUDIT

**Project:** CivilGenius · **Repo:** `amirwf3-pixel/civilgeniuss` · **Branch:** `arena/01a0b04f-civilgeniuss`
**HEAD:** `0622db6` (“CivilGenius current baseline”, 2026-09-13) — unchanged by this audit
**Date:** 1405-06-27 (2026-09-18) · **Mode:** AUDIT ONLY — zero file modifications, zero git operations
**Checks executed in this audit:** 16 · passed 15 · failed 1 (known harness-only issue) · skipped 0

---

## 1. Executive Summary

The **engineering core of CivilGenius is release-credible**: all 8 modules compute deterministically, the full verification battery passes on this tree (typecheck, production build, smoke, 8/8 identity, 24/24 smart-stress, round-33, round-26, Excel/BBS, DXF, KaTeX, advisor, dispatch), the sample project covers all 8 modules with physically plausible data, and the 3-click demo path (sample → module → compute) produces a full result with دفترچه, BBS/BOQ and Word/Excel/DXF exports.

However, **the repository is NOT ready for public portfolio presentation**, for two structural reasons and a cluster of positioning/hygiene issues:

1. **⚠ CRITICAL INCIDENT (P13A-P0-02):** the working tree was re-cloned from GitHub between phases and **all Phase 12 implementation work (Wave 1 + Wave 2 + Visual Polish Wave B) is absent from this checkout and from the remote repository** — it was never committed, per the standing no-commit policy, and did not survive the environment reset. The stated project status (“Phase 12 UI/UX PASS, Wave B PASS”) does not match the files on disk or on GitHub. Concretely, the tree now contains the defects Phase 12 had fixed: Management room unreachable, shear-wall missing from mobile navigation (7/8), stale v22/v20 version strings, no single version source, pre-polish contrast tokens.
2. **No repository presentation layer exists:** no README, no .gitignore, no LICENSE; `node_modules` (10,074 files, Windows-only binaries) is committed; the dashboard positions the product as a **3-module** tool with **“قیمت لحظه‌ای”** (instant market price) claims — both materially misleading for an 8-module prototype whose live prices depend on a third-party fetch.

**Final verdict: NOT READY FOR RELEASE.** The blocking path is short and well-understood (see §15): restore & commit the Phase 12 work, add README/.gitignore/LICENSE, fix the four headline copy claims, un-orphan Management, and stop committing `node_modules`.

**Finding counts: P0 = 2 · P1 = 8 · P2 = 8 · P3 = 5.**

---

## 2. Repository / HEAD / Branch

| Item | Value |
|---|---|
| Remote | `https://github.com/amirwf3-pixel/civilgeniuss.git` (note: repo name double-s “civilgeniuss”) |
| Default branch | `main` |
| HEAD (main and audit branch) | `0622db635fdc99bffbd8bb8176d75820df814201` — the only commit (“CivilGenius current baseline”) |
| Audit branch | `arena/01a0b04f-civilgeniuss` — clean, 0 commits ahead |
| GitHub description / homepage | **empty / empty** |
| Tracked files | 10,148 total — **10,074 inside `node_modules/`**, 74 project files |
| Working tree at audit time | clean vs HEAD (0 tracked modifications) |

**Incident record:** this sandbox was re-materialized (fresh clone) between Phase 12 Wave B and this audit. All uncommitted Phase 12 changes (16 production files + `src/lib/version.ts` + `public/images/hero.jpg` + the four Phase-12 reports + `phase12-evidence/`) were lost. Evidence: reflog contains only `clone` + `checkout`; `git status` empty; probes for Phase-12 markers all negative (`emerald-deep` 0, `normalizeProject` 0, `isResultStale` 0, `version.ts` gone, `hero.jpg` gone, `index.html` back to v20).

---

## 3. Audit Scope

Audited exactly P13-01 … P13-14 as instructed: positioning, documentation, demo flow, showcase cases, engineering disclosure, module discoverability, output discoverability, repository presentation, release hygiene, reproducibility, screenshot readiness, version/provenance, stale content, release checklist. Methods: static inspection of every tracked project file, live DOM render probe of the real `<App/>` at HEAD (jsdom; no browser binary exists in this sandbox — see §14), execution of all runnable verification scripts, byte-level determinism comparison of exported artifacts, and GitHub remote inspection via `gh`.

Frozen engineering areas (§17) were treated strictly read-only. **No finding in this audit requires any frozen-area change**; the two frozen-adjacent observations (document-code randomness, exporter wording) are documented only.

---

## 4. P0 Findings (release-blocking / materially misleading)

### P13A-P0-01 — “Instant market price” claims in first-impression copy
- **Severity:** P0
- **Locations:** `index.html:10` (meta description “قیمت لحظه‌ای بازار”), `src/pages/Dashboard.tsx:106` (hero panel title “قیمت لحظه‌ای”, unconditional), `src/pages/Dashboard.tsx:72` (“قیمت روز بازار فولاد”), `src/components/Layout.tsx:69` (“برای دریافت قیمت لحظه‌ای فولاد…”), `package.json` description (“live market prices”).
- **Observed:** the app advertises live/instant market pricing as a headline feature. In reality live prices only exist when a third-party fetch chain succeeds (`livePrices.ts` → `api.allorigins.win` CORS proxy → ahanonline.com scraping); otherwise materials fall back to “reference” or “manual” states (the app models this honestly via `status: live | reference | manual`).
- **Why it matters:** the audit brief lists “instant market price” among claims that must not stand; a portfolio reviewer who clicks Market and sees reference/manual states will feel misled. The export layer already contains the correct honest wording (`exporters.ts:953`: “این گزارش هیچ ادعایی درباره قیمت لحظه‌ای ندارد مگر آنکه وضعیت منبع «لحظه‌ای» باشد”) — the UI copy should match that standard.
- **Evidence:** rendered dashboard probe captured `livePanelTitle: "قیمت لحظه‌ای"`; grep output above; `livePrices.ts:66` allorigins dependency.
- **Remediation:** reposition copy to “قیمت روز بازار فولاد با برچسب وضعیت منبع (لحظه‌ای / مرجع / دستی)” style; make the hero panel title state-conditional. **Requires production-code (copy) change** — trivial, no logic.

### P13A-P0-02 — Phase 12 work absent from tree & remote; stated status contradicts reality
- **Severity:** P0
- **Location:** entire working tree / GitHub `main`.
- **Observed:** Phase 12 Wave 1 (UI-12-01..07 fixes), Wave 2 (8-module project persistence + stale-result lifecycle) and Wave B (AA contrast polish) are not present at HEAD. Measurable consequences in the shippable state: Management room unreachable (P13A-P1-03), shear-wall missing on mobile (P13A-P1-04), legacy 3-module hero copy (P13A-P1-05), fragmented versions v20–v25 (P13A-P1-06), broken hero image reference (P13A-P1-07), pre-polish contrast tokens (white-on-emerald 2.54:1 etc.).
- **Why it matters:** releasing now would ship a state the PM has already reviewed and superseded; the portfolio would present known-broken navigation as the current product.
- **Evidence:** §2 incident record; probe dump (`management` route renders dashboard h1; mobile sheet has 7 tiles); token grep counts.
- **Remediation:** re-apply Phase 12 Wave 1 + Wave 2 + Wave B exactly as documented in the Phase-12 reports (whose full content exists in the session record), then **commit** per a new authorization (the standing no-commit policy is precisely what made this loss possible). **Requires production-code change + git commit authorization.**

---

## 5. P1 Findings (important portfolio/release blockers)

### P13A-P1-01 — No README or project documentation (P13-02)
- **Location:** repository root (`git ls-files` shows no README*, CONTRIBUTING, docs/).
- **Observed:** a reviewer has zero entry point: no purpose statement, no module list, no stack, no run instructions, no limitations, no status/version. The 60-second comprehension test fails by absence.
- **Remediation:** README.md covering: what CivilGenius is / is not (§1 positioning text), 8-module table, stack (React 19 + TS + Tailwind v4 + Vite singlefile, docx/xlsx/katex/lucide, zero-backend), how to run (`npm install && npm run dev`), demo path, engineering scope & limitations (§11 text), verification suite (`scripts/`), version/status. **Documentation change only.**

### P13A-P1-02 — `node_modules` committed (10,074 files), no `.gitignore`; committed binaries are Windows-only (P13-08/09/10)
- **Location:** `git ls-files node_modules | wc -l` → 10,074; no `.gitignore` tracked.
- **Observed:** the committed dependency tree contains `win32-x64` native binaries (esbuild/rollup/lightningcss/oxide). A Linux/macOS clone cannot build or run until `npm install` re-fetches platform natives (verified in this audit: build failed with “Cannot find module @rollup/rollup-linux-x64-gnu” until natives were restored). Clone size and review noise are severe for a portfolio repo.
- **Remediation:** add `.gitignore` (node_modules, dist, *.tsbuildinfo, harness outputs), remove `node_modules` from tracking, keep `package-lock.json` as the source of reproducible installs. **Requires git hygiene change** (no production code).

### P13A-P1-03 — Management / Command Room orphaned — unreachable (P13-03/06)
- **Location:** `src/pages/Management.tsx:222` (`export function ManagementPage`) — imported by **nothing**; `src/App.tsx` route switch has no `case 'management'`; `src/components/Layout.tsx` NAV has no management item.
- **Observed (probe):** navigating `#/management` falls back to dashboard (`routes.management: "CivilGeniusv22"` = dashboard h1). The Gantt/S-curve/donut/procurement “اتاق فرمان پروژه” — one of the most portfolio-impressive surfaces — cannot be reached at all.
- **Remediation:** add NAV item + `case 'management'` (exactly what Phase 12 UI-12-01 did — part of the lost work, P13A-P0-02). **Requires production-code change.**

### P13A-P1-04 — Shear-wall module unreachable on mobile (7/8 tiles) (P13-06)
- **Location:** `src/components/Layout.tsx:239` — mobile design sheet filters NAV with `['foundation','beam','column','slab','wall','staircase','ramp','joint']`, but NAV defines the route as **`shear-wall`**.
- **Observed (probe):** `mobileSheet.tiles` = 7 entries; `hasShearWall: false`. Desktop sidebar is correct (8 modules).
- **Remediation:** `'wall'` → `'shear-wall'` in that filter (exactly Phase 12 UI-12-04 — lost work). **Requires production-code change (one token).**

### P13A-P1-05 — Stale 3-module positioning on the first screen (P13-01/06/13)
- **Locations:** `src/pages/Dashboard.tsx:91` (`['ماژول مهندسی', '۳']`), `Dashboard.tsx:72` (“طراحی پی، تیر و ستون…”), `index.html:10`, `package.json` description.
- **Observed (probe):** hero stats render `['۳','۱۱','۳']` while the same page renders **8 module cards** (`moduleCardCount: 8`) and all 8 modules compute (identity 8/8). The product contradicts itself on screen one.
- **Remediation:** hero stat → ۸; subtitle → all-module wording (“طراحی ۸ المان سازه‌ای…”). Phase 12 had fixed this (lost). **Requires production-code (copy) change.**

### P13A-P1-06 — Version/provenance fragmentation v20–v25 (P13-12)
- **Observed (grep):** splash `App.tsx:41` **v22** · hero badge “نسخه ۲۲” · sidebar `Layout.tsx:163/200` “نسخه ۲۲” · ReportHub calc-book footer `ReportHub.tsx:94` **v23** · file-share text `fileio.ts:111` **v21** · Word/Excel `exporters.ts:55` `APP_VERSION='v24'` · DXF frame `dxf.ts:358` **v24** · `index.html` **v20** · `package.json` **20.0.0** (“CivilGenius v20”) · header comments scattered v20/v22/v23/v24/**v25** (`codes.ts`, `Bbs.tsx`, `identity-8x8.ts`) · `PHASE-4-AUDIT.md` title claims **v25**.
- **Why it matters:** a reviewer comparing the UI (v22) to a Word export (v24) or the audit doc (v25) sees incoherent provenance.
- **Remediation:** single source of truth (Phase 12’s lost `src/lib/version.ts`), referenced by splash/sidebar/mobile/hero/exporters/fileio/index.html/package.json. **Requires production-code change.**

### P13A-P1-07 — Broken hero asset reference (P13-13)
- **Location:** `src/pages/Dashboard.tsx:52` — `<img src="images/hero.jpg">`; `public/` is **not tracked** and does not exist on disk.
- **Observed:** every deployment 404s the image (silently hidden by `onError`). The asset existed only as an untracked Phase-12 file and was lost (P13A-P0-02).
- **Remediation:** restore `public/images/hero.jpg` and commit it, or drop the `<img>` (hero degrades to its CSS pattern). **Asset + commit, or production-code change.**

### P13A-P1-08 — Engineering-scope disclosure incomplete (P13-05)
- **Observed:** partial disclosure exists and is good where present — Advisor: “پاسخ‌های مدل زبانی جنبه راهنمایی دارند و جایگزین محاسبات مهرشده مهندس محاسب نیستند” (`Advisor.tsx:373`); ReportHub footer: “…ممیزی نهایی با مهندس مهرشده است” (`ReportHub.tsx:94`); CalcBook code-reference integrity label (`CalcBook.tsx:114`); exporters’ price-honesty paragraphs (`exporters.ts:438,953`). **Missing:** any explicit statement of gravity-only structural scope; seismic/wind not implemented as analysis engines; geotechnical scope limits (Terzaghi bearing only); wall/slab/stair/ramp/joint modeling assumptions; estimate-level nature of quantities/pricing at the point of decision (module pages and dashboard). Module subtitles describe what is computed, not what is excluded.
- **Why it matters:** the target positioning (“engineering-focused prototype, not certified software”) must be self-evident, and Phase 7–12 findings documented these exact limitations.
- **Remediation:** one shared “scope & limitations” disclosure (README §engineering + a compact in-app note, e.g. Management/ReportHub footer), using wording consistent with the existing honest exporters text. **Documentation + small production copy change.**

---

## 6. P2 Findings (polish / documentation / usability)

| ID | Location | Observed | Remediation | Prod-code? |
|---|---|---|---|---|
| P13A-P2-01 | repo root | **No LICENSE** — public repo with unspecified rights | Add LICENSE (choice of license is a PM decision) | No |
| P13A-P2-02 | `PHASE-4-AUDIT.md` (tracked) | Stale root artifact: title claims “CivilGenius **v25**”, references path `/home/user/civilgenius`, Phase-4 scope only — confusing provenance for reviewers | Move to `docs/audits/` or remove from tracking | No (git hygiene) |
| P13A-P2-03 | `scripts/probe-beam*.ts`, `probe-ramp*.ts` (×5), `probe-slab.ts`, `probe-ramp-bound.ts` | 8 transient dev probes tracked alongside real gates — naming clutter | Move to `scripts/archive/` or untrack | No |
| P13A-P2-04 | `tsconfig.app.tsbuildinfo`, `tsconfig.node.tsbuildinfo` (tracked) | Build artifacts committed; churn on every typecheck | Untrack + .gitignore | No |
| P13A-P2-05 | GitHub repo | Name “civilgeniuss” (typo), empty description, empty homepage, no topics | Rename (optional), set description/homeline/topics | No (GitHub settings) |
| P13A-P2-06 | `index.html:13–21`, `livePrices.ts:66`, `knowledge.ts:197` | Undocumented external runtime dependencies: CDN fonts (Vazirmatn/Space Grotesk), third-party CORS proxy `api.allorigins.win` for prices, user-supplied Groq API key for advisor live mode — each can fail silently in a demo; offline build falls back to system fonts | Document in README “runtime dependencies & offline behavior”; consider bundling fonts later (post-release) | Docs only |
| P13A-P2-07 | repo-wide | **No screenshots / visual assets** anywhere tracked; no `docs/` media for README or GitHub gallery | Capture the §14 shot list (browser automation unavailable in this sandbox — see §14) | No |
| P13A-P2-08 | `package.json` `"test:e2e"` | Advertised script fails on Node ≥ 21 (jsdom `navigator` getter) — known harness issue, but it currently looks like a broken test | Document as known limitation or pin/patch harness (separate authorization) | Harness only |

---

## 7. P3 Findings (optional improvements)

| ID | Location | Observed | Remediation | Prod-code? |
|---|---|---|---|---|
| P13A-P3-01 | `projectCode()` (dispatch/export path) | Document codes carry a random suffix (`PRJ-SLB-050626-7BKM` vs `-5VWH` across two runs) → exported files not byte-reproducible run-to-run, though **all engineering values are byte-identical** (proven §13) | Optional seeded “demo mode” code; engineering-frozen-adjacent — requires separate authorization | Frozen-adjacent — do not change without authorization |
| P13A-P3-02 | `index.html` favicon + `theme-color #0f1f3d`, amber “CG” | Branding predates the current white/green identity | Regenerate favicon/theme-color with identity palette | Cosmetic |
| P13A-P3-03 | `src/pages/Stair.tsx` h1 “طراحی رمپ و راهپله” | Stair page title mixes ramp+stair terminology while a dedicated Ramp module exists (“طراحی رمپ”) | Copy fix | Yes (copy) |
| P13A-P3-04 | `index.html` head | No Open Graph / social-preview metadata for shared links | Add og:title/description/image once screenshots exist | Cosmetic |
| P13A-P3-05 | release process | Single-file `dist/index.html` (~3.5 MB) is the natural demo deployment artifact, but no documented release/demo-hosting procedure exists | README “deploy/demo” section | Docs only |

---

## 8. Portfolio Demo Flow Assessment (P13-03)

**Golden path verified live on the real app at HEAD (probe):**

| Step | Action | Clicks | Result |
|---|---|---|---|
| 1 | Dashboard → «پروژه نمونه ارائه» | 1 | 5-story residential sample loaded into all 8 modules |
| 2 | Click any module card (e.g. foundation) | 1 | Module page with inputs + «بارگذاری پروژه نمونه سازمانی» |
| 3 | «محاسبه و صدور اسناد» | 1 | Verdict + metric cards + PASS/WARN/FAIL checks + D/C bars |
| 4 | Scroll | 0 | دفترچه محاسبات (step trace) → BBS (35 rows + subtables) → BOQ → delivery center |
| 5 | Export | 1 | Word (.docx real docx via `docx` lib) / Excel / DXF — labels match reality |

**≈3 clicks to a complete engineering result** — compelling demo speed. Dead ends at HEAD: **Management room unreachable** (P13A-P1-03), **shear-wall unreachable on mobile** (P13A-P1-04), hero image silently missing (P13A-P1-07). Confusing wording: hero “3 modules” vs 8 cards (P13A-P1-05); “قیمت لحظه‌ای” (P13A-P0-01). Invalid routes fall back to dashboard gracefully (probe ✓). Report hub reachable from nav; calc-book assembly across modules works (smoke + dispatch check).

## 9. Eight-Module Showcase Assessment (P13-04)

`store.ts:buildSampleProject()` — “ساختمان مسکونی ۵ طبقه — پلاک ۱۲/۳”, client “شرکت ساختمانی سازه پایدار”:

| Module | Sample inputs (excerpt) | Plausible | Deterministic | Shows checks | Shows optimizer |
|---|---|---|---|---|---|
| Foundation | L=22, B=14, H=1.4, Df=2.2, φ=30°, P=9600 kN | ✓ | ✓ (identity) | Terzaghi, punching, shear, rebar | ✓ autofix path |
| Beam | L=7.2, 300×600, wd=22, wl=12 | ✓ | ✓ | flexure/shear/deflection | ✓ |
| Column | Pu=2100, Mu=180, 500×500, Lc=3.4 | ✓ | ✓ | P-M interaction, slenderness | ✓ |
| Slab | L=6.2, h=280, LL=2.5 | ✓ | ✓ | 4 slab systems, deflection | ✓ (round-33 regression) |
| Shear wall | lw=4.2, tw=250, Pu=2800, Mu=4200, Vu=900 | ✓ | ✓ | boundary elem., shear-friction, drift | ✓ |
| Stair | H=3.2, Lr=5.8, bw=1.3 | ✓ | ✓ | min thickness, rebar | ✓ |
| Ramp | H=3.5, Lr=7, bw=1.5 | ✓ | ✓ | slope/deflection | ✓ |
| Joint | 550×550 col, 350×600 beam, Vu=1500 | ✓ | ✓ | φVn ≥ Vu, hoop rows | ✓ |

All 8 covered by one coherent building sample with per-module multipliers (12 beams, 16 columns…) feeding BOQ/procurement — a genuine “golden case”, not per-module toys. No intentionally broken first impressions: sample results include honest WARN/FAIL paths (beam sample fails → demonstrates the fix loop, which is a strength for a demo). **Recommendation: keep this sample exactly; do not replace.** Document it in README as the demo script.

## 10. Documentation / README Assessment (P13-02)

**Absent entirely.** Against the 60-second checklist: purpose ✗ · modules ✗ · stack ✗ · scope ✗ · inputs ✗ · outputs ✗ · workflow ✗ · limitations ✗ · how-to-run ✗ · status/version ✗. The only documentation present is `PHASE-4-AUDIT.md` (stale, see P13A-P2-02) and per-file header comments (version-inconsistent). This is the single highest-leverage fix after restoring Phase 12.

## 11. Engineering Disclosure Assessment (P13-05)

Present & good: advisor LLM disclaimer; ReportHub “final audit with licensed engineer” footer; CalcBook code-clause integrity label (clause numbers certain, exact section/table pending printed-edition verification); exporters’ data-honesty paragraphs (live/reference/manual price semantics, estimate-level workshop rates for formwork/excavation).
**Missing (required before release):** explicit gravity-only scope; seismic/wind absent as analysis engines (Advisor answers 2800 questions from knowledge base — that is Q&A, not analysis); foundation geotech limited to Terzaghi bearing + simplified checks; wall/slab/stair/ramp/joint modeling assumptions; quantities/pricing are estimate-level. Compare: Phase 7–12 findings documented these; none of that text reached the UI/README. Proposed wording must not invent new claims — reuse the exporters’ own honest phrasing.

## 12. GitHub / Repository Hygiene (P13-08)

| Area | State | Finding |
|---|---|---|
| README | absent | P13A-P1-01 |
| .gitignore | absent | P13A-P1-02 |
| LICENSE | absent | P13A-P2-01 |
| node_modules | **10,074 files tracked**, win32 binaries | P13A-P1-02 |
| Build artifacts | tsbuildinfo tracked; dist untracked ✓ | P13A-P2-04 |
| Scripts | real gates + 8 dev probes mixed | P13A-P2-03 |
| Stale artifacts | PHASE-4-AUDIT.md at root (claims v25) | P13A-P2-02 |
| Metadata | name typo, empty description/homepage | P13A-P2-05 |
| Screenshots | none | P13A-P2-07 |
| package.json | v20.0.0 + stale/misleading description; scripts valid (`dev/build/preview/typecheck/smoke/test:e2e/test:dxf`) | P13A-P0-01/P1-06 |

## 13. Reproducibility Assessment (P13-10)

**Fresh-developer path (as audited):**
1. `git clone https://github.com/amirwf3-pixel/civilgeniuss.git` — works, but heavy (tracked node_modules).
2. `cd civilgeniuss && npm install` — **required on Linux/macOS**: committed natives are win32-only; without this step `npm run dev/build` fails with missing rollup/esbuild natives (reproduced in this audit).
3. `npm run dev` → http://localhost:5173 — dashboard reachable (verified live, HTTP 200).
4. Golden path (§8) — verified end-to-end via render probe.
5. Outputs — Word/Excel/DXF generation verified via harnesses (§16).

**Requirements:** Node ≥ 20.19 (audit used v22.22.3; Vite 7 baseline), npm ≥ 9, modern browser. No backend. Optional runtime network: fonts CDN, price fetch, Groq key for advisor live mode (local RAG mode is offline).
**Known harness-only failure:** `scripts/e2e-mount.tsx` fails on Node ≥ 21 (`Cannot set property navigator … only a getter`) — jsdom/Node incompatibility in the harness itself, **not a product defect**; kept separate per instructions.
**Determinism:** two consecutive `gen-xlsx-check` + `xlsx-bbs` runs → XML-level comparison: **every engineering cell byte-identical**; only difference = random document-code suffix (P13A-P3-01). Engineering outputs are deterministic.

## 14. Screenshot / Presentation Plan (P13-11)

**Limitation (declared, not fabricated):** this sandbox has no browser binary (chromium/chrome/firefox absent; Playwright CDN blocked; no root for apt) — **no screenshots can be produced here**. Minimal recommended shot list for a machine with a browser:

1. Desktop dashboard (hero + 8 module cards + price panel)
2. Foundation result page (verdict banner + checks + D/C bars)
3. دفترچه محاسبات step trace (KaTeX formulas)
4. BBS + BOQ tables with delivery center
5. Management command room — **after P13A-P1-03 fix** (Gantt + S-curve + procurement)
6. Mobile: bottom nav + design sheet (after P13A-P1-04 fix, showing 8 tiles)
7. DXF output opened in a CAD viewer (or the DXF text preview)
Use these for README + GitHub gallery + P13A-P3-04 og:image.

## 15. Required Changes Before Release (sequenced)

| # | Change | Findings addressed | Type | Needs authorization |
|---|---|---|---|---|
| 1 | Re-apply Phase 12 Wave 1 + Wave 2 + Wave B exactly as documented (session record holds the complete diffs) | P0-02, P1-03, P1-04, P1-05, P1-06, P1-07 (+ lost contrast polish) | production code | **YES** |
| 2 | Commit policy decision: commit the restored work on the session branch (the no-commit rule caused the loss) | P0-02 | git | **YES** |
| 3 | Fix positioning copy: remove “قیمت لحظه‌ای” overclaims; hero ۸ ماژول; subtitle all-module; package.json description | P0-01, P1-05 | production copy | YES |
| 4 | README.md (purpose/modules/stack/run/demo/scope-limitations/verification/status) | P1-01, P1-08 (disclosure), P2-06 | documentation | YES |
| 5 | .gitignore + untrack node_modules & tsbuildinfo | P1-02, P2-04 | git hygiene | YES |
| 6 | LICENSE file (PM choice) | P2-01 | documentation | YES |
| 7 | Version single-source pass (splash/sidebar/mobile/hero/exporters/share/index.html/package.json) | P1-06 | production code | YES |
| 8 | Repo metadata: description, homepage, topics; optionally rename “civilgeniuss” | P2-05 | GitHub settings | YES |

## 16. Optional Post-Release Improvements

Wave “C” (no blockers): screenshot set + GitHub gallery + og-meta (P2-07, P3-04); favicon/theme-color identity refresh (P3-02); scripts archive reorganization (P2-03); move PHASE-4-AUDIT.md to docs/audits (P2-02); font bundling for offline single-file demos (P2-06); seeded demo document codes (P3-01, frozen-adjacent — separate authorization); stair title copy (P3-03); documented demo-hosting procedure (P3-05); e2e-mount harness modernization (P2-08).

## 17. Explicitly Frozen Engineering Areas (read-only in this audit)

`src/lib/engine.ts` · `src/lib/modules.ts` · `src/lib/smartOptimizer.ts` (optimizer) · BBS/BOQ calculation logic (`Bbs.tsx`/`BOQ.tsx` calc paths, `modules.ts` bbs builders) · pricing engine (`market.ts`, `livePrices.ts` computation) · DXF calculation linkage (`dxf.ts` geometry from results) · Word/Excel calculation/export content logic (`exporters.ts`) · all Phase 10C/11B/11C validated behavior (round-33, round-26, identity, stress gates). **No finding in this audit proposes changing any frozen area.** P13A-P3-01 (document-code randomness) touches frozen provenance/export territory and is explicitly documented-only.

## 18. Mandatory Verification Results

Executed on the audited tree (natives restored version-matched; tracked tree untouched — final `git status`: 0 tracked changes):

| # | Check | Result |
|---|---|---|
| 1 | TypeScript `tsc -b --force` | **PASS** (exit 0) |
| 2 | Production build `vite build` | **PASS** — dist/index.html 3,536,523 B |
| 3 | `scripts/smoke.tsx` | **PASS** — SMOKE OK, all real components rendered |
| 4 | `scripts/identity-8x8.ts` | **PASS** — ALL 8/8 |
| 5 | `scripts/smart-stress.ts` | **PASS** — 24/24 profiles |
| 6 | `scripts/round33-check.ts` (round-33 gate) | **PASS** |
| 7 | `scripts/verify-round26.ts` (auto-fix gate) | **PASS** — ALL VERIFY PASS |
| 8 | `scripts/gen-xlsx-check.ts` (Excel/BBS) | **PASS** — 77,328 B |
| 9 | `scripts/xlsx-bbs.tsx` (BBS workbook) | **PASS** — 77,260 B |
| 10 | `scripts/dxf-audit.tsx` (DXF) | **PASS** — stair 15,130 chars, joint 9,270 chars |
| 11 | `scripts/katex-check.tsx` | **PASS** — katex-error: false |
| 12 | `scripts/advisor-check.tsx` | **PASS** |
| 13 | `scripts/dispatch-check.tsx` | **PASS** |
| 14 | `scripts/e2e-mount.tsx` | **FAIL — known harness-only issue** (Node ≥ 21 jsdom `navigator` getter), isolated from product |
| 15 | Determinism double-run (xlsx ×2, XML cell diff) | **PASS** — engineering cells byte-identical; only random doc-code suffix differs |
| 16 | Live render probe (routes/mobile/demo path at HEAD) | **EXECUTED** — findings in §4–§8 |

Named gates “Phase 10C gate / Phase 11B gate / Phase 11C gate” as dedicated scripts: **NOT PRESENT** under those names — closest existing regression gates are items 4–9 above; not fabricated.

**Totals: 16 checks executed · 15 passed · 1 failed (known harness limitation) · 0 skipped.**

---

## Final Release Readiness Verdict

**NOT READY FOR RELEASE.**

The engineering product is portfolio-credible and fully verified; the repository around it is not. Two P0 issues block presentation: materially misleading first-impression claims (instant-price + 3-module positioning) and the absence of the completed Phase 12 state from the tree/remote due to the uncommitted-work incident. §15 lists the exact, short, sequenced remediation. **No Phase 13B implementation is started; awaiting explicit authorization.**

*Report generated by the Phase 13A audit (read-only). Evidence: live render probe dump (captured in-report), harness outputs in `/home/user/preview` & `/home/user/deliverables/preview`, `gh` remote inspection. Zero production files modified; zero git operations performed; working tree preserved exactly (0 tracked changes at close).*
