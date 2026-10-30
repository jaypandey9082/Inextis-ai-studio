import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NewBoothForm } from "@/components/new-booth-form";
import { PageHeader } from "@/components/ui";

export default function NewBoothPage() {
  return (
    <>
      <Link href="/booths" className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
        <ArrowLeft size={14} /> All booths
      </Link>
      <PageHeader eyebrow="3D Booth Studio" title="New booth" subtitle="Describe the booth. Claude plans the zones, places parts from the Inextis library within the size and height limits, and prices it. You then edit it in 3D." />
      <NewBoothForm />
    </>
  );
}
