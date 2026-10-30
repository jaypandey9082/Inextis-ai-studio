// Prices a booth plan from the rate card, the same way booth_demo/build.py does.

import rateCard from "@/data/rate-card.json";
import { PART_MAP, type BoqLine } from "./registry";
import type { Plan } from "./schema";

export type CostRow = BoqLine & { rate: number; amount: number; partId?: string };
export type Costing = {
  rows: CostRow[];
  byCategory: { category: string; amount: number }[];
  subtotal: number;
  install: number;
  fee: number;
  preGst: number;
  gst: number;
  total: number;
  pct: { install: number; fee: number; gst: number };
};

type Rates = Record<string, number | string>;

export function boqLines(plan: Plan): (BoqLine & { partId?: string })[] {
  const [w, d] = plan.size;
  const pf = plan.platform;
  const lines: (BoqLine & { partId?: string })[] = [
    { category: "Flooring", item: `Raised platform ${w}x${d} m, ${pf.finish} finish`, qty: Math.round(w * d * 10.764 * 100) / 100, unit: "sq ft", rateKey: "platform_sqft" },
  ];
  if (pf.edgeLight) lines.push({ category: "Lighting", item: "LED edge strip around platform", qty: 2 * (w + d), unit: "rm", rateKey: "led_strip_rm" });
  for (const part of plan.parts) {
    const def = PART_MAP[part.type];
    if (!def) continue;
    for (const l of def.boq(part, plan)) lines.push({ ...l, partId: part.id });
  }
  for (let i = 0; i < plan.lighting.spots.length; i++) lines.push({ category: "Lighting", item: "Spot / profile light", qty: 1, unit: "nos", rateKey: "light_fixture" });
  return lines;
}

export function price(plan: Plan, rates: Rates = rateCard as Rates): Costing {
  const rows: CostRow[] = boqLines(plan).map((l) => {
    const rate = Number(rates[l.rateKey] ?? 0);
    return { ...l, rate, amount: l.qty * rate };
  });
  const subtotal = rows.reduce((a, r) => a + r.amount, 0);
  const pct = { install: Number(rates.install_dismantle_pct), fee: Number(rates.management_fee_pct), gst: Number(rates.gst_pct) };
  const install = (subtotal * pct.install) / 100;
  const fee = ((subtotal + install) * pct.fee) / 100;
  const preGst = subtotal + install + fee;
  const gst = (preGst * pct.gst) / 100;
  const cats = new Map<string, number>();
  for (const r of rows) cats.set(r.category, (cats.get(r.category) ?? 0) + r.amount);
  return {
    rows,
    byCategory: [...cats.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
    subtotal,
    install,
    fee,
    preGst,
    gst,
    total: preGst + gst,
    pct,
  };
}

export function costingCsv(c: Costing) {
  const esc = (v: string | number) => (typeof v === "string" && /[",]/.test(v) ? `"${v.replace(/"/g, '""')}"` : String(v));
  const lines = [["Category", "Item", "Qty", "Unit", "Rate (INR)", "Amount (INR)"].join(",")];
  for (const r of [...c.rows].sort((a, b) => a.category.localeCompare(b.category) || b.amount - a.amount)) lines.push([r.category, r.item, r.qty, r.unit, r.rate, Math.round(r.amount)].map(esc).join(","));
  lines.push("");
  for (const [label, v] of [
    ["Subtotal", c.subtotal],
    [`Install & dismantle ${c.pct.install}%`, c.install],
    [`Management fee ${c.pct.fee}%`, c.fee],
    ["Total before GST", c.preGst],
    [`GST ${c.pct.gst}%`, c.gst],
    ["Total", c.total],
  ] as const)
    lines.push(["", label, "", "", "", Math.round(v)].map(esc).join(","));
  return lines.join("\n");
}
