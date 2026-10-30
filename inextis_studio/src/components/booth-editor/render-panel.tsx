"use client";

import { useEffect, useState } from "react";
import { Download, ExternalLink, FileBox, ImageIcon, LoaderCircle, Wand2, X } from "lucide-react";
import type { Project, Render } from "@/lib/booth/projects";
import type { View } from "@/lib/booth/schema";
import { useEditor } from "@/lib/booth/store";
import { exportGlb } from "@/lib/booth/three/export";
import { viewportCamera } from "./bridge";

type Job = { id: string; state: "queued" | "running" | "done" | "error"; progress: string; done: number; total: number; images: string[]; files: string[]; seconds?: number; error?: string };

function toBase64(buf: ArrayBuffer) {
  let s = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function RenderDrawer({ project, onClose, onRendered }: { project: Project; onClose: () => void; onRendered: () => void }) {
  const [quality, setQuality] = useState<"draft" | "final">("draft");
  const [picked, setPicked] = useState<string[]>(["aerial", "current"]);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const busy = job?.state === "queued" || job?.state === "running";

  useEffect(() => {
    if (!job || !busy) return;
    const t0 = Date.now() - elapsed * 1000;
    const iv = setInterval(async () => {
      setElapsed(Math.floor((Date.now() - t0) / 1000));
      const res = await fetch(`/api/booths/${project.id}/render?job=${job.id}`);
      if (res.ok) {
        const next = (await res.json()) as Job;
        setJob(next);
        if (next.state === "done") onRendered();
      }
    }, 1500);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id, busy]);

  async function start() {
    const plan = useEditor.getState().plan;
    if (!plan) return;
    setError(null);
    setElapsed(0);
    const views: View[] = [];
    for (const v of plan.views) if (picked.includes(v.name)) views.push(v);
    if (picked.includes("current")) {
      const cam = viewportCamera.current?.();
      if (cam) views.push({ name: "current", ...cam });
    }
    if (!views.length) return setError("Pick at least one view.");
    try {
      setJob({ id: "", state: "queued", progress: "Exporting the 3D model", done: 0, total: views.length, images: [], files: [] });
      const glb = toBase64(await exportGlb(plan));
      const version = project.versions.at(-1)?.n ?? null;
      const res = await fetch(`/api/booths/${project.id}/render`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ glb, plan, quality, views, version }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't start the render");
      setJob(data);
    } catch (e) {
      setJob(null);
      setError(e instanceof Error ? e.message : "Couldn't start the render");
    }
  }

  const views = [
    { id: "aerial", label: "Aerial" },
    { id: "front", label: "Front" },
    { id: "current", label: "Current view" },
  ];
  const estimate = quality === "final" ? "about 1–2 min per view" : "about 20–40 s per view";

  return (
    <div className="absolute inset-y-0 right-0 z-10 flex w-full max-w-[380px] flex-col border-l border-line bg-surface shadow-2xl">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <div>
          <div className="eyebrow mb-0.5">Blender 5.2</div>
          <div className="text-[15px] font-medium">Render this booth</div>
        </div>
        <button onClick={onClose} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-sunken hover:text-ink">
          <X size={16} />
        </button>
      </div>

      <div className="scroll-thin flex-1 space-y-5 overflow-y-auto p-5">
        <div>
          <div className="mb-2 text-[12.5px] text-ink-2">Quality</div>
          <div className="grid grid-cols-2 gap-2">
            {(["draft", "final"] as const).map((q) => (
              <button key={q} onClick={() => setQuality(q)} disabled={busy} className={`rounded-xl border px-3 py-2.5 text-left ${quality === q ? "border-ink bg-ink text-white" : "border-line hover:border-ink"}`}>
                <div className="text-[13px] font-medium capitalize">{q}</div>
                <div className={`text-[11.5px] ${quality === q ? "text-white/60" : "text-muted"}`}>{q === "draft" ? "1280 × 720, quick check" : "1920 × 1080, for clients"}</div>
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 text-[12.5px] text-ink-2">Views</div>
          <div className="flex flex-wrap gap-2">
            {views.map((v) => {
              const on = picked.includes(v.id);
              return (
                <button key={v.id} disabled={busy} onClick={() => setPicked(on ? picked.filter((x) => x !== v.id) : [...picked, v.id])} className={`chip border !py-1.5 ${on ? "border-ink bg-ink text-white" : "border-line text-ink-2"}`}>
                  {v.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11.5px] text-muted">&ldquo;Current view&rdquo; uses the camera angle you see in the editor right now.</p>
        </div>

        <button onClick={start} disabled={busy} className="btn btn-accent w-full !py-2.5 disabled:opacity-60">
          {busy ? <LoaderCircle size={15} className="animate-spin" /> : <Wand2 size={15} />}
          {busy ? "Rendering…" : `Render ${picked.length} ${picked.length === 1 ? "view" : "views"}`}
        </button>
        <p className="-mt-3 text-center text-[11.5px] text-muted">{estimate} on this Mac</p>

        {error && <div className="rounded-xl bg-bad-soft px-4 py-3 text-[13px] text-bad">{error}</div>}

        {job && (
          <div className="rounded-2xl border border-line p-4">
            {busy && (
              <>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="flex items-center gap-2">
                    <LoaderCircle size={14} className="animate-spin text-accent" /> {job.progress}
                  </span>
                  <span className="tabular-nums text-muted">{elapsed} s</span>
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-sunken">
                  <div className="h-1.5 rounded-full bg-accent transition-all" style={{ width: `${Math.max(6, (job.done / Math.max(job.total, 1)) * 100)}%` }} />
                </div>
                <div className="mt-1.5 text-[11.5px] text-muted">
                  {job.done} of {job.total} views
                </div>
              </>
            )}
            {job.state === "error" && <div className="text-[13px] text-bad">Render failed: {job.error}</div>}
            {job.state === "done" && <div className="mb-3 text-[13px] text-good">Done in {Math.round(job.seconds ?? 0)} s</div>}
            {job.images.length > 0 && <RenderGallery images={job.images} files={job.state === "done" ? job.files : []} />}
          </div>
        )}

        {project.renders.length > 0 && (
          <div>
            <div className="mb-2 text-[12.5px] text-ink-2">Earlier renders</div>
            <div className="space-y-3">
              {project.renders.slice(0, 6).map((r: Render) => (
                <div key={r.id} className="rounded-xl border border-line p-3">
                  <div className="mb-2 flex justify-between text-[11.5px] text-muted">
                    <span className="capitalize">
                      {r.quality}
                      {r.version ? ` · v${r.version}` : ""}
                    </span>
                    <span>{new Date(r.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <RenderGallery images={r.images} files={r.files} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RenderGallery({ images, files }: { images: string[]; files: string[] }) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        {images.map((src) => (
          <a key={src} href={src} target="_blank" rel="noopener" className="group relative block aspect-video overflow-hidden rounded-lg bg-ink">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="size-full object-cover transition-transform group-hover:scale-[1.03]" />
            <span className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-md bg-black/50 text-white opacity-0 group-hover:opacity-100">
              <ExternalLink size={12} />
            </span>
          </a>
        ))}
      </div>
      {(files.length > 0 || images.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {images.map((src) => (
            <a key={src} href={src} download className="chip border border-line text-[11px] text-ink-2 hover:border-ink">
              <ImageIcon size={11} /> {src.split("/").pop()?.replace(".png", "")} PNG
            </a>
          ))}
          {files.map((f) => (
            <a key={f} href={f} download className="chip border border-line text-[11px] text-ink-2 hover:border-ink">
              {f.endsWith(".fbx") ? <FileBox size={11} /> : <Download size={11} />} {f.endsWith(".fbx") ? "3ds Max (.fbx)" : "Blender (.blend)"}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
