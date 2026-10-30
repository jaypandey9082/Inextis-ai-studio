// Runs Blender in the background to render a booth. One job at a time; status is
// kept in memory and mirrored to status.json so a page reload can pick it up.

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { getProject, projectPaths, updateProject } from "./projects";
import type { Plan, View } from "./schema";

export type JobStatus = {
  id: string;
  projectId: string;
  quality: "draft" | "final";
  state: "queued" | "running" | "done" | "error";
  progress: string;
  done: number;
  total: number;
  images: string[];
  files: string[];
  seconds?: number;
  error?: string;
  startedAt: string;
};

const jobs = new Map<string, JobStatus>();
const queue: (() => Promise<void>)[] = [];
let running = false;

const ROOT = process.cwd();
const SCRIPT = path.resolve(ROOT, "../booth_demo/render_glb.py");
const toUrl = (abs: string) => "/" + path.relative(path.join(ROOT, "public"), abs).split(path.sep).join("/");

async function pump() {
  if (running) return;
  const next = queue.shift();
  if (!next) return;
  running = true;
  try {
    await next();
  } finally {
    running = false;
    pump();
  }
}

export function blenderPath() {
  return process.env.BLENDER_PATH || "";
}

export async function startRender(projectId: string, glb: Buffer, plan: Plan, quality: "draft" | "final", views: View[], version: number | null) {
  const id = `r${Date.now().toString(36)}`;
  const work = path.join(projectPaths.data(projectId), "jobs", id);
  const out = path.join(projectPaths.pub(projectId), "renders", id);
  await fs.mkdir(work, { recursive: true });
  await fs.mkdir(out, { recursive: true });
  await fs.writeFile(path.join(work, "scene.glb"), glb);
  const job = {
    glb: path.join(work, "scene.glb"),
    out,
    name: plan.name.replace(/[^a-z0-9_-]/gi, "_"),
    quality,
    size: plan.size,
    palette: plan.palette,
    accent: plan.platform.accent,
    lighting: plan.lighting,
    views,
  };
  await fs.writeFile(path.join(work, "job.json"), JSON.stringify(job, null, 1));
  const status: JobStatus = { id, projectId, quality, state: "queued", progress: "Waiting for Blender", done: 0, total: views.length, images: [], files: [], startedAt: new Date().toISOString() };
  jobs.set(id, status);

  queue.push(
    () =>
      new Promise<void>((resolve) => {
        status.state = "running";
        status.progress = "Starting Blender";
        const t0 = Date.now();
        const proc = spawn(/*turbopackIgnore: true*/ blenderPath(), ["-b", "--factory-startup", "-P", SCRIPT, "--", path.join(work, "job.json")], { cwd: path.dirname(SCRIPT) });
        let tail = "";
        const onData = (buf: Buffer) => {
          const text = buf.toString();
          tail = (tail + text).slice(-4000);
          for (const line of text.split("\n")) {
            if (line.startsWith("PROGRESS ")) {
              status.progress = line.replace(/^PROGRESS \d+\/\d+ /, "").replace(/^PROGRESS /, "");
              status.progress = status.progress.charAt(0).toUpperCase() + status.progress.slice(1);
            } else if (line.startsWith("RENDERED ")) {
              status.images.push(toUrl(line.slice(9).trim()));
              status.done = status.images.length;
            } else if (line.startsWith("FILES ")) {
              status.files = (JSON.parse(line.slice(6)) as string[]).map(toUrl);
            } else if (line.startsWith("MATERIALS ") || line.startsWith("TEXT ")) {
              status.progress = "Applying realistic materials";
            }
          }
        };
        proc.stdout.on("data", onData);
        proc.stderr.on("data", onData);
        proc.on("close", async (code) => {
          status.seconds = (Date.now() - t0) / 1000;
          if (code === 0 && status.images.length) {
            status.state = "done";
            status.progress = "Done";
            await updateProject(projectId, (p) => {
              p.renders.unshift({ id, version, at: new Date().toISOString(), quality, images: status.images, files: status.files, seconds: Math.round(status.seconds!) });
              if (status.images[0]) p.thumbnail = `${status.images[0]}?v=${Date.now()}`;
            });
          } else {
            status.state = "error";
            status.error = (tail.match(/FAILED (.*)/)?.[1] ?? tail.split("\n").filter(Boolean).slice(-3).join(" ")).slice(0, 300);
            status.progress = "Render failed";
          }
          await fs.writeFile(path.join(work, "status.json"), JSON.stringify(status, null, 1)).catch(() => {});
          await fs.writeFile(path.join(work, "blender.log"), tail).catch(() => {});
          resolve();
        });
        proc.on("error", (e) => {
          status.state = "error";
          status.error = e.message;
          resolve();
        });
      }),
  );
  pump();
  return status;
}

export async function getJob(projectId: string, id: string): Promise<JobStatus | null> {
  const live = jobs.get(id);
  if (live) return live;
  try {
    return JSON.parse(await fs.readFile(path.join(projectPaths.data(projectId), "jobs", id, "status.json"), "utf8")) as JobStatus;
  } catch {
    return null;
  }
}

export async function projectExists(id: string) {
  return !!(await getProject(id));
}
