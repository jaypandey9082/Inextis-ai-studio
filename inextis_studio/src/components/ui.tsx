import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import type { Status } from "@/lib/business";

export const statusStyle: Record<Status, { dot: string; chip: string; label: string }> = {
  good: { dot: "bg-good", chip: "bg-good-soft text-good", label: "On track" },
  warn: { dot: "bg-warn", chip: "bg-warn-soft text-warn", label: "Watch" },
  bad: { dot: "bg-bad", chip: "bg-bad-soft text-bad", label: "Act now" },
};

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  right,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <header className="rise mb-8 flex flex-col gap-5 lg:mb-10 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="eyebrow mb-3 flex items-center gap-2">
          <span className="size-[6px] rounded-full bg-accent" />
          {eyebrow}
        </div>
        <h1 className="display text-[30px] leading-[1.1] sm:text-[38px]">{title}</h1>
        {subtitle && <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-2">{subtitle}</p>}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </header>
  );
}

export function DemoBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`chip border border-dashed border-line-strong text-[10.5px] !py-0.5 text-muted ${className}`} title="Sample numbers for the demo">
      Demo data
    </span>
  );
}

export function CardHead({
  title,
  eyebrow,
  href,
  hrefLabel = "Open",
  right,
}: {
  title: ReactNode;
  eyebrow?: string;
  href?: string;
  hrefLabel?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div>
        {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
        <h2 className="text-[16px] font-medium tracking-[-0.01em]">{title}</h2>
      </div>
      <div className="flex items-center gap-2">
        {right}
        {href && (
          <Link href={href} className="group inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-ink">
            {hrefLabel}
            <ArrowUpRight size={14} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>
    </div>
  );
}

export function Sparkline({ data, accent = false, width = 96, height = 30 }: { data: number[]; accent?: boolean; width?: number; height?: number }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const pts = data.map((v, i) => [(i / (data.length - 1)) * width, height - 3 - ((v - min) / (max - min || 1)) * (height - 6)]);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lx, ly] = pts[pts.length - 1];
  const color = accent ? "var(--color-accent)" : "var(--color-ink)";
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible" aria-hidden>
      <path d={`${d} L${width},${height} L0,${height} Z`} fill={color} opacity={0.06} />
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r={2.6} fill={color} />
    </svg>
  );
}

export function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <div className="text-[12px] text-muted">{label}</div>
      <div className="num mt-1 text-[24px] font-light">{value}</div>
      {note && <div className="text-[11.5px] text-muted">{note}</div>}
    </div>
  );
}

export function inrCr(n: number) {
  return `₹${n.toFixed(1)} Cr`;
}

export function inrLakh(n: number) {
  return `₹${(n / 100000).toFixed(1)} L`;
}

export function inr(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}
