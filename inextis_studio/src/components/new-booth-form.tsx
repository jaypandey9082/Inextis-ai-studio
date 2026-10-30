"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Check, ImagePlus, LoaderCircle, Plus, Sparkles, X } from "lucide-react";

type Side = "front" | "back" | "left" | "right";
type Img = { name: string; mediaType: "image/jpeg"; data: string; preview: string };

const layouts: { id: string; label: string; sides: Side[]; hint: string }[] = [
  { id: "inline", label: "Inline", sides: ["front"], hint: "1 side open" },
  { id: "corner", label: "Corner", sides: ["front", "right"], hint: "2 sides open" },
  { id: "peninsula", label: "Peninsula", sides: ["front", "left", "right"], hint: "3 sides open" },
  { id: "island", label: "Island", sides: ["front", "back", "left", "right"], hint: "4 sides open" },
];

const samples = [
  {
    label: "Energy island",
    client: "Helios Grid",
    w: 9,
    d: 9,
    layout: "island",
    h: 5,
    brief: "Island stall for a smart-grid and battery company at India Energy Week. Hero LED ring over a central drum, reception at the front corner, four touch tables for product demos, a glass meeting room for 4 at the back, lounge for 6, storage. Deep teal and lime.",
  },
  {
    label: "Inline green stall",
    client: "Ganga Biofuels",
    w: 9,
    d: 3,
    layout: "inline",
    h: 4,
    brief: "Inline stall, only the front open. Biofuels brand with a green story: moss wall with logo, wooden back wall with a story LED, grass carpet, two totems, small info desk and plenty of plants. Natural wood and green.",
  },
  {
    label: "Auto pavilion",
    client: "Vega Motors",
    w: 12,
    d: 9,
    layout: "peninsula",
    h: 6,
    brief: "Peninsula pavilion for an EV maker at Bharat Mobility. Big LED wall at the back for launches, curved fascia with brand name, presentation seating for 20, reception, a glass meeting room for VIPs, two touch tables and a lounge. Black, white and electric blue.",
  },
];

const stages = ["Reading the brief", "Planning the zones", "Placing parts from the Inextis library", "Checking layout rules", "Pricing every part"];

async function resize(file: File): Promise<Img> {
  const url = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = url;
  });
  const k = Math.min(1, 1280 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * k);
  c.height = Math.round(img.height * k);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(url);
  const dataUrl = c.toDataURL("image/jpeg", 0.85);
  return { name: file.name, mediaType: "image/jpeg", data: dataUrl.split(",")[1], preview: dataUrl };
}

export function NewBoothForm() {
  const router = useRouter();
  const [client, setClient] = useState("");
  const [brief, setBrief] = useState("");
  const [w, setW] = useState(9);
  const [d, setD] = useState(6);
  const [h, setH] = useState(4.5);
  const [sides, setSides] = useState<Side[]>(["front"]);
  const [colours, setColours] = useState<string[]>(["#ee8022"]);
  const [images, setImages] = useState<Img[]>([]);
  const [busy, setBusy] = useState<"ai" | "empty" | null>(null);
  const [stage, setStage] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (busy !== "ai") return;
    const t0 = Date.now();
    const iv = setInterval(() => {
      const s = (Date.now() - t0) / 1000;
      setElapsed(Math.floor(s));
      setStage(s < 4 ? 0 : s < 12 ? 1 : s < 32 ? 2 : s < 45 ? 3 : 4);
    }, 500);
    return () => clearInterval(iv);
  }, [busy]);

  function applySample(sm: (typeof samples)[number]) {
    setClient(sm.client);
    setBrief(sm.brief);
    setW(sm.w);
    setD(sm.d);
    setH(sm.h);
    setSides(layouts.find((l) => l.id === sm.layout)!.sides);
  }

  async function addFiles(files: FileList | null) {
    if (!files) return;
    const next = [...images];
    for (const f of Array.from(files).slice(0, 3 - images.length)) if (f.type.startsWith("image/")) next.push(await resize(f));
    setImages(next);
  }

  async function submit(kind: "ai" | "empty") {
    setError(null);
    setBusy(kind);
    try {
      const body = { client, title: client ? `${client} booth` : "", brief, w, d, heightLimit: h, openSides: sides, brandColours: colours, images: images.map(({ mediaType, data }) => ({ mediaType, data })) };
      const res = await fetch(kind === "ai" ? "/api/booths/generate" : "/api/booths", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      router.push(`/booths/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(null);
    }
  }

  const area = w * d;
  const layoutId = layouts.find((l) => l.sides.length === sides.length && l.sides.every((s) => sides.includes(s)))?.id;

  if (busy === "ai")
    return (
      <div className="card mx-auto max-w-xl p-8">
        <div className="eyebrow mb-2">Designing with Claude</div>
        <h2 className="text-[20px] font-medium">{client || "New"} booth · {w} × {d} m</h2>
        <ol className="mt-6 space-y-4">
          {stages.map((s, i) => (
            <li key={s} className="flex items-center gap-3">
              <span className={`grid size-6 place-items-center rounded-full text-[11px] ${i < stage ? "bg-ink text-white" : i === stage ? "bg-accent text-white" : "border border-line-strong text-muted"}`}>
                {i < stage ? <Check size={13} /> : i === stage ? <LoaderCircle size={13} className="animate-spin" /> : i + 1}
              </span>
              <span className={`text-[14px] ${i <= stage ? "text-ink" : "text-muted"}`}>{s}</span>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-[12.5px] text-muted">{elapsed} s · usually 30–60 s. The booth opens in the editor when it&apos;s ready.</p>
      </div>
    );

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <div className="card space-y-6 p-6 lg:p-7">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-[12.5px] text-muted">Try a sample:</span>
            {samples.map((s) => (
              <button key={s.label} onClick={() => applySample(s)} className="chip border border-line text-ink-2 hover:border-ink">
                {s.label}
              </button>
            ))}
          </div>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium">Client brief</span>
            <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={6} placeholder="What should the booth do? Zones, key features, brand feel, colours…" className="field resize-none leading-relaxed" />
          </label>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium">Client</span>
          <input value={client} onChange={(e) => setClient(e.target.value)} placeholder="e.g. Helios Grid" className="field" />
        </label>
        <div>
          <span className="mb-1.5 block text-[13px] font-medium">Reference images (optional, up to 3)</span>
          <div className="flex flex-wrap gap-3">
            {images.map((im, i) => (
              <div key={i} className="relative size-24 overflow-hidden rounded-xl border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={im.preview} alt={im.name} className="size-full object-cover" />
                <button onClick={() => setImages(images.filter((_, j) => j !== i))} className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-ink/80 text-white">
                  <X size={11} />
                </button>
              </div>
            ))}
            {images.length < 3 && (
              <button
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  addFiles(e.dataTransfer.files);
                }}
                className="grid size-24 place-items-center rounded-xl border border-dashed border-line-strong text-muted hover:border-ink hover:text-ink"
              >
                <span className="flex flex-col items-center gap-1 text-[11.5px]">
                  <ImagePlus size={18} /> Add image
                </span>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
          </div>
          <p className="mt-2 text-[12px] text-muted">Past booths, moodboards or the client&apos;s brand guide. Claude takes the mood and key elements from them.</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="card space-y-5 p-6">
          <div className="grid grid-cols-3 gap-3">
            {[
              ["Width", w, setW, 3, 40],
              ["Depth", d, setD, 3, 40],
              ["Max height", h, setH, 2.5, 12],
            ].map(([label, v, set, min, max]) => (
              <label key={label as string} className="block">
                <span className="mb-1.5 block text-[12.5px] text-ink-2">{label as string} (m)</span>
                <input type="number" step={0.5} min={min as number} max={max as number} value={v as number} onChange={(e) => (set as (n: number) => void)(Number(e.target.value))} className="field tabular-nums" />
              </label>
            ))}
          </div>
          <div className="text-[12px] text-muted">
            {area.toFixed(0)} m² · {(area * 10.764).toFixed(0)} sq ft
          </div>
          <div>
            <span className="mb-1.5 block text-[12.5px] text-ink-2">Stall type</span>
            <div className="grid grid-cols-2 gap-2">
              {layouts.map((l) => (
                <button key={l.id} onClick={() => setSides(l.sides)} className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${layoutId === l.id ? "border-ink bg-ink text-white" : "border-line hover:border-ink"}`}>
                  <div className="text-[13px] font-medium">{l.label}</div>
                  <div className={`text-[11.5px] ${layoutId === l.id ? "text-white/60" : "text-muted"}`}>{l.hint}</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="mb-1.5 block text-[12.5px] text-ink-2">Brand colours</span>
            <div className="flex items-center gap-2">
              {colours.map((c, i) => (
                <span key={i} className="relative">
                  <input type="color" value={c} onChange={(e) => setColours(colours.map((x, j) => (j === i ? e.target.value : x)))} className="h-9 w-11 cursor-pointer rounded-lg border border-line" />
                  {colours.length > 1 && (
                    <button onClick={() => setColours(colours.filter((_, j) => j !== i))} className="absolute -right-1.5 -top-1.5 grid size-4 place-items-center rounded-full bg-ink text-white">
                      <X size={9} />
                    </button>
                  )}
                </span>
              ))}
              {colours.length < 3 && (
                <button onClick={() => setColours([...colours, "#1f4fd8"])} className="grid h-9 w-11 place-items-center rounded-lg border border-dashed border-line-strong text-muted hover:border-ink">
                  <Plus size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {error && <div className="rounded-xl bg-bad-soft px-4 py-3 text-[13px] text-bad">{error}</div>}
        <button onClick={() => submit("ai")} disabled={!!busy || brief.trim().length < 10} className="btn btn-accent w-full !py-3 text-[14px] disabled:opacity-50">
          <Sparkles size={16} /> Design with AI
        </button>
        <button onClick={() => submit("empty")} disabled={!!busy} className="btn btn-ghost w-full disabled:opacity-50">
          {busy === "empty" ? <LoaderCircle size={15} className="animate-spin" /> : null} Start with an empty booth
        </button>
        <p className="text-[12px] leading-relaxed text-muted">Claude uses only parts from the Inextis library, checks the layout rules, and prices every part. A design costs about ₹10 in AI usage.</p>
      </div>
    </div>
  );
}
