// Plan edits as operations, shared by the editor (undo/redo) and the AI (server).

import { PART_MAP } from "./registry";
import { newId, type Part, type Plan } from "./schema";

export type Op =
  | { op: "add"; part: Omit<Part, "id"> & { id?: string } }
  | { op: "update"; id: string; set: Partial<Omit<Part, "p" | "id">> & { p?: Part["p"] } }
  | { op: "remove"; id: string };

export function applyOpsTo(plan: Plan, ops: Op[]): Plan {
  let parts = [...plan.parts];
  for (const o of ops) {
    if (o.op === "add") {
      const def = PART_MAP[o.part.type];
      if (!def) continue;
      parts.push({ id: o.part.id ?? newId(o.part.type), type: o.part.type, name: o.part.name || def.label, x: o.part.x ?? 0, y: o.part.y ?? 0, rot: o.part.rot ?? 0, p: { ...def.defaults, ...o.part.p } });
    } else if (o.op === "update") {
      parts = parts.map((pt) => (pt.id === o.id ? { ...pt, ...o.set, p: o.set.p ? { ...pt.p, ...o.set.p } : pt.p } : pt));
    } else if (o.op === "remove") {
      parts = parts.filter((pt) => pt.id !== o.id);
    }
  }
  return { ...plan, parts };
}
