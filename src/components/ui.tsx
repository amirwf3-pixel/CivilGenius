
/* ============================================================================
 * CivilGenius v20 — shared UI primitives (no emojis, Lucide icons only)
 * ========================================================================== */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { faNum } from '../lib/format';

export function Card({
  children,
  className = '',
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article';
}): ReactNode {
  return <Tag className={`glass ${className}`}>{children}</Tag>;
}

export function SectionHead({
  title,
  subtitle,
  icon,
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
}): ReactNode {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        {icon ? (
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-navy text-gold">{icon}</span>
        ) : null}
        <div>
          <h2 className="text-base font-bold text-ink sm:text-lg">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs leading-6 text-muted sm:text-[13px]">{subtitle}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

export function Chip({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'gold' | 'green';
  className?: string;
}): ReactNode {
  const tones: Record<string, string> = {
    neutral: 'bg-panel-2 text-muted border-line-2',
    ok: 'bg-emerald-soft text-forest border-mint',
    warn: 'bg-warn-soft text-warn border-[#fde68a]',
    bad: 'bg-bad-soft text-bad border-[#fecdca]',
    info: 'bg-blue-soft text-blue border-[#d1e0ff]',
    gold: 'bg-gold-soft text-gold-deep border-[#f6dfb6]',
    green: 'bg-forest text-white border-forest',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function LiveDot({ tone = 'ok', pulse = true }: { tone?: 'ok' | 'warn' | 'bad' | 'info'; pulse?: boolean }): ReactNode {
  const colors: Record<string, string> = {
    ok: 'bg-emerald',
    warn: 'bg-gold',
    bad: 'bg-bad',
    info: 'bg-blue',
  };
  return (
    <span className="relative inline-flex size-2.5 shrink-0">
      <span className={`absolute inset-0 rounded-full ${colors[tone]}`} />
      {pulse ? <span className={`absolute inset-0 animate-ping rounded-full ${colors[tone]} opacity-60`} /> : null}
    </span>
  );
}

/** Number that eases toward its target and renders Persian digits. */
export function AnimatedNumber({
  value,
  fractionDigits = 0,
  className = '',
  suffix,
}: {
  value: number;
  fractionDigits?: number;
  className?: string;
  suffix?: string;
}): ReactNode {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    const start = performance.now();
    const dur = 620;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      fromRef.current = to;
    };
  }, [value]);

  return (
    <span className={`tnum ${className}`}>
      {faNum(display, fractionDigits)}
      {suffix}
    </span>
  );
}

/** Price flash — green up / red down, then settles. */
export function FlashNumber({
  value,
  prev,
  fractionDigits = 0,
  className = '',
}: {
  value: number;
  prev: number;
  fractionDigits?: number;
  className?: string;
}): ReactNode {
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const prevRef = useRef(value);
  useEffect(() => {
    if (value !== prevRef.current) {
      setFlash(value > prevRef.current ? 'up' : 'down');
      prevRef.current = value;
      const t = setTimeout(() => setFlash(null), 900);
      return () => clearTimeout(t);
    }
  }, [value]);
  void prev;
  const color = flash === 'up' ? 'text-emerald' : flash === 'down' ? 'text-bad' : 'text-ink';
  return <span className={`tnum transition-colors duration-300 ${color} ${className}`}>{faNum(value, fractionDigits)}</span>;
}

export function StatCard({
  label,
  value,
  unit,
  tone = 'neutral',
  hint,
  icon,
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: 'neutral' | 'ok' | 'warn' | 'bad';
  hint?: string;
  icon?: ReactNode;
}): ReactNode {
  const ring: Record<string, string> = {
    neutral: 'border-line',
    ok: 'border-mint',
    warn: 'border-[#fde68a]',
    bad: 'border-[#fecdca]',
  };
  const text: Record<string, string> = {
    neutral: 'text-ink',
    ok: 'text-forest',
    warn: 'text-warn',
    bad: 'text-bad',
  };
  return (
    <div className={`glass flex flex-col gap-1.5 border ${ring[tone]} p-3.5`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-muted">{label}</span>
        {icon ? <span className="text-faint">{icon}</span> : null}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-xl font-bold ${text[tone]}`}>{value}</span>
        {unit ? <span className="text-[11px] text-muted">{unit}</span> : null}
      </div>
      {hint ? <p className="text-[11px] leading-5 text-faint">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({ title, text, icon, action }: { title: string; text: string; icon?: ReactNode; action?: ReactNode }): ReactNode {
  return (
    <div className="bp-grid flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line-2 bg-panel-2 px-6 py-12 text-center">
      {icon ? <span className="text-faint">{icon}</span> : null}
      <div>
        <h3 className="text-sm font-bold text-ink">{title}</h3>
        <p className="mx-auto mt-1 max-w-md text-xs leading-6 text-muted">{text}</p>
      </div>
      {action}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled,
  icon,
  className = '',
  type = 'button',
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'green' | 'gold' | 'ghost' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  icon?: ReactNode;
  className?: string;
  type?: 'button' | 'submit';
  title?: string;
}): ReactNode {
  const variants: Record<string, string> = {
    primary: 'bg-navy text-white hover:bg-navy-2 shadow-sm',
    green: 'bg-emerald-deep text-white hover:bg-forest shadow-sm',
    gold: 'bg-gold text-navy hover:brightness-110 shadow-sm',
    ghost: 'bg-transparent text-muted hover:bg-panel-2',
    outline: 'border border-line-2 bg-panel text-ink hover:border-navy hover:text-navy',
    danger: 'bg-bad text-white hover:bg-[#b42318] shadow-sm',
  };
  const sizes: Record<string, string> = {
    sm: 'px-3 py-1.5 text-[12px] gap-1.5 rounded-lg',
    md: 'px-4 py-2.5 text-[13px] gap-2 rounded-xl',
    lg: 'px-5 py-3 text-sm gap-2 rounded-xl',
  };
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-45 active:scale-[0.98] ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {icon}
      {children}
    </button>
  );
}

/** Brand mark used in the sidebar, splash and DXF title block. */
export function LogoMark({ size = 40 }: { size?: number }): ReactNode {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-xl bg-navy font-mono font-bold text-gold bp-grid-dark"
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      CG
    </span>
  );
}

/** Collapsible form group so long input lists stay compact (round-25 UX). */
export function FormSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}): ReactNode {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-panel-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-right transition hover:bg-panel"
      >
        <span className="flex items-center gap-2 text-[12px] font-bold text-ink">
          <span className={`size-1.5 rounded-full ${open ? 'bg-emerald' : 'bg-line-2'}`} />
          {title}
        </span>
        <ChevronDown size={15} className={`text-faint transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? <div className="grid grid-cols-2 gap-4 border-t border-line p-4">{children}</div> : null}
    </div>
  );
}


