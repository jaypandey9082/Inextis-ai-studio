import { z } from "zod";
import { liveAI, parseWithClaude } from "@/lib/claude";

const Result = z.object({
  label: z.enum(["Interested", "Not now", "Wrong person", "Not interested"]),
  next_step: z.string(),
  reason: z.string(),
});

const SYSTEM = `You classify replies to sales outreach from Inextis Events, an Indian exhibition stand and event agency.
Pick one label: Interested, Not now, Wrong person, Not interested.
next_step: one short, concrete action for the BD team (under 20 words).
reason: under 15 words.`;

function fallback(text: string): z.infer<typeof Result> {
  const t = text.toLowerCase();
  if (/(not the right|wrong person|reach out to|contact (our|my)|forward(ed)? (this|it) to|handles this)/.test(t))
    return { label: "Wrong person", next_step: "Ask for the right contact's name and write to them, mentioning the referral.", reason: "They pointed to someone else." };
  if (/(not interested|no thanks|unsubscribe|remove me|already have)/.test(t))
    return { label: "Not interested", next_step: "Thank them, close the lead, and stop the sequence.", reason: "Clear no or an existing vendor." };
  if (/(later|next (quarter|year|month)|after|budget|not now|circle back|q[1-4])/.test(t))
    return { label: "Not now", next_step: "Set a reminder for the date they gave and send a short case study then.", reason: "Timing or budget isn't right yet." };
  return { label: "Interested", next_step: "Send the 3D concept and book a 20-minute call within 48 hours.", reason: "They asked to see more or meet." };
}

export async function POST(req: Request) {
  const { text } = (await req.json()) as { text?: string };
  const reply = (text ?? "").slice(0, 2000);
  if (liveAI) {
    try {
      return Response.json({ ...(await parseWithClaude(SYSTEM, reply, Result)), live: true });
    } catch {
      // use the rule-based fallback below
    }
  }
  await new Promise((r) => setTimeout(r, 500));
  return Response.json({ ...fallback(reply), live: false });
}
