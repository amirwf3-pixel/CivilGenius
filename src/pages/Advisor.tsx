
/* ============================================================================
 * CivilGenius v20 — AI advisor (offline engine + optional Groq refinement)
 * ========================================================================== */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import katex from 'katex';
import { BookOpen, Bot, KeyRound, Send, Sparkles, TriangleAlert, User, Wifi } from 'lucide-react';
import { answerGroq, answerLocal, SUGGESTED_BY_PAGE, SUGGESTED_QUESTIONS, type ChatMessage } from '../lib/knowledge';
import { faNum } from '../lib/format';
import { useStore } from '../lib/store';
import { Button, Card, Chip, SectionHead } from '../components/ui';

interface UIMessage {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  source?: 'offline' | 'groq';
  confidence?: number;
  refs?: string[];
}

const KEY_STORAGE = 'cg_groq_key';

/* ---------------------------------------------------------------------------
 * math rendering — ASCII/unicode engineering formulas → KaTeX
 * ------------------------------------------------------------------------- */
const PERSIAN_RE = /[\u0600-\u06FF]/;
const MATH_LINE_RE = /[=≤≥·√φρ]/;

function toLatex(src: string): string {
  return src
    .replace(/√\s*\(/g, '\\sqrt{(')
    .replace(/√\s*([A-Za-z0-9]+)/g, '\\sqrt{$1}')
    .replace(/·/g, ' \\cdot ')
    .replace(/As\b/g, 'A_s')
    .replace(/Av\b/g, 'A_v')
    .replace(/Ac\b/g, 'A_c')
    .replace(/\bMu\b/g, 'M_u')
    .replace(/\bVu\b/g, 'V_u')
    .replace(/\bPu\b/g, 'P_u')
    .replace(/\bMn\b/g, 'M_n')
    .replace(/\bVn\b/g, 'V_n')
    .replace(/\bPn\b/g, 'P_n')
    .replace(/\bqn\b/g, 'q_n')
    .replace(/\bfc\b/g, 'f_c')
    .replace(/\bfy\b/g, 'f_y')
    .replace(/φ/g, '\\phi ')
    .replace(/ρ/g, '\\rho ')
    .replace(/≤/g, ' \\leq ')
    .replace(/≥/g, ' \\geq ')
    .replace(/≠/g, ' \\neq ')
    .replace(/±/g, ' \\pm ')
    .replace(/\s+/g, ' ')
    .trim();
}

function Katex({ tex, block = false }: { tex: string; block?: boolean }): ReactNode {
  const html = useMemo(() => {
    try {
      return katex.renderToString(toLatex(tex), { throwOnError: false, displayMode: block, output: 'html' });
    } catch {
      return null;
    }
  }, [tex, block]);
  if (!html) return <span dir="ltr" className="font-mono">{tex}</span>;
  return (
    <span dir="ltr" className={block ? 'my-1 block overflow-x-auto text-center' : ''} dangerouslySetInnerHTML={{ __html: html }} />
  );
}

/** renders a chat body: whole formula lines as KaTeX blocks, inline $...$ as inline KaTeX */
export function MathText({ text }: { text: string }): ReactNode {
  return (
    <>
      {text.split('\n').map((line, li) => {
        const t = line.trim();
        const parts = line.split(/\$([^$]+)\$/g);
        const hasInline = parts.length > 1;
        if (!hasInline && t && !PERSIAN_RE.test(t) && MATH_LINE_RE.test(t)) {
          return <Katex key={li} tex={t} block />;
        }
        const nonMath = parts.filter((_, i) => i % 2 === 0).join('');
        const centered = hasInline && !PERSIAN_RE.test(nonMath) && MATH_LINE_RE.test(line);
        return (
          <p key={li} className={centered ? 'my-1 text-center' : 'whitespace-pre-wrap'}>
            {parts.map((seg, si) =>
              si % 2 === 1 ? (
                <Katex key={si} tex={seg} />
              ) : (
                <span key={si} className={!PERSIAN_RE.test(seg) && MATH_LINE_RE.test(seg) ? 'font-mono text-[11px] text-ink' : undefined}>
                  {seg}
                </span>
              ),
            )}
          </p>
        );
      })}
    </>
  );
}

/** active route from the hash — drives context-aware suggestion chips */
function useRoute(): string {
  const read = (): string => window.location.hash.replace(/^#\/?/, '').trim() || 'advisor';
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const h = (): void => setRoute(read());
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  return route;
}

function useTypewriter(text: string, speed = 12): string {
  const [shown, setShown] = useState('');
  useEffect(() => {
    if (!text) {
      setShown('');
      return;
    }
    let i = 0;
    const id = setInterval(() => {
      i += 3;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return shown;
}

function Bubble({ msg }: { msg: UIMessage }) {
  const isUser = msg.role === 'user';
  const typed = useTypewriter(isUser ? msg.text : '', 8);
  return (
    <div className={`rise flex gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
      <span
        className={`grid size-8 shrink-0 place-items-center rounded-xl ${
          isUser ? 'bg-navy text-white' : 'bg-emerald-soft text-forest'
        }`}
      >
        {isUser ? <User size={15} /> : <Bot size={15} />}
      </span>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-6 ${
          isUser ? 'bg-navy text-white' : 'glass text-ink'
        }`}
      >
        {isUser ? <p className="whitespace-pre-wrap">{typed}</p> : <MathText text={msg.text} />}
        {!isUser && msg.source ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-line pt-2">
            <Chip tone={msg.source === 'groq' ? 'info' : 'ok'}>
              {msg.source === 'groq' ? 'مدل زبانی آنلاین' : 'پایگاه دانش آفلاین'}
            </Chip>
            {typeof msg.confidence === 'number' && msg.confidence > 0 ? (
              <Chip tone="neutral">اطمینان {faNum(msg.confidence * 100, 0)}٪</Chip>
            ) : null}
            {msg.refs?.length ? (
              <span className="inline-flex items-center gap-1 text-[10.5px] text-faint">
                <BookOpen size={12} />
                {msg.refs.join(' | ')}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function AdvisorPage() {
  const store = useStore();
  const [messages, setMessages] = useState<UIMessage[]>([
    {
      id: 0,
      role: 'assistant',
      text:
        'سلام. من مشاور آیین‌نامه CivilGenius هستم. بر پایه مبحث ششم، هفتم و نهم مقررات ملی ساختمان و آیین‌نامه ۲۸۰۰ پاسخ می‌دهم. اگر کلید Groq را در تنظیمات وارد کنید، پاسخ‌ها با مدل زبانی آنلاین تکمیل می‌شود؛ در غیر این صورت از پایگاه دانش آفلاین استفاده می‌کنم.',
      source: 'offline',
    },
  ]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'local' | 'live'>('local');
  const route = useRoute();
  const chips = SUGGESTED_BY_PAGE[route] ?? SUGGESTED_QUESTIONS;
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState(() => (typeof localStorage !== 'undefined' ? (localStorage.getItem(KEY_STORAGE) ?? '') : ''));
  const scroller = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const send = async (question: string): Promise<void> => {
    const q = question.trim();
    if (!q || busy) return;
    const id = Date.now();
    setMessages((m) => [...m, { id, role: 'user', text: q }]);
    setDraft('');
    setBusy(true);
    const history: ChatMessage[] = messages
      .filter((m) => m.id !== 0)
      .map((m) => ({ role: m.role, content: m.text }));
    let reply: UIMessage;
    if (mode === 'live' && !apiKey) {
      store.pushToast('برای مدل زنده، کلید API گروک لازم است — پنجره تنظیمات باز شد', 'warn');
      setShowSettings(true);
      setBusy(false);
      return;
    }
    if (mode === 'live') {
      try {
        const res = await answerGroq(q, history, apiKey);
        reply = { id: id + 1, role: 'assistant', text: res.text, source: 'groq' };
      } catch (err) {
        const local = answerLocal(q);
        reply = {
          id: id + 1,
          role: 'assistant',
          text: `${local.text}\n\n(دسترسی به مدل آنلاین ممکن نشد: ${err instanceof Error ? err.message : 'خطا'} — پاسخ آفلاین ارائه شد.)`,
          source: 'offline',
          confidence: local.confidence,
          refs: local.topics.flatMap((t) => t.refs),
        };
        store.pushToast('مدل آنلاین در دسترس نبود — پاسخ آفلاین', 'warn');
      }
    } else {
      const local = answerLocal(q);
      reply = { id: id + 1, role: 'assistant', text: local.text, source: 'offline', confidence: local.confidence, refs: local.topics.flatMap((t) => t.refs) };
    }
    setMessages((m) => [...m, reply]);
    setBusy(false);
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <header className="rise flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-navy text-gold">
            <Bot size={20} />
          </span>
          <div>
            <h1 className="text-lg font-bold text-ink sm:text-xl">مشاور آیین‌نامه</h1>
            <p className="mt-0.5 max-w-2xl text-[12.5px] leading-6 text-muted">
              پرسش‌های مهندسی خود را بر پایه مبحث ششم، هفتم و نهم مقررات ملی ساختمان و آیین‌نامه ۲۸۰۰ بپرسید. پایگاه دانش آفلاین
              همیشه در دسترس است؛ اتصال آنلاین اختیاری است.
            </p>
          </div>
        </div>
        <Button variant="outline" icon={<KeyRound size={16} />} onClick={() => setShowSettings(true)}>
          تنظیمات اتصال
        </Button>
      </header>

      <div className="glass flex w-fit flex-wrap items-center gap-1 p-1">
        <button
          onClick={() => setMode('local')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11.5px] font-bold transition ${
            mode === 'local' ? 'bg-emerald-deep text-white shadow-sm' : 'text-muted hover:text-ink'
          }`}
        >
          <BookOpen size={14} />
          پایگاه دانش محلی (RAG / مباحث ملی)
        </button>
        <button
          onClick={() => setMode('live')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11.5px] font-bold transition ${
            mode === 'live' ? 'bg-navy text-white shadow-sm' : 'text-muted hover:text-ink'
          }`}
        >
          <Wifi size={14} />
          مدل زنده — دستیار هوشمند (Groq / LLM)
        </button>
      </div>

      <Card className="flex h-[62vh] min-h-[420px] flex-col overflow-hidden">
        <div ref={scroller} className="flex-1 space-y-3.5 overflow-y-auto p-4">
          {messages.map((m) => (
            <Bubble key={m.id} msg={m} />
          ))}
          {busy ? (
            <div className="flex gap-2.5">
              <span className="grid size-8 place-items-center rounded-xl bg-emerald-soft text-forest">
                <Bot size={15} />
              </span>
              <div className="glass flex items-center gap-1.5 px-3.5 py-3">
                <span className="size-1.5 animate-bounce rounded-full bg-emerald" />
                <span className="size-1.5 animate-bounce rounded-full bg-emerald [animation-delay:120ms]" />
                <span className="size-1.5 animate-bounce rounded-full bg-emerald [animation-delay:240ms]" />
              </div>
            </div>
          ) : null}
        </div>
        <div className="border-t border-line p-4 sm:p-4">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {chips.map((q) => (
              <button
                key={q}
                onClick={() => void send(q)}
                className="rounded-lg border border-line-2 bg-panel-2 px-2.5 py-1.5 text-[11px] text-muted transition hover:border-emerald hover:text-forest"
              >
                {q}
              </button>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send(draft);
            }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="مثلاً: حداقل پوشش بتنی در تماس با خاک چقدر است؟"
              className="field-input flex-1 focus:field-input-focus"
              disabled={busy}
            />
            <Button type="submit" variant="green" disabled={busy || !draft.trim()} icon={<Send size={16} />}>
              ارسال
            </Button>
          </form>
        </div>
      </Card>

      <Card className="p-4">
        <SectionHead title="منابع پایگاه دانش" subtitle="موضوعات مستندشده در موتور آفلاین" icon={<BookOpen size={17} />} />
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[
            'بارهای وارد بر ساختمان (مبحث ششم)',
            'تحلیل لرزه‌ای و ضریب بازتاب (۲۸۰۰)',
            'ظرفیت باربری خاک و فونداسیون',
            'طرح خمشی تیر بتنی',
            'طرح برشی و خاموت‌گذاری',
            'ستون و نمودار تعامل P-M',
            'پوشش بتنی و دوام',
            'طول هم‌پوشانی و وصله آرماتور',
            'دال‌های بتنی و ضخامت حداقل',
            'گودبرداری و ایمنی کارگاه',
            'عمل‌آوری و زمان قالب‌برداری',
            'متره و برآورد و فهرست بها',
          ].map((t) => (
            <li key={t} className="rounded-lg border border-line bg-panel-2 px-3 py-2 text-[11.5px] text-muted">
              {t}
            </li>
          ))}
        </ul>
      </Card>

      {showSettings ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-navy/55 p-4 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
          <div className="glass w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
              <Sparkles size={16} className="text-gold" />
              اتصال به مدل زبانی آنلاین (Groq)
            </h3>
            <p className="mt-1.5 text-[11.5px] leading-6 text-muted">
              کلید API فقط در حافظه محلی همین مرورگر ذخیره می‌شود و به هیچ سرور دیگری ارسال نمی‌شود. بدون کلید، موتور آفلاین پاسخ می‌دهد.
            </p>
            <input
              dir="ltr"
              type="password"
              className="field-input mt-3 font-mono text-[12px] focus:field-input-focus"
              placeholder="gsk_..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <p className="mt-2 flex items-start gap-1.5 text-[10.5px] leading-5 text-faint">
              <TriangleAlert size={13} className="mt-0.5 shrink-0" />
              پاسخ‌های مدل زبانی جنبه راهنمایی دارند و جایگزین محاسبات مهرشده مهندس محاسب نیستند.
            </p>
            <div className="mt-4 flex gap-2">
              <Button
                variant="green"
                className="flex-1"
                onClick={() => {
                  if (typeof localStorage !== 'undefined') {
                    if (apiKey) localStorage.setItem(KEY_STORAGE, apiKey);
                    else localStorage.removeItem(KEY_STORAGE);
                  }
                  setShowSettings(false);
                  store.pushToast(apiKey ? 'کلید ذخیره شد — پاسخ‌ها آنلاین می‌شوند' : 'کلید حذف شد — حالت آفلاین', 'info');
                }}
              >
                ذخیره
              </Button>
              <Button variant="ghost" onClick={() => setShowSettings(false)}>
                بستن
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


