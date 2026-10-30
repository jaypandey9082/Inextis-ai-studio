"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, LoaderCircle, Sparkles, Zap } from "lucide-react";
import { accents, layoutFor, pitches, pixelSize, screens, sponsors, type Screen } from "@/data/screens";
import { drawKeyVisual, drawStretched, type KVOptions } from "@/lib/key-visual";

type Mode = "smart" | "stretch";
const MAX_CANVAS = 16000;

function fontVar(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function render(canvas: HTMLCanvasElement, w: number, h: number, mode: Mode, opts: KVOptions, master: HTMLCanvasElement) {
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  if (mode === "smart") drawKeyVisual(ctx, w, h, opts);
  else drawStretched(ctx, w, h, master);
}

export function ScreenAdapter() {
  const [headline, setHeadline] = useState("Powering India's next energy decade");
  const [sub, setSub] = useState("India Energy Week 2027 · Kolkata · Stand B12");
  const [sponsor, setSponsor] = useState(sponsors[0]);
  const [accent, setAccent] = useState(accents[0].value);
  const [pitch, setPitch] = useState(2.6);
  const [mode, setMode] = useState<Mode>("smart");
  const [fontsReady, setFontsReady] = useState(false);
  const [renderMs, setRenderMs] = useState<number | null>(null);
  const [zipping, setZipping] = useState(false);
  const canvases = useRef<Record<string, HTMLCanvasElement | null>>({});
  const masterRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    document.fonts.ready.then(() => setFontsReady(true));
  }, []);

  const opts = useMemo<KVOptions>(
    () => ({ headline, sub, sponsor, accent, fontDisplay: fontVar("--font-jost", "sans-serif"), fontBody: fontVar("--font-inter", "sans-serif") }),
    // fontsReady re-reads the font variables once web fonts have loaded
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [headline, sub, sponsor, accent, fontsReady],
  );

  useEffect(() => {
    if (!fontsReady) return;
    const t0 = performance.now();
    masterRef.current ??= document.createElement("canvas");
    masterRef.current.width = 1920;
    masterRef.current.height = 1080;
    drawKeyVisual(masterRef.current.getContext("2d")!, 1920, 1080, opts);
    for (const s of screens) {
      const c = canvases.current[s.id];
      if (!c) continue;
      const [w, h] = pixelSize(s, pitch);
      const scale = Math.min(1, 1100 / w, 700 / h);
      render(c, Math.round(w * scale), Math.round(h * scale), mode, opts, masterRef.current);
    }
    setRenderMs(Math.max(1, Math.round(performance.now() - t0)));
  }, [opts, pitch, mode, fontsReady]);

  async function downloadZip() {
    setZipping(true);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      const c = document.createElement("canvas");
      for (const s of screens) {
        const [w, h] = pixelSize(s, pitch);
        const k = Math.min(1, MAX_CANVAS / w, MAX_CANVAS / h);
        render(c, Math.round(w * k), Math.round(h * k), mode, opts, masterRef.current!);
        const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), "image/png"));
        zip.file(`${s.id}_${w}x${h}.png`, blob);
      }
      const out = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(out);
      a.download = "NOVA_IEW2027_screens.zip";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } finally {
      setZipping(false);
    }
  }

  const groups: { title: string; note: string; items: Screen[]; cols: string }[] = [
    { title: "LED ribbons", note: "Very wide: one row of content, repeated on the ring so it reads from every side.", items: screens.filter((s) => s.kind === "LED ribbon"), cols: "grid-cols-1" },
    { title: "LED walls", note: "Pixel size comes from the wall size and the LED pixel pitch.", items: screens.filter((s) => s.kind === "LED wall"), cols: "grid-cols-2 lg:grid-cols-4" },
    { title: "Totems and touch tables", note: "Standard screens with fixed resolutions.", items: screens.filter((s) => s.fixedPx), cols: "grid-cols-2 lg:grid-cols-4" },
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
      {/* Controls */}
      <aside className="xl:sticky xl:top-8 xl:self-start">
        <div className="card space-y-5 p-5">
          <div>
            <div className="eyebrow mb-1">Master design</div>
            <div className="text-[14px] text-ink-2">NOVA Energy · IEW 2027 key visual</div>
          </div>
          <Field label="Headline">
            <textarea value={headline} onChange={(e) => setHeadline(e.target.value)} rows={2} className="field resize-none !py-2.5 text-[13.5px]" />
          </Field>
          <Field label="Date and stand">
            <input value={sub} onChange={(e) => setSub(e.target.value)} className="field !py-2.5 text-[13.5px]" />
          </Field>
          <Field label="Sponsor (late change)">
            <Segmented options={sponsors} value={sponsor} onChange={setSponsor} />
          </Field>
          <Field label="Accent colour">
            <div className="flex gap-2">
              {accents.map((a) => (
                <button
                  key={a.value}
                  onClick={() => setAccent(a.value)}
                  title={a.name}
                  className={`size-8 rounded-full ring-offset-2 ring-offset-surface transition ${accent === a.value ? "ring-2 ring-ink" : ""}`}
                  style={{ background: a.value }}
                />
              ))}
            </div>
          </Field>
          <Field label="LED pixel pitch">
            <Segmented options={pitches.map((p) => `${p} mm`)} value={`${pitch} mm`} onChange={(v) => setPitch(parseFloat(v))} />
          </Field>
          <Field label="Resize method">
            <Segmented options={["Smart adapt", "Plain resize"]} value={mode === "smart" ? "Smart adapt" : "Plain resize"} onChange={(v) => setMode(v === "Smart adapt" ? "smart" : "stretch")} />
          </Field>

          <div className="rounded-xl bg-sunken/70 px-3.5 py-3 text-[12.5px] text-ink-2">
            <div className="flex items-center gap-1.5 font-medium text-ink">
              <Zap size={14} className="text-accent" /> {screens.length} screens regenerated
            </div>
            <div className="mt-0.5 text-muted">{renderMs !== null ? `in ${renderMs} ms (previews)` : "Loading fonts…"}</div>
          </div>
          <button onClick={downloadZip} disabled={zipping || !fontsReady} className="btn btn-dark w-full disabled:opacity-60">
            {zipping ? <LoaderCircle size={15} className="animate-spin" /> : <Download size={15} />}
            {zipping ? "Rendering full size…" : "Download all (ZIP)"}
          </button>
          <p className="text-[11.5px] leading-relaxed text-muted">
            The background is generated, so it extends to any shape. In the full tool, AI extends photo backgrounds (Adobe Firefly or a hosted image model).
          </p>
        </div>
      </aside>

      {/* Outputs */}
      <div className="min-w-0 space-y-8">
        {mode === "stretch" && (
          <div className="rise flex items-start gap-3 rounded-2xl border border-bad/30 bg-bad-soft px-4 py-3 text-[13px] text-bad">
            <Sparkles size={16} className="mt-0.5 shrink-0" />
            This is what a plain resize does: the 16:9 master squeezed into every screen. Switch back to Smart adapt to compare.
          </div>
        )}
        {groups.map((g) => (
          <section key={g.title}>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="eyebrow !text-ink-2">{g.title}</h2>
              <span className="text-[12px] text-muted">{g.note}</span>
            </div>
            <div className={`grid items-end gap-4 ${g.cols}`}>
              {g.items.map((s) => {
                const [w, h] = pixelSize(s, pitch);
                return (
                  <figure key={s.id} className="card p-3">
                    <div className="overflow-hidden rounded-lg bg-ink" style={{ aspectRatio: `${w} / ${h}` }}>
                      <canvas ref={(el) => { canvases.current[s.id] = el; }} className="block h-full w-full" />
                    </div>
                    <figcaption className="mt-2.5 px-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate text-[13px] font-medium">{s.name}</div>
                        <span className="chip shrink-0 bg-sunken !px-2 text-[10.5px] text-ink-2">{layoutFor(w, h)}</span>
                      </div>
                      <div className="mt-0.5 text-[11.5px] tabular-nums text-muted">
                        <span className="text-ink-2">
                          {w.toLocaleString("en-IN")} × {h.toLocaleString("en-IN")} px
                        </span>{" "}
                        · {s.widthM} × {s.heightM} m
                      </div>
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium text-ink-2">{label}</span>
      {children}
    </label>
  );
}

function Segmented({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex rounded-xl bg-sunken p-1">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`flex-1 rounded-lg px-2 py-1.5 text-[12px] transition-colors ${value === o ? "bg-surface font-medium text-ink shadow-sm" : "text-ink-2 hover:text-ink"}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
