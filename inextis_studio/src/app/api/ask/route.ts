import { approvals, coverage, fy, pipeline, receivables, remainingTarget, repliesWaiting } from "@/lib/business";
import { BUSINESS_CONTEXT, askClaude, liveAI } from "@/lib/claude";

const prepared: [RegExp, string][] = [
  [
    /expo|show|focus|event|season/i,
    `Focus on India Energy Week 2027 (Kolkata, 28–31 Jan), then Bharat Mobility (4–9 Feb). Jan–Mar carries ₹${fy.seasonTarget} Cr of this year's target but only ₹${fy.seasonForecast} Cr is forecast so far. Start outreach to the 6 researched IEW companies this week.`,
  ],
  [
    /pipeline|week|sales|summar|target|revenue/i,
    `Revenue is ₹${fy.booked} Cr against ₹${fy.targetToDate} Cr planned to date (${fy.toDatePct}%). Open pipeline is ₹${pipeline.open} Cr (₹${pipeline.weighted} Cr weighted), ${coverage}× the ₹${remainingTarget} Cr still to win. ${repliesWaiting.length} hot replies need answers today.`,
  ],
  [
    /proposal|approv|need me|attention|cash|money|collect/i,
    `Approve ${approvals.map((d) => `${d.client} (₹${d.value} Cr)`).join(" and ")}. ${receivables.overdue[0] ? `Ask Finance to chase ${receivables.overdue[0].client}: ₹${receivables.overdue[0].amount} Cr unpaid for ${receivables.overdue[0].days} days.` : ""} Aurora Lubricants wants concepts by Friday.`,
  ],
];

export async function POST(req: Request) {
  const { question } = (await req.json()) as { question?: string };
  const q = (question ?? "").slice(0, 500);

  if (liveAI) {
    try {
      return Response.json({ answer: await askClaude(BUSINESS_CONTEXT, q), live: true });
    } catch {
      // fall through to the prepared answer
    }
  }
  const match = prepared.find(([re]) => re.test(q));
  const answer =
    match?.[1] ??
    "In this demo I can answer questions about the pipeline, proposals and upcoming expos. Connect a Claude API key to ask anything about the business.";
  await new Promise((r) => setTimeout(r, 650));
  return Response.json({ answer, live: false });
}
