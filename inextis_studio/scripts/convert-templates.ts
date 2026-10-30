// Converts the original Blender booth plans (booth_demo/plans) into the editor's plan
// format (data/templates), then checks the costing matches the original CSVs.
// Run: pnpm tsx scripts/convert-templates.ts
import fs from "node:fs";
import path from "node:path";
import { price } from "../src/lib/booth/costing";
import { PlanSchema, type Part, type Plan } from "../src/lib/booth/schema";

const root = path.resolve(import.meta.dirname, "..");
const src = path.resolve(root, "../booth_demo");
fs.copyFileSync(path.join(src, "rate_card.json"), path.join(root, "src/data/rate-card.json"));
const outDir = path.join(root, "data/templates");
fs.mkdirSync(outDir, { recursive: true });

type Old = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
let counter = 0;
const id = (t: string) => `${t}-${(++counter).toString(36).padStart(3, "0")}`;

function convertPart(o: Old): Part {
  const t = o.type as string;
  const base = (x: number, y: number, p: Part["p"], rot = o.rot ?? 0, name = o.name ?? t): Part => ({ id: id(t), type: t, name, x, y, rot, p });
  const mid = (a: number, b: number) => (a + b) / 2;
  const path = (pp: Old) => {
    const p: Part["p"] = { kind: pp.kind };
    for (const k of ["r", "a0", "a1", "z0", "z1", "r0", "r1"]) if (typeof pp[k] === "number") p[k] = pp[k];
    if (pp.z0 === undefined || pp.z0 === null) p.onFloor = true;
    return p;
  };
  switch (t) {
    case "block":
      return base(o.center[0], o.center[1], { w: o.size[0], d: o.size[1], h: o.size[2], finish: o.finish });
    case "wall":
      return base(o.x, o.y, { w: o.w, h: o.h, finish: o.finish === "laminate" ? "laminate" : "wood" });
    case "led_panel":
      return base(o.x, o.y, { w: o.w, h: o.h, z: o.z, content: o.content, frame: !!o.frame });
    case "led_ribbon":
    case "white_band":
      return base(o.path.cx, o.path.cy, { ...path(o.path), height: o.height });
    case "floor_arc":
      return base(o.path.cx, o.path.cy, { ...path(o.path), onFloor: true });
    case "column":
      return base(o.x, o.y, { h: o.h, white: o.white ?? true });
    case "slat_wall":
      return base(mid(o.x0, o.x1), o.y, { w: o.x1 - o.x0, h: o.h, backlit: !!o.backlit });
    case "text":
      return base(o.x, o.y, { body: o.body, size: o.size, z: o.z, style: o.mat }, o.rot ?? 0, o.body);
    case "counter":
      return base(o.x, o.y, { w: o.w ?? 2.4, label: o.label ?? "" });
    case "touch_table":
      return base(o.x, o.y, {});
    case "totem":
      // build.py passed the totem's rotation to Blender as radians
      return base(o.x, o.y, {}, ((o.rot ?? 0) * 180) / Math.PI);
    case "seating_rows":
      return base(o.x0 + ((o.cols - 1) * o.dx) / 2, o.y0 - ((o.rows - 1) * o.dy) / 2, { rows: o.rows, cols: o.cols, dx: o.dx, dy: o.dy });
    case "lounge":
      return base(o.x, o.y, { seats: o.seats ?? 4 });
    case "sofa":
      return base(o.x, o.y, { w: o.w ?? 1.8 });
    case "plant":
      return base(o.x, o.y, { size: o.size ?? 1, kind: o.kind ?? "bush" });
    case "plant_row":
      return base(mid(o.x0, o.x1), o.y, { w: o.x1 - o.x0, count: o.count, size: o.size });
    case "moss_panel":
      return base(o.x, o.y, { w: o.w, h: o.h, z: o.z });
    case "tv":
      return base(o.x, o.y, { w: o.w, h: o.h, z: o.z });
    case "beam":
      return base(mid(o.x0, o.x1), o.y, { w: o.x1 - o.x0, depth: o.depth, h: o.h, z: o.z });
    case "grass_strip":
      return base(mid(o.x0, o.x1), o.y, { w: o.x1 - o.x0, depth: o.depth, z: o.z });
    case "bamboo_panel":
      return base(mid(o.x0, o.x1), o.y, { w: o.x1 - o.x0, h: o.h });
    case "door":
      return base(o.x, o.y, { w: o.w, h: o.h });
    case "grass_patch":
      return base(o.x, o.y, { w: o.w, d: o.d });
    case "hanging_plants":
      return base(mid(o.x0, o.x1), o.y, { w: o.x1 - o.x0, count: o.count, z: o.z });
    case "roof_planters":
      return base(mid(o.x0, o.x1), mid(o.y0, o.y1), { w: o.x1 - o.x0, d: o.y1 - o.y0, nx: o.nx, ny: o.ny, z: o.z });
    default:
      throw new Error(`unknown part ${t}`);
  }
}

const expected: Record<string, number> = {};
for (const row of JSON.parse(fs.readFileSync(path.join(root, "src/data/booths.json"), "utf8"))) expected[row.file] = row.totals.Total;

for (const file of ["nova_tech_pavilion", "greenleaf_eco_pavilion"]) {
  const o: Old = JSON.parse(fs.readFileSync(path.join(src, "plans", `${file}.json`), "utf8"));
  counter = 0;
  const pf = o.platform;
  const plan: Plan = {
    version: 1,
    name: o.name,
    title: o.title,
    brief: o.brief,
    size: o.size,
    openSides: file.startsWith("nova") ? ["front", "back", "left", "right"] : ["front"],
    heightLimit: 6,
    platform: { height: pf.height ?? 0.1, finish: pf.finish, edgeLight: pf.edge_light ?? true, accent: pf.accent ?? [0.3, 0.6, 1.0] },
    palette: { led: o.palette.led ?? [[0.5, 0.2, 1], [0.1, 0.5, 1]], screen: o.palette.screen, glow: o.palette.glow ?? [0.3, 0.5, 1.0] },
    lighting: { topEnergy: o.lighting.top_energy, tint: o.lighting.tint, spots: o.lighting.spots },
    parts: o.parts.map(convertPart),
    views: o.views,
  };
  PlanSchema.parse(plan);
  fs.writeFileSync(path.join(outDir, `${file}.json`), JSON.stringify(plan, null, 2));
  const c = price(plan);
  const diff = Math.round(c.total - expected[file]);
  console.log(`${file}: ${plan.parts.length} parts, total ₹${Math.round(c.total).toLocaleString("en-IN")} vs CSV ₹${expected[file].toLocaleString("en-IN")} (diff ${diff}) ${Math.abs(diff) <= 1000 ? "OK" : "MISMATCH"}`);
}
