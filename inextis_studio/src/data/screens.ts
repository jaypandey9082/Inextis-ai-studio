// Screens on the NOVA Tech Pavilion, sized from booth_demo/plans/nova_tech_pavilion.json.
// LED surfaces get their pixel size from physical size ÷ pixel pitch; TVs are fixed.

export type Screen = {
  id: string;
  name: string;
  kind: "LED ribbon" | "LED wall" | "Totem" | "Touch table";
  widthM: number;
  heightM: number;
  fixedPx?: [number, number];
};

export const screens: Screen[] = [
  { id: "HeroRing", name: "Hero LED ring", kind: "LED ribbon", widthM: 21.36, heightM: 1.15 },
  { id: "RibbonSweepRight", name: "LED ribbon, right sweep", kind: "LED ribbon", widthM: 9.8, heightM: 1.5 },
  { id: "RibbonSweepBack", name: "LED ribbon, back sweep", kind: "LED ribbon", widthM: 4.5, heightM: 1.15 },
  { id: "BacklitWall", name: "Backlit LED wall", kind: "LED wall", widthM: 4.0, heightM: 2.4 },
  { id: "StageLED", name: "Presentation LED", kind: "LED wall", widthM: 2.9, heightM: 1.7 },
  { id: "StoreBlockLED", name: "Storage block LED", kind: "LED wall", widthM: 3.7, heightM: 4.2 },
  { id: "CoreScreen", name: "Reception core screen", kind: "LED wall", widthM: 1.5, heightM: 1.9 },
  { id: "TotemL", name: "Digital totem, left", kind: "Totem", widthM: 0.69, heightM: 1.21, fixedPx: [1080, 1920] },
  { id: "TotemR", name: "Digital totem, front", kind: "Totem", widthM: 0.69, heightM: 1.21, fixedPx: [1080, 1920] },
  { id: "TableA", name: "Touch table A", kind: "Touch table", widthM: 0.95, heightM: 0.54, fixedPx: [1920, 1080] },
  { id: "TableB", name: "Touch table B", kind: "Touch table", widthM: 0.95, heightM: 0.54, fixedPx: [1920, 1080] },
];

export const pitches = [1.9, 2.6, 3.9];

export const sponsors = ["HELIOS GRID", "VOLTA STORAGE", "AQUA H2"];

export const accents = [
  { name: "Violet", value: "#7b3cff" },
  { name: "Blue", value: "#2f7bff" },
  { name: "Orange", value: "#ee8022" },
];

export function pixelSize(s: Screen, pitchMm: number): [number, number] {
  if (s.fixedPx) return s.fixedPx;
  return [Math.round((s.widthM * 1000) / pitchMm), Math.round((s.heightM * 1000) / pitchMm)];
}

export function layoutFor(w: number, h: number) {
  const a = w / h;
  if (a >= 4) return "Ultra-wide row";
  if (a >= 1.3) return "Wide split";
  if (a >= 0.8) return "Centred";
  return "Tall stack";
}
