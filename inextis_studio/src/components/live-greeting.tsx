"use client";

import { useEffect, useState } from "react";

// Greeting and date in India time, refreshed every minute. Rendered after mount so
// the static page never shows a stale greeting from build time.

function now() {
  const d = new Date();
  const hour = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Kolkata" }).format(d));
  const part = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const date = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(d);
  return { greeting: `Good ${part}, Dhruv`, date };
}

function useNow() {
  const [value, setValue] = useState<ReturnType<typeof now> | null>(null);
  useEffect(() => {
    setValue(now());
    const iv = setInterval(() => setValue(now()), 60_000);
    return () => clearInterval(iv);
  }, []);
  return value;
}

export function LiveGreeting() {
  const v = useNow();
  return <span className={v ? "" : "opacity-0"}>{v?.greeting ?? "Good morning, Dhruv"}</span>;
}

export function LiveDate() {
  const v = useNow();
  return <span className={v ? "" : "opacity-0"}>{v?.date ?? "Today"}</span>;
}
