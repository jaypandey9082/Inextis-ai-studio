// One sample business dataset for the whole demo. Every number on the dashboard,
// the Lead Engine board and the Ask box is computed from these deals, so they agree.
// Client names are fictional. Values are in ₹ crore.

export const TODAY = "2026-10-29";
const FY_START = "2026-04-01";
const FY_MONTHS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
// Expo season (Jan–Mar) carries more of the year's revenue
const MONTH_WEIGHT = [0.06, 0.06, 0.05, 0.06, 0.08, 0.09, 0.09, 0.08, 0.08, 0.13, 0.12, 0.1];

export const STAGES = ["New", "Contacted", "Replied", "Meeting", "Proposal", "Won"] as const;
export type Stage = (typeof STAGES)[number];
const STAGE_PROB: Record<Stage, number> = { New: 0.02, Contacted: 0.04, Replied: 0.08, Meeting: 0.2, Proposal: 0.35, Won: 1 };

export type Deal = {
  id: string;
  client: string;
  sector: string;
  source: string;
  owner: string;
  value: number;
  created: string;
  stage: Stage;
  stageDates: string[]; // date each stage was reached, index = stage index
  status: "open" | "won" | "lost";
  closed?: string;
  margin?: number;
  eventDate?: string;
  eventName?: string;
  invoice?: { amount: number; date: string; paid?: string };
  hot?: boolean;
  note?: string;
  quote?: string;
  awaitingApproval?: boolean;
};

/* ---------- helpers ---------- */

const DAY = 86400000;
const toDate = (s: string) => new Date(`${s}T00:00:00Z`);
export const iso = (d: Date) => d.toISOString().slice(0, 10);
export const shortDate = (s: string) => toDate(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
export const addDays = (s: string, n: number) => iso(new Date(toDate(s).getTime() + n * DAY));
export const daysBetween = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / DAY);
const between = (d: string | undefined, from: string, to: string) => !!d && d >= from && d <= to;
const r1 = (n: number) => Math.round(n * 10) / 10;

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- generate history ---------- */

// Fictional names: prefix × suffix gives every generated deal its own client
const NAME_PREFIX = [
  "Zenith", "Orion", "Helix", "Sunpeak", "Volt", "Sarathi", "Trident", "Nimbus", "Kaveri", "Apex", "Gridline", "Monsoon", "Ranger", "Shakti",
  "Northstar", "Saffron", "Bluewave", "Vega", "Prism", "Atlas", "Horizon", "Cobalt", "Tejas", "Ganga", "Everest", "Lotus", "Pioneer", "Kestrel",
];
const NAME_SUFFIX = ["Pipes", "Batteries", "Hydrogen", "Modules", "Mobility", "Lubes", "Power", "Refiners", "Turbines", "Cables", "Infra", "Offshore", "Valves"];
const clientName = (n: number) => `${NAME_PREFIX[n % NAME_PREFIX.length]} ${NAME_SUFFIX[Math.floor(n / NAME_PREFIX.length) % NAME_SUFFIX.length]}`;
const SECTORS = ["Oil & gas", "Power & renewables", "Automotive & EV", "Industrial", "Infrastructure"];
const SOURCES = ["Expo outreach", "Repeat client", "Referral", "LinkedIn", "Tender"];
const SOURCE_WEIGHTS = [0.34, 0.24, 0.17, 0.13, 0.12];
export const OWNERS = ["Aman", "Priya", "Rohit"];
// Generic event types; real expo names are only used where their dates are known
const EVENTS: Record<string, string[]> = {
  "Oil & gas": ["Dealer meet", "Technology summit", "Partner conference"],
  "Power & renewables": ["Utility summit", "Product launch", "Trade show"],
  "Automotive & EV": ["Dealer conference", "Vehicle launch", "Trade show"],
  Industrial: ["Plant open day", "Channel partner meet", "Trade show"],
  Infrastructure: ["Investor summit", "Project launch", "Trade show"],
};

function pick<T>(rand: () => number, arr: readonly T[], weights?: number[]) {
  if (!weights) return arr[Math.floor(rand() * arr.length)];
  let x = rand();
  for (let i = 0; i < arr.length; i++) if ((x -= weights[i]) <= 0) return arr[i];
  return arr[arr.length - 1];
}

function generate(): Deal[] {
  const rand = mulberry32(2027);
  const deals: Deal[] = [];
  const transition = [0.8, 0.45, 0.62, 0.78, 0.52]; // chance to move to the next stage
  let n = 0;
  // start in January so deals created before April close inside this financial year
  for (let m = -3; m < 7; m++) {
    const monthStart = addDays(FY_START, Math.round(m * 30.5));
    const leads = 26 + Math.max(m, 0) * 2 + Math.floor(rand() * 6);
    for (let k = 0; k < leads; k++) {
      const created = addDays(monthStart, Math.floor(rand() * 30));
      if (created > TODAY) continue;
      const age = daysBetween(created, TODAY);
      const stageDates = [created];
      let stage = 0;
      let status: Deal["status"] = "open";
      let date = created;
      for (let s = 0; s < 5; s++) {
        const gap = s === 4 ? 18 + Math.floor(rand() * 25) : 5 + Math.floor(rand() * 9);
        const next = addDays(date, gap);
        if (rand() > transition[s]) {
          // didn't progress: lost if it has been quiet for a while
          if (daysBetween(date, TODAY) > 35) status = "lost";
          break;
        }
        if (next > TODAY) break;
        date = next;
        stage = s + 1;
        stageDates.push(next);
      }
      if (stage === 5) status = "won";
      if (age < 6 && stage === 0) status = "open";
      const sector = pick(rand, SECTORS);
      const value = r1(0.35 + Math.pow(rand(), 1.5) * 2.6);
      const deal: Deal = {
        id: `h${++n}`,
        client: clientName(n),
        sector,
        source: pick(rand, SOURCES, SOURCE_WEIGHTS),
        owner: OWNERS[n % 3],
        value,
        created,
        stage: STAGES[stage],
        stageDates,
        status,
      };
      if (status === "lost") deal.closed = addDays(stageDates[stage], 30);
      if (status === "won") {
        deal.closed = stageDates[5];
        deal.margin = Math.round(19 + rand() * 13);
        deal.eventDate = addDays(deal.closed, 25 + Math.floor(rand() * 110));
        deal.eventName = pick(rand, EVENTS[sector]);
        if (deal.eventDate < TODAY) {
          const invDate = addDays(deal.eventDate, 5);
          const payDays = 20 + Math.floor(Math.pow(rand(), 0.8) * 120);
          deal.invoice = { amount: value, date: invDate };
          if (addDays(invDate, payDays) <= TODAY) deal.invoice.paid = addDays(invDate, payDays);
        }
      }
      deals.push(deal);
    }
  }
  return deals;
}

// Named open deals referred to in the brief and the attention list
const CURATED: Deal[] = [
  { id: "c1", client: "Aurora Lubricants", sector: "Oil & gas", source: "Expo outreach", owner: "Priya", value: 0.9, created: "2026-10-12", stage: "Replied", stageDates: ["2026-10-12", "2026-10-15", "2026-10-29"], status: "open", hot: true, note: "Wants concepts by Friday", quote: "Can we see concepts by Friday?" },
  { id: "c2", client: "Coastal LNG", sector: "Oil & gas", source: "LinkedIn", owner: "Aman", value: 1.4, created: "2026-10-08", stage: "Replied", stageDates: ["2026-10-08", "2026-10-10", "2026-10-28"], status: "open", hot: true, note: "Asked for past energy pavilions", quote: "Can you share your past energy pavilions?" },
  { id: "c3", client: "Meridian Petro", sector: "Oil & gas", source: "Repeat client", owner: "Aman", value: 1.6, created: "2026-09-30", stage: "Meeting", stageDates: ["2026-09-30", "2026-10-02", "2026-10-09", "2026-10-27"], status: "open", hot: true, note: "Head of brand viewed deck 3 times" },
  { id: "c4", client: "Vistara Solar", sector: "Power & renewables", source: "Referral", owner: "Rohit", value: 1.2, created: "2026-09-18", stage: "Proposal", stageDates: ["2026-09-18", "2026-09-20", "2026-09-29", "2026-10-08", "2026-10-27"], status: "open", awaitingApproval: true, note: "9 × 6 m island, IEW 2027" },
  { id: "c5", client: "Kinetic Cables", sector: "Power & renewables", source: "Expo outreach", owner: "Priya", value: 0.7, created: "2026-09-22", stage: "Proposal", stageDates: ["2026-09-22", "2026-09-24", "2026-10-03", "2026-10-14", "2026-10-28"], status: "open", awaitingApproval: true, note: "6 × 3 m inline, ELECRAMA 2027" },
];

export const deals: Deal[] = [...generate(), ...CURATED];

/* ---------- targets ---------- */

const wonDeals = deals.filter((d) => d.status === "won" && d.closed! >= FY_START);
const bookedRaw = wonDeals.reduce((a, d) => a + d.value, 0);
const bookedYTD = r1(bookedRaw);
const elapsedWeight = MONTH_WEIGHT.slice(0, 6).reduce((a, b) => a + b, 0) + MONTH_WEIGHT[6] * (29 / 31);
// Annual target set so the business is a little behind plan: something to act on
export const FY_TARGET = Math.round(bookedYTD / 0.93 / elapsedWeight);

function monthIndex(d: string) {
  const dt = toDate(d);
  return (dt.getUTCFullYear() - 2026) * 12 + dt.getUTCMonth() - 3;
}

function targetBetween(from: string, to: string) {
  let t = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const mi = monthIndex(d);
    if (mi < 0 || mi > 11) continue;
    const dim = new Date(Date.UTC(2026, 3 + mi + 1, 0)).getUTCDate();
    t += (FY_TARGET * MONTH_WEIGHT[mi]) / dim;
  }
  return t;
}

/* ---------- metrics ---------- */

export type Period = "30d" | "90d" | "fytd";
export const PERIODS: { id: Period; label: string; compare: string }[] = [
  { id: "30d", label: "Last 30 days", compare: "vs previous 30 days" },
  { id: "90d", label: "Last 90 days", compare: "vs previous 90 days" },
  { id: "fytd", label: "FY 2026–27 to date", compare: "vs target to date" },
];

function rangeFor(p: Period): [string, string] {
  if (p === "fytd") return [FY_START, TODAY];
  const days = p === "30d" ? 30 : 90;
  return [addDays(TODAY, -(days - 1)), TODAY];
}

function windowStats(from: string, to: string) {
  const won = deals.filter((d) => d.status === "won" && between(d.closed, from, to));
  // win rate counts decided proposals only, not leads that went quiet early
  const lost = deals.filter((d) => d.status === "lost" && d.stage === "Proposal" && between(d.closed, from, to));
  const booked = won.reduce((a, d) => a + d.value, 0);
  const marginW = won.reduce((a, d) => a + d.value * (d.margin ?? 0), 0);
  const entered = STAGES.map((_, i) => deals.filter((d) => between(d.stageDates[i], from, to)));
  return {
    booked,
    wonCount: won.length,
    winRate: won.length + lost.length ? (won.length / (won.length + lost.length)) * 100 : 0,
    margin: booked ? marginW / booked : 0,
    avgDeal: won.length ? booked / won.length : 0,
    cycle: won.length ? won.reduce((a, d) => a + daysBetween(d.created, d.closed!), 0) / won.length : 0,
    newLeads: entered[0].length,
    meetings: entered[3].length,
    funnel: STAGES.map((stage, i) => ({
      stage,
      count: entered[i].length,
      value: i >= 2 ? entered[i].reduce((a, d) => a + d.value, 0) : null,
    })),
    target: targetBetween(from, to),
  };
}

export const openDeals = deals.filter((d) => d.status === "open");
const openQualified = openDeals.filter((d) => STAGES.indexOf(d.stage) >= 2);
export const pipeline = {
  open: r1(openQualified.reduce((a, d) => a + d.value, 0)),
  weighted: r1(openQualified.reduce((a, d) => a + d.value * STAGE_PROB[d.stage], 0)),
  count: openQualified.length,
};
export const remainingTarget = r1(Math.max(0, FY_TARGET - bookedYTD));
export const coverage = Math.round((pipeline.open / remainingTarget) * 10) / 10;

const outstanding = deals.filter((d) => d.invoice && !d.invoice.paid);
const ageOf = (d: Deal) => daysBetween(d.invoice!.date, TODAY);
export const receivables = {
  total: r1(outstanding.reduce((a, d) => a + d.invoice!.amount, 0)),
  buckets: [
    { label: "0–30 days", value: r1(outstanding.filter((d) => ageOf(d) <= 30).reduce((a, d) => a + d.invoice!.amount, 0)) },
    { label: "31–60 days", value: r1(outstanding.filter((d) => ageOf(d) > 30 && ageOf(d) <= 60).reduce((a, d) => a + d.invoice!.amount, 0)) },
    { label: "Over 60 days", value: r1(outstanding.filter((d) => ageOf(d) > 60).reduce((a, d) => a + d.invoice!.amount, 0)) },
  ],
  invoices: outstanding
    .map((d) => ({ client: d.client, amount: d.invoice!.amount, days: ageOf(d) }))
    .sort((a, b) => b.days - a.days),
  overdue: outstanding.filter((d) => ageOf(d) > 60).sort((a, b) => ageOf(b) - ageOf(a)).map((d) => ({ client: d.client, amount: d.invoice!.amount, days: ageOf(d) })),
  collected30: r1(deals.filter((d) => between(d.invoice?.paid, addDays(TODAY, -29), TODAY)).reduce((a, d) => a + d.invoice!.amount, 0)),
};

export type Status = "good" | "warn" | "bad";
export type Kpi = { id: string; label: string; value: string; unit?: string; delta: string; deltaUp: boolean; status: Status; target: string; owner: string; spark?: number[] };

const monthly = FY_MONTHS.slice(0, 7).map((_, i) => {
  const from = addDays(FY_START, Math.round(i * 30.5));
  const to = i === 6 ? TODAY : addDays(FY_START, Math.round((i + 1) * 30.5) - 1);
  return windowStats(from, to);
});

function pctDelta(now: number, before: number, unit = "%") {
  if (!before) return { text: "new", up: true };
  const d = ((now - before) / before) * 100;
  return { text: `${d >= 0 ? "+" : ""}${Math.round(d)}${unit}`, up: d >= 0 };
}

export function metrics(p: Period) {
  const [from, to] = rangeFor(p);
  const now = windowStats(from, to);
  const len = daysBetween(from, to) + 1;
  const prev = p === "fytd" ? null : windowStats(addDays(from, -len), addDays(from, -1));

  const vsTarget = (now.booked / now.target) * 100;
  const revDelta = prev ? pctDelta(now.booked, prev.booked) : { text: `${Math.round(vsTarget)}% of target`, up: vsTarget >= 100 };
  const winPrev = prev?.winRate ?? 35;
  const marginPrev = prev?.margin ?? 25;

  const kpis: Kpi[] = [
    {
      id: "revenue",
      label: "Revenue booked",
      value: `₹${now.booked.toFixed(1)} Cr`,
      delta: revDelta.text,
      deltaUp: revDelta.up,
      status: vsTarget >= 100 ? "good" : vsTarget >= 85 ? "warn" : "bad",
      target: `Target ₹${now.target.toFixed(1)} Cr`,
      owner: "Dhruv",
      spark: monthly.map((m) => m.booked),
    },
    {
      id: "pipeline",
      label: "Open pipeline",
      value: `₹${pipeline.open.toFixed(1)} Cr`,
      delta: `₹${pipeline.weighted.toFixed(1)} Cr weighted`,
      deltaUp: true,
      status: coverage >= 3 ? "good" : coverage >= 2 ? "warn" : "bad",
      target: `${pipeline.count} live deals`,
      owner: "Sales",
      spark: monthly.map((m) => m.funnel[2].value ?? 0),
    },
    {
      id: "coverage",
      label: "Pipeline coverage",
      value: `${coverage.toFixed(1)}×`,
      delta: `of ₹${remainingTarget.toFixed(1)} Cr still to win`,
      deltaUp: coverage >= 3,
      status: coverage >= 3 ? "good" : coverage >= 2 ? "warn" : "bad",
      target: "Healthy at 3× or more",
      owner: "Sales",
    },
    {
      id: "win",
      label: "Win rate",
      value: `${Math.round(now.winRate)}%`,
      delta: `${now.winRate - winPrev >= 0 ? "+" : ""}${Math.round(now.winRate - winPrev)} pts`,
      deltaUp: now.winRate >= winPrev,
      status: now.winRate >= 35 ? "good" : now.winRate >= 25 ? "warn" : "bad",
      target: "Target 35%",
      owner: "Sales",
      spark: monthly.map((m) => m.winRate),
    },
    {
      id: "margin",
      label: "Gross margin",
      value: `${now.margin.toFixed(1)}%`,
      delta: `${now.margin - marginPrev >= 0 ? "+" : ""}${(now.margin - marginPrev).toFixed(1)} pts`,
      deltaUp: now.margin >= marginPrev,
      status: now.margin >= 25 ? "good" : now.margin >= 20 ? "warn" : "bad",
      target: "Target 25%",
      owner: "Projects",
      spark: monthly.map((m) => m.margin),
    },
    {
      id: "cash",
      label: "Cash to collect",
      value: `₹${receivables.total.toFixed(1)} Cr`,
      delta: `₹${receivables.buckets[2].value.toFixed(1)} Cr over 60 days`,
      deltaUp: receivables.buckets[2].value === 0,
      status: receivables.buckets[2].value <= receivables.total * 0.15 ? "good" : receivables.buckets[2].value <= receivables.total * 0.3 ? "warn" : "bad",
      target: `₹${receivables.collected30.toFixed(1)} Cr collected in 30 days`,
      owner: "Finance",
    },
  ];

  return {
    period: p,
    range: [from, to] as const,
    kpis,
    funnel: now.funnel,
    extra: {
      newLeads: now.newLeads,
      meetings: now.meetings,
      avgDeal: now.avgDeal,
      cycle: Math.round(now.cycle),
      wonCount: now.wonCount,
    },
    sources: breakdown("source", from, to),
    sectors: breakdown("sector", from, to),
  };
}

function breakdown(key: "source" | "sector", from: string, to: string) {
  const won = deals.filter((d) => d.status === "won" && between(d.closed, from, to));
  const total = won.reduce((a, d) => a + d.value, 0) || 1;
  const map = new Map<string, number>();
  for (const d of won) map.set(d[key], (map.get(d[key]) ?? 0) + d.value);
  return [...map.entries()].map(([name, v]) => ({ name, value: r1(v), share: Math.round((v / total) * 100) })).sort((a, b) => b.value - a.value);
}

/* ---------- year view: booked vs target by month ---------- */

// Expected close: later stages close sooner; a per-deal spread avoids every deal landing in one month
const expectedClose = (d: Deal) => {
  const base = d.stageDates[d.stageDates.length - 1];
  const spread = Number(d.id.replace(/\D/g, "")) % 35;
  return addDays(base, (d.stage === "Proposal" ? 20 : d.stage === "Meeting" ? 45 : 75) + spread);
};

export const revenueByMonth = FY_MONTHS.map((m, i) => {
  const target = r1(FY_TARGET * MONTH_WEIGHT[i]);
  const booked = r1(wonDeals.filter((d) => monthIndex(d.closed!) === i).reduce((a, d) => a + d.value, 0));
  const forecast = r1(openQualified.filter((d) => Math.max(monthIndex(expectedClose(d)), 7) === i).reduce((a, d) => a + d.value * STAGE_PROB[d.stage], 0));
  return { m, target, booked: i <= 6 ? booked : null, forecast: i >= 7 ? forecast : null };
});

export const fy = {
  target: FY_TARGET,
  seasonForecast: r1(revenueByMonth.slice(9).reduce((a, m) => a + (m.forecast ?? 0), 0)),
  seasonTarget: r1(revenueByMonth.slice(9).reduce((a, m) => a + m.target, 0)),
  booked: bookedYTD,
  targetToDate: r1(targetBetween(FY_START, TODAY)),
  toDatePct: Math.round((bookedRaw / targetBetween(FY_START, TODAY)) * 100),
  forecast: r1(bookedYTD + pipeline.weighted),
};

/* ---------- delivery ---------- */

export const projects = deals
  .filter((d) => d.status === "won")
  .filter((d) => d.eventDate! >= TODAY)
  .sort((a, b) => a.eventDate!.localeCompare(b.eventDate!))
  .map((d, i) => {
    const days = daysBetween(TODAY, d.eventDate!);
    const phase = days > 45 ? "Design" : days > 14 ? "Fabrication" : "On-site build";
    const risk = i === 1 ? "Client artwork late" : i === 4 ? "Venue power plan pending" : null;
    return { id: d.id, client: d.client, event: d.eventName!, date: d.eventDate!, days, value: d.value, margin: d.margin!, phase, risk };
  });

/* ---------- attention list ---------- */

export const attention = [
  ...CURATED.filter((d) => d.hot && d.stage === "Replied").map((d) => ({ kind: "reply" as const, title: `${d.client} replied: “${d.quote}”`, meta: `₹${d.value} Cr · ${d.owner}`, href: "/leads?tab=pipeline" })),
  ...CURATED.filter((d) => d.awaitingApproval).map((d) => ({ kind: "approval" as const, title: `Approve proposal: ${d.client}, ₹${d.value} Cr`, meta: `${d.note} · waiting ${Math.max(1, daysBetween(d.stageDates[4], TODAY))} ${Math.max(1, daysBetween(d.stageDates[4], TODAY)) === 1 ? "day" : "days"}`, href: "/booths" })),
  ...receivables.overdue.slice(0, 1).map((o) => ({ kind: "cash" as const, title: `${o.client} invoice unpaid for ${o.days} days`, meta: `₹${o.amount} Cr · Finance`, href: "/" })),
  ...projects.filter((p) => p.risk).slice(0, 1).map((p) => ({ kind: "risk" as const, title: `${p.client}: ${p.risk?.toLowerCase()}`, meta: `${p.event} in ${p.days} days`, href: "/booths" })),
];

export const hotCount = CURATED.filter((d) => d.hot).length;
export const repliesWaiting = CURATED.filter((d) => d.hot && d.stage === "Replied");
export const approvals = CURATED.filter((d) => d.awaitingApproval);

/* ---------- plain-text summary for the AI assistant ---------- */

export function businessSummary() {
  const m30 = metrics("30d");
  const fyM = metrics("fytd");
  const k = (id: string, mm = m30) => mm.kpis.find((x) => x.id === id)!;
  return [
    `FY 2026–27 target ₹${fy.target} Cr; booked so far ₹${fy.booked} Cr vs ₹${fy.targetToDate} Cr target to date; forecast ₹${fy.forecast} Cr (booked + weighted pipeline).`,
    `Open pipeline ₹${pipeline.open} Cr in ${pipeline.count} deals (weighted ₹${pipeline.weighted} Cr); coverage ${coverage}× of the ₹${remainingTarget} Cr still to win (healthy is 3×).`,
    `Last 30 days: booked ${k("revenue").value}, win rate ${k("win").value}, gross margin ${k("margin").value}, ${m30.extra.newLeads} new leads, ${m30.extra.meetings} meetings.`,
    `FY to date: win rate ${k("win", fyM).value}, gross margin ${k("margin", fyM).value}, average deal ₹${fyM.extra.avgDeal.toFixed(2)} Cr, sales cycle ${fyM.extra.cycle} days.`,
    `Top win sources FY: ${fyM.sources.map((s) => `${s.name} ${s.share}%`).join(", ")}.`,
    `Cash to collect ₹${receivables.total} Cr, of which ₹${receivables.buckets[2].value} Cr is over 60 days${receivables.overdue[0] ? ` (largest: ${receivables.overdue[0].client}, ${receivables.overdue[0].days} days)` : ""}.`,
    `Waiting for Dhruv: ${approvals.map((d) => `${d.client} proposal ₹${d.value} Cr`).join("; ")}. Hot: ${CURATED.filter((d) => d.hot).map((d) => `${d.client} (${d.note})`).join("; ")}.`,
    `Next projects: ${projects.slice(0, 4).map((p) => `${p.client} at ${p.event} in ${p.days} days (${p.phase}${p.risk ? `, risk: ${p.risk}` : ""})`).join("; ")}.`,
  ].join("\n");
}
