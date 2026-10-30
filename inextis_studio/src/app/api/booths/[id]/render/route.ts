import fs from "node:fs";
import { blenderPath, getJob, projectExists, startRender } from "@/lib/booth/render-jobs";
import { PlanSchema, type Plan, type View } from "@/lib/booth/schema";

// Start a render: body is { glb (base64), plan, quality, views, version }
export async function POST(req: Request, ctx: RouteContext<"/api/booths/[id]/render">) {
  const { id } = await ctx.params;
  if (!blenderPath() || !fs.existsSync(blenderPath())) return Response.json({ error: "Blender isn't installed. Set BLENDER_PATH in .env.local." }, { status: 400 });
  if (!(await projectExists(id))) return Response.json({ error: "not found" }, { status: 404 });
  const body = (await req.json()) as { glb: string; plan: Plan; quality: "draft" | "final"; views: View[]; version?: number | null };
  const plan = PlanSchema.parse(body.plan) as Plan;
  const glb = Buffer.from(body.glb, "base64");
  if (glb.subarray(0, 4).toString() !== "glTF") return Response.json({ error: "invalid 3D file" }, { status: 400 });
  const views = (body.views ?? []).slice(0, 4);
  if (!views.length) return Response.json({ error: "Pick at least one view" }, { status: 400 });
  const job = await startRender(id, glb, plan, body.quality === "final" ? "final" : "draft", views, body.version ?? null);
  return Response.json(job, { status: 202 });
}

export async function GET(req: Request, ctx: RouteContext<"/api/booths/[id]/render">) {
  const { id } = await ctx.params;
  const job = new URL(req.url).searchParams.get("job") ?? "";
  const status = await getJob(id, job);
  return status ? Response.json(status) : Response.json({ error: "not found" }, { status: 404 });
}
