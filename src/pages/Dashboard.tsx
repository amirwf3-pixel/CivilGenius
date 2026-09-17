
/* ============================================================================
 * CivilGenius v20 — Dashboard
 *   hero · live mini-prices · module cards · management banner · recent calcs
 * ========================================================================== */

import { ArrowLeft, BarChart3, Building2, Columns3, Combine, FileSpreadsheet, FolderInput, Footprints, Layers, MoveUpRight, Ruler, TrendingUp, Waves } from 'lucide-react';
import { CALC_META, type CalcType } from '../lib/engine';
import { faCompactToman, faMoney, faNum, jalaliDate } from '../lib/format';
import { market, useMarket } from '../lib/market';
import { buildSampleProject, useStore } from '../lib/store';
import { NAV } from '../components/Layout';
import { Sparkline, TrendBadge } from '../components/XYChart';
import { Button, Card, Chip, LiveDot, SectionHead } from '../components/ui';
import { APP_NAME, APP_VERSION, APP_VERSION_FA } from '../lib/version';
import { ProjectsPanel } from './Management';

const MODULE_META: Record<CalcType, { icon: typeof Ruler; gradient: string }> = {
  foundation: { icon: Ruler, gradient: 'from-navy to-navy-2' },
  beam: { icon: Waves, gradient: 'from-[#14544a] to-[#1f7a68]' },
  column: { icon: Columns3, gradient: 'from-[#0e3a34] to-[#17695a]' },
  slab: { icon: Layers, gradient: 'from-[#14544a] to-[#0e3a34]' },
  wall: { icon: Building2, gradient: 'from-[#0e3a34] to-navy' },
  stair: { icon: Footprints, gradient: 'from-[#17695a] to-[#14544a]' },
  ramp: { icon: MoveUpRight, gradient: 'from-[#14544a] to-[#1f7a68]' },
  joint: { icon: Combine, gradient: 'from-navy-2 to-[#14544a]' },
};

export function DashboardPage({ navigate }: { navigate: (r: string) => void }) {
  const snap = useMarket();
  const store = useStore();
  const cov = market.coverage();
  const highlights = ['rebar', 'ibeam', 'sheet', 'concrete'] as const;

  const loadSample = (): void => {
    const s = buildSampleProject();
    store.setProjectName(s.projectName);
    store.setClient(s.client);
    store.setInput('foundation', s.foundation);
    store.setInput('beam', s.beam);
    store.setInput('column', s.column);
    store.setMultipliers(s.multipliers);
    store.pushToast('پروژه نمونه بارگذاری شد', 'info');
  };

  const recent = store.recent;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      {/* hero */}
      <section className="rise relative overflow-hidden rounded-3xl border border-white/10 bg-navy text-white">
        {/* hero visual: CSS blueprint grid (self-contained, no external asset).
            The previous photographic hero asset was not recoverable after the
            workspace reset, so it was removed in favour of this clean fallback. */}
        <div className="absolute inset-0 bg-gradient-to-l from-navy via-navy/85 to-navy/45" />
        <div className="bp-grid-dark absolute inset-0 opacity-60" />
        <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-[11px] text-white/80">
              <LiveDot />
              {APP_VERSION_FA} — موتور محاسبات مهندسی + استعلام قیمت بازار
            </span>
            <h1 className="mt-4 text-2xl font-bold leading-snug sm:text-3xl">
              {APP_NAME}
              <span className="mr-2 font-mono text-gold">{APP_VERSION}</span>
            </h1>
            <p className="mt-2 max-w-xl text-[13px] leading-7 text-white/75">
              طراحی هشت المان سازه‌ای (پی، تیر، ستون، سقف، دیوار برشی، راه‌پله، رمپ و چشمه اتصال) بر پایه مقررات ملی ساختمان،
              متره و برآورد با آخرین استعلام موفق قیمت بازار فولاد، و صدور سه سند قابل ویرایش (Excel، Word، DXF) و مدیریت چند پروژه.
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Button variant="green" size="lg" icon={<FolderInput size={17} />} onClick={loadSample}>
                پروژه نمونه ارائه
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="border-white/25 bg-white/8 text-white hover:border-white/50 hover:text-white"
                icon={<Ruler size={17} />}
                onClick={() => navigate('foundation')}
              >
                شروع طراحی فونداسیون
              </Button>
            </div>
            <div className="mt-6 grid max-w-lg grid-cols-3 gap-3">
              {[
                ['ماژول مهندسی', faNum(Object.keys(CALC_META).length, 0)],
                ['قلم مصالح', faNum(market.materials.length, 0)],
                ['قیمت به‌روز', faNum(cov.live, 0)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-white/12 bg-white/6 p-3">
                  <div className="text-[10px] text-white/60">{label}</div>
                  <div className="text-lg font-bold text-white tnum">{value}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/12 bg-white/6 p-4 backdrop-blur-sm">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-[13px] font-bold">
                <TrendingUp size={15} className="text-gold" />
                آخرین استعلام قیمت بازار
              </h2>
              <span className="text-[10.5px] text-white/55">{jalaliDate()}</span>
            </div>
            <ul className="space-y-2.5">
              {highlights.map((id) => {
                const def = market.def(id);
                const st = snap.live[id];
                return (
                  <li key={id} className="flex items-center gap-3">
                    <span className={`size-1.5 shrink-0 rounded-full ${st.status === 'live' ? 'bg-emerald' : st.status === 'reference' ? 'bg-blue' : 'bg-gold'}`} />
                    <span className="min-w-0 flex-1 truncate text-[11.5px] text-white/80">{def.name}</span>
                    <span className="h-6 w-16 shrink-0">
                      <Sparkline points={market.historyOf(id)} color={st.status === 'live' ? '#10b981' : '#93c5fd'} height={24} />
                    </span>
                    <span className="shrink-0 font-mono text-[12px] font-bold text-white tnum">{faCompactToman(snap.prices[id])}</span>
                  </li>
                );
              })}
            </ul>
            <button
              onClick={() => navigate('market')}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/8 py-2 text-[11.5px] font-semibold text-white/85 transition hover:bg-white/15"
            >
              مشاهده تابلوی کامل بازار
              <ArrowLeft size={14} />
            </button>
          </div>
        </div>
      </section>

      {/* modules */}
      <section>
        <SectionHead title="ماژول‌های طراحی" subtitle="هر ماژول خروجی کامل شامل ارزیابی مهندسی، متره و برآورد و سه فایل قابل ویرایش می‌دهد." icon={<BarChart3 size={17} />} />
        <div className="grid gap-4 md:grid-cols-3">
          {(['foundation', 'beam', 'column', 'slab', 'wall', 'stair', 'ramp', 'joint'] as CalcType[]).map((type) => {
            const meta = MODULE_META[type];
            const Icon = meta.icon;
            const result = store.results[type];
            const desc: Record<CalcType, string> = {
              foundation: 'ظرفیت باربری ترزاگی، کنترل تنش و برش، شبکه آرماتور دو طرفه',
              beam: 'لنگر و برش نهایی، آرماتور خمشی، خاموت، کنترل خیز و نمودار BMD/SFD',
              column: 'نمودار تعامل P-M، اثر لاغری، آرماتور طولی و خاموت',
              slab: 'تیرچه-بلوک، وافل، دال و مجوف — آرماتور منفی، حرارتی/مونس، تای‌بیم و خیز',
              wall: 'آرماتور افقی/عمودی، المان مرزی، برش لغزشی و دریفت',
              stair: 'دال پله، خم مهار تکیه‌گاهی و کنترل خیز',
              ramp: 'دال شیبدار رمپ، خم مهار ۹۰ درجه و کنترل خیز',
              joint: 'برش چشمه φVn ≥ Vu و خاموت محصورکننده داخلی',
            };
            return (
              <button
                key={type}
                onClick={() => navigate(type)}
                className={`group relative overflow-hidden rounded-2xl bg-gradient-to-l ${meta.gradient} p-5 text-right text-white transition-transform hover:-translate-y-0.5`}
              >
                <div className="bp-grid-dark absolute inset-0 opacity-50" />
                <div className="relative">
                  <div className="flex items-start justify-between">
                    <span className="grid size-11 place-items-center rounded-2xl bg-white/10 text-gold">
                      <Icon size={21} />
                    </span>
                    {result ? <Chip tone="green">{result.verdict.ok ? 'محاسبه شد' : 'نیاز به اصلاح'}</Chip> : null}
                  </div>
                  <h3 className="mt-3 text-[15px] font-bold">{CALC_META[type].title}</h3>
                  <p className="mt-1 text-[11.5px] leading-6 text-white/70">{desc[type]}</p>
                  {result ? (
                    <p className="mt-2 text-[10.5px] text-white/55 tnum" dir="ltr">
                      {result.code}
                    </p>
                  ) : null}
                  <span className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-gold">
                    ورود به ماژول
                    <ArrowLeft size={14} />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* project management (save/load/import) */}
      <ProjectsPanel />

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        {/* recent calculations */}
        <Card className="p-4">
          <SectionHead title="محاسبات اخیر" subtitle="آخرین اسناد صادرشده در این نشست" icon={<FileSpreadsheet size={17} />} />
          {recent.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line-2 bg-panel-2 px-4 py-8 text-center text-[12px] text-faint">
              هنوز محاسبه‌ای انجام نشده است. از ماژول‌های بالا شروع کنید یا پروژه نمونه را بارگذاری کنید.
            </p>
          ) : (
            <ul className="space-y-2">
              {recent.map((r) => (
                <li key={r.code} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-panel-2 px-3.5 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className={`size-2 rounded-full ${r.verdict.ok ? 'bg-emerald' : 'bg-bad'}`} />
                    <div>
                      <div className="text-[12.5px] font-bold text-ink">{CALC_META[r.type].title}</div>
                      <div className="text-[10.5px] text-faint tnum" dir="ltr">
                        {r.code}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Chip tone={r.verdict.ok ? 'ok' : 'bad'}>{r.verdict.ok ? 'قابل قبول' : 'اصلاح'}</Chip>
                    <Button size="sm" variant="ghost" onClick={() => navigate(r.type)}>
                      مشاهده
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* quick price + navigation */}
        <Card className="p-4">
          <SectionHead title="دسترسی سریع" subtitle="ماژول‌ها و ابزارها" icon={<ArrowLeft size={17} />} />
          <div className="grid grid-cols-2 gap-2">
            {NAV.map((item) => (
              <button
                key={item.route}
                onClick={() => navigate(item.route)}
                className="flex items-center gap-2 rounded-xl border border-line bg-panel-2 px-3 py-2.5 text-[12px] font-medium text-muted transition hover:border-navy hover:text-navy"
              >
                <span className="text-navy">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
          <div className="mt-4 rounded-xl bg-navy p-3.5 text-white">
            <div className="flex items-center justify-between">
              <span className="text-[11.5px] text-white/70">ارزش تقریبی اقلم اصلی</span>
              <LiveDot />
            </div>
            <div className="mt-1.5 text-lg font-bold tnum">
              {faMoney(snap.prices.rebar * 1000 + snap.prices.concrete, 'تومان')}
            </div>
            <p className="mt-1 text-[10.5px] leading-5 text-white/60">
              یک تن میلگرد A3 به‌علاوه یک متر مکعب بتن آماده، بر پایه آخرین قیمت‌های ثبت‌شده.
            </p>
            <div className="mt-2 flex items-center gap-2 text-[10.5px] text-white/70">
              روند ۱۸۰ روزه میلگرد
              <TrendBadge points={market.historyOf('rebar')} className="bg-white/15 text-white" />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}


