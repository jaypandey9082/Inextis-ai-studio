import { Suspense } from "react";
import { LeadEngine } from "@/components/lead-engine";
import { PageHeader } from "@/components/ui";

export default function LeadsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Problem 2 · LinkedIn-safe lead generation"
        title="Lead Engine"
        subtitle="AI finds expo exhibitors, researches each company from public sources and drafts every message. A person sends on LinkedIn with one click; email and WhatsApp follow-ups can run on their own."
      />
      <Suspense fallback={<div className="h-[60vh] animate-pulse rounded-[24px] bg-sunken" />}>
        <LeadEngine />
      </Suspense>
    </>
  );
}
