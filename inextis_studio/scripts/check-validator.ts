// Runs the validator on the templates and on deliberately broken plans.
// Run: pnpm tsx scripts/check-validator.ts
import fs from "node:fs";
import { validate } from "../src/lib/booth/validate";
import type { Plan } from "../src/lib/booth/schema";

const load = (f: string) => JSON.parse(fs.readFileSync(`data/templates/${f}.json`, "utf8")) as Plan;
for (const f of ["nova_tech_pavilion", "greenleaf_eco_pavilion"]) {
  const issues = validate(load(f));
  console.log(`${f}: ${issues.filter((i) => i.level === "error").length} errors, ${issues.filter((i) => i.level === "warning").length} warnings`);
  for (const i of issues) console.log(`   ${i.level}: ${i.message}`);
}
const base = load("nova_tech_pavilion");
const broken: Plan = {
  ...base,
  parts: [
    ...base.parts,
    { id: "t-out", type: "counter", name: "Counter outside", x: 9, y: 0, rot: 0, p: { w: 2.4, label: "X" } },
    { id: "t-tall", type: "block", name: "Too tall tower", x: 3, y: 3, rot: 0, p: { w: 1, d: 1, h: 7, finish: "laminate" } },
    { id: "t-ov1", type: "sofa", name: "Sofa A", x: -3, y: -4, rot: 0, p: { w: 1.8 } },
    { id: "t-ov2", type: "sofa", name: "Sofa B", x: -3, y: -4.2, rot: 0, p: { w: 1.8 } },
    { id: "t-wall", type: "wall", name: "Front wall", x: 0, y: -5.9, rot: 0, p: { w: 10, h: 3, finish: "laminate" } },
    { id: "t-led", type: "led_panel", name: "Odd LED", x: 0, y: 2, rot: 0, p: { w: 2.3, h: 1.7, z: 1.5, content: "screen", frame: false } },
  ],
};
const found = validate(broken).filter((i) => i.partId?.startsWith("t-"));
const want: Record<string, string> = { "t-out": "outside", "t-tall": "tall", "t-ov2": "overlap", "t-wall": "open front", "t-led": "cabinets" };
for (const [id, word] of Object.entries(want)) {
  const hit = found.find((i) => i.partId === id && i.message.includes(word));
  console.log(`${hit ? "CAUGHT" : "MISSED"} ${id}: ${hit?.message ?? "-"}`);
}
