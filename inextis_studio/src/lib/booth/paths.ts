// Curved paths for LED ribbons, fascia bands and floor light lines, relative to
// the part's own centre. Same maths as booth_demo/build.py so lengths (and costs) match.

export type Pt = [number, number, number];
type P = Record<string, number | string | boolean>;

const num = (p: P, k: string, d = 0) => (typeof p[k] === "number" ? (p[k] as number) : d);

export function arcPoints(r: number, a0: number, a1: number, z0 = 0, z1?: number, steps = 64): Pt[] {
  const zEnd = z1 ?? z0;
  const pts: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = ((a0 + (a1 - a0) * t) * Math.PI) / 180;
    const z = z0 + (zEnd - z0) * (0.5 - 0.5 * Math.cos(Math.PI * t));
    pts.push([r * Math.cos(a), r * Math.sin(a), z]);
  }
  return pts;
}

// floorZ is used when a band has no height of its own (it sits on the platform)
export function resolvePath(p: P, floorZ = 0): { points: Pt[]; closed: boolean } {
  const kind = p.kind ?? "arc";
  const z0 = p.onFloor ? floorZ : num(p, "z0");
  const z1 = p.onFloor ? floorZ : typeof p.z1 === "number" ? (p.z1 as number) : undefined;
  if (kind === "spiral") {
    const pts: Pt[] = [];
    const steps = 96;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const ease = t * t * (3 - 2 * t);
      const a = ((num(p, "a0") + (num(p, "a1") - num(p, "a0")) * t) * Math.PI) / 180;
      const r = num(p, "r0") + (num(p, "r1") - num(p, "r0")) * ease;
      const z = z0 + ((z1 ?? z0) - z0) * ease;
      pts.push([r * Math.cos(a), r * Math.sin(a), z]);
    }
    return { points: pts, closed: false };
  }
  const closed = num(p, "a1") - num(p, "a0") >= 360;
  const pts = arcPoints(num(p, "r", 3), num(p, "a0"), num(p, "a1", 360), z0, z1, 128);
  return { points: closed ? pts.slice(0, -1) : pts, closed };
}

export function pathLength(points: Pt[]) {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay, az] = points[i - 1];
    const [bx, by, bz] = points[i];
    len += Math.hypot(bx - ax, by - ay, bz - az);
  }
  return len;
}
