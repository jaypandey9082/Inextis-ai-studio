"use client";

// Editor state: the plan being edited, selection, and undo/redo history.

import { create } from "zustand";
import { PART_MAP } from "./registry";
import { newId, type Part, type Plan } from "./schema";
import { applyOpsTo, type Op } from "./store-ops";

export { applyOpsTo, type Op };

type ViewMode = "3d" | "plan";
type Tool = "move" | "rotate";

type State = {
  projectId: string | null;
  plan: Plan | null;
  selectedId: string | null;
  past: Plan[];
  future: Plan[];
  view: ViewMode;
  tool: Tool;
  dragBase: Plan | null;
  lastMerge: { key: string; at: number } | null;
  revision: number;
  load: (projectId: string, plan: Plan) => void;
  select: (id: string | null) => void;
  setView: (v: ViewMode) => void;
  setTool: (t: Tool) => void;
  commit: (next: Plan, mergeKey?: string) => void;
  updatePart: (id: string, set: Partial<Omit<Part, "p" | "id">> & { p?: Part["p"] }, mergeKey?: string) => void;
  updatePlan: (set: Partial<Plan>, mergeKey?: string) => void;
  addPart: (type: string, at?: { x: number; y: number }) => void;
  removePart: (id: string) => void;
  duplicatePart: (id: string) => void;
  applyOps: (ops: Op[]) => void;
  beginDrag: () => void;
  dragPart: (id: string, x: number, y: number, rot: number) => void;
  endDrag: () => void;
  undo: () => void;
  redo: () => void;
};

const HISTORY = 150;

export const useEditor = create<State>((set, get) => ({
  projectId: null,
  plan: null,
  selectedId: null,
  past: [],
  future: [],
  view: "3d",
  tool: "move",
  dragBase: null,
  lastMerge: null,
  revision: 0,

  load: (projectId, plan) => set({ projectId, plan, selectedId: null, past: [], future: [], dragBase: null, lastMerge: null, revision: 0 }),
  select: (id) => set({ selectedId: id }),
  setView: (view) => set({ view }),
  setTool: (tool) => set({ tool }),

  commit: (next, mergeKey) => {
    const { plan, past, lastMerge, revision } = get();
    if (!plan) return;
    const now = Date.now();
    const merge = mergeKey && lastMerge && lastMerge.key === mergeKey && now - lastMerge.at < 900;
    set({
      plan: next,
      past: merge ? past : [...past, plan].slice(-HISTORY),
      future: [],
      lastMerge: mergeKey ? { key: mergeKey, at: now } : null,
      revision: revision + 1,
    });
  },

  updatePart: (id, change, mergeKey) => {
    const plan = get().plan;
    if (plan) get().commit(applyOpsTo(plan, [{ op: "update", id, set: change }]), mergeKey);
  },

  updatePlan: (change, mergeKey) => {
    const plan = get().plan;
    if (plan) get().commit({ ...plan, ...change }, mergeKey);
  },

  addPart: (type, at) => {
    const plan = get().plan;
    const def = PART_MAP[type];
    if (!plan || !def) return;
    const id = newId(type);
    const count = plan.parts.filter((p) => p.type === type).length;
    get().commit(applyOpsTo(plan, [{ op: "add", part: { id, type, name: count ? `${def.label} ${count + 1}` : def.label, x: at?.x ?? 0, y: at?.y ?? 0, rot: 0, p: { ...def.defaults } } }]));
    set({ selectedId: id });
  },

  removePart: (id) => {
    const plan = get().plan;
    if (!plan) return;
    get().commit(applyOpsTo(plan, [{ op: "remove", id }]));
    if (get().selectedId === id) set({ selectedId: null });
  },

  duplicatePart: (id) => {
    const plan = get().plan;
    const src = plan?.parts.find((p) => p.id === id);
    if (!plan || !src) return;
    const nid = newId(src.type);
    get().commit(applyOpsTo(plan, [{ op: "add", part: { ...src, id: nid, name: `${src.name} copy`, x: src.x + 0.5, y: src.y - 0.5, p: { ...src.p } } }]));
    set({ selectedId: nid });
  },

  applyOps: (ops) => {
    const plan = get().plan;
    if (plan) get().commit(applyOpsTo(plan, ops));
  },

  // Dragging updates the plan live; one history step is recorded when the drag ends
  beginDrag: () => set({ dragBase: get().plan }),
  dragPart: (id, x, y, rot) => {
    const plan = get().plan;
    if (!plan) return;
    set({ plan: applyOpsTo(plan, [{ op: "update", id, set: { x, y, rot } }]) });
  },
  endDrag: () => {
    const { dragBase, plan, past, revision } = get();
    if (!dragBase || !plan) return set({ dragBase: null });
    if (dragBase === plan) return set({ dragBase: null });
    set({ past: [...past, dragBase].slice(-HISTORY), future: [], dragBase: null, lastMerge: null, revision: revision + 1 });
  },

  undo: () => {
    const { past, plan, future, revision } = get();
    if (!past.length || !plan) return;
    set({ plan: past[past.length - 1], past: past.slice(0, -1), future: [plan, ...future], lastMerge: null, revision: revision + 1 });
  },
  redo: () => {
    const { past, plan, future, revision } = get();
    if (!future.length || !plan) return;
    set({ plan: future[0], future: future.slice(1), past: [...past, plan], lastMerge: null, revision: revision + 1 });
  },
}));
