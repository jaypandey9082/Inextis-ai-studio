import { designBooth, type DesignInput } from "@/lib/booth/ai";
import { createProject, updateProject } from "@/lib/booth/projects";

export const maxDuration = 300;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "Add ANTHROPIC_API_KEY to .env.local to design booths with AI." }, { status: 400 });
  const body = (await req.json()) as Partial<DesignInput>;
  const brief = (body.brief ?? "").trim();
  if (brief.length < 10) return Response.json({ error: "Please describe the booth in a sentence or two." }, { status: 400 });
  const input: DesignInput = {
    client: (body.client ?? "").slice(0, 80),
    title: (body.title ?? "").slice(0, 80),
    brief: brief.slice(0, 4000),
    w: Math.min(Math.max(Number(body.w) || 9, 3), 40),
    d: Math.min(Math.max(Number(body.d) || 6, 3), 40),
    openSides: body.openSides?.length ? body.openSides : ["front"],
    heightLimit: Math.min(Math.max(Number(body.heightLimit) || 4, 2.5), 12),
    brandColours: (body.brandColours ?? []).slice(0, 3),
    images: (body.images ?? []).slice(0, 3).filter((im) => ["image/jpeg", "image/png", "image/webp"].includes(im.mediaType) && im.data.length < 7_000_000),
  };
  try {
    const result = await designBooth(input);
    const project = await createProject(input.client, result.plan);
    await updateProject(project.id, (p) => {
      p.versions.push({ n: 1, label: "AI concept", at: new Date().toISOString(), total: Math.round(result.total), plan: p.plan });
    });
    return Response.json({ id: project.id, concept: result.concept, issues: result.issues, usage: result.usage });
  } catch (e) {
    console.error("[ai] design failed", e);
    return Response.json({ error: e instanceof Error ? e.message : "Design failed" }, { status: 500 });
  }
}
