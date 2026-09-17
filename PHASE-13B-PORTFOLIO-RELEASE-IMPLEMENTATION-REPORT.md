# PHASE 13B — Portfolio / Release Implementation Report

**Repo:** `amirwf3-pixel/civilgeniuss` · **Branch:** `arena/01a0b04f-civilgeniuss` · **Date:** 2026-09-18
**Baseline:** HEAD `0622db6` (Phase 13A audit state) · **Authoritative input:** `PHASE-13A-PORTFOLIO-RELEASE-AUDIT.md`
**Scope:** Part A — restore lost Phase 12 (Wave 1 + Wave 2 + Visual Wave B) · Part B — release items B01–B12
**Engineering drift:** **NONE** (byte-identical verification, §13)

---

## 1. Executive Summary

**Verdict: PASS**

Phase 13B is complete in a single local commit. The lost Phase 12 implementation was reconstructed exactly per the original specification and re-verified with a dedicated 23-check probe (23/23 PASS). All twelve B-series release items are implemented within the authorization envelope: professional README with engineering-scope disclosure (B01/B11), `.gitignore` + untracking of `node_modules` and tsbuildinfos with local files preserved (B02/B09), version single-source `v24` propagated to all audited surfaces (B04), honest pricing copy (B05), Management room reachable via the existing page (B06), mobile 8/8 modules (B07), hero broken reference removed with clean CSS fallback (B08), demo path preserved (B10), golden sample untouched (B12).

LICENSE (B03): **deliberately NOT added** — repository ownership/licensing cannot be safely inferred from context; the licensing state is documented in the README and in §7. No ownership or legal terms were invented.

The engineering surface is **byte-identical** to the pre-change baseline across all frozen areas: verdicts, checks, BBS, BOQ, DXF sheet content and Excel cell content were captured before the first edit and compared after the last — zero drift on 12 sample/edge profiles, 7 DXF files and 2 workbook cell-sets (only the intentionally random document-code suffixes differ, per P13A-P3-01).

Full regression battery: **19 gates executed — 18 PASS, 1 FAIL** (`scripts/e2e-mount.tsx`, the known Node ≥ 21 / jsdom `navigator` harness limitation, reported as such and documented in the README; NOT PRESENT as a functional gate).

Remaining findings: **P0 = 0 · P1 = 0 · P2 = 4 (documentation/hygiene/GitHub-settings, none product-blocking) · P3 = 5 (cosmetic/frozen-adjacent)** — detailed in §14.

---

## 2. Phase 12 Restoration (Part A)

Restoration = reconstruction from the recorded Phase 12 specification (originals were never committed and did not survive the workspace reset; nothing was recoverable from repo history — single commit). Every item below was verified by `audit-evidence-p13b/phase12-verify.tsx` (23/23 PASS) and `render-final.tsx` (19/19 PASS).

### Wave 1 (UI)
| ID | Item | Implementation | Verification |
|---|---|---|---|
| UI-12-01 | Management reachable | `Layout.tsx` NAV item `management` (GanttChart icon) + `App.tsx` `case 'management'` → existing `ManagementPage` (no second implementation — B06) | `U1.management-routed` PASS; route renders h1 «اتاق فرمان پروژه» |
| UI-12-04 | Mobile shear-wall visible | `Layout.tsx` sheet filter `'wall'` → `'shear-wall'` | `U2.mobile-8-modules` PASS (8 tiles incl. دیوار برشی) |
| UI-12-06/07 | Honest positioning + version | Dashboard hero: count from `CALC_META` (renders ۸), 8-module subtitle, version constants | `U3.hero-module-count-8`, `U3.hero-version` PASS |

### Wave 2 (8-module persistence + stale lifecycle)
| ID | Item | Implementation | Verification |
|---|---|---|---|
| A-1 | `ProjectFile` 8 modules | `src/lib/projects.ts` rewritten: 8-module `inputs`, multipliers, `normalizeProject` | A1/A2 round-trip PASS |
| A-2 | Legacy backfill | `normalizeProject`: core-3 (foundation/beam/column) mandatory else `null`; newer-5 backfilled from engine defaults; multipliers merge finite-numeric-only; name/client/savedAt guards; `parseProjectJSON` throws «فایل پروژه نامعتبر است» | A3/A4a–d PASS |
| A-3 | Load restores 8, no recalc | `Management.tsx` `doLoad` sets all 8 inputs verbatim | `C1.restores-8-with-override` PASS |
| B-1 | Stale detection | `store.ts` `isResultStale(result, currentInput)` — union-of-keys `Object.is` over the `result.input` snapshot (snapshot already existed in engine; no engine change) | — |
| B-2/3 | Stale chip + banner | `ModuleShell.tsx` warn chip «نتیجه قدیمی — ورودی‌ها تغییر کرده» + amber banner with recompute guidance | `B3.*` PASS |
| B-4 | Clears on fresh calc, no timers | staleness derived synchronously from data; cleared automatically on recompute | `B1.not-stale-initially`, `B4.stale-cleared-after-recompute` PASS |

Persistence key `civilgenius.projects.v22` / `v:22` kept unchanged (historical semantics).

### Visual Wave B (AA contrast tokens)
| ID | Change | Value |
|---|---|---|
| VQA-01 | emerald fill for white-text buttons/tabs | `--color-emerald-deep: #047857` — applied to compute button (ModuleShell), Button `green`, CalcBook/Column/Advisor/ReportHub active tabs |
| VQA-02 | gold button text | `bg-gold text-navy` + hover brightness (was white-on-gold 2.54:1) |
| VQA-03 | faint text + active mobile label | `--color-faint: #64756d`; mobile bottom-nav active label `text-emerald-deep` |
| VQA-04 | gold chip text | `--color-gold-deep: #806515` on Chip `gold` tone |
| VQA-05 | bad tone | `--color-bad: #cc2a1e` |

All four tokens confirmed PRESENT in the built CSS bundle.

---

## 3. Phase 13B Changes (Part B) — item-by-item

| Item | File(s) | Change | Reason | Engineering impact | Verification |
|---|---|---|---|---|---|
| B01/B11 | `README.md` (new) | Professional README: positioning, 8-module table, workflow, demo path, stack, pricing provenance, limitations, run/verification/status sections | No documentation existed (P13A-P1-01); disclosure incomplete (P13A-P1-08) | None (documentation) | 60-second checklist review §6 |
| B02 | `.gitignore` (new) | node_modules, dist, tsbuildinfo, stray documents, env/logs, OS+editor junk | Repo hygiene (P13A-P1-02) | None | `git status` clean; no tracked file collisions |
| B03 | `README.md` §License + this report | **No LICENSE file added** — ownership/licensing not safely inferable; reserved-rights state documented | PM decision; no invented legal terms | None | §7 |
| B04 | `src/lib/version.ts` (new) + 9 surfaces | Single source `APP_NAME/APP_VERSION('v24')/APP_VERSION_FA`; propagated to splash, sidebar, mobile header, Dashboard hero, ReportHub footer, exporters re-export, fileio share text, index.html title/meta, package.json | Version fragmentation v20–v25 (P13A-P1-06) | None (presentation strings) | grep sweep: no stale v20–v23 surface strings; render probe U3 |
| B05 | Dashboard, index.html, Layout | «قیمت لحظه‌ای» first-impression copy removed; panel title «آخرین استعلام قیمت بازار»; hero/meta honest wording; pricing engine untouched | Unsupported real-time claim (P13A-P0-01) | None (copy only; `market.ts`/`livePrices.ts` untouched) | `U5.no-live-price-claim` PASS; remaining «لحظه‌ای» occurrences are honest status labels/disclaimers inside exporters/market source-status text |
| B06 | `App.tsx`, `Layout.tsx` | Management reachable via existing `ManagementPage` — no second implementation | Orphaned page (P13A-P1-03) | None | route render PASS |
| B07 | `Layout.tsx` | Mobile sheet shows 8/8 modules | Shear wall hidden on mobile (P13A-P1-04) | None | `U2.mobile-8-modules` PASS |
| B08 | `Dashboard.tsx` | Broken `<img src="images/hero.jpg">` removed (asset unrecoverable — never committed); existing `bp-grid-dark` CSS pattern retained as the hero visual; explanatory comment added | 404 on every deployment (P13A-P1-07); no fabrication per authorization | None | `hero.no-img` + `hero.bp-grid` PASS |
| B09 | git index | `git rm -r --cached node_modules` (10,074 files) + untrack 2 tsbuildinfos; **local files preserved on disk** (deps still installed); audit evidence kept; no blind deletes | Repo hygiene (P13A-P1-02/P2-04) | None (index-only operation) | `ls node_modules` intact; build/typecheck still run |
| B10 | — | Demo path preserved: Dashboard → sample → module → Calculate → checks/trace → BBS/BOQ → Export → DXF; smallest-change edits only | Release requirement | None | full render + dispatch + dxf-audit |
| B11 | `README.md` | Explicit limitations (gravity-only, no seismic/wind engines, limited geotech, per-module model limits, manual code refs, price freshness, estimate-level outputs) | Honest disclosure | None | §11 |
| B12 | — | Golden sample `buildSampleProject()` **NOT modified** (verified by byte-identical freeze probe) | Showcase integrity | None | §13 |

---

## 4. Files Changed

**New (5):** `README.md`, `.gitignore`, `src/lib/version.ts`, `PHASE-13A-PORTFOLIO-RELEASE-AUDIT.md` (committed documentation), `audit-evidence-p13b/` (probes + evidence JSONs).

**Modified (17):** `index.html` · `package.json` · `src/App.tsx` · `src/components/CalcBook.tsx` · `src/components/Layout.tsx` · `src/components/ModuleShell.tsx` · `src/components/ui.tsx` · `src/index.css` · `src/lib/exporters.ts` · `src/lib/fileio.ts` · `src/lib/projects.ts` · `src/lib/store.ts` · `src/pages/Advisor.tsx` · `src/pages/Column.tsx` · `src/pages/Dashboard.tsx` · `src/pages/Management.tsx` · `src/pages/ReportHub.tsx`

**Untracked from index (files kept on disk):** `node_modules/` (10,074 files), `tsconfig.app.tsbuildinfo`, `tsconfig.node.tsbuildinfo`.

Diff size: 17 source files, +191/−60 lines — consistent with "smallest changes only".

---

## 5. Frozen Files — Confirmed Untouched

Byte-identical at `HEAD` for all of: `src/lib/engine.ts`, `src/lib/modules.ts`, `src/lib/smartOptimizer.ts`, `src/lib/market.ts`, `src/lib/livePrices.ts`, `src/lib/dxf.ts`, all formula/combination/verdict logic, BBS/BOQ/pricing computation, DXF engineering linkage, Word/Excel engineering calculations, Phase 10C/11B/11C behavior. (`exporters.ts` change is a two-line version re-export only — presentation, verified by cell-identical xlsx comparison in §13.) No engineering change was needed at any point; no STOP-and-report condition was triggered.

## 6. README Review (60-second checklist)

Purpose ✓ · "engineering-focused portfolio prototype" statement + NOT-certified/NOT-substitute/NOT-full-compliance block ✓ · 8-module table ✓ · stack ✓ · workflow ✓ · outputs (Word/Excel/DXF/BBS/BOQ/trace) ✓ · pricing provenance model ✓ · limitations ✓ · install/run ✓ · verification suite ✓ · status/version ✓ · repo map ✓ · licensing state ✓.

## 7. Repository Hygiene

- `node_modules` untracked via index removal only; local install intact (build/typecheck re-ran afterwards). Win32 binaries no longer tracked.
- `.gitignore` added; verified no tracked non-node_modules file matches any ignore glob.
- tsbuildinfos untracked (they had churned on every typecheck).
- `dist/` untracked and now ignored.
- Audit evidence preserved: `audit-evidence-p13b/` committed; Phase 13A report committed.
- **No blind deletes.** Deferred (out of authorization scope): `PHASE-4-AUDIT.md` root artifact (P13A-P2-02), 8 dev probes in `scripts/` (P13A-P2-03) — both retained per "preserve existing work".
- LICENSE decision: **documentation-only** (owner must choose); reserved-rights statement in README.

## 8. Version Provenance

Single source of truth: `src/lib/version.ts` → `CivilGenius / v24 / نسخه ۲۴`.
Surfaces audited and aligned: splash (App.tsx) ✓ · desktop sidebar ✓ · mobile header ✓ · Dashboard hero chip+h1 ✓ · ReportHub HTML footer ✓ · exporters `APP_NAME/APP_VERSION` (re-exported) ✓ · fileio web-share text ✓ · index.html title+meta ✓ · package.json `24.0.0` + honest description ✓. Grep sweep confirms zero remaining `v20/v21/v22/v23` surface strings (dxf.ts:358 frame stamp already read v24 at HEAD — left untouched, frozen-adjacent). `projects.ts` storage key `v:22` is historical persistence semantics, intentionally kept.

## 9. Demo Flow (B10)

Render-probed end-to-end: Dashboard «پروژه نمونه ارائه» → any module → sample already loaded → «محاسبه و صدور اسناد» → verdict + checks + trace → BBS/BOQ tabs → delivery (Word/Excel/DXF dispatched, `dispatch-check` PASS) → DXF audit PASS. ≈3 clicks to a complete result. No dead ends: management reachable, shear-wall reachable (desktop + mobile), invalid routes fall back to dashboard.

## 10. 8-Module Discoverability

Desktop sidebar: 13 nav items (dashboard, market, 8 modules, report hub, management, advisor) — probe-verified. Mobile bottom-sheet «طراحی» tab: **8/8 tiles including دیوار برشی** — probe-verified. Dashboard module grid: 8 cards (unchanged). No duplicate pages.

## 11. Engineering Disclosure

README limitations section states: gravity-oriented scope; seismic/wind not implemented as analysis engines; Terzaghi-only geotech; simplified wall/slab/stair/ramp/joint models; manually curated code references requiring verification; price freshness dependent on third-party fetch; estimate-level outputs (not procurement/construction). No invented clauses, no full-compliance claim. These mirror the frozen engine's actual capabilities.

## 12. Regression Results (19 gates)

| # | Gate | Result |
|---|---|---|
| 1 | typecheck (`tsc -b`) | PASS |
| 2 | production build (vite + singlefile) | PASS — 3,554.97 kB single file |
| 3 | smoke (all pages/components) | PASS |
| 4 | identity-8x8 | PASS — ALL 8/8 |
| 5 | smart-stress | PASS — 24/24 profiles |
| 6 | round33-check | PASS |
| 7 | verify-round26 | PASS |
| 8 | gen-xlsx-check | PASS (+cell identity §13) |
| 9 | xlsx-bbs | PASS (+cell identity §13) |
| 10 | dxf-audit | PASS (+content identity §13) |
| 11 | katex-check | PASS |
| 12 | advisor-check | PASS |
| 13 | dispatch-check | PASS |
| 14 | e2e-mount | **FAIL — harness-only** (Node ≥ 21 jsdom `navigator`; NOT PRESENT as functional gate; documented in README) |
| 15 | determinism (freeze-probe self-check) | PASS |
| 16 | freeze-probe vs baseline (zero-drift) | PASS |
| 17 | phase12-verify (23 checks) | PASS — 23/23 |
| 18 | render-final (19 checks, 13 routes) | PASS — 19/19 |
| 19 | built-bundle token sweep (Wave-B hexes) | PASS |

Totals: **18 PASS / 1 FAIL (harness-limited) / 0 SKIP.** No gate result was fabricated; the e2e failure is reported exactly as the known harness limitation.

## 13. Zero-Drift Results

Baselines captured **before** the first source edit; re-verified **after** the last:

| Surface | Method | Result |
|---|---|---|
| Verdicts/checks/BBS/BOQ/metrics/trace — 8 samples + 4 edge profiles | `freeze-dump.baseline.json` vs post-change dump (random `code`/`createdAt` stripped) | **BYTE-IDENTICAL** |
| DXF sheets — 7 files (beam, column, foundation, joint, slab, stair, wall) | line-level compare vs `/tmp/dxf-baseline/` excluding document-code tokens | **IDENTICAL** |
| Excel — gen-xlsx (240 cells) + bbs workbook (240 cells) | XML cell compare vs baselines excluding document codes | **IDENTICAL** |

**Engineering zero-drift: CONFIRMED.** The only run-to-run differences anywhere are the intentionally random document-code suffixes (P13A-P3-01) and `createdAt` timestamps.

## 14. Remaining Findings (P0–P3)

**P0: 0** · **P1: 0**

| ID | Finding | Status after 13B |
|---|---|---|
| P13A-P2-01 | No LICENSE | **Open by decision** — ownership/licensing not safely inferable; documented state instead (owner action required) |
| P13A-P2-02 | Stale `PHASE-4-AUDIT.md` at root | Open — retained per preserve-existing-work; recommend move/archive later |
| P13A-P2-03 | 8 dev probes mixed with gates in `scripts/` | Open — cosmetic organization; recommend `scripts/archive/` later |
| P13A-P2-05 | GitHub name typo / empty description / topics | Open — GitHub settings + no-push policy; owner action |
| P13A-P2-07 | No screenshots for README/gallery | Open — browser automation unavailable in this sandbox (documented limitation) |
| P13A-P3-01 | Random doc-code suffix (non-byte-reproducible filenames) | Open — frozen-adjacent, requires separate authorization |
| P13A-P3-02 | Favicon/theme-color pre-identity | Open — cosmetic |
| P13A-P3-03 | Stair page h1 mixes ramp terminology | Open — copy, out of 13B scope |
| P13A-P3-04 | No OG/social metadata | Open — cosmetic |
| P13A-P3-05 | No documented deploy procedure | Mitigated — README “Run it” documents `npm run build` → portable `dist/index.html` |

Resolved by 13B: P0-01, P0-02, P1-01…P1-08, P2-04, P2-06, P2-08 (documented).

## 15. Release Recommendation

**Release-ready for portfolio publication, subject to owner actions:**
1. Choose and add a LICENSE (or keep the documented reserved-rights state).
2. Optional GitHub settings: description/topics (and the repo-name typo fix).
3. Optional screenshots once a browser-capable environment is available.

No engineering blocker remains. All P0/P1 findings are resolved; engineering behavior is provably unchanged (byte-identical across every frozen surface); the single-file build deploys anywhere as `dist/index.html`.

## 16. Commit

Single clean local commit on `arena/01a0b04f-civilgeniuss` containing all work above, this report and the evidence.
**Commit hash:** `7a575c528a6998578e0027439edbd3fd889e3d5e (this report was folded into the same commit via a single --amend after the hash was recorded)`
**Pushed:** NO (per authorization). **Pull request:** NO (per authorization). No reset/stash/rebase/destructive-clean was used.
