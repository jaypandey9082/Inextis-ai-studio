import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Box, Layers } from "lucide-react";
import { BriefFlow } from "@/components/brief-flow";
import { PageHeader } from "@/components/ui";
import { listProjects } from "@/lib/booth/projects";

export default function BoothsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Problem 1 · AI 3D booth design"
        title="3D Booth Studio"
        subtitle="Describe a booth and Claude designs it from the Inextis parts library. Every part is a real 3D object with real sizes: edit it in the browser, see the cost update, and render it in Blender."
      />
      <BriefFlow />
      <div className="mb-4 mt-10 flex items-center justify-between">
        <h2 className="eyebrow">Booth projects</h2>
      </div>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-[20px] bg-sunken" />}>
        <ProjectGrid />
      </Suspense>
    </>
  );
}

async function ProjectGrid() {
  await connection();
  const projects = await listProjects();
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {projects.map((p) => (
        <Link key={p.id} href={`/booths/${p.id}`} className="card group overflow-hidden transition-colors hover:border-ink">
          <div className="relative aspect-[16/10] overflow-hidden bg-ink">
            {p.thumbnail ? (
              <Image src={p.thumbnail} alt={p.title} fill unoptimized sizes="(min-width: 1280px) 33vw, 50vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
            ) : (
              <div className="grid h-full place-items-center text-white/30">
                <Box size={32} />
              </div>
            )}
          </div>
          <div className="flex items-end justify-between gap-4 p-5">
            <div className="min-w-0">
              <div className="truncate text-[15px] font-medium">{p.title}</div>
              <div className="mt-0.5 truncate text-[12.5px] text-muted">
                {p.client || "No client"} · {p.size[0]} × {p.size[1]} m · {p.parts} parts
              </div>
              <div className="mt-1 flex items-center gap-1 text-[11.5px] text-muted">
                <Layers size={12} /> {p.versions} {p.versions === 1 ? "version" : "versions"} · edited {new Date(p.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[11px] text-muted">incl. GST</div>
              <div className="num text-[20px] font-light">₹{(p.total / 100000).toFixed(1)} L</div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
