// Layout checks for a booth plan. Errors must be fixed (outside the booth, too tall);
// warnings are shown to the designer (overlaps, blocked open sides, LED sizes, tight gaps).

import { PART_MAP } from "./registry";
import { resolvePath } from "./paths";
import type { Part, Plan } from "./schema";

export type Issue = { level: "error" | "warning"; partId?: string; message: string };
type Rect = { x0: number; x1: number; y0: number; y1: number };

// Parts that stand on the floor and take up walking space
const FLOOR = new Set(["block", "wall", "curved_wall", "column", "meeting_room", "totem", "touch_table", "counter", "lounge", "sofa", "seating_rows", "high_table", "plant", "plant_row", "slat_wall", "bamboo_panel"]);
const WALL_LIKE = new Set(["wall", "block", "slat_wall", "bamboo_panel", "curved_wall"]);
const VISITOR = new Set(["counter", "totem", "touch_table", "lounge", "high_table", "seating_rows", "sofa"]);

const PATHS = new Set(["led_ribbon", "white_band", "floor_arc"]);

export function footprint(part: Part): Rect | null {
  const def = PART_MAP[part.type];
  if (!def) return null;
  if (PATHS.has(part.type)) {
    // exact bounds of the curve (a quarter spiral doesn't fill a whole circle)
    const a = (part.rot * Math.PI) / 180;
    const pts = resolvePath(part.p).points.map(([x, y]) => [part.x + x * Math.cos(a) - y * Math.sin(a), part.y + x * Math.sin(a) + y * Math.cos(a)]);
    const t = 0.08;
    return { x0: Math.min(...pts.map((q) => q[0])) - t, x1: Math.max(...pts.map((q) => q[0])) + t, y0: Math.min(...pts.map((q) => q[1])) - t, y1: Math.max(...pts.map((q) => q[1])) + t };
  }
  const { w, d } = def.extent(part.p);
  const a = (part.rot * Math.PI) / 180;
  const c = Math.abs(Math.cos(a));
  const s = Math.abs(Math.sin(a));
  const hw = (w * c + d * s) / 2;
  const hd = (w * s + d * c) / 2;
  return { x0: part.x - hw, x1: part.x + hw, y0: part.y - hd, y1: part.y + hd };
}

const overlapArea = (a: Rect, b: Rect) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
const gap = (a: Rect, b: Rect) => Math.max(Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1), Math.max(a.y0, b.y0) - Math.min(a.y1, b.y1));

export function validate(plan: Plan): Issue[] {
  const issues: Issue[] = [];
  const [W, D] = plan.size;
  const tol = 0.15;
  const rects = new Map<string, Rect>();

  for (const part of plan.parts) {
    const def = PART_MAP[part.type];
    if (!def) {
      issues.push({ level: "error", partId: part.id, message: `${part.name}: unknown part type "${part.type}"` });
      continue;
    }
    const r = footprint(part)!;
    rects.set(part.id, r);
    if (r.x0 < -W / 2 - tol || r.x1 > W / 2 + tol || r.y0 < -D / 2 - tol || r.y1 > D / 2 + tol)
      issues.push({ level: "error", partId: part.id, message: `${part.name} goes outside the ${W} × ${D} m booth` });
    const h = def.extent(part.p).h;
    if (h > plan.heightLimit + 0.01) issues.push({ level: "error", partId: part.id, message: `${part.name} is ${h.toFixed(2)} m tall; the limit is ${plan.heightLimit} m` });
    if (part.type === "led_panel") {
      const w = Number(part.p.w);
      const hh = Number(part.p.h);
      if (Math.abs(w * 2 - Math.round(w * 2)) > 0.01 || Math.abs(hh * 2 - Math.round(hh * 2)) > 0.01)
        issues.push({ level: "warning", partId: part.id, message: `${part.name}: LED size ${w} × ${hh} m isn't a multiple of 0.5 m cabinets` });
    }
  }

  // Overlaps and tight gaps between floor-standing parts
  const floor = plan.parts.filter((p) => FLOOR.has(p.type) && rects.has(p.id));
  for (let i = 0; i < floor.length; i++)
    for (let j = i + 1; j < floor.length; j++) {
      const a = floor[i];
      const b = floor[j];
      const ra = rects.get(a.id)!;
      const rb = rects.get(b.id)!;
      const ov = overlapArea(ra, rb);
      if (ov > 0.3 && !(WALL_LIKE.has(a.type) && WALL_LIKE.has(b.type))) issues.push({ level: "warning", partId: b.id, message: `${a.name} and ${b.name} overlap` });
      else if (ov === 0 && VISITOR.has(a.type) && VISITOR.has(b.type)) {
        const g = gap(ra, rb);
        if (g > 0 && g < 0.6) issues.push({ level: "warning", partId: b.id, message: `Only ${g.toFixed(1)} m between ${a.name} and ${b.name}; keep at least 0.9 m to walk through` });
      }
    }

  // Long walls along an open side block visitors
  const edges = { front: (r: Rect) => r.y0 < -D / 2 + 0.8, back: (r: Rect) => r.y1 > D / 2 - 0.8, left: (r: Rect) => r.x0 < -W / 2 + 0.8, right: (r: Rect) => r.x1 > W / 2 - 0.8 } as const;
  for (const side of plan.openSides) {
    const along = side === "front" || side === "back" ? W : D;
    for (const part of plan.parts.filter((p) => WALL_LIKE.has(p.type))) {
      const r = rects.get(part.id);
      if (!r || !edges[side](r)) continue;
      const len = side === "front" || side === "back" ? r.x1 - r.x0 : r.y1 - r.y0;
      if (len > along * 0.45) issues.push({ level: "warning", partId: part.id, message: `${part.name} closes off ${Math.round((len / along) * 100)}% of the open ${side} side` });
    }
  }
  return issues;
}
