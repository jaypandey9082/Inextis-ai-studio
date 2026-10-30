import { getProject, savePlan, saveVersion } from "@/lib/booth/projects";
import type { Plan } from "@/lib/booth/schema";

export async function GET(_req: Request, ctx: RouteContext<"/api/booths/[id]">) {
  const { id } = await ctx.params;
  const project = await getProject(id);
  return project ? Response.json(project) : Response.json({ error: "not found" }, { status: 404 });
}

// Save the current plan (autosave), optionally with a thumbnail and/or as a named version
export async function PUT(req: Request, ctx: RouteContext<"/api/booths/[id]">) {
  const { id } = await ctx.params;
  const body = (await req.json()) as { plan: Plan; thumbnail?: string; version?: string };
  try {
    let project = await savePlan(id, body.plan, body.thumbnail);
    if (project && body.version !== undefined) project = await saveVersion(id, body.version);
    return project ? Response.json(project) : Response.json({ error: "not found" }, { status: 404 });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "invalid plan" }, { status: 400 });
  }
}
