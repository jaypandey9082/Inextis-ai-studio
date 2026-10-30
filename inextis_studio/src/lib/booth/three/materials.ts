// Preview materials for the browser. Names match booth_demo/kit.py so Blender can
// swap each one for its photo-quality version at render time.

import * as THREE from "three";
import type { Plan, Rgb } from "../schema";

const cache = new Map<string, THREE.Material>();

const col = (c: Rgb) => new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);
const css = (c: Rgb) => `rgb(${c.map((v) => Math.round(Math.min(1, v) * 255)).join(",")})`;

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat: [number, number]) {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// LED skin: a dot grid whose colour flows along the length. UVs are in metres;
// one tile covers 2 m × 0.25 m (16 dots per metre).
function ledTexture(colors: Rgb[], key: string) {
  return canvasTexture(
    512,
    64,
    (g) => {
      const grad = g.createLinearGradient(0, 0, 512, 0);
      const seq = [...colors, ...colors.slice(0, -1).reverse()];
      seq.forEach((c, i) => grad.addColorStop(i / (seq.length - 1), css(c)));
      g.fillStyle = "#05050a";
      g.fillRect(0, 0, 512, 64);
      g.fillStyle = grad;
      for (let y = 8; y < 64; y += 16) for (let x = 8; x < 512; x += 16) {
        g.beginPath();
        g.arc(x, y, key === "ice" ? 4.2 : 5.2, 0, Math.PI * 2);
        g.fill();
      }
    },
    [0.5, 4],
  );
}

function screenTexture(colors: Rgb[]) {
  return canvasTexture(
    256,
    256,
    (g) => {
      g.fillStyle = css(colors[0]);
      g.fillRect(0, 0, 256, 256);
      const blobs = [[60, 80, 140], [190, 170, 120], [140, 40, 90], [40, 210, 100]];
      blobs.forEach(([x, y, r], i) => {
        const rg = g.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, css(colors[1 + (i % (colors.length - 1))]));
        rg.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = rg;
        g.fillRect(0, 0, 256, 256);
      });
      g.strokeStyle = "rgba(255,255,255,0.18)";
      g.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        g.beginPath();
        for (let x = 0; x <= 256; x += 8) g.lineTo(x, 40 + i * 36 + Math.sin(x / 30 + i) * 14);
        g.stroke();
      }
    },
    [0.5, 0.5],
  );
}

function woodTexture(light: Rgb, dark: Rgb) {
  return canvasTexture(
    256,
    256,
    (g) => {
      g.fillStyle = css(light);
      g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 70; i++) {
        g.strokeStyle = `rgba(${dark.map((v) => Math.round(v * 255)).join(",")},${0.15 + ((i * 37) % 10) / 30})`;
        g.lineWidth = 1 + ((i * 13) % 4);
        g.beginPath();
        const y = (i * 41) % 256;
        for (let x = 0; x <= 256; x += 16) g.lineTo(x, y + Math.sin(x / 40 + i) * 3);
        g.stroke();
      }
    },
    [1, 1],
  );
}

function noiseTexture(a: Rgb, b: Rgb, scale = 1) {
  return canvasTexture(
    128,
    128,
    (g) => {
      const img = g.createImageData(128, 128);
      let seed = 7;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 128 * 128; i++) {
        const t = rnd();
        img.data[i * 4] = (a[0] + (b[0] - a[0]) * t) * 255;
        img.data[i * 4 + 1] = (a[1] + (b[1] - a[1]) * t) * 255;
        img.data[i * 4 + 2] = (a[2] + (b[2] - a[2]) * t) * 255;
        img.data[i * 4 + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    },
    [scale, scale],
  );
}

function skyGrassTexture() {
  return canvasTexture(
    16,
    256,
    (g) => {
      const grad = g.createLinearGradient(0, 256, 0, 0);
      grad.addColorStop(0, "#1a6b0a");
      grad.addColorStop(0.32, "#1a6b0a");
      grad.addColorStop(0.52, "#73bf40");
      grad.addColorStop(0.62, "#c7e5ff");
      grad.addColorStop(1, "#9fd1ff");
      g.fillStyle = grad;
      g.fillRect(0, 0, 16, 256);
    },
    [1, 1],
  );
}

function std(name: string, color: Rgb, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  const m = new THREE.MeshStandardMaterial({ color: col(color), roughness: 0.4, metalness: 0, ...opts });
  m.name = name;
  return m;
}

function emissive(name: string, color: Rgb, intensity = 2) {
  const m = new THREE.MeshStandardMaterial({ color: col(color), emissive: col(color), emissiveIntensity: intensity, roughness: 0.4 });
  m.name = name;
  return m;
}

export type MatName =
  | "Laminate" | "Oak" | "LEDRibbon" | "LEDIce" | "Screen" | "Glow" | "TextGlow" | "BrandGreen" | "Ink" | "EdgeLight"
  | "PlatformWhite" | "FloorOak" | "BandWhite" | "SlatBlack" | "KioskWhite" | "CounterWhite" | "Chrome" | "TableTop"
  | "Leaf" | "Trunk" | "Moss" | "GrassTop" | "GrassCarpet" | "Bamboo" | "BambooBack" | "DoorWood" | "Wire" | "Bezel"
  | "SkyGrassPrint" | "Glass" | "HallFloor";

function make(name: MatName, plan: Plan): THREE.Material {
  const pal = plan.palette;
  switch (name) {
    case "Laminate": return std(name, [0.92, 0.93, 0.95], { roughness: 0.22 });
    case "BandWhite": return std(name, [0.92, 0.93, 0.95], { roughness: 0.25 });
    case "PlatformWhite": return std(name, [0.88, 0.89, 0.9], { roughness: 0.15 });
    case "KioskWhite": return std(name, [0.93, 0.94, 0.95], { roughness: 0.2 });
    case "CounterWhite": return std(name, [0.95, 0.95, 0.96], { roughness: 0.15 });
    case "TableTop": return std(name, [0.95, 0.95, 0.96], { roughness: 0.15 });
    case "Oak": return std(name, [1, 1, 1], { map: woodTexture([0.72, 0.52, 0.32], [0.38, 0.22, 0.11]), roughness: 0.45 });
    case "FloorOak": return std(name, [1, 1, 1], { map: woodTexture([0.78, 0.6, 0.4], [0.55, 0.36, 0.2]), roughness: 0.4 });
    case "DoorWood": return std(name, [1, 1, 1], { map: woodTexture([0.55, 0.38, 0.24], [0.3, 0.18, 0.1]), roughness: 0.45 });
    case "LEDRibbon": {
      const t = ledTexture(pal.led, "led");
      return std(name, [0.02, 0.02, 0.04], { map: t, emissiveMap: t, emissive: new THREE.Color(1, 1, 1), emissiveIntensity: 1.6, roughness: 0.35 });
    }
    case "LEDIce": {
      const t = ledTexture([[0.6, 0.85, 1.0], [0.2, 0.5, 1.0]], "ice");
      return std(name, [0.02, 0.02, 0.04], { map: t, emissiveMap: t, emissive: new THREE.Color(1, 1, 1), emissiveIntensity: 1.6, roughness: 0.35 });
    }
    case "Screen": {
      const t = screenTexture(pal.screen);
      return std(name, [0, 0, 0], { map: t, emissiveMap: t, emissive: new THREE.Color(1, 1, 1), emissiveIntensity: 1.2 });
    }
    case "Glow": return emissive(name, pal.glow, 3);
    case "EdgeLight": return emissive(name, plan.platform.accent, 3);
    case "TextGlow": return emissive(name, [1, 1, 1], 2);
    case "BrandGreen": return std(name, [0.02, 0.22, 0.06]);
    case "Ink": return std(name, [0.05, 0.08, 0.3]);
    case "SlatBlack": return std(name, [0.03, 0.03, 0.035], { roughness: 0.3 });
    case "Chrome": return std(name, [0.8, 0.8, 0.82], { roughness: 0.15, metalness: 1 });
    case "Leaf": return std(name, [0.05, 0.22, 0.05], { roughness: 0.55 });
    case "Trunk": return std(name, [0.25, 0.16, 0.08], { roughness: 0.8 });
    case "Moss": return std(name, [1, 1, 1], { map: noiseTexture([0.04, 0.16, 0.02], [0.3, 0.58, 0.1], 4), roughness: 0.9 });
    case "GrassTop": return std(name, [1, 1, 1], { map: noiseTexture([0.04, 0.16, 0.02], [0.3, 0.58, 0.1], 4), roughness: 0.9 });
    case "GrassCarpet": return std(name, [1, 1, 1], { map: noiseTexture([0.06, 0.26, 0.04], [0.32, 0.6, 0.12], 6), roughness: 0.9 });
    case "Bamboo": return std(name, [0.62, 0.46, 0.22], { roughness: 0.45 });
    case "BambooBack": return std(name, [0.12, 0.08, 0.05], { roughness: 0.6 });
    case "Wire": return std(name, [0.1, 0.1, 0.1]);
    case "Bezel": return std(name, [0.02, 0.02, 0.02], { roughness: 0.3 });
    case "SkyGrassPrint": return std(name, [1, 1, 1], { map: skyGrassTexture(), emissive: new THREE.Color(0.25, 0.28, 0.25), roughness: 0.6 });
    case "Glass": return std(name, [0.85, 0.92, 1.0], { roughness: 0.05, transparent: true, opacity: 0.28 });
    case "HallFloor": return std(name, [0.1, 0.1, 0.11], { roughness: 0.3 });
  }
}

export function mat(name: MatName, plan: Plan) {
  const key = `${name}|${JSON.stringify(plan.palette)}|${plan.platform.accent.join(",")}`;
  let m = cache.get(key);
  if (!m) cache.set(key, (m = make(name, plan)));
  return m;
}

// Coloured materials (chairs, sofas, pots, graphics) carry their colour in the name, like kit.py
export function colourMat(prefix: string, c: Rgb, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  const name = `${prefix}(${c.map((v) => v.toString()).join(", ")})`;
  let m = cache.get(name);
  if (!m) cache.set(name, (m = std(name, c, { roughness: 0.5, ...opts })));
  return m;
}

export function textMaterial(body: string, style: string, sizePx: number, font: string) {
  const key = `text|${body}|${style}|${font}`;
  let m = cache.get(key) as THREE.MeshBasicMaterial | undefined;
  if (m) return m;
  if (typeof document === "undefined") return new THREE.MeshBasicMaterial();
  const c = document.createElement("canvas");
  const g = c.getContext("2d")!;
  g.font = `600 ${sizePx}px ${font}`;
  const w = Math.ceil(g.measureText(body).width + sizePx * 0.6);
  c.width = w;
  c.height = Math.ceil(sizePx * 1.5);
  g.font = `600 ${sizePx}px ${font}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  const fill = style === "brand_green" ? "#0a5a14" : style === "ink" ? "#0d1550" : "#ffffff";
  if (style === "white_glow") {
    g.shadowColor = "rgba(160,190,255,0.9)";
    g.shadowBlur = sizePx * 0.25;
  }
  g.fillStyle = fill;
  g.fillText(body, w / 2, c.height / 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  m = new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: style !== "white_glow" });
  m.name = style === "white_glow" ? "TextGlow" : style === "brand_green" ? "BrandGreen" : "Ink";
  m.userData.aspect = w / c.height;
  cache.set(key, m);
  return m;
}
