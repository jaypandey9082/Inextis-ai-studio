// Claude designs and edits booths using only parts from the Inextis library.
// Output is structured (Zod schema), then checked by the validator; errors get one repair round.

import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { price } from "./costing";
import { PART_MAP, PARTS } from "./registry";
import { defaultViews, emptyPlan, hexToRgb, newId, type Part, type Plan } from "./schema";
import { applyOpsTo, type Op } from "./store-ops";
import { validate, type Issue } from "./validate";

const MODEL = "claude-opus-5-5";
let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

export type Usage = { inputTokens: number; outputTokens: number; usd: number; inr: number; seconds: number };
const USD_TO_INR = 84; // approximate, for display only

function usageOf(u: { input_tokens: number; output_tokens: number }, started: number, prev?: Usage): Usage {
  const inputTokens = u.input_tokens + (prev?.inputTokens ?? 0);
  const outputTokens = u.output_tokens + (prev?.outputTokens ?? 0);
  const usd = (inputTokens * 4 + outputTokens * 20) / 1e6;
  return { inputTokens, outputTokens, usd, inr: usd * USD_TO_INR, seconds: (Date.now() - started) / 1000 + (prev?.seconds ?? 0) };
}

/* ---------------- prompt pieces ---------------- */

function catalog() {
  return PARTS.map((d) => {
    const params = d.params
      .map((p) => {
        const dflt = d.defaults[p.key];
        if (p.kind === "number") return `${p.key} (${p.label}${p.unit ? `, ${p.unit}` : ""}, ${p.min}–${p.max}${dflt !== undefined ? `, default ${dflt}` : ""})`;
        if (p.kind === "select") return `${p.key} (${p.label}: ${p.options?.join(" | ")})`;
        if (p.kind === "bool") return `${p.key} (${p.label}: true | false)`;
        return `${p.key} (${p.label}: text)`;
      })
      .join("; ");
    const e = d.extent(d.defaults);
    const size = `Floor footprint at defaults ≈ ${e.w.toFixed(1)} × ${e.d.toFixed(1)} m (width × depth at rot 0), top ≈ ${e.h.toFixed(1)} m`;
    return `- ${d.type}: ${d.label}. ${d.hint}. ${size}.${params ? ` Params: ${params}.` : " No params."}`;
  }).join("\n");
}

const RULES = `COORDINATES (metres, degrees): origin at the booth centre. x runs left (-) to right (+); y runs front (-) to back (+); the FRONT edge is y = -depth/2 and the BACK edge is y = +depth/2. Each part's x, y is its centre on the floor; rot turns it around the vertical axis (0 = facing the front). Heights (z, z0, z1) are measured from the hall floor and already include the 0.1 m platform. Flat parts (walls, LED screens, TVs, graphics) face the front at rot 0; to face left use rot 90, right use -90, back use 180.
Curved parts (led_ribbon, white_band, floor_arc) are drawn around their x, y centre: angle 0 points right (+x), 90 points back (+y), 270 points front. A full ring is a0 0, a1 360.

DESIGN RULES (Indian exhibition stands):
- Keep everything inside the footprint and under the height limit. Keep open sides inviting: no long walls along an open side; put walls, storage and tall structures along closed sides or at the back.
- Reception counter near the main front entry. Give visitors clear walkways (at least 1.2 m) and at least 0.9 m between furniture.
- Include a lockable storage room on stands over about 30 m²: a block (e.g. 2.5 × 2 m) plus a door part on its front face.
- Use one strong focal element (LED ring, tower with LED, or story wall). LED screens snap to 0.5 m cabinet sizes.
- Match the brief's zones (demo, lounge, meeting, presentation) and scale furniture to the area. Use brand lettering for the brand name on a tower, fascia or LED. Add plants where the brief is green.
- Add a roof only where the brief asks for a covered lounge, meeting or VIP area, never over the whole stand; keep its underside at least 2.7 m high and its top under the height limit.
- Prefer fewer, well-placed parts over clutter: typically 15–40 parts.`;

let exampleCache: string | null = null;
function example() {
  if (exampleCache) return exampleCache;
  const t = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/templates/nova_tech_pavilion.json"), "utf8")) as Plan;
  const compact = t.parts.map((p) => ({ type: p.type, name: p.name, x: p.x, y: p.y, rot: p.rot, params: Object.entries(p.p).map(([key, value]) => ({ key, value: String(value) })) }));
  exampleCache = `EXAMPLE of a good plan for a 14 x 12 m island, four sides open, height limit 6 m:\n${JSON.stringify(compact)}`;
  return exampleCache;
}

/* ---------------- schemas ---------------- */

const TYPES = PARTS.map((p) => p.type) as [string, ...string[]];
const Param = z.object({ key: z.string(), value: z.string() });
const AiPart = z.object({ type: z.enum(TYPES), name: z.string(), x: z.number(), y: z.number(), rot: z.number(), params: z.array(Param) });
const AiDesign = z.object({
  concept: z.string().describe("Two sentences: the big idea and how the zones work"),
  zones: z.array(z.object({ name: z.string(), purpose: z.string(), x: z.number(), y: z.number(), w: z.number(), d: z.number() })).describe("Plan the zones first"),
  palette: z.object({ led: z.array(z.string()).describe("3 hex colours for LED content"), glow: z.string().describe("hex accent glow"), screen: z.array(z.string()).describe("3 hex colours: dark, mid, light") }),
  platformFinish: z.enum(["white", "wood"]),
  parts: z.array(AiPart),
});
const AiOp = z.object({
  op: z.enum(["add", "update", "remove"]),
  id: z.string().describe("Existing part id for update/remove; empty string for add"),
  type: z.string().describe("Part type for add; empty string otherwise"),
  name: z.string().describe("Name for add, or new name for update; empty string to keep"),
  x: z.number().nullable(),
  y: z.number().nullable(),
  rot: z.number().nullable(),
  params: z.array(Param).describe("Only the params to set"),
});
const AiEdit = z.object({ summary: z.string().describe("One short sentence describing the change, in plain English"), ops: z.array(AiOp) });

/* ---------------- conversion ---------------- */

function toParams(type: string, params: { key: string; value: string }[]): Part["p"] {
  const def = PART_MAP[type];
  const out: Part["p"] = {};
  for (const { key, value } of params) {
    const pd = def?.params.find((x) => x.key === key);
    if (pd?.kind === "number" || (!pd && !Number.isNaN(Number(value)) && value.trim() !== "")) {
      const v = Number(value);
      if (!Number.isNaN(v)) out[key] = pd ? Math.min(pd.max ?? Infinity, Math.max(pd.min ?? -Infinity, v)) : v;
    } else if (pd?.kind === "bool" || value === "true" || value === "false") out[key] = value === "true";
    else out[key] = value;
  }
  return out;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

function toOps(edit: z.infer<typeof AiEdit>, plan: Plan): Op[] {
  const ids = new Set(plan.parts.map((p) => p.id));
  const ops: Op[] = [];
  for (const o of edit.ops) {
    if (o.op === "add" && PART_MAP[o.type]) {
      ops.push({ op: "add", part: { id: newId(o.type), type: o.type, name: o.name || PART_MAP[o.type].label, x: r2(o.x ?? 0), y: r2(o.y ?? 0), rot: o.rot ?? 0, p: { ...PART_MAP[o.type].defaults, ...toParams(o.type, o.params) } } });
    } else if (o.op === "update" && ids.has(o.id)) {
      const type = plan.parts.find((p) => p.id === o.id)!.type;
      const set: Extract<Op, { op: "update" }>["set"] = {};
      if (o.name) set.name = o.name;
      if (o.x != null) set.x = r2(o.x);
      if (o.y != null) set.y = r2(o.y);
      if (o.rot != null) set.rot = o.rot;
      if (o.params.length) set.p = toParams(type, o.params);
      ops.push({ op: "update", id: o.id, set });
    } else if (o.op === "remove" && ids.has(o.id)) ops.push({ op: "remove", id: o.id });
  }
  return ops;
}

const compactPlan = (plan: Plan) =>
  JSON.stringify({
    size: plan.size,
    openSides: plan.openSides,
    heightLimit: plan.heightLimit,
    platformHeight: plan.platform.height,
    parts: plan.parts.map((p) => ({ id: p.id, type: p.type, name: p.name, x: p.x, y: p.y, rot: p.rot, params: p.p })),
  });

const checksText = (plan: Plan) => {
  const issues = validate(plan);
  return issues.length ? `Current layout checks:\n${issues.map((i) => `- ${i.level}: ${i.message}${i.partId ? ` (part id ${i.partId})` : ""}`).join("\n")}\n` : "";
};

/* ---------------- calls ---------------- */

export type DesignInput = {
  client: string;
  title: string;
  brief: string;
  w: number;
  d: number;
  openSides: Plan["openSides"];
  heightLimit: number;
  brandColours: string[];
  images: { mediaType: "image/jpeg" | "image/png" | "image/webp"; data: string }[];
};

async function callEdit(plan: Plan, instruction: string, started: number, prev?: Usage) {
  const res = await getClient().messages.parse({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: "medium", format: zodOutputFormat(AiEdit) },
    system: `You edit exhibition booth plans for Inextis Events using ONLY these library parts:\n${catalog()}\n\n${RULES}\n\nReturn the smallest set of operations that does what is asked. Use existing part ids for update/remove. For update, include only the params that change. Keep every part inside the booth and under the height limit.`,
    messages: [{ role: "user", content: `Current booth plan:\n${compactPlan(plan)}\n${checksText(plan)}\nChange requested: ${instruction}` }],
  });
  if (res.stop_reason === "refusal" || !res.parsed_output) throw new Error("The AI could not make that change.");
  return { edit: res.parsed_output, usage: usageOf(res.usage, started, prev) };
}

export async function designBooth(input: DesignInput) {
  const started = Date.now();
  const content: Anthropic.ContentBlockParam[] = [
    ...input.images.map((im) => ({ type: "image" as const, source: { type: "base64" as const, media_type: im.mediaType, data: im.data } })),
    {
      type: "text",
      text: `Design an exhibition booth.
Client: ${input.client || "(not given)"}
Booth: ${input.w} m wide × ${input.d} m deep. Open sides: ${input.openSides.join(", ")}. Height limit: ${input.heightLimit} m.
${input.brandColours.length ? `Brand colours: ${input.brandColours.join(", ")}.` : ""}
${input.images.length ? "Reference images are attached: take the mood, materials and key elements from them, adapted to this footprint." : ""}
Brief: ${input.brief}`,
    },
  ];
  const res = await getClient().messages.parse({
    model: MODEL,
    max_tokens: 20000,
    output_config: { effort: "medium", format: zodOutputFormat(AiDesign) },
    system: `You are a senior exhibition stand designer at Inextis Events, an Indian events agency that builds booths for brands like HPCL, EIL and Nayara. You design booths using ONLY these library parts:\n${catalog()}\n\n${RULES}\n\n${example()}\n\nPlan the zones first, then place parts into them. Put brand names in params as text values. Return numbers as plain numbers in the value strings.`,
    messages: [{ role: "user", content }],
  });
  if (res.stop_reason === "refusal" || !res.parsed_output) throw new Error("The AI could not design this booth.");
  const design = res.parsed_output;
  let usage = usageOf(res.usage, started);

  const plan = emptyPlan({ name: "booth", title: input.title || `${input.client || "New"} booth`, brief: input.brief, w: input.w, d: input.d, openSides: input.openSides, heightLimit: input.heightLimit });
  const hex = (h: string) => /^#?[0-9a-f]{6}$/i.test(h.trim()) ? hexToRgb(h.trim().startsWith("#") ? h.trim() : `#${h.trim()}`) : null;
  const led = design.palette.led.map(hex).filter(Boolean) as Plan["palette"]["led"];
  const screen = design.palette.screen.map(hex).filter(Boolean) as Plan["palette"]["screen"];
  if (led.length >= 2) plan.palette.led = led.slice(0, 3);
  if (screen.length >= 2) plan.palette.screen = screen.slice(0, 3);
  plan.palette.glow = hex(design.palette.glow) ?? plan.palette.glow;
  plan.platform.finish = design.platformFinish;
  plan.platform.accent = plan.palette.glow;
  plan.views = defaultViews(input.w, input.d);
  plan.parts = design.parts
    .filter((p) => PART_MAP[p.type])
    .map((p) => ({ id: newId(p.type), type: p.type, name: p.name || PART_MAP[p.type].label, x: r2(p.x), y: r2(p.y), rot: p.rot, p: { ...PART_MAP[p.type].defaults, ...toParams(p.type, p.params) } }));

  // One repair round for hard errors
  let final = plan;
  let issues = validate(final);
  const errors = issues.filter((i) => i.level === "error");
  if (errors.length) {
    const { edit, usage: u2 } = await callEdit(final, `Fix these problems without changing the design idea:\n${errors.map((e) => `- ${e.message}${e.partId ? ` (part id ${e.partId})` : ""}`).join("\n")}`, Date.now(), usage);
    usage = u2;
    final = applyOpsTo(final, toOps(edit, final));
    issues = validate(final);
  }
  console.log(`[ai] designed "${final.title}": ${final.parts.length} parts, ${issues.length} issues, ${usage.inputTokens} in / ${usage.outputTokens} out tokens, ~$${usage.usd.toFixed(3)}, ${usage.seconds.toFixed(0)} s`);
  return { plan: final, concept: design.concept, zones: design.zones, issues, usage, total: price(final).total };
}

export async function editBooth(plan: Plan, instruction: string, selectedId?: string | null) {
  const started = Date.now();
  const sel = selectedId ? plan.parts.find((p) => p.id === selectedId) : null;
  const first = await callEdit(plan, sel ? `${instruction}\n(The user has "${sel.name}" (id ${sel.id}) selected; "this" or "it" means that part.)` : instruction, started);
  let usage = first.usage;
  let ops = toOps(first.edit, plan);

  // If the change created new layout errors, give it one repair round that keeps the request
  const errKey = (i: Issue) => `${i.partId}|${i.message}`;
  const before = new Set(validate(plan).filter((i) => i.level === "error").map(errKey));
  const edited = applyOpsTo(plan, ops);
  const added = validate(edited).filter((i) => i.level === "error" && !before.has(errKey(i)));
  if (added.length) {
    const fix = await callEdit(
      edited,
      `The previous change ("${instruction}") caused these problems. Fix them while keeping what was asked:\n${added.map((e) => `- ${e.message}${e.partId ? ` (part id ${e.partId})` : ""}`).join("\n")}`,
      Date.now(),
      usage,
    );
    usage = fix.usage;
    ops = [...ops, ...toOps(fix.edit, edited)];
  }
  console.log(`[ai] edit "${instruction.slice(0, 60)}": ${ops.length} ops${added.length ? ` (repaired ${added.length})` : ""}, ~$${usage.usd.toFixed(3)}, ${usage.seconds.toFixed(0)} s`);
  return { summary: first.edit.summary, ops, usage };
}

export type { Issue };
