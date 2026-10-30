import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, ArrowRight, ArrowUpRight, CheckCircle2, IndianRupee, MessageSquareText, MonitorPlay, Sparkles, Target } from "lucide-react";
import { AskBox } from "@/components/ask-box";
import { ImpactBars, RevenueChart } from "@/components/charts";
import { PeriodSection } from "@/components/dashboard-period";
import { CardHead, DemoBadge, PageHeader, Stat, statusStyle } from "@/components/ui";
import { aiImpact, designStats, screenStats } from "@/data/dashboard";
import { LiveDate, LiveGreeting } from "@/components/live-greeting";
import { expos } from "@/data/expos";
import booths from "@/data/booths.json";
import { approvals, attention, coverage, fy, repliesWaiting, projects, receivables, revenueByMonth, type Status } from "@/lib/business";

const attentionIcon = { reply: MessageSquareText, approval: CheckCircle2, cash: IndianRupee, risk: AlertTriangle } as const;

export default function Home() {
  const toDatePct = fy.toDatePct;
  const yearPct = Math.round((fy.booked / fy.target) * 100);
  const forecastPct = Math.round((fy.forecast / fy.target) * 100);
  const fyStatus: Status = toDatePct >= 100 ? "good" : toDatePct >= 85 ? "warn" : "bad";
  const proposalValue = approvals.reduce((a, d) => a + d.value, 0);
  const overdue = receivables.overdue[0];
  const risky = projects.find((p) => p.risk);

  const brief = [
    { text: `${repliesWaiting.length} hot replies need an answer today, led by Aurora Lubricants asking for concepts by Friday; Meridian Petro's head of brand has opened our deck 3 times.`, href: "/leads?tab=pipeline", accent: true },
    {
      text: `Revenue is ₹${fy.booked} Cr against ₹${fy.targetToDate} Cr planned to date (${toDatePct}%). Pipeline cover is ${coverage}×, but the Jan–Mar expo season has only ₹${fy.seasonForecast} Cr forecast against a ₹${fy.seasonTarget} Cr target.`,
      href: "/leads",
    },
    { text: `${approvals.length} proposals worth ₹${proposalValue.toFixed(1)} Cr are waiting for your approval.`, href: "/booths" },
    {
      text: `${overdue ? `${overdue.client} owes ₹${overdue.amount} Cr, ${overdue.days} days after invoice. ` : ""}${risky ? `${risky.client}: ${risky.risk?.toLowerCase()}, ${risky.days} days before the event.` : ""}`,
      href: "/",
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow={<LiveDate />}
        title={<LiveGreeting />}
        subtitle="Sales, delivery and cash for Inextis Events in one place. Every card opens the tool behind it."
        right={
          <>
            <DemoBadge />
            <Link href="/leads" className="btn btn-dark">
              Open Lead Engine <ArrowRight size={15} />
            </Link>
          </>
        }
      />

      {/* Brief + year */}
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="rise relative overflow-hidden rounded-[24px] bg-ink p-6 text-white sm:p-8 xl:col-span-8" style={{ animationDelay: "60ms" }}>
          <div
            className="pointer-events-none absolute -right-10 -top-10 h-64 w-80 opacity-[0.35]"
            style={{
              backgroundImage: "radial-gradient(rgb(255 255 255 / 0.5) 1.3px, transparent 1.4px)",
              backgroundSize: "13px 13px",
              maskImage: "radial-gradient(ellipse at top right, black 10%, transparent 70%)",
            }}
          />
          <div className="relative">
            <div className="mb-5 flex items-center gap-2.5">
              <span className="pulse-dot size-2 rounded-full bg-accent" />
              <span className="eyebrow !text-white/60">AI morning brief</span>
            </div>
            <ul className="space-y-3.5">
              {brief.map((b, i) => (
                <li key={i}>
                  <Link href={b.href} className="group flex items-start gap-3 text-[15px] leading-snug text-white/85 hover:text-white">
                    <span className={`mt-[8px] size-[5px] shrink-0 rounded-full ${b.accent ? "bg-accent" : "bg-white/40"}`} />
                    <span className="flex-1">{b.text}</span>
                    <ArrowUpRight size={16} className="mt-0.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-7">
              <AskBox />
            </div>
          </div>
        </div>

        <div className="rise card flex flex-col p-6 xl:col-span-4" style={{ animationDelay: "120ms" }}>
          <CardHead eyebrow="FY 2026–27" title="Revenue vs target" right={<span className={`chip text-[11px] ${statusStyle[fyStatus].chip}`}>{statusStyle[fyStatus].label}</span>} />
          <div className="flex items-center gap-5">
            <ProgressRing pct={yearPct} markerPct={(fy.targetToDate / fy.target) * 100} />
            <div>
              <div className="num text-[34px] font-light leading-none">₹{fy.booked} Cr</div>
              <div className="mt-1.5 text-[12.5px] text-muted">booked of ₹{fy.target} Cr annual target</div>
            </div>
          </div>
          <dl className="mt-6 space-y-2.5 text-[13.5px]">
            <Row label="Planned by today" value={`₹${fy.targetToDate} Cr`} note={`${toDatePct}% achieved`} />
            <Row label="Forecast to March" value={`₹${fy.forecast} Cr`} note={`${forecastPct}% of target`} />
            <Row label="Gap to close" value={`₹${(fy.target - fy.forecast).toFixed(1)} Cr`} note="new deals needed" strong />
          </dl>
          <p className="mt-auto pt-5 text-[12px] leading-relaxed text-muted">Forecast = booked + open deals weighted by stage. The ring marker shows where plan says we should be today.</p>
        </div>
      </section>

      <PeriodSection />

      {/* Revenue by month + attention */}
      <section className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="card p-6 xl:col-span-8">
          <CardHead eyebrow="FY 2026–27 by month" title="Booked, forecast and target" right={<DemoBadge />} />
          <div className="h-64">
            <RevenueChart data={revenueByMonth} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-muted">
            <Legend swatch="bg-ink" label="Booked" />
            <Legend swatch="bg-accent/60" label="Forecast (weighted)" />
            <Legend swatch="border-t-2 border-dashed border-muted !h-0 !rounded-none" label="Target" />
            <Legend swatch="bg-accent/10" label="Expo season" />
          </div>
          <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-accent-soft px-4 py-3 text-[13px] text-ink-2">
            <Sparkles size={15} className="mt-0.5 shrink-0 text-accent" />
            <span>
              Jan–Mar carries {Math.round((fy.seasonTarget / fy.target) * 100)}% of the year&apos;s target, but only ₹{fy.seasonForecast} Cr is forecast so far. Starting India Energy Week and Bharat Mobility outreach now is the biggest lever.{" "}
              <Link href="/leads" className="font-medium text-accent-deep hover:underline">
                Open targets
              </Link>
            </span>
          </div>
        </div>

        <div className="card p-6 xl:col-span-4">
          <CardHead eyebrow="Today" title="Needs your attention" right={<span className="chip bg-accent-soft text-accent-deep">{attention.length} items</span>} />
          <ul className="-mx-2">
            {attention.map((a, i) => {
              const Icon = attentionIcon[a.kind];
              const tone = a.kind === "reply" ? "bg-accent text-white" : a.kind === "cash" || a.kind === "risk" ? "bg-bad-soft text-bad" : "bg-sunken text-ink-2";
              return (
                <li key={i}>
                  <Link href={a.href} className="group flex items-start gap-3 rounded-xl px-2 py-2.5 hover:bg-sunken/70">
                    <span className={`grid size-8 shrink-0 place-items-center rounded-full ${tone}`}>
                      <Icon size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] leading-snug">{a.title}</span>
                      <span className="mt-0.5 block text-[12px] text-muted">{a.meta}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Delivery + cash */}
      <section className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="card p-6 xl:col-span-7">
          <CardHead eyebrow="Won and in delivery" title="Projects coming up" href="/booths" hrefLabel="Booths" right={<DemoBadge />} />
          <ul className="divide-y divide-line">
            {projects.slice(0, 5).map((p) => {
              const d = new Date(`${p.date}T00:00:00Z`);
              const phases = ["Design", "Fabrication", "On-site build"];
              const at = phases.indexOf(p.phase);
              return (
                <li key={p.id} className="flex items-center gap-4 py-3.5">
                  <div className="flex w-12 shrink-0 flex-col items-center rounded-xl bg-sunken py-1.5">
                    <span className="text-[10px] font-medium tracking-[0.14em] text-muted">{d.toLocaleString("en-IN", { month: "short", timeZone: "UTC" }).toUpperCase()}</span>
                    <span className="num text-[19px] leading-tight">{d.getUTCDate()}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-medium">{p.client}</span>
                      {p.risk && (
                        <span className="chip shrink-0 bg-bad-soft !py-0.5 text-[11px] text-bad">
                          <AlertTriangle size={11} /> {p.risk}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      {phases.map((ph, i) => (
                        <span key={ph} className={`h-1.5 w-10 rounded-full sm:w-14 ${i < at ? "bg-ink" : i === at ? "bg-accent" : "bg-sunken"}`} title={ph} />
                      ))}
                      <span className="ml-1.5 truncate text-[12px] text-muted">
                        {p.phase} · {p.event} · in {p.days} days
                      </span>
                    </div>
                  </div>
                  <div className="hidden shrink-0 text-right sm:block">
                    <div className="num text-[15px]">₹{p.value} Cr</div>
                    <div className="text-[11.5px] text-muted">{p.margin}% margin</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="card flex flex-col p-6 xl:col-span-5">
          <CardHead eyebrow="Cash" title="Money to collect" right={<DemoBadge />} />
          <div className="flex items-end justify-between">
            <div>
              <div className="num text-[34px] font-light leading-none">₹{receivables.total} Cr</div>
              <div className="mt-1.5 text-[12.5px] text-muted">invoiced, not yet paid</div>
            </div>
            <div className="text-right">
              <div className="num text-[18px]">₹{receivables.collected30} Cr</div>
              <div className="text-[12px] text-muted">collected in 30 days</div>
            </div>
          </div>
          <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-sunken">
            {receivables.buckets.map((b, i) => (
              <div key={b.label} className={i === 0 ? "bg-ink" : i === 1 ? "bg-warn" : "bg-bad"} style={{ width: `${(b.value / (receivables.total || 1)) * 100}%` }} />
            ))}
          </div>
          <ul className="mt-4 space-y-2 text-[13px]">
            {receivables.buckets.map((b, i) => (
              <li key={b.label} className="flex items-center gap-2.5">
                <span className={`size-2.5 rounded-[3px] ${i === 0 ? "bg-ink" : i === 1 ? "bg-warn" : "bg-bad"}`} />
                <span className="flex-1 text-ink-2">{b.label}</span>
                <span className="num">₹{b.value.toFixed(1)} Cr</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 border-t border-line pt-4">
            <div className="mb-2 text-[12px] text-muted">Unpaid invoices, oldest first</div>
            <ul className="space-y-1.5">
              {receivables.invoices.slice(0, 4).map((o) => (
                <li key={o.client} className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="truncate">{o.client}</span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className={`chip !py-0.5 text-[11px] ${o.days > 60 ? "bg-bad-soft text-bad" : o.days > 30 ? "bg-warn-soft text-warn" : "bg-sunken text-ink-2"}`}>{o.days} days</span>
                    <span className="num w-16 text-right">₹{o.amount} Cr</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Expos + AI impact */}
      <section className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="card p-6 xl:col-span-7">
          <CardHead eyebrow="Next 12 months" title="Upcoming expos" href="/leads" hrefLabel="Targets" />
          <div className="grid gap-3 sm:grid-cols-2">
            {expos.map((e) => (
              <Link key={e.id} href={`/leads?expo=${e.id}`} className="group flex gap-4 rounded-2xl border border-line p-4 transition-colors hover:border-ink">
                <div className={`flex w-14 shrink-0 flex-col items-center justify-center rounded-xl py-2 ${e.confirmed ? "bg-ink text-white" : "bg-sunken text-ink-2"}`}>
                  <span className="text-[10px] font-medium tracking-[0.18em]">{e.month}</span>
                  <span className="num text-[22px] font-light leading-tight">{e.day}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-medium">{e.short}</div>
                  <div className="truncate text-[12px] text-muted">
                    {e.city} · {e.dates}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="chip bg-sunken text-ink-2">
                      <Target size={12} /> {e.targets} targets
                    </span>
                    {e.confirmed ? (
                      <span className="chip bg-accent-soft text-accent-deep">in {e.daysAway} days</span>
                    ) : (
                      <span className="chip border border-dashed border-line-strong text-muted">Dates TBC</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="card flex flex-col p-6 xl:col-span-5">
          <CardHead eyebrow="Return on AI" title="Hours saved by AI" right={<DemoBadge />} />
          <div className="grid grid-cols-3 gap-4">
            <Stat label="This month" value={`${aiImpact.hoursSaved} h`} />
            <Stat label="AI cost" value={aiImpact.aiCost} />
            <Stat label="Time value" value={aiImpact.valueOfTime} />
          </div>
          <div className="mt-5 h-40 min-h-40 flex-1">
            <ImpactBars data={aiImpact.months} />
          </div>
          <div className="mt-3 flex gap-4 text-[12px] text-muted">
            <Legend swatch="bg-ink" label="Design" />
            <Legend swatch="bg-muted" label="BD / sales" />
            <Legend swatch="bg-accent" label="Screens" />
          </div>
        </div>
      </section>

      {/* Tools */}
      <div className="eyebrow mb-4 mt-10">AI tools</div>
      <section className="grid gap-5 md:grid-cols-3">
        <Link href="/booths" className="card group overflow-hidden transition-colors hover:border-ink">
          <div className="relative aspect-[16/9] overflow-hidden bg-ink">
            <Image src={`/booths/${booths[0].file}_aerial.jpg`} alt="" fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
          </div>
          <ToolFoot eyebrow="Problem 1" title="3D Booth Studio" stats={designStats.map((s) => `${s.value} ${s.label.toLowerCase()}`).join(" · ")} />
        </Link>
        <Link href="/leads" className="card group overflow-hidden transition-colors hover:border-ink">
          <div className="dots-bg flex aspect-[16/9] items-center justify-center gap-3 bg-sunken/60">
            {["ONGC", "Indian Oil", "Mahindra"].map((n, i) => (
              <span key={n} className={`chip bg-surface text-ink shadow-sm ${i === 0 ? "ring-1 ring-accent" : ""}`}>
                {n}
              </span>
            ))}
          </div>
          <ToolFoot eyebrow="Problem 2" title="Lead Engine" stats="11 real targets researched · LinkedIn-safe" />
        </Link>
        <Link href="/screens" className="card group overflow-hidden transition-colors hover:border-ink">
          <div className="flex aspect-[16/9] flex-col justify-center gap-2 bg-ink p-5">
            <div className="h-4 rounded-sm bg-gradient-to-r from-[#3a1e8f] via-[#1f4fd8] to-[#6fb3ff]" />
            <div className="flex flex-1 gap-2">
              <div className="flex-[2] rounded-sm bg-gradient-to-br from-[#241079] to-[#0f3cc0]" />
              <div className="flex-1 rounded-sm bg-gradient-to-b from-[#241079] to-[#0f3cc0]" />
              <div className="w-6 rounded-sm bg-gradient-to-b from-[#3a1e8f] to-[#ee8022]" />
            </div>
          </div>
          <ToolFoot eyebrow="Problem 3" title="Screen Adapter" stats={`${screenStats.screens} screens · ${screenStats.event}`} icon />
        </Link>
      </section>
    </>
  );
}

function ProgressRing({ pct, markerPct }: { pct: number; markerPct: number }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  const angle = (markerPct / 100) * 2 * Math.PI - Math.PI / 2;
  return (
    <div className="relative size-[96px] shrink-0">
      <svg viewBox="0 0 96 96" className="size-full">
        <circle cx="48" cy="48" r={r} fill="none" stroke="var(--color-sunken)" strokeWidth="8" />
        <circle
          cx="48"
          cy="48"
          r={r}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * c} ${c}`}
          transform="rotate(-90 48 48)"
        />
        <line
          x1={48 + Math.cos(angle) * (r - 7)}
          y1={48 + Math.sin(angle) * (r - 7)}
          x2={48 + Math.cos(angle) * (r + 7)}
          y2={48 + Math.sin(angle) * (r + 7)}
          stroke="var(--color-ink)"
          strokeWidth="2"
        />
      </svg>
      <span className="num absolute inset-0 grid place-items-center text-[18px]">{pct}%</span>
    </div>
  );
}

function Row({ label, value, note, strong = false }: { label: string; value: string; note: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-2">{label}</dt>
      <dd className="text-right">
        <span className={`num ${strong ? "text-[16px] text-ink" : "text-[15px]"}`}>{value}</span>
        <span className="ml-2 text-[12px] text-muted">{note}</span>
      </dd>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2 w-3 rounded-[3px] ${swatch}`} />
      {label}
    </span>
  );
}

function ToolFoot({ eyebrow, title, stats, icon = false }: { eyebrow: string; title: string; stats: string; icon?: boolean }) {
  return (
    <div className="flex items-end justify-between gap-3 p-5">
      <div className="min-w-0">
        <div className="eyebrow mb-1">{eyebrow}</div>
        <div className="flex items-center gap-2 text-[15px] font-medium">
          {icon && <MonitorPlay size={15} />}
          {title}
        </div>
        <div className="mt-1 truncate text-[12.5px] text-muted">{stats}</div>
      </div>
      <ArrowUpRight size={17} className="shrink-0 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
    </div>
  );
}
