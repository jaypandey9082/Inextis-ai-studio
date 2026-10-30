// Booth projects are stored as JSON files: data/projects/<id>/project.json.
// Renders and thumbnails live under public/projects/<id>/ so the browser can load them.

import fs from "node:fs/promises";
import path from "node:path";
import { price } from "./costing";
import { PlanSchema, type Plan } from "./schema";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "data/projects");
const PUB = path.join(ROOT, "public/projects");
const TEMPLATES = path.join(ROOT, "data/templates");

export type Version = { n: number; label: string; at: string; total: number; plan: Plan };
export type Render = { id: string; version: number | null; at: string; quality: "draft" | "final"; images: string[]; files: string[]; seconds?: number };
export type Project = {
  id: string;
  client: string;
  createdAt: string;
  updatedAt: string;
  plan: Plan;
  versions: Version[];
  renders: Render[];
  thumbnail?: string;
};

export type ProjectSummary = Pick<Project, "id" | "client" | "updatedAt" | "thumbnail"> & { title: string; size: [number, number]; total: number; parts: number; versions: number };

const file = (id: string) => path.join(DATA, id, "project.json");
const safeId = (id: string) => /^[a-z0-9-]+$/.test(id);

async function seedTemplates() {
  await fs.mkdir(DATA, { recursive: true });
  const existing = new Set(await fs.readdir(DATA));
  const seeds = [
    { id: "nova-tech-pavilion", file: "nova_tech_pavilion", client: "NOVA Energy" },
    { id: "greenleaf-eco-pavilion", file: "greenleaf_eco_pavilion", client: "GreenLeaf Fuels" },
  ];
  for (const s of seeds) {
    if (existing.has(s.id)) continue;
    const plan = PlanSchema.parse(JSON.parse(await fs.readFile(path.join(TEMPLATES, `${s.file}.json`), "utf8"))) as Plan;
    const now = new Date().toISOString();
    const project: Project = {
      id: s.id,
      client: s.client,
      createdAt: now,
      updatedAt: now,
      plan,
      versions: [{ n: 1, label: "Original concept", at: now, total: Math.round(price(plan).total), plan }],
      renders: [{ id: "original", version: 1, at: now, quality: "final", images: [`/booths/${s.file}_aerial.jpg`, `/booths/${s.file}_front.jpg`], files: [`/booths/${s.file}.glb`] }],
      thumbnail: `/booths/${s.file}_aerial.jpg`,
    };
    await writeProject(project);
  }
}

async function writeProject(p: Project) {
  await fs.mkdir(path.dirname(file(p.id)), { recursive: true });
  const tmp = `${file(p.id)}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(p, null, 1));
  await fs.rename(tmp, file(p.id));
}

export async function listProjects(): Promise<ProjectSummary[]> {
  await seedTemplates();
  const ids = (await fs.readdir(DATA)).filter(safeId);
  const out: ProjectSummary[] = [];
  for (const id of ids) {
    const p = await getProject(id);
    if (!p) continue;
    out.push({ id, client: p.client, updatedAt: p.updatedAt, thumbnail: p.thumbnail, title: p.plan.title, size: p.plan.size, total: Math.round(price(p.plan).total), parts: p.plan.parts.length, versions: p.versions.length });
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getProject(id: string): Promise<Project | null> {
  if (!safeId(id)) return null;
  await seedTemplates();
  try {
    return JSON.parse(await fs.readFile(file(id), "utf8")) as Project;
  } catch {
    return null;
  }
}

export async function createProject(client: string, plan: Plan): Promise<Project> {
  await seedTemplates();
  const base = (client || plan.title || "booth").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "booth";
  const id = `${base}-${Date.now().toString(36).slice(-4)}`;
  const now = new Date().toISOString();
  const project: Project = { id, client, createdAt: now, updatedAt: now, plan: { ...plan, name: id }, versions: [], renders: [] };
  await writeProject(project);
  return project;
}

export async function updateProject(id: string, change: (p: Project) => void | Promise<void>): Promise<Project | null> {
  const p = await getProject(id);
  if (!p) return null;
  await change(p);
  p.updatedAt = new Date().toISOString();
  await writeProject(p);
  return p;
}

export async function savePlan(id: string, plan: Plan, thumbnailDataUrl?: string) {
  const parsed = PlanSchema.parse(plan) as Plan;
  return updateProject(id, async (p) => {
    p.plan = parsed;
    if (thumbnailDataUrl?.startsWith("data:image/jpeg;base64,")) {
      const dir = path.join(PUB, id);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, "thumb.jpg"), Buffer.from(thumbnailDataUrl.split(",")[1], "base64"));
      p.thumbnail = `/projects/${id}/thumb.jpg?v=${Date.now()}`;
    }
  });
}

export async function saveVersion(id: string, label: string) {
  return updateProject(id, (p) => {
    const n = (p.versions.at(-1)?.n ?? 0) + 1;
    p.versions.push({ n, label: label || `Version ${n}`, at: new Date().toISOString(), total: Math.round(price(p.plan).total), plan: p.plan });
  });
}

export const projectPaths = { data: (id: string) => path.join(DATA, id), pub: (id: string) => path.join(PUB, id) };
