import { companies, draftMessages } from "@/data/companies";
import { expos } from "@/data/expos";
import { askClaude, liveAI } from "@/lib/claude";

const SYSTEM = `You write short B2B outreach for Inextis Events, an Indian exhibition stand and event agency (past pavilions for HPCL, EIL, Nayara).
Write one message in the requested channel. Warm, specific, no hype, no emojis, Indian business English.
LinkedIn: under 280 characters. WhatsApp: under 200 characters. Email: start with "Subject: ..." on the first line, then a body under 120 words.
Never invent facts about the company beyond what you're given. Sign off as "Business Development, Inextis Events".`;

export async function POST(req: Request) {
  const { companyId, channel } = (await req.json()) as { companyId: string; channel: "linkedin" | "email" | "whatsapp" };
  const company = companies.find((c) => c.id === companyId);
  if (!company) return Response.json({ error: "unknown company" }, { status: 404 });
  const expo = expos.find((e) => e.id === company.expo)!;

  if (liveAI) {
    try {
      const facts = `Company: ${company.name} (${company.sector}, ${company.hq}). What they do: ${company.what}
Public signal: ${company.signal}
Expo: ${expo.name}, ${expo.city}, ${expo.dates}.
Likely booth needs: ${company.needs}
Similar Inextis work: ${company.similar}.
Channel: ${channel}. Write a fresh variation.`;
      return Response.json({ text: await askClaude(SYSTEM, facts), live: true });
    } catch {
      // fall back to the template
    }
  }
  const d = draftMessages(company, expo.short);
  const text = channel === "email" ? `Subject: ${d.email.subject}\n\n${d.email.body}` : d[channel];
  await new Promise((r) => setTimeout(r, 500));
  return Response.json({ text, live: false });
}
