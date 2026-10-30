import { editBooth } from "@/lib/booth/ai";
import { PlanSchema, type Plan } from "@/lib/booth/schema";

export const maxDuration = 120;

// Returns operations; the editor applies them so the change can be undone
export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "Add ANTHROPIC_API_KEY to .env.local to edit with AI." }, { status: 400 });
  const body = (await req.json()) as { plan: Plan; instruction: string; selectedId?: string | null };
  const instruction = (body.instruction ?? "").trim().slice(0, 1000);
  if (!instruction) return Response.json({ error: "Type what you'd like to change." }, { status: 400 });
  try {
    const plan = PlanSchema.parse(body.plan) as Plan;
    return Response.json(await editBooth(plan, instruction, body.selectedId));
  } catch (e) {
    console.error("[ai] edit failed", e);
    return Response.json({ error: e instanceof Error ? e.message : "Edit failed" }, { status: 500 });
  }
}
