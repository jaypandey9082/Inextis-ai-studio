import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { BoothEditor } from "@/components/booth-editor/editor";
import { getProject } from "@/lib/booth/projects";

export default function BoothEditorPage({ params }: PageProps<"/booths/[id]">) {
  return (
    <Suspense fallback={<div className="h-[70vh] animate-pulse rounded-[24px] bg-sunken" />}>
      <EditorLoader params={params} />
    </Suspense>
  );
}

async function EditorLoader({ params }: { params: PageProps<"/booths/[id]">["params"] }) {
  await connection();
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();
  return <BoothEditor initial={project} />;
}
