import Link from "next/link";
import { ArrowRight, MessageSquareText, MousePointer2, Sparkles, Wand2 } from "lucide-react";

const steps = [
  { icon: MessageSquareText, title: "Describe", text: "Brief, size, open sides, brand colours and reference images" },
  { icon: Sparkles, title: "Claude designs", text: "Zones first, then parts from the Inextis library, priced" },
  { icon: MousePointer2, title: "Edit in 3D", text: "Drag, resize, swap materials, or ask in plain English" },
  { icon: Wand2, title: "Render", text: "Blender renders it; download files for Blender or 3ds Max" },
];

export function BriefFlow() {
  return (
    <div className="card relative overflow-hidden p-6 lg:p-7">
      <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {steps.map(({ icon: Icon, title, text }, i) => (
            <div key={title} className="flex gap-3">
              <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${i === 1 ? "bg-accent text-white" : "bg-sunken text-ink-2"}`}>
                <Icon size={16} />
              </span>
              <div>
                <div className="text-[14px] font-medium">{title}</div>
                <div className="text-[12.5px] leading-snug text-muted">{text}</div>
              </div>
            </div>
          ))}
        </div>
        <Link href="/booths/new" className="btn btn-accent !px-6 !py-3 text-[14px]">
          New booth <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
