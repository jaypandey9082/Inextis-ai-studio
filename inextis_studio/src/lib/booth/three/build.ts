// Builds three.js geometry for every part, in Z-up booth coordinates (the caller
// rotates the root to three's Y-up). Same shapes and sizes as booth_demo/kit.py.

import * as THREE from "three";
import { resolvePath, type Pt } from "../paths";
import type { Part, Plan, Rgb } from "../schema";
import { colourMat, mat, textMaterial, type MatName } from "./materials";

export type BuildCtx = { plan: Plan; ph: number; font: string };

const n = (p: Part["p"], k: string, d = 0) => (typeof p[k] === "number" ? (p[k] as number) : d);
const s = (p: Part["p"], k: string, d = "") => (typeof p[k] === "string" ? (p[k] as string) : d);

/* ---------------- primitives ---------------- */

// Box with UVs in metres (matches kit._box_uv) so LED/wood textures keep their scale
function boxGeom(w: number, d: number, h: number) {
  const g = new THREE.BoxGeometry(w, d, h);
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const [x, y, z] = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    const [nx, ny, nz] = [nor.getX(i), nor.getY(i), nor.getZ(i)];
    if (Math.abs(nz) > 0.5) uv.setXY(i, x + w / 2, y + d / 2);
    else if (Math.abs(ny) > 0.5) uv.setXY(i, x + w / 2, z + h / 2);
    else if (Math.abs(nx) > 0.5) uv.setXY(i, y + d / 2, z + h / 2);
  }
  return g;
}

function box(parent: THREE.Object3D, name: string, size: [number, number, number], center: [number, number, number], m: THREE.Material, rotZ = 0, rotX = 0) {
  const mesh = new THREE.Mesh(boxGeom(...size), m);
  mesh.name = name;
  mesh.position.set(...center);
  mesh.rotation.set(rotX, 0, rotZ, "ZYX");
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function cylinder(parent: THREE.Object3D, name: string, r: number, h: number, center: [number, number, number], m: THREE.Material, segs = 32, rTop?: number) {
  const g = new THREE.CylinderGeometry(rTop ?? r, r, h, segs);
  g.rotateX(Math.PI / 2);
  const mesh = new THREE.Mesh(g, m);
  mesh.name = name;
  mesh.position.set(...center);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

// Vertical band along a path with real thickness; UV u = length (m), v = height (m)
function ribbon(parent: THREE.Object3D, name: string, pts: Pt[], height: number, thickness: number, m: THREE.Material, closed = false) {
  const N = pts.length;
  const verts: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];
  let len = 0;
  const lens = [0];
  for (let i = 1; i < N; i++) {
    len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]);
    lens.push(len);
  }
  const count = closed ? N + 1 : N;
  for (let k = 0; k < count; k++) {
    const i = k % N;
    const prev = pts[closed ? (i - 1 + N) % N : Math.max(i - 1, 0)];
    const next = pts[closed ? (i + 1) % N : Math.min(i + 1, N - 1)];
    let tx = next[0] - prev[0];
    let ty = next[1] - prev[1];
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    const [nx, ny] = [-ty * (thickness / 2), tx * (thickness / 2)];
    const [x, y, z] = pts[i];
    const u = k === N ? len + Math.hypot(pts[0][0] - pts[N - 1][0], pts[0][1] - pts[N - 1][1]) : lens[i];
    // outer bottom, outer top, inner bottom, inner top
    verts.push(x + nx, y + ny, z, x + nx, y + ny, z + height, x - nx, y - ny, z, x - nx, y - ny, z + height);
    uvs.push(u, 0, u, height, u, 0, u, height);
  }
  for (let k = 0; k < count - 1; k++) {
    const a = k * 4;
    const b = (k + 1) * 4;
    idx.push(a, b, b + 1, a, b + 1, a + 1); // outer
    idx.push(a + 2, a + 3, b + 3, a + 2, b + 3, b + 2); // inner
    idx.push(a + 1, b + 1, b + 3, a + 1, b + 3, a + 3); // top
    idx.push(a, a + 2, b + 2, a, b + 2, b); // bottom
  }
  if (!closed) {
    const e = (count - 1) * 4;
    idx.push(0, 1, 3, 0, 3, 2, e, e + 2, e + 3, e, e + 3, e + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, m);
  mesh.name = name;
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function textPlane(parent: THREE.Object3D, name: string, body: string, size: number, center: [number, number, number], style: string, ctx: BuildCtx, rotZ = 0) {
  if (!body) return;
  const m = textMaterial(body, style, 160, ctx.font);
  const aspect = (m.userData.aspect as number) ?? body.length * 0.7;
  const h = size * 1.5;
  const g = new THREE.PlaneGeometry(h * aspect, h);
  g.rotateX(Math.PI / 2); // plane faces -Y (the front), like kit.text
  const mesh = new THREE.Mesh(g, m);
  mesh.name = name;
  mesh.position.set(...center);
  mesh.rotation.z = rotZ;
  // Blender replaces this plane with real extruded 3D letters
  mesh.userData = { inextis_text: body, inextis_text_size: size, inextis_text_style: style };
  parent.add(mesh);
}

/* ---------------- furniture pieces ---------------- */

function chair(parent: THREE.Object3D, name: string, x: number, y: number, z0: number, rotZ: number, color: Rgb, plan: Plan) {
  const m = colourMat("Chair", color, { roughness: 0.35 });
  cylinder(parent, `${name}_stem`, 0.03, 0.42, [x, y, z0 + 0.21], mat("Chrome", plan), 12);
  cylinder(parent, `${name}_seat`, 0.24, 0.06, [x, y, z0 + 0.45], m, 24);
  const bx = -Math.sin(rotZ) * 0.2;
  const by = Math.cos(rotZ) * 0.2;
  box(parent, `${name}_back`, [0.42, 0.05, 0.38], [x + bx, y + by, z0 + 0.68], m, rotZ);
}

function roundTable(parent: THREE.Object3D, name: string, x: number, y: number, z0: number, plan: Plan) {
  cylinder(parent, `${name}_leg`, 0.04, 0.72, [x, y, z0 + 0.36], mat("Chrome", plan), 12);
  cylinder(parent, `${name}_top`, 0.4, 0.03, [x, y, z0 + 0.73], mat("TableTop", plan), 32);
}

// Deterministic leafy blob: icosphere with hashed bumps
function leafBlob(r: number, seed: number) {
  const g = new THREE.IcosahedronGeometry(r, 3);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
    const h = Math.sin(v.x * 12.9898 * 3 + v.y * 78.233 * 2 + v.z * 37.719 + seed) * 43758.5453;
    const k = 1 + ((h - Math.floor(h)) - 0.5) * 0.35;
    v.multiplyScalar(k);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

function plant(parent: THREE.Object3D, name: string, x: number, y: number, z0: number, size: number, kind: string, pot: Rgb, plan: Plan, seed = 0) {
  cylinder(parent, `${name}_pot`, 0.18 * size, 0.38 * size, [x, y, z0 + 0.19 * size], colourMat("Pot", pot), 24, 0.22 * size);
  const blobs: [number, number, number, number][] = kind === "tree" ? [[0, 0, 0.9, 0.3], [0.12, 0.08, 1.35, 0.26], [-0.1, -0.06, 1.7, 0.22]] : [[0, 0, 0.62, 0.32]];
  blobs.forEach(([dx, dy, dz, r], i) => {
    const mesh = new THREE.Mesh(leafBlob(r * size, seed + i * 3.1 + x * 7 + y * 3), mat("Leaf", plan));
    mesh.name = `${name}_leaf${i}`;
    mesh.position.set(x + dx * size, y + dy * size, z0 + dz * size);
    mesh.castShadow = true;
    parent.add(mesh);
  });
  if (kind === "tree") cylinder(parent, `${name}_trunk`, 0.03 * size, 1.2 * size, [x, y, z0 + 0.8 * size], mat("Trunk", plan), 10);
}

/* ---------------- parts ---------------- */

const finishMat = (f: string): MatName => (f === "wood" ? "Oak" : "Laminate");
const ledMat = (c: string): MatName => (c === "dots" ? "LEDRibbon" : c === "dots_ice" ? "LEDIce" : "Screen");

export function buildPart(part: Part, ctx: BuildCtx): THREE.Group {
  const { plan, ph } = ctx;
  const p = part.p;
  const g = new THREE.Group();
  const nm = part.name || part.type;
  const M = (name: MatName) => mat(name, plan);

  switch (part.type) {
    case "block":
      box(g, nm, [n(p, "w"), n(p, "d"), n(p, "h")], [0, 0, ph + n(p, "h") / 2], M(finishMat(s(p, "finish"))));
      break;
    case "wall":
      box(g, nm, [n(p, "w"), 0.12, n(p, "h")], [0, 0, ph + n(p, "h") / 2], M(finishMat(s(p, "finish"))));
      break;
    case "curved_wall": {
      const a = n(p, "angle", 120);
      const pts = resolvePath({ kind: "arc", r: n(p, "r", 2), a0: 90 - a / 2, a1: 90 + a / 2, z0: ph }).points;
      ribbon(g, nm, pts, n(p, "h"), 0.12, M(finishMat(s(p, "finish"))), a >= 360);
      break;
    }
    case "beam":
      box(g, nm, [n(p, "w"), n(p, "depth"), n(p, "h")], [0, 0, n(p, "z")], M("Oak"));
      box(g, `${nm}_print`, [n(p, "w"), 0.02, n(p, "h") - 0.06], [0, -n(p, "depth") / 2 - 0.012, n(p, "z")], M("SkyGrassPrint"));
      break;
    case "column":
      cylinder(g, nm, 0.11, n(p, "h"), [0, 0, ph + n(p, "h") / 2], M(p.white === false ? "Chrome" : "Laminate"));
      break;
    case "door":
      box(g, nm, [n(p, "w"), 0.06, n(p, "h")], [0, -0.06, ph + n(p, "h") / 2], M("DoorWood"));
      box(g, `${nm}_handle`, [0.15, 0.04, 0.03], [0.35, -0.11, ph + 1.05], M("Chrome"));
      break;
    case "meeting_room": {
      const [w, d, h] = [n(p, "w"), n(p, "d"), n(p, "h")];
      const glass = M("Glass");
      const frame = M("Laminate");
      box(g, `${nm}_back`, [w, 0.04, h], [0, d / 2, ph + h / 2], glass);
      box(g, `${nm}_left`, [0.04, d, h], [-w / 2, 0, ph + h / 2], glass);
      box(g, `${nm}_right`, [0.04, d, h], [w / 2, 0, ph + h / 2], glass);
      const gap = 0.95;
      const side = (w - gap) / 2;
      box(g, `${nm}_frontL`, [side, 0.04, h], [-w / 2 + side / 2, -d / 2, ph + h / 2], glass);
      box(g, `${nm}_frontR`, [side, 0.04, h], [w / 2 - side / 2, -d / 2, ph + h / 2], glass);
      box(g, `${nm}_header`, [w + 0.08, d + 0.08, 0.1], [0, 0, ph + h + 0.05], frame);
      for (const [cx, cy] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) box(g, `${nm}_post`, [0.08, 0.08, h], [cx, cy, ph + h / 2], frame);
      roundTable(g, `${nm}_table`, 0, 0, ph, plan);
      for (let i = 0; i < 4; i++) {
        const a = (Math.PI / 2) * i + Math.PI / 4;
        chair(g, `${nm}_chair${i}`, 0.75 * Math.cos(a), 0.75 * Math.sin(a), ph, a - Math.PI / 2, [0.92, 0.92, 0.93], plan);
      }
      break;
    }
    case "led_panel": {
      const [w, h, z] = [n(p, "w"), n(p, "h"), n(p, "z")];
      if (p.frame) box(g, `${nm}_frame`, [w + 0.3, 0.2, h + 0.3], [0, 0.12, z], M("Laminate"));
      box(g, nm, [w, 0.08, h], [0, 0, z], M(ledMat(s(p, "content", "screen"))));
      break;
    }
    case "led_ribbon": {
      const { points } = resolvePath(p, ph);
      ribbon(g, nm, points, n(p, "height"), 0.12, M("LEDRibbon"), false);
      break;
    }
    case "white_band": {
      const { points, closed } = resolvePath(p, ph);
      ribbon(g, nm, points, n(p, "height"), 0.16, M("BandWhite"), closed);
      break;
    }
    case "floor_arc": {
      const { points } = resolvePath({ ...p, onFloor: true }, ph);
      ribbon(g, nm, points, 0.012, 0.05, M("Glow"), false);
      break;
    }
    case "tv": {
      const [w, h, z] = [n(p, "w"), n(p, "h"), n(p, "z")];
      box(g, `${nm}_bezel`, [w + 0.06, 0.05, h + 0.06], [0, 0.01, z], M("Bezel"));
      box(g, nm, [w, 0.05, h], [0, -0.01, z], M("Screen"));
      break;
    }
    case "totem":
      box(g, `${nm}_body`, [0.65, 0.35, 2], [0, 0, ph + 1], M("KioskWhite"));
      box(g, `${nm}_screen`, [0.52, 0.02, 0.95], [0, -0.18, ph + 1.2], M("Screen"));
      break;
    case "touch_table":
      box(g, `${nm}_base`, [1.1, 0.7, 0.85], [0, 0, ph + 0.425], M("KioskWhite"));
      box(g, `${nm}_screen`, [1.0, 0.6, 0.03], [0, 0, ph + 0.87], M("Screen"), 0, (-8 * Math.PI) / 180);
      break;
    case "slat_wall": {
      const [w, h] = [n(p, "w"), n(p, "h")];
      const count = Math.floor(w / 0.18);
      for (let i = 0; i < count; i++) box(g, `${nm}_${i}`, [0.06, 0.1, h], [-w / 2 + i * 0.18 + 0.03, 0, ph + h / 2], M("SlatBlack"));
      if (p.backlit) box(g, `${nm}_backlight`, [w, 0.03, h - 0.2], [0, 0.13, ph + h / 2], M("Glow"));
      break;
    }
    case "bamboo_panel": {
      const [w, h] = [n(p, "w"), n(p, "h")];
      box(g, `${nm}_back`, [w + 0.2, 0.04, h + 0.2], [0, 0.05, ph + 0.4 + h / 2], M("BambooBack"));
      const count = Math.floor(w / 0.11);
      for (let i = 0; i < count; i++) cylinder(g, `${nm}_${i}`, 0.04, h, [-w / 2 + 0.05 + i * 0.11, 0, ph + 0.4 + h / 2], M("Bamboo"), 10);
      break;
    }
    case "moss_panel":
      box(g, nm, [n(p, "w"), 0.06, n(p, "h")], [0, 0, n(p, "z")], M("Moss"));
      break;
    case "graphic_panel": {
      const c = s(p, "color", "#1f4fd8").replace("#", "");
      const rgb: Rgb = [parseInt(c.slice(0, 2), 16) / 255, parseInt(c.slice(2, 4), 16) / 255, parseInt(c.slice(4, 6), 16) / 255];
      box(g, `${nm}_frame`, [n(p, "w"), 0.06, n(p, "h")], [0, 0.01, n(p, "z")], M("Laminate"));
      box(g, nm, [n(p, "w") - 0.08, 0.01, n(p, "h") - 0.08], [0, -0.026, n(p, "z")], colourMat("Graphic", rgb, { roughness: 0.6 }));
      break;
    }
    case "grass_patch":
      box(g, nm, [n(p, "w"), n(p, "d"), 0.014], [0, 0, ph + 0.007], M("GrassCarpet"));
      break;
    case "grass_strip":
      box(g, nm, [n(p, "w"), n(p, "depth"), 0.14], [0, 0, n(p, "z")], M("GrassTop"));
      break;
    case "text":
      textPlane(g, nm, s(p, "body"), n(p, "size", 0.5), [0, 0, n(p, "z")], s(p, "style", "white_glow"), ctx);
      break;
    case "counter": {
      const w = n(p, "w", 2.4);
      box(g, `${nm}_body`, [w, 0.7, 1.05], [0, 0, ph + 0.525], M("CounterWhite"));
      box(g, `${nm}_glow`, [w * 0.96, 0.72, 0.04], [0, 0, ph + 0.08], M("Glow"));
      textPlane(g, `${nm}_label`, s(p, "label"), 0.16, [0, -0.36, ph + 0.62], "ink", ctx);
      break;
    }
    case "lounge": {
      const seats = n(p, "seats", 4);
      roundTable(g, `${nm}_t`, 0, 0, ph, plan);
      for (let i = 0; i < seats; i++) {
        const a = (2 * Math.PI * i) / seats;
        chair(g, `${nm}_c${i}`, 0.85 * Math.cos(a), 0.85 * Math.sin(a), ph, a - Math.PI / 2, [0.92, 0.92, 0.93], plan);
      }
      break;
    }
    case "sofa": {
      const w = n(p, "w", 1.8);
      const m = colourMat("Sofa", [0.95, 0.68, 0.12], { roughness: 0.7 });
      box(g, `${nm}_seat`, [w, 0.8, 0.42], [0, 0, ph + 0.21], m);
      box(g, `${nm}_back`, [w, 0.18, 0.5], [0, 0.32, ph + 0.62], m);
      break;
    }
    case "seating_rows": {
      const [rows, cols, dx, dy] = [n(p, "rows"), n(p, "cols"), n(p, "dx"), n(p, "dy")];
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) chair(g, `${nm}_${r}_${c}`, -((cols - 1) * dx) / 2 + c * dx, ((rows - 1) * dy) / 2 - r * dy, ph, Math.PI, [0.12, 0.14, 0.2], plan);
      break;
    }
    case "high_table": {
      cylinder(g, `${nm}_leg`, 0.05, 1.05, [0, 0, ph + 0.525], M("Chrome"), 12);
      cylinder(g, `${nm}_top`, 0.35, 0.03, [0, 0, ph + 1.07], M("TableTop"), 32);
      const stools = n(p, "stools", 3);
      for (let i = 0; i < stools; i++) {
        const a = (2 * Math.PI * i) / Math.max(stools, 1);
        const [x, y] = [0.6 * Math.cos(a), 0.6 * Math.sin(a)];
        cylinder(g, `${nm}_stem${i}`, 0.025, 0.72, [x, y, ph + 0.36], M("Chrome"), 10);
        cylinder(g, `${nm}_stool${i}`, 0.18, 0.05, [x, y, ph + 0.74], colourMat("Chair", [0.12, 0.14, 0.2]), 20);
      }
      break;
    }
    case "plant":
      plant(g, nm, 0, 0, ph, n(p, "size", 1), s(p, "kind", "bush"), [0.88, 0.88, 0.86], plan);
      break;
    case "plant_row": {
      const [w, count] = [n(p, "w"), n(p, "count")];
      for (let i = 0; i < count; i++) plant(g, `${nm}_${i}`, -w / 2 + (w * i) / Math.max(count - 1, 1), 0, ph, n(p, "size", 0.7), "bush", [0.35, 0.36, 0.38], plan, i);
      break;
    }
    case "hanging_plants": {
      const [w, count, z] = [n(p, "w"), n(p, "count"), n(p, "z")];
      for (let i = 0; i < count; i++) {
        const x = -w / 2 + (w * i) / Math.max(count - 1, 1);
        cylinder(g, `${nm}_wire${i}`, 0.006, 0.45, [x, 0, z + 0.62], M("Wire"), 6);
        plant(g, `${nm}_${i}`, x, 0, z, 0.42, "bush", [0.95, 0.95, 0.95], plan, i);
      }
      break;
    }
    case "roof_planters": {
      const [w, d, nx, ny, z] = [n(p, "w"), n(p, "d"), n(p, "nx"), n(p, "ny"), n(p, "z")];
      for (let i = 0; i < nx; i++)
        for (let j = 0; j < ny; j++) {
          const x = -w / 2 + (w * i) / Math.max(nx - 1, 1);
          const y = -d / 2 + (d * j) / Math.max(ny - 1, 1);
          box(g, `${nm}_planter${i}${j}`, [0.55, 0.55, 0.25], [x, y, z + 0.125], M("Laminate"));
          plant(g, `${nm}_${i}${j}`, x, y, z + 0.05, 0.42, "bush", [0.95, 0.95, 0.95], plan, i * 10 + j);
        }
      break;
    }
  }
  g.name = nm;
  g.position.set(part.x, part.y, 0);
  g.rotation.z = (part.rot * Math.PI) / 180;
  g.userData = { partId: part.id, partType: part.type };
  return g;
}

export function buildPlatform(plan: Plan): THREE.Group {
  const g = new THREE.Group();
  g.name = "Platform";
  const [w, d] = plan.size;
  const h = plan.platform.height;
  box(g, "Platform", [w, d, h], [0, 0, h / 2], mat(plan.platform.finish === "wood" ? "FloorOak" : "PlatformWhite", plan));
  if (plan.platform.edgeLight) {
    const em = mat("EdgeLight", plan);
    const t = 0.03;
    box(g, "EdgeF", [w, t, 0.03], [0, -d / 2 - t / 2, h * 0.5], em);
    box(g, "EdgeB", [w, t, 0.03], [0, d / 2 + t / 2, h * 0.5], em);
    box(g, "EdgeL", [t, d, 0.03], [-w / 2 - t / 2, 0, h * 0.5], em);
    box(g, "EdgeR", [t, d, 0.03], [w / 2 + t / 2, 0, h * 0.5], em);
  }
  return g;
}

// Whole booth for export (GLB → Blender). Root is rotated to three's Y-up.
export function buildBooth(plan: Plan, font: string): THREE.Group {
  const root = new THREE.Group();
  root.name = plan.name;
  root.rotation.x = -Math.PI / 2;
  const ctx: BuildCtx = { plan, ph: plan.platform.height, font };
  root.add(buildPlatform(plan));
  for (const part of plan.parts) root.add(buildPart(part, ctx));
  return root;
}
