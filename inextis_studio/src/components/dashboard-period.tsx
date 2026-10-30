"use client";

import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { metrics, PERIODS, type Kpi, type Period } from "@/lib/business";
import { CardHead, Sparkline, statusStyle } from "@/components/ui";

export function PeriodSection() {
  const [period, setPeriod] = useState<Period>("fytd");
  const m = useMemo(() => metrics(period), [period]);
  const p = PERIODS.find((x) => x.id === period)!;

  return (
    <>
      <div className="mb-4 mt-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="eyebrow mb-1.5">Business at a glance</div>
          <p className="text-[13px] text-muted">
            {p.label} · changes {p.compare}. Each number has an owner and turns amber or red when it needs a decision.
          </p>
        </div>
        <div className="flex shrink-0 rounded-full border border-line bg-surface p-1">
          {PERIODS.map((x) => (
            <button
              key={x.id}
              onClick={() => setPeriod(x.id)}
              className={`rounded-full px-3.5 py-1.5 text-[12.5px] transition-colors ${period === x.id ? "bg-ink text-white" : "text-ink-2 hover:text-ink"}`}
            >
              {x.id === "fytd" ? "FY to date" : x.label}
            </button>
          ))}
        </div>
      </div>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
        {m.kpis.map((k, i) => (
          <KpiCard key={k.id} k={k} index={i} />
        ))}
      </section>

      <section className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="card p-6 xl:col-span-7">
          <CardHead eyebrow={p.label} title="Sales funnel" href="/leads?tab=pipeline" hrefLabel="Pipeline" />
          <Funnel rows={m.funnel} />
          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-5 sm:grid-cols-4">
            <Mini label="New leads" value={String(m.extra.newLeads)} />
            <Mini label="Meetings" value={String(m.extra.meetings)} />
            <Mini label="Average deal" value={m.extra.avgDeal ? `₹${m.extra.avgDeal.toFixed(2)} Cr` : "—"} />
            <Mini label="Sales cycle" value={m.extra.cycle ? `${m.extra.cycle} days` : "—"} />
          </div>
        </div>

        <div className="card flex flex-col p-6 xl:col-span-5">
          <CardHead eyebrow={p.label} title="Where wins come from" />
          {m.sources.length ? (
            <ul className="space-y-3.5">
              {m.sources.map((s, i) => (
                <li key={s.name}>
                  <div className="mb-1.5 flex items-baseline justify-between text-[13.5px]">
                    <span>{s.name}</span>
                    <span className="text-muted">
                      <span className="num text-ink">₹{s.value.toFixed(1)} Cr</span> · {s.share}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-sunken">
                    <div className={`h-2 rounded-full ${i === 0 ? "bg-accent" : "bg-ink"}`} style={{ width: `${s.share}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-muted">No deals won in this period.</p>
          )}
          <div className="mt-6 border-t border-line pt-5">
            <div className="mb-2 text-[12px] text-muted">By sector</div>
            <div className="flex flex-wrap gap-1.5">
              {m.sectors.map((s) => (
                <span key={s.name} className="chip bg-sunken text-ink-2">
                  {s.name} <span className="text-muted">{s.share}%</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function KpiCard({ k, index }: { k: Kpi; index: number }) {
  const s = statusStyle[k.status];
  return (
    <div className="rise card flex flex-col p-5" style={{ animationDelay: `${index * 40}ms` }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] text-ink-2">{k.label}</span>
        <span className={`chip !py-0.5 text-[11px] ${s.chip}`}>
          <span className={`size-1.5 rounded-full ${s.dot}`} />
          {s.label}
        </span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="num text-[34px] font-light leading-none">{k.value}</div>
        {k.spark && <Sparkline data={k.spark} accent={k.status !== "good"} width={92} height={30} />}
      </div>
      <div className={`mt-2.5 flex items-center gap-1 text-[12.5px] ${k.deltaUp ? "text-good" : "text-bad"}`}>
        {k.deltaUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
        {k.delta}
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-[12px] text-muted">
        <span>{k.target}</span>
        <span>Owner: {k.owner}</span>
      </div>
    </div>
  );
}

function Funnel({ rows }: { rows: { stage: string; count: number; value: number | null }[] }) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div className="space-y-2.5">
      {rows.map((f, i) => {
        const won = f.stage === "Won";
        const conv = i > 0 && rows[i - 1].count ? Math.round((f.count / rows[i - 1].count) * 100) : null;
        return (
          <div key={f.stage} className="grid grid-cols-[78px_1fr_auto] items-center gap-3 sm:grid-cols-[92px_1fr_130px]">
            <div className="text-[13px] text-ink-2">{f.stage}</div>
            <div className="h-8 rounded-lg bg-sunken">
              <div
                className={`flex h-full items-center rounded-lg px-3 text-[12px] font-medium ${won ? "bg-accent text-white" : i < 2 ? "bg-line-strong text-ink" : "bg-ink text-white"}`}
                style={{ width: `${Math.max((f.count / max) * 100, 10)}%` }}
              >
                {f.count}
              </div>
            </div>
            <div className="text-right text-[12.5px] text-muted">
              {f.value != null ? <span className="num text-[14px] text-ink">₹{f.value.toFixed(1)} Cr</span> : null}
              {conv != null && <span className="ml-2 hidden sm:inline">{conv}%</span>}
            </div>
          </div>
        );
      })}
      <p className="pt-2 text-[12px] text-muted">Deals that reached each stage in the period. Percentages show how many moved on from the stage before.</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[12px] text-muted">{label}</div>
      <div className="num mt-0.5 text-[20px] font-light">{value}</div>
    </div>
  );
}
