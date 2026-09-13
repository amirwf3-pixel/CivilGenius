
/* ============================================================================
 * CivilGenius v20 — app root: hash routing, splash, store provider, live prices
 * ========================================================================== */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_BEAM, DEFAULT_COLUMN, DEFAULT_FOUNDATION, type AnyInput, type CalcResult, type CalcType } from './lib/engine';
import { DEFAULT_JOINT, DEFAULT_RAMP, DEFAULT_SLAB, DEFAULT_STAIR, DEFAULT_WALL } from './lib/modules';
import { useMarket, type MarketSnapshot } from './lib/market';
import { initLivePrices } from './lib/livePrices';
import { DEFAULT_MULTIPLIERS, StoreCtx, type Multipliers, type StoreValue, type Toast } from './lib/store';
import { Layout, NAV } from './components/Layout';
import { TickerStrip } from './components/TickerStrip';
import { DashboardPage } from './pages/Dashboard';
import { MarketPage } from './pages/Market';
import { FoundationPage } from './pages/Foundation';
import { BeamPage } from './pages/Beam';
import { ColumnPage } from './pages/Column';
import { AdvisorPage } from './pages/Advisor';
import { SlabPage } from './pages/Slab';
import { WallPage } from './pages/Wall';
import { StairPage } from './pages/Stair';
import { RampPage } from './pages/Ramp';
import { JointPage } from './pages/Joint';
import { ReportHubPage } from './pages/ReportHub';

const VALID = NAV.map((n) => n.route);

function routeFromHash(): string {
  const raw = window.location.hash.replace(/^#\/?/, '').trim();
  return VALID.includes(raw) ? raw : 'dashboard';
}

function Splash() {
  return (
    <div className="grid min-h-screen place-items-center bg-navy text-white">
      <div className="flex flex-col items-center gap-4">
        <div className="splash-ring" />
        <div className="text-center">
          <div className="font-mono text-lg font-bold tracking-tight">
            CivilGenius <span className="text-gold">v22</span>
          </div>
          <p className="mt-1 text-[11.5px] text-white/60">در حال بارگذاری موتور محاسبات و قیمت‌های بازار…</p>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [route, setRoute] = useState<string>(() => (typeof window !== 'undefined' ? routeFromHash() : 'dashboard'));
  const [ready, setReady] = useState(false);

  const [projectName, setProjectName] = useState('پروژه ساختمانی شماره ۱');
  const [client, setClient] = useState('کارفرما: —');
  const [inputs, setInputs] = useState({
    foundation: { ...DEFAULT_FOUNDATION },
    beam: { ...DEFAULT_BEAM },
    column: { ...DEFAULT_COLUMN },
    slab: { ...DEFAULT_SLAB },
    wall: { ...DEFAULT_WALL },
    stair: { ...DEFAULT_STAIR },
    ramp: { ...DEFAULT_RAMP },
    joint: { ...DEFAULT_JOINT },
  });
  const [results, setResults] = useState<Partial<Record<CalcType, CalcResult>>>({});
  const [recent, setRecent] = useState<CalcResult[]>([]);
  const [multipliers, setMultipliers] = useState<Multipliers>({ ...DEFAULT_MULTIPLIERS });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const snap: MarketSnapshot = useMarket();
  const marketRef = useRef<MarketSnapshot>(snap);
  marketRef.current = snap;

  useEffect(() => {
    const onHash = (): void => setRoute(routeFromHash());
    window.addEventListener('hashchange', onHash);
    initLivePrices();
    const t = setTimeout(() => setReady(true), 850);
    return () => {
      window.removeEventListener('hashchange', onHash);
      clearTimeout(t);
    };
  }, []);

  const navigate = useCallback((r: string): void => {
    window.location.hash = `#/${r}`;
    setRoute(r);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const pushToast = useCallback((text: string, tone: Toast['tone'] = 'ok'): void => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-3), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const dismissToast = useCallback((id: number): void => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const setInput = useCallback(<T extends CalcType>(type: T, value: AnyInput): void => {
    setInputs((prev) => ({ ...prev, [type]: value }) as typeof prev);
  }, []);

  const setResult = useCallback((type: CalcType, result: CalcResult): void => {
    setResults((prev) => ({ ...prev, [type]: result }));
    setRecent((prev) => [result, ...prev.filter((r) => r.code !== result.code)].slice(0, 8));
  }, []);

  const value: StoreValue = useMemo(
    () => ({
      projectName,
      client,
      setProjectName,
      setClient,
      inputs,
      setInput,
      results,
      setResult,
      recent,
      multipliers,
      setMultipliers,
      toasts,
      pushToast,
      dismissToast,
      loadSample: () => undefined,
      marketRef,
    }),
    [projectName, client, inputs, setInput, results, setResult, recent, multipliers, toasts, pushToast, dismissToast],
  );

  if (!ready) return <Splash />;

  const page = (() => {
    switch (route) {
      case 'market':
        return <MarketPage />;
      case 'foundation':
        return <FoundationPage />;
      case 'beam':
        return <BeamPage />;
      case 'column':
        return <ColumnPage />;
      case 'slab':
        return <SlabPage />;
      case 'shear-wall':
        return <WallPage />;
      case 'staircase':
        return <StairPage />;
      case 'ramp':
        return <RampPage />;
      case 'joint':
        return <JointPage />;
      case 'report-generator':
        return <ReportHubPage />;
      case 'advisor':
        return <AdvisorPage />;
      default:
        return <DashboardPage navigate={navigate} />;
    }
  })();

  return (
    <StoreCtx.Provider value={value}>
      <Layout route={route} navigate={navigate} ticker={<TickerStrip />}>
        {page}
      </Layout>
    </StoreCtx.Provider>
  );
}



