
/* ============================================================================
 * CivilGenius v20 — app shell
 *   desktop sidebar · mobile header + bottom nav · toast system · SourceCard
 * ========================================================================== */

import { useEffect, useState, type ReactNode } from 'react';
import { Bot, Building2, Columns3, Combine, FileStack, Footprints, GanttChart, Layers, LayoutDashboard, Link2, MoveUpRight, Ruler, TrendingUp, TriangleAlert, Waves, X } from 'lucide-react';
import { faAgo, faNum } from '../lib/format';
import { APP_NAME, APP_VERSION_FA } from '../lib/version';
import { market, useClock, useMarket } from '../lib/market';
import { refreshLivePrices } from '../lib/livePrices';
import { useStore } from '../lib/store';
import { Chip, LiveDot, LogoMark } from './ui';

export interface NavItem {
  route: string;
  label: string;
  icon: ReactNode;
  short: string;
}

export const NAV: NavItem[] = [
  { route: 'dashboard', label: 'داشبورد', short: 'خانه', icon: <LayoutDashboard size={18} /> },
  { route: 'market', label: 'بازار مصالح', short: 'بازار', icon: <TrendingUp size={18} /> },
  { route: 'foundation', label: 'طراحی فونداسیون', short: 'پی', icon: <Ruler size={18} /> },
  { route: 'beam', label: 'طراحی تیر', short: 'تیر', icon: <Waves size={18} /> },
  { route: 'column', label: 'طراحی ستون', short: 'ستون', icon: <Columns3 size={18} /> },
  { route: 'slab', label: 'طراحی سقف', short: 'سقف', icon: <Layers size={18} /> },
  { route: 'shear-wall', label: 'دیوار برشی', short: 'دیوار', icon: <Building2 size={18} /> },
  { route: 'staircase', label: 'راه‌پله', short: 'پله', icon: <Footprints size={18} /> },
  { route: 'ramp', label: 'رمپ', short: 'رمپ', icon: <MoveUpRight size={18} /> },
  { route: 'joint', label: 'چشمه اتصال', short: 'چشمه', icon: <Combine size={18} /> },
  { route: 'report-generator', label: 'هاب دفترچه محاسبات', short: 'دفترچه', icon: <FileStack size={18} /> },
  { route: 'management', label: 'اتاق فرمان پروژه', short: 'فرمان', icon: <GanttChart size={18} /> },
  { route: 'advisor', label: 'مشاور آیین‌نامه', short: 'مشاور', icon: <Bot size={18} /> },
];

/** Connection card for the ahanonline.com price source. */
export function SourceCard({ compact = false }: { compact?: boolean }): ReactNode {
  const snap = useMarket();
  const now = useClock(15_000);
  const cov = market.coverage();
  const [busy, setBusy] = useState(false);
  const status = snap.fetch.status;
  // red is reserved for hard failures; a rate-limited source falls back to approved offline rates → amber
  const tone = status === 'ok' ? 'ok' : status === 'loading' ? 'info' : 'warn';

  return (
    <div className={`glass ${compact ? '' : 'p-4'}`}>
      {compact ? null : (
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-[13px] font-bold text-ink">
            <Link2 size={15} className="text-navy" />
            منبع قیمت
          </h3>
          <LiveDot tone={tone} pulse={status === 'loading'} />
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[12px] font-semibold text-navy" dir="ltr">
          ahanonline.com
        </span>
        <Chip tone={tone === 'ok' ? 'ok' : tone === 'warn' ? 'warn' : 'info'}>
          {status === 'ok' ? 'متصل' : status === 'error' ? 'قطع/محدود' : status === 'loading' ? 'در حال استعلام' : 'در انتظار'}
        </Chip>
      </div>
      <p className="mt-1.5 text-[11px] leading-5 text-muted">
        {status === 'error'
          ? 'استفاده از نرخ مبنای مصوب (آفلاین)'
          : snap.fetch.message || 'برای دریافت آخرین قیمت فولاد از منبع، استعلام را اجرا کنید.'}
      </p>
      <div className="mt-2 flex items-center justify-between text-[10.5px] text-faint tnum">
        <span>
          پوشش: {faNum(cov.live, 0)} به‌روز / {faNum(cov.reference, 0)} مرجع / {faNum(cov.manual, 0)} دستی
        </span>
        {snap.fetch.at ? <span>{faAgo(now - snap.fetch.at)}</span> : null}
      </div>
      {compact ? null : (
        <button
          className="mt-3 w-full rounded-lg bg-navy px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-navy-2 disabled:opacity-50"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void refreshLivePrices({ force: true }).finally(() => setBusy(false));
          }}
        >
          {busy ? 'در حال استعلام…' : 'استعلام آهن‌آنلاین'}
        </button>
      )}
    </div>
  );
}

function Toasts(): ReactNode {
  const { toasts, dismissToast } = useStore();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-end sm:px-6">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`rise pointer-events-auto flex max-w-sm items-center gap-2 rounded-xl border px-3.5 py-2.5 text-[12px] shadow-lg backdrop-blur ${
            t.tone === 'ok'
              ? 'border-mint bg-emerald-soft text-forest'
              : t.tone === 'bad'
                ? 'border-[#fecdca] bg-bad-soft text-bad'
                : t.tone === 'warn'
                  ? 'border-[#fde68a] bg-warn-soft text-warn'
                  : 'border-line bg-panel text-ink'
          }`}
        >
          {t.tone === 'bad' || t.tone === 'warn' ? <TriangleAlert size={15} /> : <LiveDot tone={t.tone === 'ok' ? 'ok' : 'info'} pulse={false} />}
          <span className="leading-5">{t.text}</span>
          <button onClick={() => dismissToast(t.id)} className="mr-1 opacity-60 transition hover:opacity-100" aria-label="بستن">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function Layout({
  route,
  navigate,
  children,
  ticker,
}: {
  route: string;
  navigate: (r: string) => void;
  children: ReactNode;
  ticker: ReactNode;
}): ReactNode {
  const store = useStore();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [route]);

  const go = (r: string): void => {
    navigate(r);
    setMenuOpen(false);
  };

  const find = (r: string): NavItem => NAV.find((n) => n.route === r)!;
  const mobileTabs: { key: string; label: string; icon: ReactNode; routes: string[]; sheet?: boolean }[] = [
    { key: 'home', label: find('dashboard').short, icon: find('dashboard').icon, routes: ['dashboard'] },
    { key: 'market', label: find('market').short, icon: find('market').icon, routes: ['market'] },
    { key: 'design', label: 'طراحی', icon: <Ruler size={18} />, routes: ['foundation', 'beam', 'column'], sheet: true },
    { key: 'adv', label: find('advisor').short, icon: find('advisor').icon, routes: ['advisor'] },
  ];

  return (
    <div className="min-h-screen bg-bg text-ink">
      {/* top ticker */}
      {ticker}

      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 right-0 z-40 hidden w-64 flex-col border-l border-line bg-panel lg:flex">
        <div className="flex min-w-0 items-center gap-3 overflow-hidden border-b border-line px-4 py-4">
          <LogoMark size={40} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-mono text-[15px] font-bold tracking-tight text-navy">{APP_NAME}</div>
            <div className="truncate text-[10.5px] text-faint">{APP_VERSION_FA} — مهندسی عمران هوشمند</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV.map((item) => {
            const active = item.route === route;
            return (
              <button
                key={item.route}
                onClick={() => go(item.route)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all ${
                  active
                    ? 'bg-emerald-soft text-forest shadow-[inset_2px_0_0_0_#059669]'
                    : 'text-muted hover:bg-panel-2 hover:text-ink'
                }`}
              >
                <span className={active ? 'text-emerald' : 'text-faint'}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="space-y-3 border-t border-line p-3">
          <SourceCard />
          <div className="rounded-xl bg-panel-2 p-3">
            <div className="text-[10.5px] text-faint">پروژه فعال</div>
            <div className="mt-0.5 truncate text-[12px] font-semibold text-ink">{store.projectName || 'بدون نام'}</div>
          </div>
        </div>
      </aside>

      {/* mobile header */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-panel/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2.5">
          <LogoMark size={34} />
          <div>
            <div className="font-mono text-[13px] font-bold text-navy">{APP_NAME}</div>
            <div className="text-[10px] text-faint">{APP_VERSION_FA}</div>
          </div>
        </div>
        <Chip tone="green" className="gap-1.5">
          <LiveDot pulse={false} />
          <span className="tnum">{faNum(market.coverage().live, 0)} قیمت به‌روز</span>
        </Chip>
      </header>

      {/* main */}
      <main className="px-4 pb-28 pt-5 sm:px-6 lg:mr-64 lg:px-8 lg:pb-8 lg:pt-7">{children}</main>

      <Toasts />

      {/* mobile bottom nav — native-app feel, 5 tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-line bg-panel/98 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {mobileTabs.map((tab) => {
          const active = tab.routes.includes(route);
          return (
            <button
              key={tab.key}
              onClick={() => (tab.sheet ? setMenuOpen((v) => !v) : go(tab.routes[0]))}
              className={`relative flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition ${active ? 'text-emerald-deep' : 'text-faint'}`}
            >
              {active ? <span className="absolute top-0 h-0.5 w-8 rounded-full bg-emerald" /> : null}
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* design-module bottom sheet (opened from the طراحی tab) */}
      {menuOpen ? (
        <div className="fixed inset-0 z-50 bg-navy/50 backdrop-blur-sm lg:hidden" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-line bg-panel p-4 pb-6" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-2" />
            <div className="mb-2 text-[12px] font-bold text-ink">ماژول‌های طراحی</div>
            <div className="grid grid-cols-3 gap-2">
              {NAV.filter((n) => ['foundation', 'beam', 'column', 'slab', 'shear-wall', 'staircase', 'ramp', 'joint'].includes(n.route)).map((item) => (
                <button
                  key={item.route}
                  onClick={() => go(item.route)}
                  className={`flex flex-col items-center gap-2 rounded-2xl border p-4 text-[12px] font-semibold transition ${
                    item.route === route ? 'border-mint bg-emerald-soft text-forest' : 'border-line bg-panel-2 text-ink'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


