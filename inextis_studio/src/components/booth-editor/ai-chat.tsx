"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowUp, CheckCircle2, LoaderCircle, Sparkles, Undo2, X } from "lucide-react";
import { price } from "@/lib/booth/costing";
import { useEditor } from "@/lib/booth/store";
import { validate } from "@/lib/booth/validate";
import { lakh } from "./panels";

const suggestions = ["Make the LED ring bigger", "Add a lounge for 6 at the back", "Move reception to the front left corner", "Add plants along the open sides"];

type Result = { summary: string; changes: number; delta: number; inr: number; seconds: number };

export function AiChat() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(instruction: string) {
    const { plan, selectedId, applyOps, projectId } = useEditor.getState();
    if (!plan || !instruction.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/booths/${projectId}/edit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan, instruction, selectedId }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't make that change");
      const before = price(plan).total;
      if (data.ops.length) applyOps(data.ops);
      const after = useEditor.getState().plan;
      setResult({ summary: data.summary, changes: data.ops.length, delta: after ? price(after).total - before : 0, inr: data.usage.inr, seconds: data.usage.seconds });
      setText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't make that change");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 flex flex-col items-center gap-2 px-3">
      {(result || error) && (
        <div className={`pointer-events-auto flex max-w-xl items-start gap-3 rounded-2xl px-4 py-3 text-[13px] shadow-lg ${error ? "bg-bad-soft text-bad" : "bg-surface text-ink"}`}>
          {error ? <AlertTriangle size={16} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-good" />}
          <div className="min-w-0">
            <div>{error ?? result?.summary}</div>
            {result && (
              <div className="mt-0.5 text-[11.5px] text-muted">
                {result.changes} {result.changes === 1 ? "change" : "changes"}
                {Math.abs(result.delta) >= 5000 ? ` · cost ${result.delta > 0 ? "+" : "−"}${lakh(Math.abs(result.delta))}` : ""} · {result.seconds.toFixed(0)} s · AI ₹{result.inr.toFixed(1)}
              </div>
            )}
          </div>
          {result && result.changes > 0 && (
            <button
              onClick={() => {
                useEditor.getState().undo();
                setResult(null);
              }}
              className="flex shrink-0 items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[12px] hover:border-ink"
            >
              <Undo2 size={12} /> Undo
            </button>
          )}
          <button onClick={() => (setResult(null), setError(null))} className="shrink-0 text-muted hover:text-ink">
            <X size={14} />
          </button>
        </div>
      )}
      {focused && !busy && !text && (
        <div className="pointer-events-auto flex flex-wrap justify-center gap-1.5">
          {suggestions.map((s) => (
            <button key={s} onMouseDown={(e) => e.preventDefault()} onClick={() => send(s)} className="chip bg-black/55 text-white/85 backdrop-blur hover:bg-black/75">
              {s}
            </button>
          ))}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
        className="pointer-events-auto flex w-full max-w-xl items-center gap-2 rounded-full border border-white/15 bg-black/60 py-1.5 pl-4 pr-1.5 shadow-xl backdrop-blur"
      >
        {busy ? <LoaderCircle size={16} className="shrink-0 animate-spin text-accent" /> : <Sparkles size={16} className="shrink-0 text-accent" />}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={busy}
          placeholder={busy ? "Claude is changing the booth…" : "Ask AI to change the booth, e.g. “make the LED ring bigger”"}
          className="min-w-0 flex-1 bg-transparent text-[13.5px] text-white placeholder:text-white/45 outline-none"
        />
        <button disabled={busy || !text.trim()} className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-white disabled:opacity-40">
          <ArrowUp size={15} />
        </button>
      </form>
    </div>
  );
}

export function IssuesButton() {
  const plan = useEditor((s) => s.plan);
  const select = useEditor((s) => s.select);
  const [open, setOpen] = useState(false);
  const issues = useMemo(() => (plan ? validate(plan) : []), [plan]);
  const errors = issues.filter((i) => i.level === "error").length;
  const warnings = issues.length - errors;
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] ${errors ? "bg-bad-soft text-bad" : warnings ? "bg-warn-soft text-warn" : "bg-good-soft text-good"}`}
      >
        {errors || warnings ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
        {errors ? `${errors} ${errors === 1 ? "problem" : "problems"}` : warnings ? `${warnings} ${warnings === 1 ? "check" : "checks"}` : "Layout OK"}
      </button>
      {open && issues.length > 0 && (
        <div className="absolute right-0 top-10 z-30 w-[340px] rounded-2xl border border-line bg-surface p-2 shadow-xl">
          <div className="px-2 pb-1.5 pt-1 text-[11px] uppercase tracking-[0.14em] text-muted">Layout checks</div>
          <ul className="scroll-thin max-h-80 overflow-y-auto">
            {issues.map((i, k) => (
              <li key={k}>
                <button
                  onClick={() => {
                    if (i.partId) select(i.partId);
                    setOpen(false);
                  }}
                  className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-[12.5px] hover:bg-sunken"
                >
                  <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${i.level === "error" ? "bg-bad" : "bg-warn"}`} />
                  {i.message}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
