import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { businessSummary } from "@/lib/business";

export const MODEL = "claude-opus-5-5";

// Live AI only runs when a key is configured; otherwise routes use prepared answers.
export const liveAI = Boolean(process.env.ANTHROPIC_API_KEY);

let client: Anthropic | null = null;
function getClient() {
  client ??= new Anthropic();
  return client;
}

export const BUSINESS_CONTEXT = `You are the AI assistant inside Inextis AI Studio, built for Dhruv, CEO of Inextis Events (an Indian exhibition stand and event agency; past booths include HPCL, EIL and Nayara). Today is 29 Oct 2026.
Current business state (sample demo data, ₹ crore):
${businessSummary()}
Upcoming expos: India Energy Week 2027, Kolkata, 28–31 Jan 2027 (42 exhibitor targets, 6 researched); Bharat Mobility Global Expo 2027, New Delhi, 4–9 Feb 2027 (35 targets, 5 researched); ELECRAMA 2027 and REI Expo 2027 dates TBC.
Answer in 2–4 short sentences or bullets, plain text, no markdown headings. Be specific, use the numbers, and say what to do next.`;

export async function askClaude(system: string, question: string): Promise<string> {
  const response = await getClient().beta.messages.create({
    model: MODEL,
    max_tokens: 2000,
    output_config: { effort: "low" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system,
    messages: [{ role: "user", content: question }],
  });
  if (response.stop_reason === "refusal") throw new Error("refused");
  return response.content
    .flatMap((b) => (b.type === "text" ? [b.text] : []))
    .join("")
    .trim();
}

export async function parseWithClaude<T extends z.ZodType>(system: string, input: string, schema: T): Promise<z.infer<T>> {
  const response = await getClient().messages.parse({
    model: MODEL,
    max_tokens: 2000,
    output_config: { effort: "low", format: zodOutputFormat(schema) },
    system,
    messages: [{ role: "user", content: input }],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) throw new Error("no output");
  return response.parsed_output;
}
