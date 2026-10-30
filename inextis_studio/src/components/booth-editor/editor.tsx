"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Box, Check, Download, LoaderCircle, Map, Move, Redo2, RotateCw, Undo2, Wand2 } from "lucide-react";
import type { Project, Version } from "@/lib/booth/projects";
import { useEditor } from "@/lib/booth/store";
import { download, exportGlb } from "@/lib/booth/three/export";
import { AiChat, IssuesButton } from "./ai-chat";
import { RenderDrawer } from "./render-panel";
import { CostPanel, LibraryPanel, PropertiesPanel, VersionsPanel, lakh, usePlanTotal } from "./panels";
import { viewportCapture } from "./bridge";

const Viewport = dynamic(() => import("./viewport").then((m) => m.Viewport), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center bg-[#121317] text-white/50">
      <LoaderCircle className="animate-spin" />
    </div>
  ),
});

type SaveState = "saved" | "saving" | "unsaved" | "error";

export function BoothEditor({ initial }: { initial: Project }) {
  const storePlan = useEditor((s) => s.plan);
  const loadedId = useEditor((s) => s.projectId);
  const plan = loadedId === initial.id ? storePlan : null;
  const revision = useEditor((s) => s.revision);
  const view = useEditor((s) => s.view);
  const tool = useEditor((s) => s.tool);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const { load, undo, redo, setView, setTool, commit, select } = useEditor.getState();
  const [project, setProject] = useState(initial);
  const [save, setSave] = useState<SaveState>("saved");
  const [busy, setBusy] = useState(false);
  const [showRender, setShowRender] = useState(false);
  const lastThumb = useRef(0);
  const total = usePlanTotal(plan);

  useEffect(() => {
    load(initial.id, initial.plan);
  }, [initial, load]);

  const persist = useCallback(
    async (opts: { version?: string; thumb?: boolean } = {}) => {
      const { plan: p, projectId } = useEditor.getState();
      if (!p || projectId !== initial.id) return;
      setSave("saving");
      const wantThumb = opts.thumb || Date.now() - lastThumb.current > 60_000;
      const thumbnail = wantThumb && viewportCapture.current ? viewportCapture.current() : undefined;
      if (thumbnail) lastThumb.current = Date.now();
      try {
        const res = await fetch(`/api/booths/${initial.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: p, thumbnail, version: opts.version }) });
        if (!res.ok) throw new Error();
        setProject(await res.json());
        setSave("saved");
      } catch {
        setSave("error");
      }
    },
    [initial.id],
  );

  // First open: save a thumbnail once the 3D view has drawn
  useEffect(() => {
    if (initial.thumbnail) return;
    let tries = 0;
    let ready = 0;
    const iv = setInterval(() => {
      tries++;
      const loaded = !!viewportCapture.current && useEditor.getState().projectId === initial.id;
      ready = loaded ? ready + 1 : 0;
      // wait for two ticks after the view is ready so the booth has drawn
      if (ready >= 2) {
        clearInterval(iv);
        persist({ thumb: true });
      } else if (tries > 30) clearInterval(iv);
    }, 1000);
    return () => clearInterval(iv);
  }, [initial.thumbnail, persist]);

  // Autosave 1.2 s after the last change
  useEffect(() => {
    if (revision === 0) return;
    setSave("unsaved");
    const t = setTimeout(() => persist(), 1200);
    return () => clearTimeout(t);
  }, [revision, persist]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select")) return;
      const s = useEditor.getState();
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        s.redo();
      } else if ((e.key === "Delete" || e.key === "Backspace") && s.selectedId) {
        e.preventDefault();
        s.removePart(s.selectedId);
      } else if (e.key.toLowerCase() === "d" && !mod && s.selectedId) s.duplicatePart(s.selectedId);
      else if (e.key.toLowerCase() === "r" && !mod) s.setTool(s.tool === "rotate" ? "move" : "rotate");
      else if (e.key.toLowerCase() === "g" && !mod) s.setTool("move");
      else if (e.key === "Escape") s.select(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const baseline = project.versions.at(-1)?.total ?? null;

  async function exportModel() {
    if (!plan) return;
    setBusy(true);
    try {
      download(await exportGlb(plan), `${plan.name}.glb`, "model/gltf-binary");
    } finally {
      setBusy(false);
    }
  }

  function restore(v: Version) {
    commit(v.plan);
    select(null);
  }

  if (!plan)
    return (
      <div className="fixed inset-x-0 bottom-[64px] top-[57px] z-20 grid place-items-center bg-[#121317] text-white/60 lg:bottom-0 lg:left-[248px] lg:top-0">
        <div className="flex items-center gap-3 text-[13px]">
          <LoaderCircle className="animate-spin" size={18} /> Opening {initial.plan.title}…
        </div>
      </div>
    );

  return (
    <div className="fixed inset-x-0 bottom-[64px] top-[57px] z-20 flex flex-col bg-canvas lg:bottom-0 lg:left-[248px] lg:top-0">
      {/* Top bar */}
      <header className="flex flex-wrap items-center gap-3 border-b border-line bg-surface px-4 py-2.5">
        <Link href="/booths" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-sunken hover:text-ink" title="All booths">
          <ArrowLeft size={16} />
        </Link>
        <div className="min-w-0">
          <div className="truncate text-[14px] font-medium">{plan.title}</div>
          <div className="text-[11.5px] text-muted">
            {project.client || "No client"} · {plan.size[0]} × {plan.size[1]} m · {plan.parts.length} parts
          </div>
        </div>
        <SaveBadge state={save} />

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <IssuesButton />
          <Toggle
            items={[
              { id: "3d", label: "3D", icon: Box },
              { id: "plan", label: "Plan", icon: Map },
            ]}
            value={view}
            onChange={(v) => setView(v as "3d" | "plan")}
          />
          <Toggle
            items={[
              { id: "move", label: "Move", icon: Move, hint: "G" },
              { id: "rotate", label: "Rotate", icon: RotateCw, hint: "R" },
            ]}
            value={tool}
            onChange={(v) => setTool(v as "move" | "rotate")}
          />
          <div className="flex rounded-full border border-line bg-surface p-0.5">
            <IconBtn title="Undo (⌘Z)" onClick={undo} disabled={!canUndo}>
              <Undo2 size={15} />
            </IconBtn>
            <IconBtn title="Redo (⇧⌘Z)" onClick={redo} disabled={!canRedo}>
              <Redo2 size={15} />
            </IconBtn>
          </div>
          <button onClick={exportModel} disabled={busy} className="btn btn-ghost !py-1.5 text-[12.5px]">
            {busy ? <LoaderCircle size={14} className="animate-spin" /> : <Download size={14} />} 3D file
          </button>
          <button onClick={() => setShowRender(!showRender)} className="btn btn-accent !py-1.5 text-[12.5px]">
            <Wand2 size={14} /> Render
          </button>
          <div className="hidden rounded-full bg-ink px-4 py-1.5 text-[13px] text-white sm:block">
            <span className="num">{lakh(total)}</span>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="scroll-thin hidden w-[248px] shrink-0 overflow-y-auto border-r border-line bg-surface lg:block">
          <LibraryPanel />
        </aside>
        <main className="relative min-w-0 flex-1">
          <Viewport />
          <div className="pointer-events-none absolute left-3 top-3 hidden rounded-lg bg-black/45 px-2.5 py-1.5 text-[11px] text-white/70 backdrop-blur xl:block">
            Click a part · drag arrows to move · R rotate · D duplicate · Del remove · ⌘Z undo
          </div>
          <AiChat />
          {showRender && (
            <RenderDrawer
              project={project}
              onClose={() => setShowRender(false)}
              onRendered={async () => {
                const res = await fetch(`/api/booths/${initial.id}`);
                if (res.ok) setProject(await res.json());
              }}
            />
          )}
        </main>
        <aside className="scroll-thin hidden w-[320px] shrink-0 overflow-y-auto border-l border-line bg-surface lg:block">
          <PropertiesPanel />
          <CostPanel baseline={baseline} />
          <VersionsPanel versions={project.versions} saving={save === "saving"} onSave={(label) => persist({ version: label, thumb: true })} onRestore={restore} />
        </aside>
      </div>
    </div>
  );
}

function SaveBadge({ state }: { state: SaveState }) {
  const map = {
    saved: { t: "Saved", c: "text-muted", i: <Check size={12} /> },
    saving: { t: "Saving…", c: "text-muted", i: <LoaderCircle size={12} className="animate-spin" /> },
    unsaved: { t: "Unsaved changes", c: "text-warn", i: null },
    error: { t: "Couldn't save", c: "text-bad", i: null },
  }[state];
  return <span className={`hidden items-center gap-1 text-[11.5px] sm:flex ${map.c}`}>{map.i}{map.t}</span>;
}

function Toggle({ items, value, onChange }: { items: { id: string; label: string; icon: typeof Box; hint?: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex rounded-full border border-line bg-surface p-0.5">
      {items.map(({ id, label, icon: Icon, hint }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          title={hint ? `${label} (${hint})` : label}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] transition-colors ${value === id ? "bg-ink text-white" : "text-ink-2 hover:text-ink"}`}
        >
          <Icon size={14} />
          <span className="hidden md:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}

function IconBtn({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} className="grid size-7 place-items-center rounded-full text-ink-2 hover:bg-sunken hover:text-ink disabled:opacity-30">
      {children}
    </button>
  );
}
