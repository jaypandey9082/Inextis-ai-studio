// The Inextis parts library: every part type, its editable settings, its size for
// layout checks, and the bill-of-quantities lines it adds (ported from booth_demo/kit.py).

import type { Part, Plan } from "./schema";
import { pathLength, resolvePath } from "./paths";

export type ParamDef = {
  key: string;
  label: string;
  kind: "number" | "select" | "bool" | "text";
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: string[];
};

export type BoqLine = { category: string; item: string; qty: number; unit: string; rateKey: string };

export type PartDef = {
  type: string;
  label: string;
  group: "Structure" | "LED and AV" | "Finishes" | "Furniture" | "Brand and green";
  hint: string;
  defaults: Part["p"];
  params: ParamDef[];
  // local footprint (before rotation): width (x), depth (y), height above floor (top)
  extent: (p: Part["p"]) => { w: number; d: number; h: number };
  boq: (part: Part, plan: Plan) => BoqLine[];
};

const SQFT = 10.764;
const n = (p: Part["p"], k: string, d = 0) => (typeof p[k] === "number" ? (p[k] as number) : d);
const s = (p: Part["p"], k: string, d = "") => (typeof p[k] === "string" ? (p[k] as string) : d);
const b = (p: Part["p"], k: string) => p[k] === true;
const line = (category: string, item: string, qty: number, unit: string, rateKey: string): BoqLine => ({ category, item, qty: Math.round(qty * 100) / 100, unit, rateKey });
const fmt = (v: number) => (Math.round(v * 100) / 100).toString();

const W = (min = 0.3, max = 30): ParamDef => ({ key: "w", label: "Width", kind: "number", min, max, step: 0.1, unit: "m" });
const H = (min = 0.3, max = 8): ParamDef => ({ key: "h", label: "Height", kind: "number", min, max, step: 0.1, unit: "m" });
const Z = (label = "Height above floor"): ParamDef => ({ key: "z", label, kind: "number", min: 0, max: 8, step: 0.05, unit: "m" });
const pathParams: ParamDef[] = [
  { key: "kind", label: "Shape", kind: "select", options: ["arc", "spiral"] },
  { key: "r", label: "Radius", kind: "number", min: 0.5, max: 15, step: 0.1, unit: "m" },
  { key: "r0", label: "Start radius (spiral)", kind: "number", min: 0.5, max: 15, step: 0.1, unit: "m" },
  { key: "r1", label: "End radius (spiral)", kind: "number", min: 0.5, max: 15, step: 0.1, unit: "m" },
  { key: "a0", label: "Start angle", kind: "number", min: -360, max: 360, step: 5, unit: "°" },
  { key: "a1", label: "End angle", kind: "number", min: -360, max: 720, step: 5, unit: "°" },
  { key: "z0", label: "Start height", kind: "number", min: 0, max: 8, step: 0.05, unit: "m" },
  { key: "z1", label: "End height", kind: "number", min: 0, max: 8, step: 0.05, unit: "m" },
];
const pathExtent = (p: Part["p"]) => {
  const r = s(p, "kind", "arc") === "spiral" ? Math.max(n(p, "r0"), n(p, "r1")) : n(p, "r", 3);
  return { w: 2 * r, d: 2 * r, h: Math.max(n(p, "z0"), n(p, "z1")) + n(p, "height") };
};

// Roof: how deep the top is for each style, and the downlight grid (about one per 2 m)
export const roofDepth = (style: string) => (style === "pergola" ? 0.25 : style === "fabric" ? 0.12 : 0.3);
export const roofLights = (p: Part["p"]) => {
  const nx = Math.max(1, Math.round(n(p, "w") / 2));
  const ny = Math.max(1, Math.round(n(p, "d") / 2));
  return { nx, ny, count: nx * ny };
};

export const PARTS: PartDef[] = [
  /* ---------------- Structure ---------------- */
  {
    type: "block",
    label: "Tower / storage block",
    group: "Structure",
    hint: "Solid built structure, e.g. a storage room or brand tower",
    defaults: { w: 3, d: 3, h: 4, finish: "laminate" },
    params: [W(), { key: "d", label: "Depth", kind: "number", min: 0.3, max: 20, step: 0.1, unit: "m" }, H(), { key: "finish", label: "Finish", kind: "select", options: ["laminate", "wood"] }],
    extent: (p) => ({ w: n(p, "w"), d: n(p, "d"), h: n(p, "h") }),
    boq: ({ name, p }) => [
      line("Fabrication", `${name} structure ${fmt(n(p, "w"))}x${fmt(n(p, "d"))}x${fmt(n(p, "h"))} m (${s(p, "finish")})`, 2 * (n(p, "w") + n(p, "d")) * n(p, "h") * SQFT, "sq ft", s(p, "finish") === "wood" ? "wood_fabrication_sqft" : "fabrication_sqft"),
    ],
  },
  {
    type: "wall",
    label: "Wall",
    group: "Structure",
    hint: "Flat partition or back wall",
    defaults: { w: 4, h: 3, finish: "laminate" },
    params: [W(), H(), { key: "finish", label: "Finish", kind: "select", options: ["laminate", "wood"] }],
    extent: (p) => ({ w: n(p, "w"), d: 0.12, h: n(p, "h") }),
    boq: ({ name, p }) => [line("Fabrication", `${name} wall ${fmt(n(p, "w"))}x${fmt(n(p, "h"))} m (${s(p, "finish")})`, n(p, "w") * n(p, "h") * SQFT, "sq ft", s(p, "finish") === "wood" ? "wood_fabrication_sqft" : "fabrication_sqft")],
  },
  {
    type: "curved_wall",
    label: "Curved wall",
    group: "Structure",
    hint: "Curved feature wall or drum",
    defaults: { r: 2, angle: 120, h: 3, finish: "laminate" },
    params: [
      { key: "r", label: "Radius", kind: "number", min: 0.5, max: 10, step: 0.1, unit: "m" },
      { key: "angle", label: "Arc", kind: "number", min: 20, max: 360, step: 5, unit: "°" },
      H(),
      { key: "finish", label: "Finish", kind: "select", options: ["laminate", "wood"] },
    ],
    extent: (p) => ({ w: 2 * n(p, "r"), d: 2 * n(p, "r"), h: n(p, "h") }),
    boq: ({ name, p }) => {
      const len = (2 * Math.PI * n(p, "r") * n(p, "angle")) / 360;
      return [line("Fabrication", `${name} curved wall ${fmt(len)} m x ${fmt(n(p, "h"))} m`, len * n(p, "h") * SQFT, "sq ft", "curved_fabrication_sqft")];
    },
  },
  {
    type: "beam",
    label: "Header beam",
    group: "Structure",
    hint: "Overhead fascia beam with printed graphic",
    defaults: { w: 6, depth: 0.8, h: 0.8, z: 4.2 },
    params: [W(), { key: "depth", label: "Depth", kind: "number", min: 0.2, max: 3, step: 0.05, unit: "m" }, H(0.2, 2), Z("Centre height")],
    extent: (p) => ({ w: n(p, "w"), d: n(p, "depth"), h: n(p, "z") + n(p, "h") / 2 }),
    boq: ({ name, p }) => [
      line("Fabrication", `${name} header beam ${fmt(n(p, "w"))} m`, n(p, "w") * n(p, "h") * 2 * SQFT, "sq ft", "wood_fabrication_sqft"),
      line("Graphics", `${name} printed header graphic`, n(p, "w") * n(p, "h") * SQFT, "sq ft", "graphics_sqft"),
    ],
  },
  {
    type: "column",
    label: "Column",
    group: "Structure",
    hint: "Round support column",
    defaults: { h: 4, white: true },
    params: [H(), { key: "white", label: "White finish", kind: "bool" }],
    extent: (p) => ({ w: 0.22, d: 0.22, h: n(p, "h") }),
    boq: ({ name, p }) => [line("Fabrication", `${name} support column ${fmt(n(p, "h"))} m`, 1, "nos", "column")],
  },
  {
    type: "door",
    label: "Store room door",
    group: "Structure",
    hint: "Lockable door for a storage room",
    defaults: { w: 1, h: 2.15 },
    params: [W(0.7, 2), H(1.8, 3)],
    extent: (p) => ({ w: n(p, "w"), d: 0.1, h: n(p, "h") }),
    boq: () => [line("Fabrication", "Store room door with lock", 1, "nos", "door")],
  },
  {
    type: "meeting_room",
    label: "Glass meeting room",
    group: "Structure",
    hint: "Enclosed meeting room with glass walls and a door",
    defaults: { w: 3, d: 2.5, h: 2.7 },
    params: [W(1.5, 8), { key: "d", label: "Depth", kind: "number", min: 1.5, max: 8, step: 0.1, unit: "m" }, H(2.2, 4)],
    extent: (p) => ({ w: n(p, "w"), d: n(p, "d"), h: n(p, "h") }),
    boq: ({ name, p }) => [
      line("Fabrication", `${name} glass partition ${fmt(2 * (n(p, "w") + n(p, "d")))} m x ${fmt(n(p, "h"))} m`, 2 * (n(p, "w") + n(p, "d")) * n(p, "h") * SQFT, "sq ft", "fabrication_sqft"),
      line("Fabrication", "Meeting room door", 1, "nos", "door"),
      line("Furniture", "Meeting table", 1, "nos", "table"),
      line("Furniture", "Chair", 4, "nos", "chair"),
    ],
  },
  {
    type: "roof",
    label: "Roof / canopy",
    group: "Structure",
    hint: "Overhead cover for a lounge or meeting area: flat ceiling, timber pergola or fabric canopy, on corner posts",
    defaults: { w: 4, d: 3, z: 3, style: "flat", posts: true, lights: true },
    params: [
      W(1, 30),
      { key: "d", label: "Depth", kind: "number", min: 1, max: 30, step: 0.1, unit: "m" },
      Z("Underside height"),
      { key: "style", label: "Style", kind: "select", options: ["flat", "pergola", "fabric"] },
      { key: "posts", label: "Corner posts", kind: "bool" },
      { key: "lights", label: "Downlights", kind: "bool" },
    ],
    extent: (p) => ({ w: n(p, "w"), d: n(p, "d"), h: n(p, "z") + roofDepth(s(p, "style", "flat")) }),
    boq: ({ name, p }) => {
      const [w, d] = [n(p, "w"), n(p, "d")];
      const size = `${fmt(w)}x${fmt(d)} m`;
      const style = s(p, "style", "flat");
      const out =
        style === "pergola"
          ? [line("Fabrication", `${name} timber pergola ${size} (${Math.floor(w / 0.3)} slats)`, w * d * SQFT, "sq ft", "pergola_sqft")]
          : style === "fabric"
            ? [line("Fabrication", `${name} stretch fabric canopy ${size} with frame`, w * d * SQFT, "sq ft", "fabric_canopy_sqft")]
            : [
                line("Fabrication", `${name} flat roof ${size}`, w * d * SQFT, "sq ft", "fabrication_sqft"),
                line("Fabrication", `${name} roof fascia ${fmt(2 * (w + d))} m`, 2 * (w + d) * roofDepth(style) * SQFT, "sq ft", "fabrication_sqft"),
              ];
      if (b(p, "posts")) out.push(line("Fabrication", `${name} roof post ${fmt(n(p, "z"))} m`, 4, "nos", "column"));
      if (b(p, "lights")) out.push(line("Lighting", `${name} downlight`, roofLights(p).count, "nos", "light_fixture"));
      return out;
    },
  },

  /* ---------------- LED and AV ---------------- */
  {
    type: "led_panel",
    label: "LED screen",
    group: "LED and AV",
    hint: "Flat LED wall; sizes snap to 0.5 m cabinets",
    defaults: { w: 3, h: 2, z: 1.5, content: "screen", frame: false },
    params: [W(0.5, 20), H(0.5, 8), Z("Centre height"), { key: "content", label: "Content", kind: "select", options: ["screen", "dots", "dots_ice"] }, { key: "frame", label: "White frame", kind: "bool" }],
    extent: (p) => ({ w: n(p, "w") + (b(p, "frame") ? 0.3 : 0), d: 0.2, h: n(p, "z") + n(p, "h") / 2 }),
    boq: ({ name, p }) => [
      ...(b(p, "frame") ? [line("Fabrication", `${name} frame`, (n(p, "w") + 0.3) * (n(p, "h") + 0.3) * SQFT, "sq ft", "fabrication_sqft")] : []),
      line("AV / LED", `${name} LED screen ${fmt(n(p, "w"))}x${fmt(n(p, "h"))} m`, n(p, "w") * n(p, "h"), "sq m", "led_screen_sqm"),
    ],
  },
  {
    type: "led_ribbon",
    label: "Flexible LED ribbon / ring",
    group: "LED and AV",
    hint: "Curved LED band: full ring (0–360°), arc or sweeping spiral",
    defaults: { kind: "arc", r: 3, a0: 0, a1: 360, z0: 3.5, height: 1.1, r0: 3, r1: 5, z1: 3.5 },
    params: [...pathParams, { key: "height", label: "Band height", kind: "number", min: 0.2, max: 4, step: 0.05, unit: "m" }],
    extent: pathExtent,
    boq: ({ name, p }, plan) => {
      const len = pathLength(resolvePath(p, plan.platform.height).points);
      return [line("AV / LED", `${name} flexible LED ribbon ${len.toFixed(1)} m x ${fmt(n(p, "height"))} m`, len * n(p, "height"), "sq m", "flexible_led_sqm")];
    },
  },
  {
    type: "white_band",
    label: "Curved fascia band",
    group: "LED and AV",
    hint: "White curved band that frames an LED ring or wraps a drum",
    defaults: { kind: "arc", r: 3, a0: 0, a1: 360, z0: 4.6, height: 0.3 },
    params: [...pathParams, { key: "height", label: "Band height", kind: "number", min: 0.05, max: 6, step: 0.05, unit: "m" }, { key: "onFloor", label: "Stands on floor", kind: "bool" }],
    extent: pathExtent,
    boq: ({ name, p }, plan) => {
      const len = pathLength(resolvePath(p, plan.platform.height).points);
      return [line("Fabrication", `${name} curved fascia band ${len.toFixed(1)} m x ${fmt(n(p, "height"))} m`, len * n(p, "height") * SQFT, "sq ft", "curved_fabrication_sqft")];
    },
  },
  {
    type: "tv",
    label: "TV / display",
    group: "LED and AV",
    hint: "55 in wall-mounted display",
    defaults: { w: 1.23, h: 0.7, z: 1.6 },
    params: [W(0.5, 3), H(0.3, 2), Z("Centre height")],
    extent: (p) => ({ w: n(p, "w"), d: 0.1, h: n(p, "z") + n(p, "h") / 2 }),
    boq: ({ name }) => [line("AV / LED", `${name} 55 in display`, 1, "nos", "tv_55")],
  },
  {
    type: "totem",
    label: "Digital totem",
    group: "LED and AV",
    hint: "Free-standing 43 in screen totem",
    defaults: {},
    params: [],
    extent: () => ({ w: 0.65, d: 0.35, h: 2 }),
    boq: () => [line("AV / LED", "Digital totem 43 in", 1, "nos", "totem")],
  },
  {
    type: "touch_table",
    label: "Touch table",
    group: "LED and AV",
    hint: "Interactive 55 in touch table / kiosk",
    defaults: {},
    params: [],
    extent: () => ({ w: 1.1, d: 0.7, h: 0.9 }),
    boq: () => [line("AV / LED", "Interactive touch table 55 in", 1, "nos", "touch_table")],
  },

  /* ---------------- Finishes ---------------- */
  {
    type: "slat_wall",
    label: "Slat wall",
    group: "Finishes",
    hint: "Vertical slats, optionally backlit",
    defaults: { w: 3, h: 3, backlit: true },
    params: [W(), H(), { key: "backlit", label: "Backlit", kind: "bool" }],
    extent: (p) => ({ w: n(p, "w"), d: 0.3, h: n(p, "h") }),
    boq: ({ name, p }) => {
      const slats = Math.floor(n(p, "w") / 0.18);
      return [line("Fabrication", `${name} slat wall ${n(p, "w").toFixed(1)} m x ${fmt(n(p, "h"))} m (${slats} slats)`, n(p, "w") * n(p, "h") * SQFT, "sq ft", "slat_wall_sqft")];
    },
  },
  {
    type: "bamboo_panel",
    label: "Bamboo slat panel",
    group: "Finishes",
    hint: "Natural bamboo slats on a dark backing",
    defaults: { w: 2.5, h: 3 },
    params: [W(), H()],
    extent: (p) => ({ w: n(p, "w") + 0.2, d: 0.15, h: n(p, "h") + 0.5 }),
    boq: ({ name, p }) => [line("Fabrication", `${name} bamboo slat panel ${n(p, "w").toFixed(1)} m`, n(p, "w") * n(p, "h") * SQFT, "sq ft", "slat_wall_sqft")],
  },
  {
    type: "moss_panel",
    label: "Moss wall",
    group: "Finishes",
    hint: "Preserved moss green wall",
    defaults: { w: 3, h: 3, z: 1.6 },
    params: [W(), H(), Z("Centre height")],
    extent: (p) => ({ w: n(p, "w"), d: 0.06, h: n(p, "z") + n(p, "h") / 2 }),
    boq: ({ name, p }) => [line("Decor", `${name} preserved moss wall ${fmt(n(p, "w"))}x${fmt(n(p, "h"))} m`, n(p, "w") * n(p, "h") * SQFT, "sq ft", "moss_wall_sqft")],
  },
  {
    type: "graphic_panel",
    label: "Graphic panel",
    group: "Finishes",
    hint: "Printed brand graphic on a panel",
    defaults: { w: 2, h: 2.4, z: 1.3, color: "#1f4fd8" },
    params: [W(), H(), Z("Centre height"), { key: "color", label: "Colour", kind: "text" }],
    extent: (p) => ({ w: n(p, "w"), d: 0.06, h: n(p, "z") + n(p, "h") / 2 }),
    boq: ({ name, p }) => [
      line("Fabrication", `${name} graphic panel frame`, n(p, "w") * n(p, "h") * SQFT, "sq ft", "fabrication_sqft"),
      line("Graphics", `${name} printed graphic`, n(p, "w") * n(p, "h") * SQFT, "sq ft", "graphics_sqft"),
    ],
  },
  {
    type: "grass_patch",
    label: "Grass carpet",
    group: "Finishes",
    hint: "Artificial grass floor area",
    defaults: { w: 4, d: 2 },
    params: [W(), { key: "d", label: "Depth", kind: "number", min: 0.3, max: 20, step: 0.1, unit: "m" }],
    extent: (p) => ({ w: n(p, "w"), d: n(p, "d"), h: 0.02 }),
    boq: ({ name, p }) => [line("Flooring", `${name} artificial grass ${fmt(n(p, "w"))}x${fmt(n(p, "d"))} m`, n(p, "w") * n(p, "d") * SQFT, "sq ft", "grass_carpet_sqft")],
  },
  {
    type: "grass_strip",
    label: "Grass topping",
    group: "Finishes",
    hint: "Grass on top of a header beam",
    defaults: { w: 6, depth: 0.8, z: 4.6 },
    params: [W(), { key: "depth", label: "Depth", kind: "number", min: 0.2, max: 3, step: 0.05, unit: "m" }, Z()],
    extent: (p) => ({ w: n(p, "w"), d: n(p, "depth"), h: n(p, "z") + 0.07 }),
    boq: ({ name, p }) => [line("Decor", `${name} grass topping`, n(p, "w") * n(p, "depth") * SQFT, "sq ft", "grass_carpet_sqft")],
  },
  {
    type: "floor_arc",
    label: "Floor light line",
    group: "Finishes",
    hint: "Glowing line set into the floor (arc)",
    defaults: { kind: "arc", r: 3, a0: 200, a1: 340, onFloor: true },
    params: [
      { key: "r", label: "Radius", kind: "number", min: 0.5, max: 15, step: 0.1, unit: "m" },
      { key: "a0", label: "Start angle", kind: "number", min: -360, max: 360, step: 5, unit: "°" },
      { key: "a1", label: "End angle", kind: "number", min: -360, max: 720, step: 5, unit: "°" },
    ],
    extent: (p) => ({ w: 2 * n(p, "r"), d: 2 * n(p, "r"), h: 0.02 }),
    boq: ({ name, p }, plan) => [line("Lighting", `${name} floor light line`, pathLength(resolvePath({ ...p, onFloor: true }, plan.platform.height).points), "rm", "led_strip_rm")],
  },

  /* ---------------- Furniture ---------------- */
  {
    type: "counter",
    label: "Reception counter",
    group: "Furniture",
    hint: "Branded reception counter with glow base",
    defaults: { w: 2.4, label: "WELCOME" },
    params: [W(1, 6), { key: "label", label: "Front text", kind: "text" }],
    extent: (p) => ({ w: n(p, "w"), d: 0.7, h: 1.05 }),
    boq: ({ p }) => [line("Furniture", `Reception counter ${fmt(n(p, "w"))} m with logo`, 1, "nos", "counter")],
  },
  {
    type: "lounge",
    label: "Lounge set",
    group: "Furniture",
    hint: "Round table with chairs",
    defaults: { seats: 4 },
    params: [{ key: "seats", label: "Seats", kind: "number", min: 2, max: 8, step: 1 }],
    extent: () => ({ w: 2.2, d: 2.2, h: 1 }),
    boq: ({ p }) => [line("Furniture", "Round table", 1, "nos", "table"), ...Array.from({ length: n(p, "seats", 4) }, () => line("Furniture", "Chair", 1, "nos", "chair"))],
  },
  {
    type: "sofa",
    label: "Sofa",
    group: "Furniture",
    hint: "Lounge sofa",
    defaults: { w: 1.8 },
    params: [W(1, 4)],
    extent: (p) => ({ w: n(p, "w"), d: 0.8, h: 0.87 }),
    boq: () => [line("Furniture", "Lounge sofa", 1, "nos", "sofa")],
  },
  {
    type: "seating_rows",
    label: "Presentation seating",
    group: "Furniture",
    hint: "Rows of chairs facing the front",
    defaults: { rows: 2, cols: 5, dx: 0.6, dy: 0.75 },
    params: [
      { key: "rows", label: "Rows", kind: "number", min: 1, max: 8, step: 1 },
      { key: "cols", label: "Chairs per row", kind: "number", min: 1, max: 12, step: 1 },
      { key: "dx", label: "Chair spacing", kind: "number", min: 0.5, max: 1.2, step: 0.05, unit: "m" },
      { key: "dy", label: "Row spacing", kind: "number", min: 0.6, max: 1.5, step: 0.05, unit: "m" },
    ],
    extent: (p) => ({ w: (n(p, "cols") - 1) * n(p, "dx") + 0.5, d: (n(p, "rows") - 1) * n(p, "dy") + 0.5, h: 0.9 }),
    boq: ({ p }) => Array.from({ length: n(p, "rows") * n(p, "cols") }, () => line("Furniture", "Chair", 1, "nos", "chair")),
  },
  {
    type: "high_table",
    label: "High table with stools",
    group: "Furniture",
    hint: "Bar-height meeting table",
    defaults: { stools: 3 },
    params: [{ key: "stools", label: "Stools", kind: "number", min: 0, max: 6, step: 1 }],
    extent: () => ({ w: 1.6, d: 1.6, h: 1.1 }),
    boq: ({ p }) => [line("Furniture", "High table", 1, "nos", "table"), ...Array.from({ length: n(p, "stools", 3) }, () => line("Furniture", "Chair", 1, "nos", "chair"))],
  },

  /* ---------------- Brand and green ---------------- */
  {
    type: "text",
    label: "Brand lettering",
    group: "Brand and green",
    hint: "3D brand name, glowing or coloured",
    defaults: { body: "BRAND", size: 0.5, z: 3.5, style: "white_glow" },
    params: [
      { key: "body", label: "Text", kind: "text" },
      { key: "size", label: "Letter height", kind: "number", min: 0.1, max: 2, step: 0.05, unit: "m" },
      Z("Centre height"),
      { key: "style", label: "Style", kind: "select", options: ["white_glow", "brand_green", "ink"] },
    ],
    extent: (p) => ({ w: Math.max(0.3, s(p, "body").length * n(p, "size") * 0.62), d: 0.05, h: n(p, "z") + n(p, "size") / 2 }),
    boq: ({ p }) => [line("Graphics", `Brand lettering '${s(p, "body")}'`, s(p, "body").length * n(p, "size") * n(p, "size") * SQFT, "sq ft", "graphics_sqft")],
  },
  {
    type: "plant",
    label: "Plant",
    group: "Brand and green",
    hint: "Potted bush or tree",
    defaults: { size: 1, kind: "bush" },
    params: [{ key: "size", label: "Size", kind: "number", min: 0.3, max: 2.5, step: 0.05 }, { key: "kind", label: "Type", kind: "select", options: ["bush", "tree"] }],
    extent: (p) => ({ w: 0.7 * n(p, "size", 1), d: 0.7 * n(p, "size", 1), h: (s(p, "kind") === "tree" ? 2 : 0.95) * n(p, "size", 1) }),
    boq: ({ p }) => [line("Decor", `Live plant (${s(p, "kind", "bush")})`, 1, "nos", s(p, "kind") === "tree" || n(p, "size", 1) > 1.3 ? "plant_large" : "plant_small")],
  },
  {
    type: "plant_row",
    label: "Row of plants",
    group: "Brand and green",
    hint: "Planters along an edge",
    defaults: { w: 6, count: 6, size: 0.7 },
    params: [W(1, 30), { key: "count", label: "Plants", kind: "number", min: 2, max: 30, step: 1 }, { key: "size", label: "Size", kind: "number", min: 0.3, max: 1.5, step: 0.05 }],
    extent: (p) => ({ w: n(p, "w") + 0.5, d: 0.5, h: 0.95 * n(p, "size", 1) }),
    boq: ({ p }) => Array.from({ length: n(p, "count") }, () => line("Decor", "Live plant (bush)", 1, "nos", n(p, "size", 1) > 1.3 ? "plant_large" : "plant_small")),
  },
  {
    type: "hanging_plants",
    label: "Hanging plants",
    group: "Brand and green",
    hint: "Plants hung from a header",
    defaults: { w: 6, count: 6, z: 3.5 },
    params: [W(1, 30), { key: "count", label: "Plants", kind: "number", min: 2, max: 30, step: 1 }, Z()],
    extent: (p) => ({ w: n(p, "w") + 0.4, d: 0.4, h: n(p, "z") + 0.9 }),
    boq: ({ p }) => Array.from({ length: n(p, "count") }, () => line("Decor", "Live plant (bush)", 1, "nos", "plant_small")),
  },
  {
    type: "roof_planters",
    label: "Rooftop planters",
    group: "Brand and green",
    hint: "Grid of planters on top of a tower",
    defaults: { w: 3, d: 3, nx: 3, ny: 3, z: 4 },
    params: [W(), { key: "d", label: "Depth", kind: "number", min: 0.5, max: 20, step: 0.1, unit: "m" }, { key: "nx", label: "Across", kind: "number", min: 1, max: 10, step: 1 }, { key: "ny", label: "Deep", kind: "number", min: 1, max: 10, step: 1 }, Z()],
    extent: (p) => ({ w: n(p, "w") + 0.6, d: n(p, "d") + 0.6, h: n(p, "z") + 0.6 }),
    boq: ({ p }) => Array.from({ length: n(p, "nx") * n(p, "ny") }, () => line("Decor", "Live plant (bush)", 1, "nos", "plant_small")),
  },
];

export const PART_MAP = Object.fromEntries(PARTS.map((d) => [d.type, d])) as Record<string, PartDef>;
export const GROUPS = ["Structure", "LED and AV", "Finishes", "Furniture", "Brand and green"] as const;
