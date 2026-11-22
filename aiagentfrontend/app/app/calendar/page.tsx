"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

type JobItem = { id: number; status: string; seo_title: string | null; instruction: string; created_at: string };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const STATUS: Record<string, { label: string; dot: string; badge: string }> = {
  generating: { label: "In progress", dot: "bg-cyan-400", badge: "bg-cyan-400/15 text-cyan-300" },
  pending_approval: { label: "Awaiting approval", dot: "bg-amber-400", badge: "bg-amber-400/15 text-amber-300" },
  approved: { label: "Approved", dot: "bg-emerald-400", badge: "bg-emerald-400/15 text-emerald-300" },
  published: { label: "Published", dot: "bg-purple-400", badge: "bg-purple-400/15 text-purple-300" },
  rejected: { label: "Rejected", dot: "bg-red-400", badge: "bg-red-400/15 text-red-300" },
  failed: { label: "Failed", dot: "bg-red-400", badge: "bg-red-400/15 text-red-300" },
};
const FALLBACK = { label: "Other", dot: "bg-slate-400", badge: "bg-slate-400/15 text-slate-300" };

// Local-date key, so a day never shifts because of time zones
const key = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function CalendarPage() {
  const [today] = useState(() => new Date());
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(() => new Date());
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [note, setNote] = useState("");

  useEffect(() => {
    api<JobItem[]>("/jobs")
      .then(setJobs)
      .catch(() => setNote("Your content could not be loaded onto the calendar yet."));
  }, []);

  // 6 weeks x 7 days, starting on Sunday
  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursor]);

  const byDay = useMemo(() => {
    const m = new Map<string, JobItem[]>();
    for (const j of jobs) {
      const k = key(new Date(j.created_at));
      const list = m.get(k) ?? [];
      list.push(j);
      m.set(k, list);
    }
    return m;
  }, [jobs]);

  const goMonth = (delta: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));
  const goToday = () => {
    setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelected(new Date());
  };

  const dayJobs = byDay.get(key(selected)) ?? [];

  return (
    <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[1fr_320px]">
      <section className="rounded-2xl border border-violet-400/30 bg-white/5 p-4">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">
            {cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </h1>
          <div className="flex items-center gap-2">
            <Button size="icon" variant="outline" onClick={() => goMonth(-1)} aria-label="Previous month"
              className="border-violet-400/40 bg-white/5"><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" onClick={goToday} className="border-violet-400/40 bg-white/5">Today</Button>
            <Button size="icon" variant="outline" onClick={() => goMonth(1)} aria-label="Next month"
              className="border-violet-400/40 bg-white/5"><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>

        <div className="mb-1 grid grid-cols-7 gap-1 text-center text-xs text-violet-200/70">
          {WEEKDAYS.map((w) => <div key={w} className="py-1">{w}</div>)}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((d) => {
            const k = key(d);
            const inMonth = d.getMonth() === cursor.getMonth();
            const isToday = k === key(today);
            const isSel = k === key(selected);
            const list = byDay.get(k) ?? [];
            return (
              <button
                key={k}
                type="button"
                aria-label={`${d.toDateString()}, ${list.length} content item${list.length === 1 ? "" : "s"}`}
                onClick={() => {
                  setSelected(d);
                  if (!inMonth) setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
                }}
                className={`flex min-h-16 flex-col items-start gap-1 rounded-lg border p-1.5 text-left transition sm:min-h-24 ${
                  isSel ? "border-cyan-300 ring-1 ring-cyan-300" : "border-violet-400/15 hover:border-violet-400/50"
                } ${inMonth ? "bg-white/[0.04]" : "bg-transparent opacity-40"}`}
              >
                <span className={`grid h-6 w-6 place-items-center rounded-full text-xs ${isToday ? "bg-purple-500 font-bold text-white" : ""}`}>
                  {d.getDate()}
                </span>
                {list.length > 0 && (
                  <span className="flex flex-wrap items-center gap-1">
                    {list.slice(0, 4).map((j) => (
                      <span key={j.id} className={`h-2 w-2 rounded-full ${(STATUS[j.status] ?? FALLBACK).dot}`} />
                    ))}
                    {list.length > 4 && <span className="text-[10px] text-violet-200/70">+{list.length - 4}</span>}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-violet-200/70">
          {Object.entries(STATUS).filter(([s]) => s !== "failed").map(([s, v]) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${v.dot}`} />{v.label}
            </span>
          ))}
        </div>
        {note && <p className="mt-3 text-xs text-amber-300">{note}</p>}
      </section>

      <aside className="rounded-2xl border border-violet-400/30 bg-white/5 p-4">
        <h2 className="text-lg font-bold">
          {selected.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </h2>
        <div className="mt-3 space-y-3">
          {dayJobs.length === 0 && <p className="text-sm text-violet-200/70">No content created on this day.</p>}
          {dayJobs.map((j) => {
            const s = STATUS[j.status] ?? FALLBACK;
            return (
              <div key={j.id} className="rounded-xl border border-violet-400/20 bg-white/5 p-3 text-sm">
                <div className="font-semibold">{j.seo_title || j.instruction}</div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className={`rounded-full px-2 py-0.5 ${s.badge}`}>{s.label}</span>
                  <span className="text-violet-200/60">
                    {new Date(j.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <Link href="/app/content"
          className="mt-4 block rounded-lg bg-purple-600/50 px-4 py-2 text-center text-sm hover:bg-purple-600/70">
          Create new content
        </Link>
      </aside>
    </div>
  );
}