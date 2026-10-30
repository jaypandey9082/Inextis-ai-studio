"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Copy, Download, History, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { costingCsv, price } from "@/lib/booth/costing";
import { GROUPS, PART_MAP, PARTS, type ParamDef } from "@/lib/booth/registry";
import { hexToRgb, rgbToHex, type Plan, type Rgb } from "@/lib/booth/schema";
import { useEditor } from "@/lib/booth/store";
import type { Version } from "@/lib/booth/projects";
import { download } from "@/lib/booth/three/export";

export const inr = (v: number) => `₹${Math.round(v).toLocaleString("en-IN")}`;
export const lakh = (v: number) => `₹${(v / 100000).toFixed(1)} L`;

/* ---------------- small inputs ---------------- */

function Field({ label, children, unit }: { label: string; children: React.ReactNode; unit?: string }) {
  return (
    <label className="grid grid-cols-[104px_1fr] items-center gap-2 text-[12.5px]">
      <span className="truncate text-ink-2">{label}</span>
      <span className="flex items-center gap-1.5">
        {children}
        {unit && <span className="w-4 shrink-0 text-[11px] text-muted">{unit}</span>}
      </span>
    </label>
  );
}

const inputCls = "w-full min-w-0 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12.5px] outline-none focus:border-ink";

function NumberInput({ value, onChange, min, max, step }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      type="number"
      className={`${inputCls} tabular-nums`}
      value={draft ?? String(Math.round(value * 1000) / 1000)}
      min={min}
      max={max}
      step={step ?? 0.1}
      onChange={(e) => {
        setDraft(e.target.value);
        const v = parseFloat(e.target.value);
        if (!Number.isNaN(v)) onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v)));
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

function ParamInput({ def, value, onChange }: { def: ParamDef; value: number | string | boolean | undefined; onChange: (v: number | string | boolean) => void }) {
  if (def.kind === "number") return <NumberInput value={typeof value === "number" ? value : 0} onChange={onChange} min={def.min} max={def.max} step={def.step} />;
  if (def.kind === "bool")
    return (
      <button type="button" onClick={() => onChange(!value)} className={`relative h-5 w-9 rounded-full transition-colors ${value ? "bg-accent" : "bg-line-strong"}`}>
        <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${value ? "left-[18px]" : "left-0.5"}`} />
      </button>
    );
  if (def.kind === "select")
    return (
      <select className={inputCls} value={String(value ?? def.options?.[0])} onChange={(e) => onChange(e.target.value)}>
        {def.options?.map((o) => (
          <option key={o} value={o}>
            {o.replace(/_/g, " ")}
          </option>
        ))}
      </select>
    );
  if (def.key === "color")
    return (
      <span className="flex w-full items-center gap-2">
        <input type="color" value={String(value ?? "#1f4fd8")} onChange={(e) => onChange(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-line" />
        <span className="text-[11.5px] text-muted">{String(value)}</span>
      </span>
    );
  return <input className={inputCls} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
}

function Section({ title, children, right, defaultOpen = true }: { title: string; children: React.ReactNode; right?: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-line">
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-muted hover:text-ink">
          <ChevronDown size={13} className={`transition-transform ${open ? "" : "-rotate-90"}`} />
          {title}
        </button>
        {right}
      </div>
      {open && <div className="px-4 pb-4">{children}</div>}
    </section>
  );
}

/* ---------------- left: library + layers ---------------- */

export function LibraryPanel() {
  const plan = useEditor((s) => s.plan);
  const selectedId = useEditor((s) => s.selectedId);
  const { addPart, select } = useEditor.getState();
  const [q, setQ] = useState("");
  const list = PARTS.filter((p) => !q || `${p.label} ${p.hint}`.toLowerCase().includes(q.toLowerCase()));
  if (!plan) return null;
  return (
    <>
      <Section title="Parts library" right={<span className="text-[11px] text-muted">{PARTS.length} parts</span>}>
        <div className="relative mb-3">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search parts" className={`${inputCls} pl-7`} />
        </div>
        <div className="space-y-3">
          {GROUPS.map((g) => {
            const items = list.filter((p) => p.group === g);
            if (!items.length) return null;
            return (
              <div key={g}>
                <div className="mb-1.5 text-[11px] text-muted">{g}</div>
                <div className="grid grid-cols-1 gap-1">
                  {items.map((p) => (
                    <button
                      key={p.type}
                      title={p.hint}
                      onClick={() => addPart(p.type, { x: 0, y: -plan.size[1] / 4 })}
                      className="group flex items-center justify-between rounded-lg px-2 py-1.5 text-left text-[12.5px] hover:bg-sunken"
                    >
                      <span className="truncate">{p.label}</span>
                      <Plus size={13} className="shrink-0 text-muted opacity-0 group-hover:opacity-100" />
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Section>
      <Section title="Layers" right={<span className="text-[11px] text-muted">{plan.parts.length}</span>}>
        <ul className="space-y-0.5">
          {plan.parts.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => select(p.id)}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] ${p.id === selectedId ? "bg-ink text-white" : "hover:bg-sunken"}`}
              >
                <span className="truncate">{p.name}</span>
                <span className={`shrink-0 text-[10.5px] ${p.id === selectedId ? "text-white/60" : "text-muted"}`}>{PART_MAP[p.type]?.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

/* ---------------- right: properties ---------------- */

function ColourRow({ label, value, onChange }: { label: string; value: Rgb; onChange: (c: Rgb) => void }) {
  return (
    <Field label={label}>
      <input type="color" value={rgbToHex(value)} onChange={(e) => onChange(hexToRgb(e.target.value))} className="h-8 w-10 cursor-pointer rounded border border-line" />
    </Field>
  );
}

export function PropertiesPanel() {
  const plan = useEditor((s) => s.plan);
  const selectedId = useEditor((s) => s.selectedId);
  const { updatePart, updatePlan, removePart, duplicatePart } = useEditor.getState();
  if (!plan) return null;
  const part = plan.parts.find((p) => p.id === selectedId);

  if (!part)
    return (
      <Section title="Booth settings">
        <div className="space-y-2.5">
          <Field label="Title">
            <input className={inputCls} value={plan.title} onChange={(e) => updatePlan({ title: e.target.value }, "title")} />
          </Field>
          <Field label="Width" unit="m">
            <NumberInput value={plan.size[0]} min={2} max={40} step={0.5} onChange={(v) => updatePlan({ size: [v, plan.size[1]] }, "w")} />
          </Field>
          <Field label="Depth" unit="m">
            <NumberInput value={plan.size[1]} min={2} max={40} step={0.5} onChange={(v) => updatePlan({ size: [plan.size[0], v] }, "d")} />
          </Field>
          <Field label="Height limit" unit="m">
            <NumberInput value={plan.heightLimit} min={2.5} max={12} step={0.5} onChange={(v) => updatePlan({ heightLimit: v }, "hl")} />
          </Field>
          <Field label="Open sides">
            <span className="flex flex-wrap gap-1">
              {(["front", "back", "left", "right"] as const).map((sd) => {
                const on = plan.openSides.includes(sd);
                return (
                  <button
                    key={sd}
                    onClick={() => updatePlan({ openSides: on ? plan.openSides.filter((x) => x !== sd) : [...plan.openSides, sd] })}
                    className={`rounded-full px-2 py-0.5 text-[11px] ${on ? "bg-ink text-white" : "border border-line text-muted"}`}
                  >
                    {sd}
                  </button>
                );
              })}
            </span>
          </Field>
          <Field label="Floor finish">
            <select className={inputCls} value={plan.platform.finish} onChange={(e) => updatePlan({ platform: { ...plan.platform, finish: e.target.value as "white" | "wood" } })}>
              <option value="white">white</option>
              <option value="wood">wood</option>
            </select>
          </Field>
          <Field label="Edge light">
            <ParamInput def={{ key: "e", label: "", kind: "bool" }} value={plan.platform.edgeLight} onChange={(v) => updatePlan({ platform: { ...plan.platform, edgeLight: !!v } })} />
          </Field>
          <div className="pt-2 text-[11px] uppercase tracking-[0.14em] text-muted">Brand colours</div>
          {plan.palette.led.map((c, i) => (
            <ColourRow key={i} label={`LED colour ${i + 1}`} value={c} onChange={(nc) => updatePlan({ palette: { ...plan.palette, led: plan.palette.led.map((x, j) => (j === i ? nc : x)) } }, `led${i}`)} />
          ))}
          <ColourRow label="Glow accent" value={plan.palette.glow} onChange={(nc) => updatePlan({ palette: { ...plan.palette, glow: nc } }, "glow")} />
          <ColourRow label="Edge light" value={plan.platform.accent} onChange={(nc) => updatePlan({ platform: { ...plan.platform, accent: nc } }, "accent")} />
          <p className="pt-1 text-[11.5px] leading-relaxed text-muted">Select a part in the 3D view or the layers list to edit it.</p>
        </div>
      </Section>
    );

  const def = PART_MAP[part.type];
  const visible = def.params.filter((pd) => {
    if (["r0", "r1"].includes(pd.key)) return part.p.kind === "spiral";
    if (pd.key === "r") return part.p.kind !== "spiral";
    return true;
  });
  return (
    <Section
      title={def.label}
      right={
        <span className="flex gap-1">
          <button title="Duplicate (D)" onClick={() => duplicatePart(part.id)} className="grid size-7 place-items-center rounded-lg text-muted hover:bg-sunken hover:text-ink">
            <Copy size={14} />
          </button>
          <button title="Delete (Del)" onClick={() => removePart(part.id)} className="grid size-7 place-items-center rounded-lg text-muted hover:bg-bad-soft hover:text-bad">
            <Trash2 size={14} />
          </button>
        </span>
      }
    >
      <div className="space-y-2.5">
        <Field label="Name">
          <input className={inputCls} value={part.name} onChange={(e) => updatePart(part.id, { name: e.target.value }, `${part.id}.name`)} />
        </Field>
        <Field label="Position X" unit="m">
          <NumberInput value={part.x} step={0.1} onChange={(v) => updatePart(part.id, { x: v }, `${part.id}.x`)} />
        </Field>
        <Field label="Position Y" unit="m">
          <NumberInput value={part.y} step={0.1} onChange={(v) => updatePart(part.id, { y: v }, `${part.id}.y`)} />
        </Field>
        <Field label="Rotation" unit="°">
          <NumberInput value={part.rot} step={15} onChange={(v) => updatePart(part.id, { rot: v }, `${part.id}.rot`)} />
        </Field>
        {visible.length > 0 && <div className="border-t border-line pt-2.5" />}
        {visible.map((pd) => (
          <Field key={pd.key} label={pd.label} unit={pd.unit}>
            <ParamInput def={pd} value={part.p[pd.key]} onChange={(v) => updatePart(part.id, { p: { [pd.key]: v } }, `${part.id}.${pd.key}`)} />
          </Field>
        ))}
        <p className="pt-1 text-[11.5px] leading-relaxed text-muted">{def.hint}. Drag the arrows in the 3D view to move; press R to rotate.</p>
      </div>
    </Section>
  );
}

/* ---------------- right: costing + versions ---------------- */

export function CostPanel({ baseline }: { baseline: number | null }) {
  const plan = useEditor((s) => s.plan);
  const selectedId = useEditor((s) => s.selectedId);
  const c = useMemo(() => (plan ? price(plan) : null), [plan]);
  if (!plan || !c) return null;
  const delta = baseline != null ? c.total - baseline : null;
  const partCost = selectedId ? c.rows.filter((r) => r.partId === selectedId).reduce((a, r) => a + r.amount, 0) : null;
  const max = Math.max(...c.byCategory.map((x) => x.amount), 1);
  return (
    <Section
      title="Live costing"
      right={
        <button onClick={() => download(costingCsv(c), `${plan.name}_costing.csv`, "text/csv")} className="flex items-center gap-1 text-[11.5px] text-muted hover:text-ink">
          <Download size={12} /> CSV
        </button>
      }
    >
      <div className="num text-[30px] font-light leading-none">{lakh(c.total)}</div>
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px] text-muted">
        incl. 18% GST
        {delta != null && Math.abs(delta) >= 1 && (
          <span className={`chip !py-0 text-[11px] ${delta > 0 ? "bg-bad-soft text-bad" : "bg-good-soft text-good"}`}>
            {delta > 0 ? "+" : "−"}
            {lakh(Math.abs(delta))} vs last version
          </span>
        )}
      </div>
      {partCost != null && partCost > 0 && (
        <div className="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-[12px] text-ink-2">
          Selected part: <span className="num text-ink">{inr(partCost)}</span> before fees and GST
        </div>
      )}
      <ul className="mt-4 space-y-2">
        {c.byCategory.map((x) => (
          <li key={x.category}>
            <div className="flex justify-between text-[12px]">
              <span className="text-ink-2">{x.category}</span>
              <span className="num">{lakh(x.amount)}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-sunken">
              <div className="h-1.5 rounded-full bg-ink" style={{ width: `${(x.amount / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <dl className="mt-4 space-y-1 border-t border-line pt-3 text-[12px]">
        {[
          ["Subtotal", c.subtotal],
          [`Install & dismantle ${c.pct.install}%`, c.install],
          [`Management fee ${c.pct.fee}%`, c.fee],
          [`GST ${c.pct.gst}%`, c.gst],
        ].map(([l, v]) => (
          <div key={l as string} className="flex justify-between">
            <dt className="text-muted">{l}</dt>
            <dd className="tabular-nums">{inr(v as number)}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

export function VersionsPanel({ versions, onSave, onRestore, saving }: { versions: Version[]; onSave: (label: string) => void; onRestore: (v: Version) => void; saving: boolean }) {
  const [label, setLabel] = useState("");
  return (
    <Section title="Versions" right={<History size={13} className="text-muted" />} defaultOpen={false}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(label);
          setLabel("");
        }}
        className="mb-3 flex gap-2"
      >
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={`Version ${(versions.at(-1)?.n ?? 0) + 1}`} className={inputCls} />
        <button disabled={saving} className="btn btn-dark shrink-0 !px-3 !py-1.5 text-[12px] disabled:opacity-60">
          Save
        </button>
      </form>
      <ul className="space-y-1.5">
        {[...versions].reverse().map((v) => (
          <li key={v.n} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2">
            <div className="min-w-0">
              <div className="truncate text-[12.5px] font-medium">
                v{v.n} · {v.label}
              </div>
              <div className="text-[11px] text-muted">
                {lakh(v.total)} · {new Date(v.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
            <button title="Restore this version" onClick={() => onRestore(v)} className="grid size-7 shrink-0 place-items-center rounded-lg text-muted hover:bg-sunken hover:text-ink">
              <RotateCcw size={13} />
            </button>
          </li>
        ))}
        {!versions.length && <li className="text-[12px] text-muted">No saved versions yet.</li>}
      </ul>
    </Section>
  );
}

export function usePlanTotal(plan: Plan | null) {
  return useMemo(() => (plan ? price(plan).total : 0), [plan]);
}
