"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Box, LayoutGrid, MonitorPlay, Target } from "lucide-react";

const items = [
  { href: "/", label: "Overview", short: "Home", icon: LayoutGrid },
  { href: "/booths", label: "3D Booth Studio", short: "Booths", icon: Box },
  { href: "/leads", label: "Lead Engine", short: "Leads", icon: Target },
  { href: "/screens", label: "Screen Adapter", short: "Screens", icon: MonitorPlay },
] as const;

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path.startsWith(href);
}

export function Nav() {
  const path = usePathname();
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[248px] flex-col border-r border-line bg-surface">
        <Link href="/" className="flex items-center gap-3 px-7 pt-8 pb-10">
          <Image src="/brand/mark.png" alt="" width={22} height={50} className="h-[46px] w-auto" priority />
          <div>
            <Image src="/brand/wordmark.png" alt="Inextis Events" width={150} height={13} className="h-[11px] w-auto" priority />
            <div className="eyebrow mt-2 !text-[9.5px] !tracking-[0.3em]">AI Studio</div>
          </div>
        </Link>

        <nav className="flex flex-col gap-1 px-4">
          {items.map(({ href, label, icon: Icon }) => {
            const active = isActive(path, href);
            return (
              <Link
                key={href}
                href={href}
                className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] transition-colors ${
                  active ? "bg-sunken text-ink font-medium" : "text-ink-2 hover:bg-sunken/60 hover:text-ink"
                }`}
              >
                <Icon size={17} strokeWidth={active ? 2 : 1.6} />
                {label}
                {active && <span className="ml-auto size-[7px] rounded-full bg-accent" />}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto px-4 pb-6">
          <div className="rounded-2xl border border-line p-4">
            <div className="flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-full bg-ink text-[13px] font-medium text-white">D</div>
              <div className="leading-tight">
                <div className="text-[13px] font-medium">Dhruv</div>
                <div className="text-[12px] text-muted">CEO, Inextis Events</div>
              </div>
            </div>
            <p className="mt-3 text-[11.5px] leading-relaxed text-muted">
              Demo build. Numbers marked <span className="text-ink-2">Demo data</span> are samples.
            </p>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between border-b border-line bg-canvas/85 px-4 py-3 backdrop-blur">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/brand/mark.png" alt="" width={14} height={32} className="h-7 w-auto" />
          <Image src="/brand/wordmark.png" alt="Inextis Events" width={120} height={11} className="h-[9px] w-auto" />
        </Link>
        <div className="grid size-8 place-items-center rounded-full bg-ink text-[12px] font-medium text-white">D</div>
      </header>

      {/* Mobile bottom tabs */}
      <nav className="lg:hidden fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-surface/95 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 backdrop-blur">
        {items.map(({ href, short, icon: Icon }) => {
          const active = isActive(path, href);
          return (
            <Link key={href} href={href} className={`flex flex-col items-center gap-1 py-1 text-[11px] ${active ? "text-ink font-medium" : "text-muted"}`}>
              <span className="relative">
                <Icon size={20} strokeWidth={active ? 2 : 1.6} />
                {active && <span className="absolute -right-1.5 -top-0.5 size-[6px] rounded-full bg-accent" />}
              </span>
              {short}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
