"use client";

import { ArrowUp, LoaderCircle } from "lucide-react";
import { useState } from "react";

const suggestions = ["Which expo should we focus on?", "Summarise this week's pipeline", "Which proposals need me?"];

export function AskBox() {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<{ text: string; live: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  async function ask(question: string) {
    if (!question.trim()) return;
    setQ(question);
    setLoading(true);
    setAnswer(null);
    try {
      const res = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) });
      const data = await res.json();
      setAnswer({ text: data.answer, live: data.live });
    } catch {
      setAnswer({ text: "Couldn't reach the assistant. Try again in a moment.", live: false });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
        }}
        className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] py-1.5 pl-5 pr-1.5 transition-colors focus-within:border-white/40"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask anything about the business…"
          className="min-w-0 flex-1 bg-transparent text-[14px] text-white placeholder:text-white/45 outline-none"
        />
        <button type="submit" disabled={loading} className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-white transition-colors hover:bg-accent-deep disabled:opacity-60" aria-label="Ask">
          {loading ? <LoaderCircle size={16} className="animate-spin" /> : <ArrowUp size={16} />}
        </button>
      </form>
      {!answer && !loading && (
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button key={s} onClick={() => ask(s)} className="chip border border-white/15 text-white/70 transition-colors hover:border-white/40 hover:text-white">
              {s}
            </button>
          ))}
        </div>
      )}
      {answer && (
        <div className="rise mt-4 rounded-2xl bg-white/[0.07] p-4 text-[13.5px] leading-relaxed text-white/90 whitespace-pre-line">
          {answer.text}
          <div className="mt-2 text-[11px] text-white/40">{answer.live ? "Answered by Claude" : "Prepared demo answer"}</div>
        </div>
      )}
    </div>
  );
}
