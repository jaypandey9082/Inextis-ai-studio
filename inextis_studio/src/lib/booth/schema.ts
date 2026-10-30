// The booth plan: the single source of truth for a booth. The editor, costing,
// validator, AI and Blender all read this. Units are metres and degrees.
// Coordinates (Z-up, like Blender): origin at the booth centre, x to the right,
// y towards the back (the front edge is y = -depth/2), z up.

import { z } from "zod";

export type Rgb = [number, number, number];

export type Part = {
  id: string;
  type: string;
  name: string;
  x: number;
  y: number;
  rot: number;
  p: Record<string, number | string | boolean>;
};

export type View = { name: string; loc: [number, number, number]; target: [number, number, number]; lens: number };

export type Plan = {
  version: 1;
  name: string;
  title: string;
  brief: string;
  size: [number, number];
  openSides: ("front" | "back" | "left" | "right")[];
  heightLimit: number;
  platform: { height: number; finish: "white" | "wood"; edgeLight: boolean; accent: Rgb };
  palette: { led: Rgb[]; screen: Rgb[]; glow: Rgb };
  lighting: { topEnergy: number; tint: Rgb; spots: [number, number, number][] };
  parts: Part[];
  views: View[];
};

const rgb = z.tuple([z.number(), z.number(), z.number()]);

export const PartSchema = z.object({
  id: z.string(),
  type: z.string(),
  name: z.string(),
  x: z.number(),
  y: z.number(),
  rot: z.number(),
  p: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])),
});

export const PlanSchema = z.object({
  version: z.literal(1),
  name: z.string(),
  title: z.string(),
  brief: z.string(),
  size: z.tuple([z.number(), z.number()]),
  openSides: z.array(z.enum(["front", "back", "left", "right"])),
  heightLimit: z.number(),
  platform: z.object({ height: z.number(), finish: z.enum(["white", "wood"]), edgeLight: z.boolean(), accent: rgb }),
  palette: z.object({ led: z.array(rgb), screen: z.array(rgb), glow: rgb }),
  lighting: z.object({ topEnergy: z.number(), tint: rgb, spots: z.array(z.tuple([z.number(), z.number(), z.number()])) }),
  parts: z.array(PartSchema),
  views: z.array(
    z.object({ name: z.string(), loc: z.tuple([z.number(), z.number(), z.number()]), target: z.tuple([z.number(), z.number(), z.number()]), lens: z.number() }),
  ),
});

export function newId(type: string) {
  return `${type}-${Math.random().toString(36).slice(2, 8)}`;
}

export const hexToRgb = (hex: string): Rgb => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

export const rgbToHex = (c: Rgb) =>
  "#" +
  c
    .map((v) =>
      Math.round(Math.max(0, Math.min(1, v)) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");

// Default cameras framed from the booth size
export function defaultViews(w: number, d: number): View[] {
  const s = Math.max(w, d);
  return [
    { name: "aerial", loc: [-s * 1.05, -s * 1.1, s * 0.85], target: [0, 0, 1.4], lens: 30 },
    { name: "front", loc: [s * 0.25, -s * 1.05, 1.9], target: [0, 0, 2.0], lens: 24 },
  ];
}

export function emptyPlan(opts: { name: string; title: string; brief: string; w: number; d: number; openSides: Plan["openSides"]; heightLimit: number }): Plan {
  const { w, d } = opts;
  return {
    version: 1,
    name: opts.name,
    title: opts.title,
    brief: opts.brief,
    size: [w, d],
    openSides: opts.openSides,
    heightLimit: opts.heightLimit,
    platform: { height: 0.1, finish: "white", edgeLight: true, accent: [0.3, 0.6, 1.0] },
    palette: { led: [[0.42, 0.04, 1.0], [0.16, 0.12, 1.0], [0.0, 0.38, 1.0]], screen: [[0.01, 0.02, 0.12], [0.05, 0.25, 0.9], [0.45, 0.7, 1.0]], glow: [0.3, 0.5, 1.0] },
    lighting: { topEnergy: 1300, tint: [0.9, 0.93, 1.0], spots: [[-w * 0.45, -d * 0.6, 6], [w * 0.45, -d * 0.6, 6], [0, d * 0.5, 7]] },
    parts: [],
    views: defaultViews(w, d),
  };
}
