
/* ============================================================================
 * CivilGenius v20 — Market board
 *   coverage bar · main chart · 10 source-attributed price cards · manual editor
 * ========================================================================== */

import { useEffect, useState } from 'react';
import { AlertTriangle, BadgeCheck, ExternalLink, Info, PenLine, RefreshCw, TrendingUp } from 'lucide-react';
import { MATERIALS, market, useClock, useMarket, type MaterialId } from '../lib/market';
import { refreshLivePrices } from '../lib/livePrices';
import { faAgo, faClock, faCompactToman, faMoney, faNum, faStamp, jalaliDate, parseNum, toFa } from '../lib/format';
import { Sparkline, TrendBadge, XYChart } from '../components/XYChart';
import { Button, Card, Chip, LiveDot, SectionHead } from '../components/ui';

const STATUS = {
  live: { label: 'به‌روز', tone: 'ok' as const, color: '#059669', bg: 'bg-emerald-soft', text: 'text-forest', border: 'border-mint' },
  reference: { label: 'مبنای معتبر', tone: 'info' as const, color: '#2563eb', bg: 'bg-blue-soft', text: 'text-blue', border: 'border-[#d1e0ff]' },
  manual: { label: 'دستی وارد کنید', tone: 'warn' as const, color: '#b54708', bg: 'bg-warn-soft', text: 'text-warn', border: 'border-[#fde68a]' },
};

export function MarketPage() {
  const snap = useMarket();
  const now = useClock(1000);
  const [selected, setSelected] = useState<MaterialId>('rebar');
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<MaterialId | null>(null);
  const [draft, setDraft] = useState('');
  const cov = market.coverage();
  const def = snap.live[selected];
  const defInfo = MATERIALS.find((m) => m.id === selected)!;

  useEffect(() => {
    if (editor) setDraft(toFa(Math.round(snap.prices[editor]).toLocaleString('en-US')));
  }, [editor, snap.prices]);

  const doRefresh = async (): Promise<void> => {
    setBusy(true);
    await refreshLivePrices({ force: true });
    setBusy(false);
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <header className="rise flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold text-ink sm:text-xl">
            <TrendingUp size={20} className="text-emerald" />
            بازار مصالح و قیمت روز
          </h1>
          <p className="mt-1 max-w-2xl text-[12.5px] leading-6 text-muted">
            قیمت فولاد از <span dir="ltr">ahanonline.com</span> استعلام می‌شود؛ سایر اقلام با ذکر دقیق منبع و تاریخ اعلام می‌شوند. هر
            قیمتی که منبع عمومی ندارد، به‌صورت شفاف «دستی وارد کنید» علامت‌گذاری شده است.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Button variant="green" onClick={() => void doRefresh()} disabled={busy} icon={<RefreshCw size={16} className={busy ? 'animate-spin' : ''} />}>
            {busy ? 'در حال استعلام…' : 'استعلام آهن‌آنلاین'}
          </Button>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-faint tnum">
            <LiveDot pulse />
            ساعت بازار: {faClock(now)}
          </span>
        </div>
      </header>

      {/* coverage bar */}
      <Card className="p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[13px] font-bold text-ink">پوشش منابع قیمت</h2>
          <span className="text-[11px] text-faint">{jalaliDate()}</span>
        </div>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-[#eef0f4]">
          <div className="h-full bg-emerald transition-all duration-700" style={{ width: `${(cov.live / cov.total) * 100}%` }} />
          <div className="h-full bg-blue transition-all duration-700" style={{ width: `${(cov.reference / cov.total) * 100}%` }} />
          <div className="h-full bg-gold transition-all duration-700" style={{ width: `${(cov.manual / cov.total) * 100}%` }} />
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-emerald" />
            به‌روز از آهن‌آنلاین: <b className="tnum text-forest">{faNum(cov.live, 0)}</b>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-blue" />
            مبنای معتبر: <b className="tnum text-blue">{faNum(cov.reference, 0)}</b>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-gold" />
            نیازمند ورود دستی: <b className="tnum text-warn">{faNum(cov.manual, 0)}</b>
          </span>
          <span className="mr-auto flex items-center gap-1.5">
            <LiveDot tone={snap.fetch.status === 'ok' ? 'ok' : snap.fetch.status === 'error' ? 'warn' : 'warn'} pulse={snap.fetch.status === 'loading'} />
            {snap.fetch.at ? faAgo(now - snap.fetch.at) : 'هنوز استعلامی انجام نشده'}
          </span>
        </div>
        {snap.fetch.message ? <p className="mt-2 text-[11.5px] text-muted">{snap.fetch.message}</p> : null}
      </Card>

      {/* main chart */}
      <Card className="p-4">
        <SectionHead
          title={defInfo.name}
          subtitle={`${defInfo.nameEn} — واحد: ${defInfo.unit}`}
          icon={<TrendingUp size={17} />}
          action={
            <div className="flex items-center gap-2">
              <Chip tone={STATUS[def.status].tone}>{STATUS[def.status].label}</Chip>
              <TrendBadge points={market.historyOf(selected)} />
            </div>
          }
        />
        <div className="mb-3 flex flex-wrap gap-1.5">
          {MATERIALS.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelected(m.id)}
              className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition ${
                selected === m.id ? 'border-navy bg-navy text-white' : 'border-line-2 bg-panel text-muted hover:border-navy hover:text-navy'
              }`}
            >
              {m.name.split(' ').slice(0, 2).join(' ')}
            </button>
          ))}
        </div>
        <XYChart points={market.historyOf(selected)} color={STATUS[def.status].color} yLabel={defInfo.unit} height={240} />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
          <div>
            <div className="text-[11px] text-faint">آخرین قیمت</div>
            <div className="text-lg font-bold text-ink tnum">{faMoney(snap.prices[selected], `تومان / ${defInfo.unit}`)}</div>
          </div>
          {defInfo.sourceUrl ? (
            <a
              href={defInfo.sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 rounded-lg border border-line-2 px-3 py-2 text-[11.5px] font-semibold text-navy transition hover:border-navy"
            >
              مشاهده در {defInfo.sourceName}
              <ExternalLink size={13} />
            </a>
          ) : (
            <Chip tone="warn">
              <Info size={12} />
              منبع عمومی ندارد
            </Chip>
          )}
        </div>
      </Card>

      {/* price cards */}
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-3">
        {MATERIALS.map((m) => {
          const st = snap.live[m.id];
          const meta = STATUS[st.status];
          const missingManual = m.sourceType === 'manual' && snap.overrides[m.id] === undefined;
          return (
            <button
              key={m.id}
              onClick={() => {
                setSelected(m.id);
                setEditor(m.id);
              }}
              className={`glass min-w-[240px] snap-center p-3.5 text-right transition-all hover:shadow-md sm:min-w-0 ${missingManual ? 'border-gold bg-gold-soft/40' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-[12.5px] font-bold text-ink">{m.name}</h3>
                  <p className="mt-0.5 text-[10.5px] text-faint">{m.nameEn}</p>
                </div>
                {st.status === 'live' ? <BadgeCheck size={15} className="shrink-0 text-emerald" /> : missingManual ? <AlertTriangle size={15} className="shrink-0 text-gold" /> : null}
              </div>
              <div className="mt-2.5 flex items-end justify-between gap-2">
                <div>
                  <div className={`text-[16px] font-bold tnum ${snap.prices[m.id] > 0 ? 'text-ink' : 'text-warn'}`}>
                    {snap.prices[m.id] > 0 ? faCompactToman(snap.prices[m.id]) : '—'}
                  </div>
                  <div className="text-[10px] text-faint">
                    {snap.prices[m.id] > 0 ? `تومان / ${m.unit}` : 'قیمت به‌روز نیست؛ دستی وارد کنید'}
                  </div>
                </div>
                <span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${meta.bg} ${meta.text}`}>{meta.label}</span>
              </div>
              <div className="mt-2 h-8">
                <Sparkline points={market.historyOf(m.id)} color={meta.color} />
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-2 text-[10.5px]">
                <span className="truncate text-muted">{m.sourceName}</span>
                <span className="shrink-0 text-faint tnum">بروزرسانی: {faStamp(snap.updatedAt[m.id])}</span>
                {m.sourceUrl ? (
                  <a
                    href={m.sourceUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex shrink-0 items-center gap-1 font-semibold text-navy hover:underline"
                  >
                    منبع
                    <ExternalLink size={11} />
                  </a>
                ) : (
                  <span className="shrink-0 font-semibold text-warn">ورود دستی</span>
                )}
              </div>
              <p className="mt-1.5 line-clamp-2 text-[10px] leading-5 text-faint">{m.sourceNote}</p>
            </button>
          );
        })}
      </div>

      {/* manual editor */}
      {editor ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-navy/55 p-4 backdrop-blur-sm" onClick={() => setEditor(null)}>
          <Card className="w-full max-w-md p-5" >
            <div onClick={(e) => e.stopPropagation()}>
              <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
                <PenLine size={16} className="text-navy" />
                ویرایش قیمت دستی
              </h3>
              <p className="mt-1 text-[11.5px] leading-6 text-muted">
                {MATERIALS.find((m) => m.id === editor)?.sourceNote}
              </p>
              <div className="mt-4">
                <label className="mb-1.5 block text-[12px] font-medium text-ink">قیمت (تومان بر {MATERIALS.find((m) => m.id === editor)?.unit})</label>
                <input
                  autoFocus
                  dir="rtl"
                  className="field-input tnum focus:field-input-focus"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="مثلاً ۹۵٬۰۰۰"
                />
              </div>
              <div className="mt-4 flex gap-2">
                <Button
                  variant="green"
                  className="flex-1"
                  onClick={() => {
                    const v = parseNum(draft);
                    if (!Number.isFinite(v) || v <= 0) {
                      market.setFetchStatus('error', 'عدد واردشده معتبر نیست');
                      return;
                    }
                    market.override(editor, v);
                    setEditor(null);
                  }}
                >
                  اعمال قیمت
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    market.clearOverride(editor);
                    setEditor(null);
                  }}
                >
                  حذف و بازگشت به مبنا
                </Button>
                <Button variant="ghost" onClick={() => setEditor(null)}>
                  بستن
                </Button>
              </div>
              <p className="mt-3 text-[10.5px] leading-5 text-faint">
                قیمت دستی در همه محاسبات، متره و اسناد صادرشده اعمال می‌شود و در وضعیت «دستی» علامت‌گذاری می‌ماند تا شفافیت منبع حفظ شود.
              </p>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}


