"use client";

import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Ban,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  LoaderCircle,
  Mail,
  MessageCircle,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  Wand2,
} from "lucide-react";
import { companies, draftMessages, type Company } from "@/data/companies";
import { addDays, deals, shortDate, STAGES, TODAY, type Deal } from "@/lib/business";
import { expos } from "@/data/expos";
import { DemoBadge, inrCr } from "@/components/ui";

type Tab = "targets" | "pipeline" | "linkedin";
const tabs: { id: Tab; label: string }[] = [
  { id: "targets", label: "Targets" },
  { id: "pipeline", label: "Pipeline" },
  { id: "linkedin", label: "LinkedIn" },
];

export function LeadEngine() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = (params.get("tab") as Tab) ?? "targets";

  function setTab(t: Tab) {
    const next = new URLSearchParams(params);
    next.set("tab", t);
    router.replace(`${pathname}?${next}`, { scroll: false });
  }

  return (
    <>
      <div className="mb-6 inline-flex rounded-full border border-line bg-surface p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-full px-5 py-2 text-[13.5px] transition-colors ${tab === t.id ? "bg-ink text-white" : "text-ink-2 hover:text-ink"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "targets" && <Targets initialExpo={params.get("expo")} />}
      {tab === "pipeline" && <Pipeline />}
      {tab === "linkedin" && <LinkedInTab />}
    </>
  );
}

/* ---------------- Targets ---------------- */

const liveExpos = expos.filter((e) => companies.some((c) => c.expo === e.id));

function Targets({ initialExpo }: { initialExpo: string | null }) {
  const [expoId, setExpoId] = useState(liveExpos.some((e) => e.id === initialExpo) ? initialExpo! : liveExpos[0].id);
  const list = useMemo(() => companies.filter((c) => c.expo === expoId).sort((a, b) => b.fit - a.fit), [expoId]);
  const [selectedId, setSelectedId] = useState(list[0].id);
  const selected = list.find((c) => c.id === selectedId) ?? list[0];
  const expo = expos.find((e) => e.id === expoId)!;

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-2">
        {expos.map((e) => {
          const enabled = liveExpos.some((x) => x.id === e.id);
          const active = e.id === expoId;
          return (
            <button
              key={e.id}
              disabled={!enabled}
              onClick={() => {
                setExpoId(e.id);
                setSelectedId(companies.filter((c) => c.expo === e.id).sort((a, b) => b.fit - a.fit)[0].id);
              }}
              className={`flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-left transition-colors ${
                active ? "border-ink bg-ink text-white" : enabled ? "border-line bg-surface hover:border-ink" : "border-dashed border-line-strong text-muted"
              }`}
            >
              <span className="text-[13.5px] font-medium">{e.short}</span>
              <span className={`text-[12px] ${active ? "text-white/60" : "text-muted"}`}>{enabled ? e.dates : "Research next"}</span>
            </button>
          );
        })}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniStat label="Exhibitors found" value={String(expo.targets)} />
        <MiniStat label="Researched" value={String(list.length)} />
        <MiniStat label="Drafts ready" value={String(list.filter((c) => c.stage === "Draft ready").length)} />
        <MiniStat label="Source checked" value={`${list.filter((c) => c.stage !== "To verify").length}/${list.length}`} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="min-w-0 space-y-2.5 xl:col-span-5">
          {list.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={`card flex w-full items-center gap-4 p-4 text-left transition-colors ${c.id === selected.id ? "!border-ink" : "hover:border-line-strong"}`}
            >
              <FitRing value={c.fit} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[14.5px] font-medium">{c.name}</span>
                  {c.id === selected.id && <span className="size-1.5 rounded-full bg-accent" />}
                </div>
                <div className="truncate text-[12.5px] text-muted">{c.sector}</div>
              </div>
              <StageChip stage={c.stage} />
            </button>
          ))}
          <p className="px-1 pt-1 text-[12px] leading-relaxed text-muted">
            Public information only. Contacts are shown as roles; the BD team finds the person in Sales Navigator.
          </p>
        </div>

        <div className="min-w-0 xl:col-span-7">
          <CompanyDetail key={selected.id} c={selected} expoName={expo.short} />
        </div>
      </div>
    </div>
  );
}

function CompanyDetail({ c, expoName }: { c: Company; expoName: string }) {
  const drafts = draftMessages(c, expoName);
  const initial = {
    linkedin: drafts.linkedin,
    email: `Subject: ${drafts.email.subject}\n\n${drafts.email.body}`,
    whatsapp: drafts.whatsapp,
  };
  const [channel, setChannel] = useState<keyof typeof initial>("linkedin");
  const [texts, setTexts] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);
  const [live, setLive] = useState<boolean | null>(null);

  async function rewrite() {
    setBusy(true);
    try {
      const res = await fetch("/api/draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId: c.id, channel }) });
      const data = await res.json();
      if (data.text) setTexts((t) => ({ ...t, [channel]: data.text }));
      setLive(data.live);
    } finally {
      setBusy(false);
    }
  }

  async function copyAndOpen() {
    await navigator.clipboard.writeText(texts[channel]).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
    if (channel === "linkedin") window.open(`https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(c.name)}`, "_blank", "noopener");
  }

  const channels = [
    { id: "linkedin", label: "LinkedIn note", icon: InIcon },
    { id: "email", label: "Email", icon: Mail },
    { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  ] as const;

  return (
    <div className="rise card overflow-hidden">
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="eyebrow mb-1.5">
              {c.sector} · {c.hq}
            </div>
            <h2 className="display text-[28px]">{c.name}</h2>
          </div>
          <a href={c.website} target="_blank" rel="noopener" className="btn btn-ghost !px-3.5 !py-2 text-[12.5px]">
            Website <ExternalLink size={13} />
          </a>
        </div>
        <p className="mt-3 text-[14px] leading-relaxed text-ink-2">{c.what}</p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Fact title="Signal">
            {c.signal}{" "}
            <a href={c.source.url} target="_blank" rel="noopener" className="inline-flex items-center gap-0.5 text-accent-deep underline-offset-2 hover:underline">
              {c.source.label} <ArrowUpRight size={12} />
            </a>
          </Fact>
          <Fact title="Likely booth needs">{c.needs}</Fact>
          <Fact title={`Fit ${c.fit}/100`}>{c.fitWhy}</Fact>
          <Fact title="Closest Inextis work">{c.similar}</Fact>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-[12.5px] text-muted">
            <Users size={14} /> Contact:
          </span>
          {c.roles.map((r) => (
            <span key={r} className="chip bg-sunken text-ink-2">
              {r}
            </span>
          ))}
        </div>
      </div>

      <div className="border-t border-line bg-sunken/40 p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1 rounded-full bg-surface p-1 ring-1 ring-line">
            {channels.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setChannel(id)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] transition-colors ${channel === id ? "bg-ink text-white" : "text-ink-2 hover:text-ink"}`}
              >
                <Icon size={13} /> <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
          <button onClick={rewrite} disabled={busy} className="btn btn-ghost !py-2 text-[12.5px]">
            {busy ? <LoaderCircle size={14} className="animate-spin" /> : <Wand2 size={14} />} Rewrite with AI
          </button>
        </div>
        <textarea
          value={texts[channel]}
          onChange={(e) => setTexts((t) => ({ ...t, [channel]: e.target.value }))}
          rows={channel === "email" ? 11 : 5}
          className="field resize-none font-[450] leading-relaxed"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button onClick={copyAndOpen} className="btn btn-dark">
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {channel === "linkedin" ? "Copy & open LinkedIn" : "Copy message"}
          </button>
          <button onClick={() => setSent(true)} className={`btn ${sent ? "bg-good-soft text-good" : "btn-ghost"}`}>
            {sent ? <CheckCircle2 size={15} /> : <Send size={15} />}
            {sent ? "Marked as sent" : "Mark as sent"}
          </button>
          <span className="text-[12px] text-muted">
            {live === true ? "Rewritten by Claude. " : live === false ? "Template draft (no API key). " : ""}A person sends every LinkedIn message.
          </span>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Pipeline ---------------- */

const board = STAGES.map((stage) => {
  const all = deals.filter((d) => d.stage === stage && (stage === "Won" ? d.closed! >= addDays(TODAY, -60) : d.status === "open"));
  const sorted = [...all].sort((a, b) => Number(!!b.hot || !!b.awaitingApproval) - Number(!!a.hot || !!a.awaitingApproval) || b.value - a.value);
  return { stage, all, shown: sorted.slice(0, 4) };
});

function dealNote(d: Deal) {
  if (d.note) return d.note;
  if (d.stage === "Won") return `Won ${shortDate(d.closed!)} · ${d.sector}`;
  return `${d.sector} · ${d.source} · ${d.owner}`;
}

const sampleReplies = [
  "Thanks for reaching out. Can you share a couple of concepts by Friday? We're finalising our IEW space next week.",
  "Interesting, but our budget for exhibitions is locked till Q1. Please circle back in February.",
  "I'm not the right person for this. Please reach out to our corporate communications team.",
];

function Pipeline() {
  const [text, setText] = useState(sampleReplies[0]);
  const [result, setResult] = useState<{ label: string; next_step: string; reason: string; live: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  async function classify() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/classify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      setResult(await res.json());
    } finally {
      setBusy(false);
    }
  }

  const tone: Record<string, string> = {
    Interested: "bg-good-soft text-good",
    "Not now": "bg-accent-soft text-accent-deep",
    "Wrong person": "bg-sunken text-ink-2",
    "Not interested": "bg-bad-soft text-bad",
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-[13.5px] text-ink-2">Live deals by stage, plus wins in the last 60 days. Sample deals use fictional client names.</p>
        <DemoBadge />
      </div>
      <div className="scroll-thin -mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <div className="grid min-w-[1080px] grid-cols-6 gap-3">
          {board.map(({ stage, all, shown }) => {
            const total = all.reduce((a, d) => a + d.value, 0);
            const qualified = STAGES.indexOf(stage) >= 2;
            return (
              <div key={stage} className="rounded-2xl bg-sunken/70 p-2.5">
                <div className="flex items-center justify-between px-1.5 pb-2.5 pt-1">
                  <span className="text-[12.5px] font-medium">
                    {stage} <span className="font-normal text-muted">{all.length}</span>
                  </span>
                  <span className="text-[11.5px] text-muted">{qualified ? inrCr(total) : ""}</span>
                </div>
                <div className="space-y-2">
                  {shown.map((d) => (
                    <div key={d.id} className={`rounded-xl border bg-surface p-3 ${stage === "Won" ? "border-accent/40" : d.awaitingApproval ? "border-ink" : "border-line"}`}>
                      <div className="flex items-center gap-1.5">
                        {d.hot && <span className="pulse-dot size-1.5 rounded-full bg-accent" />}
                        <span className="truncate text-[13px] font-medium">{d.client}</span>
                      </div>
                      <div className="mt-1 text-[11.5px] leading-snug text-muted">{d.awaitingApproval ? `Awaiting Dhruv's approval · ${d.note}` : dealNote(d)}</div>
                      {qualified && <div className="num mt-2 text-[14px]">{inrCr(d.value)}</div>}
                    </div>
                  ))}
                  {all.length > shown.length && <div className="px-1.5 pb-1 text-[11.5px] text-muted">+{all.length - shown.length} more</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card grid gap-6 p-6 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <div className="eyebrow mb-1.5">Reply classifier</div>
          <h2 className="text-[16px] font-medium">Paste a reply, get the next step</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {sampleReplies.map((r, i) => (
              <button key={i} onClick={() => setText(r)} className={`chip border ${text === r ? "border-ink text-ink" : "border-line text-muted hover:text-ink"}`}>
                Sample {i + 1}
              </button>
            ))}
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className="field mt-3 resize-none leading-relaxed" />
          <button onClick={classify} disabled={busy || !text.trim()} className="btn btn-accent mt-3 disabled:opacity-60">
            {busy ? <LoaderCircle size={15} className="animate-spin" /> : <Sparkles size={15} />} Classify reply
          </button>
        </div>
        <div className="flex flex-col justify-center rounded-2xl bg-sunken/70 p-5">
          {result ? (
            <div className="rise">
              <span className={`chip ${tone[result.label] ?? "bg-sunken"}`}>{result.label}</span>
              <div className="mt-4 text-[12px] text-muted">Next step</div>
              <div className="mt-1 text-[15px] leading-snug">{result.next_step}</div>
              <div className="mt-3 text-[12.5px] text-muted">{result.reason}</div>
              <div className="mt-4 text-[11px] text-muted">{result.live ? "Classified by Claude" : "Rule-based demo (no API key)"}</div>
            </div>
          ) : (
            <p className="text-center text-[13px] text-muted">The label and next step appear here, and the deal moves on the board.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- LinkedIn ---------------- */

const posts = [
  {
    img: "/booths/nova_tech_pavilion_aerial.jpg",
    text: "A 14 × 12 m island pavilion, from brief to editable 3D in one afternoon. LED hero ring, sweeping ribbons and a presentation zone for 20. Heading to India Energy Week 2027? Let's design yours.",
    when: "Tue 10:00",
  },
  {
    img: "/booths/greenleaf_eco_pavilion_front.jpg",
    text: "Green energy, told in materials: moss walls, bamboo slats, grass carpet and natural oak. A sustainable inline stall concept for a fuels brand.",
    when: "Thu 10:00",
  },
  {
    img: "/booths/nova_tech_pavilion_front.jpg",
    text: "Behind every great booth is a screen plan. One key visual, adapted to 11 LED surfaces automatically. Here's how we do it.",
    when: "Mon 10:00",
  },
];

function LinkedInTab() {
  const [approved, setApproved] = useState<number[]>([]);
  return (
    <div className="grid gap-5 xl:grid-cols-12">
      <div className="space-y-5 xl:col-span-7">
        <div className="flex items-center justify-between">
          <div>
            <div className="eyebrow mb-1">Company Page · official Posts API</div>
            <h2 className="text-[16px] font-medium">Post drafts from booth renders</h2>
          </div>
          <span className="chip bg-sunken text-ink-2">{approved.length}/{posts.length} approved</span>
        </div>
        {posts.map((p, i) => {
          const ok = approved.includes(i);
          return (
            <div key={i} className="card flex flex-col gap-4 p-4 sm:flex-row">
              <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden rounded-xl bg-ink sm:w-48">
                <Image src={p.img} alt="" fill sizes="200px" className="object-cover" />
              </div>
              <div className="flex flex-1 flex-col">
                <div className="flex items-center gap-2">
                  <Image src="/brand/mark.png" alt="" width={10} height={22} className="h-5 w-auto" />
                  <span className="text-[13px] font-medium">Inextis Events</span>
                  <span className="text-[12px] text-muted">· scheduled {p.when}</span>
                </div>
                <p className="mt-2 flex-1 text-[13.5px] leading-relaxed text-ink-2">{p.text}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setApproved((a) => (ok ? a.filter((x) => x !== i) : [...a, i]))}
                    className={`btn !py-2 text-[12.5px] ${ok ? "bg-good-soft text-good" : "btn-dark"}`}
                  >
                    {ok ? <CheckCircle2 size={14} /> : <Check size={14} />} {ok ? "Approved" : "Approve"}
                  </button>
                  <button className="btn btn-ghost !py-2 text-[12.5px]">Edit</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-5 xl:col-span-5">
        <ConversationAd />
        <div className="card p-6">
          <div className="eyebrow mb-3">What LinkedIn allows</div>
          <ul className="space-y-2.5 text-[13.5px]">
            {["Company Page posts, scheduled", "Replies to comments on our posts", "Conversation Ads (paid, button flow)", "Ad lead forms synced to the CRM"].map((t) => (
              <li key={t} className="flex items-start gap-2.5">
                <ShieldCheck size={16} className="mt-0.5 shrink-0 text-good" /> {t}
              </li>
            ))}
            {["Bots sending DMs or connection requests", "Scraping profiles or search results"].map((t) => (
              <li key={t} className="flex items-start gap-2.5 text-muted">
                <Ban size={16} className="mt-0.5 shrink-0 text-bad" /> {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function ConversationAd() {
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <div>
          <div className="eyebrow">Conversation Ad preview</div>
          <div className="text-[13px] text-muted">India Energy Week 2027 · energy marketing heads</div>
        </div>
        <button onClick={() => { setStep(0); setSubmitted(false); }} className="text-[12px] text-muted hover:text-ink">
          Restart
        </button>
      </div>
      <div className="space-y-3 bg-sunken/50 p-5">
        <Bubble>
          Planning your stand for India Energy Week 2027 in Kolkata? We design and build pavilions for India&apos;s energy leaders, and can send you an editable 3D concept within 48 hours.
        </Bubble>
        {step === 0 && (
          <Choices options={["See 3D concepts", "Get a quick estimate", "Not now"]} onPick={(i) => setStep(i === 2 ? 3 : 1)} />
        )}
        {step >= 1 && step < 3 && (
          <>
            <UserBubble>See 3D concepts</UserBubble>
            <Bubble>
              <div className="relative mb-2 aspect-[16/9] overflow-hidden rounded-lg bg-ink">
                <Image src="/booths/nova_tech_pavilion_aerial.jpg" alt="" fill sizes="320px" className="object-cover" />
              </div>
              Here&apos;s a recent energy-tech pavilion concept. Want one made for your brand?
            </Bubble>
            {step === 1 && <Choices options={["Yes, contact me"]} onPick={() => setStep(2)} />}
          </>
        )}
        {step === 2 && (
          <div className="rise rounded-2xl border border-line bg-surface p-4">
            <div className="mb-3 text-[13px] font-medium">Lead form · prefilled from LinkedIn</div>
            {["Full name", "Company", "Job title", "Work email"].map((f) => (
              <div key={f} className="mb-2 flex items-center justify-between rounded-lg bg-sunken/70 px-3 py-2 text-[12.5px]">
                <span className="text-muted">{f}</span>
                <span className="text-ink-2">from profile</span>
              </div>
            ))}
            <button onClick={() => setSubmitted(true)} className={`btn mt-2 w-full ${submitted ? "bg-good-soft text-good" : "btn-accent"}`}>
              {submitted ? <><CheckCircle2 size={15} /> Lead sent to CRM, follow-up started</> : "Submit"}
            </button>
          </div>
        )}
        {step === 3 && <UserBubble>Not now</UserBubble>}
      </div>
    </div>
  );
}

/* ---------------- small pieces ---------------- */

function Bubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="rise flex gap-2.5">
      <div className="grid size-8 shrink-0 place-items-center rounded-full bg-surface ring-1 ring-line">
        <Image src="/brand/mark.png" alt="" width={8} height={18} className="h-[18px] w-auto" />
      </div>
      <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-surface p-3 text-[13px] leading-relaxed ring-1 ring-line">
        <div className="mb-1 text-[11px] text-muted">Inextis Events · Sponsored</div>
        {children}
      </div>
    </div>
  );
}

function UserBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="rise flex justify-end">
      <div className="rounded-2xl rounded-tr-md bg-ink px-3.5 py-2 text-[13px] text-white">{children}</div>
    </div>
  );
}

function Choices({ options, onPick }: { options: string[]; onPick: (i: number) => void }) {
  return (
    <div className="flex flex-wrap justify-end gap-2 pl-10">
      {options.map((o, i) => (
        <button key={o} onClick={() => onPick(i)} className="rounded-full border border-accent px-3.5 py-1.5 text-[12.5px] font-medium text-accent-deep transition-colors hover:bg-accent hover:text-white">
          {o}
        </button>
      ))}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card px-4 py-3.5">
      <div className="text-[12px] text-muted">{label}</div>
      <div className="num mt-0.5 text-[24px] font-light">{value}</div>
    </div>
  );
}

function Fact({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-sunken/60 p-3.5">
      <div className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">{title}</div>
      <div className="mt-1 text-[13px] leading-relaxed text-ink-2">{children}</div>
    </div>
  );
}

function StageChip({ stage }: { stage: Company["stage"] }) {
  const cls = stage === "Draft ready" ? "bg-accent-soft text-accent-deep" : stage === "To verify" ? "border border-dashed border-line-strong text-muted" : "bg-sunken text-ink-2";
  return <span className={`chip shrink-0 ${cls}`}>{stage}</span>;
}

function FitRing({ value }: { value: number }) {
  const r = 17;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid size-11 shrink-0 place-items-center">
      <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90">
        <circle cx="22" cy="22" r={r} fill="none" stroke="var(--color-sunken)" strokeWidth="3.5" />
        <circle cx="22" cy="22" r={r} fill="none" stroke={value >= 85 ? "var(--color-accent)" : "var(--color-ink)"} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${(value / 100) * c} ${c}`} />
      </svg>
      <span className="num text-[13px]">{value}</span>
    </div>
  );
}

function InIcon({ size = 13 }: { size?: number }) {
  return (
    <span className="font-bold leading-none" style={{ fontSize: size }}>
      in
    </span>
  );
}
