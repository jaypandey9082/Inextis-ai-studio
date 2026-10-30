import { createProject, listProjects } from "@/lib/booth/projects";
import { emptyPlan, PlanSchema, type Plan } from "@/lib/booth/schema";

export async function GET() {
  return Response.json(await listProjects());
}

type CreateBody = {
  client?: string;
  title?: string;
  brief?: string;
  w?: number;
  d?: number;
  openSides?: Plan["openSides"];
  heightLimit?: number;
  plan?: Plan;
};

export async function POST(req: Request) {
  const body = (await req.json()) as CreateBody;
  const plan = body.plan
    ? (PlanSchema.parse(body.plan) as Plan)
    : emptyPlan({
        name: "booth",
        title: body.title || `${body.client || "New"} booth`,
        brief: body.brief ?? "",
        w: Math.min(Math.max(body.w ?? 9, 2), 40),
        d: Math.min(Math.max(body.d ?? 6, 2), 40),
        openSides: body.openSides?.length ? body.openSides : ["front"],
        heightLimit: body.heightLimit ?? 4,
      });
  const project = await createProject(body.client ?? "", plan);
  return Response.json(project, { status: 201 });
}
