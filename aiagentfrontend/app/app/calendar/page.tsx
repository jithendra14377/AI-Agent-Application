// "use client";
// import Link from "next/link";
// import { useEffect, useMemo, useState } from "react";
// import { ChevronLeft, ChevronRight } from "lucide-react";
// import { Button } from "@/components/ui/button";
// import { api } from "@/lib/api";

// type JobItem = { id: number; status: string; seo_title: string | null; instruction: string; created_at: string };

// const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// const STATUS: Record<string, { label: string; dot: string; badge: string }> = {
//   generating: { label: "In progress", dot: "bg-cyan-400", badge: "bg-cyan-400/15 text-cyan-300" },
//   pending_approval: { label: "Awaiting approval", dot: "bg-amber-400", badge: "bg-amber-400/15 text-amber-300" },
//   approved: { label: "Approved", dot: "bg-emerald-400", badge: "bg-emerald-400/15 text-emerald-300" },
//   published: { label: "Published", dot: "bg-purple-400", badge: "bg-purple-400/15 text-purple-300" },
//   rejected: { label: "Rejected", dot: "bg-red-400", badge: "bg-red-400/15 text-red-300" },
//   failed: { label: "Failed", dot: "bg-red-400", badge: "bg-red-400/15 text-red-300" },
// };
// const FALLBACK = { label: "Other", dot: "bg-slate-400", badge: "bg-slate-400/15 text-slate-300" };

// // Local-date key, so a day never shifts because of time zones
// const key = (d: Date) =>
//   `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// export default function CalendarPage() {
//   const [today] = useState(() => new Date());
//   const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
//   const [selected, setSelected] = useState(() => new Date());
//   const [jobs, setJobs] = useState<JobItem[]>([]);
//   const [note, setNote] = useState("");

//   useEffect(() => {
//     api<JobItem[]>("/jobs")
//       .then(setJobs)
//       .catch(() => setNote("Your content could not be loaded onto the calendar yet."));
//   }, []);

//   // 6 weeks x 7 days, starting on Sunday
//   const cells = useMemo(() => {
//     const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
//     const start = new Date(first);
//     start.setDate(1 - first.getDay());
//     return Array.from({ length: 42 }, (_, i) => {
//       const d = new Date(start);
//       d.setDate(start.getDate() + i);
//       return d;
//     });
//   }, [cursor]);

//   const byDay = useMemo(() => {
//     const m = new Map<string, JobItem[]>();
//     for (const j of jobs) {
//       const k = key(new Date(j.created_at));
//       const list = m.get(k) ?? [];
//       list.push(j);
//       m.set(k, list);
//     }
//     return m;
//   }, [jobs]);

//   const goMonth = (delta: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));
//   const goToday = () => {
//     setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
//     setSelected(new Date());
//   };

//   const dayJobs = byDay.get(key(selected)) ?? [];

//   return (
//     <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[1fr_320px]">
//       <section className="rounded-2xl border border-violet-400/30 bg-white/5 p-4">
//         <div className="mb-4 flex items-center justify-between">
//           <h1 className="text-xl font-bold">
//             {cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
//           </h1>
//           <div className="flex items-center gap-2">
//             <Button size="icon" variant="outline" onClick={() => goMonth(-1)} aria-label="Previous month"
//               className="border-violet-400/40 bg-white/5"><ChevronLeft className="h-4 w-4" /></Button>
//             <Button variant="outline" onClick={goToday} className="border-violet-400/40 bg-white/5">Today</Button>
//             <Button size="icon" variant="outline" onClick={() => goMonth(1)} aria-label="Next month"
//               className="border-violet-400/40 bg-white/5"><ChevronRight className="h-4 w-4" /></Button>
//           </div>
//         </div>

//         <div className="mb-1 grid grid-cols-7 gap-1 text-center text-xs text-violet-200/70">
//           {WEEKDAYS.map((w) => <div key={w} className="py-1">{w}</div>)}
//         </div>

//         <div className="grid grid-cols-7 gap-1">
//           {cells.map((d) => {
//             const k = key(d);
//             const inMonth = d.getMonth() === cursor.getMonth();
//             const isToday = k === key(today);
//             const isSel = k === key(selected);
//             const list = byDay.get(k) ?? [];
//             return (
//               <button
//                 key={k}
//                 type="button"
//                 aria-label={`${d.toDateString()}, ${list.length} content item${list.length === 1 ? "" : "s"}`}
//                 onClick={() => {
//                   setSelected(d);
//                   if (!inMonth) setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
//                 }}
//                 className={`flex min-h-16 flex-col items-start gap-1 rounded-lg border p-1.5 text-left transition sm:min-h-24 ${
//                   isSel ? "border-cyan-300 ring-1 ring-cyan-300" : "border-violet-400/15 hover:border-violet-400/50"
//                 } ${inMonth ? "bg-white/[0.04]" : "bg-transparent opacity-40"}`}
//               >
//                 <span className={`grid h-6 w-6 place-items-center rounded-full text-xs ${isToday ? "bg-purple-500 font-bold text-white" : ""}`}>
//                   {d.getDate()}
//                 </span>
//                 {list.length > 0 && (
//                   <span className="flex flex-wrap items-center gap-1">
//                     {list.slice(0, 4).map((j) => (
//                       <span key={j.id} className={`h-2 w-2 rounded-full ${(STATUS[j.status] ?? FALLBACK).dot}`} />
//                     ))}
//                     {list.length > 4 && <span className="text-[10px] text-violet-200/70">+{list.length - 4}</span>}
//                   </span>
//                 )}
//               </button>
//             );
//           })}
//         </div>

//         <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-violet-200/70">
//           {Object.entries(STATUS).filter(([s]) => s !== "failed").map(([s, v]) => (
//             <span key={s} className="flex items-center gap-1.5">
//               <span className={`h-2 w-2 rounded-full ${v.dot}`} />{v.label}
//             </span>
//           ))}
//         </div>
//         {note && <p className="mt-3 text-xs text-amber-300">{note}</p>}
//       </section>

//       <aside className="rounded-2xl border border-violet-400/30 bg-white/5 p-4">
//         <h2 className="text-lg font-bold">
//           {selected.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
//         </h2>
//         <div className="mt-3 space-y-3">
//           {dayJobs.length === 0 && <p className="text-sm text-violet-200/70">No content created on this day.</p>}
//           {dayJobs.map((j) => {
//             const s = STATUS[j.status] ?? FALLBACK;
//             return (
//               <div key={j.id} className="rounded-xl border border-violet-400/20 bg-white/5 p-3 text-sm">
//                 <div className="font-semibold">{j.seo_title || j.instruction}</div>
//                 <div className="mt-2 flex items-center justify-between text-xs">
//                   <span className={`rounded-full px-2 py-0.5 ${s.badge}`}>{s.label}</span>
//                   <span className="text-violet-200/60">
//                     {new Date(j.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
//                   </span>
//                 </div>
//               </div>
//             );
//           })}
//         </div>
//         <Link href="/app/content"
//           className="mt-4 block rounded-lg bg-purple-600/50 px-4 py-2 text-center text-sm hover:bg-purple-600/70">
//           Create new content
//         </Link>
//       </aside>
//     </div>
//   );
// }


"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowLeft, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, Copy, FileText,
  Layers, LayoutGrid, Link2, Plus, SlidersHorizontal, Sparkles, Trash2, Upload, X, Zap,
} from "lucide-react";
import { BrandLogo, type Brand } from "@/components/BrandLogo";
import { api } from "@/lib/api";

type JobItem = {
  id: number; status: string; seo_title: string | null; instruction: string; created_at: string;
  scheduled_at: string | null; scheduled_platform: string | null; thumb: number | null; has_video: boolean;
};
type Note = { ok: boolean; text: string } | null;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PLAT: { key: Brand; name: string; color: string }[] = [
  { key: "instagram", name: "Instagram", color: "#e1306c" },
  { key: "facebook", name: "Facebook", color: "#1877f2" },
  { key: "youtube", name: "YouTube", color: "#ff2d2d" },
  { key: "linkedin", name: "LinkedIn", color: "#0a8fe8" },
  { key: "x", name: "X (Twitter)", color: "#e5e7eb" },
  { key: "tiktok", name: "TikTok", color: "#22d3ee" },
];
const ST: Record<string, { label: string; cls: string }> = {
  generating: { label: "Generating", cls: "bg-cyan-400/15 text-cyan-300" },
  pending_approval: { label: "Awaiting approval", cls: "bg-amber-400/15 text-amber-300" },
  approved: { label: "Approved", cls: "bg-emerald-400/15 text-emerald-300" },
  published: { label: "Published", cls: "bg-purple-400/15 text-purple-300" },
  rejected: { label: "Rejected", cls: "bg-red-400/15 text-red-300" },
  failed: { label: "Failed", cls: "bg-red-400/15 text-red-300" },
  draft: { label: "Draft", cls: "bg-slate-400/15 text-slate-300" },
};
const QUEUE_STATUS = ["approved", "pending_approval", "draft", "rejected"];

const pad = (n: number) => String(n).padStart(2, "0");
const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtTime = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const badge = (j: JobItem) => (j.status === "approved" && j.scheduled_at ? { label: "Scheduled", cls: ST.approved.cls } : ST[j.status] ?? ST.draft);
const title = (j: JobItem) => j.seo_title || j.instruction;
const sel = "h-10 w-full rounded-lg border border-violet-400/40 bg-[#160c3a] px-3 text-sm text-white outline-none focus:border-cyan-300";
const opt = "bg-[#160c3a] text-white";

export default function CalendarPage() {
  const [today] = useState(() => new Date());
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [view, setView] = useState<"month" | "list">("month");
  const [platFilter, setPlatFilter] = useState("all");
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [isManager, setIsManager] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [queue, setQueue] = useState<null | "approved" | "all">(null);
  const [note, setNote] = useState<Note>(null);
  const [busy, setBusy] = useState(false);
  const [eDate, setEDate] = useState("");
  const [eTime, setETime] = useState("10:00");
  const [ePlat, setEPlat] = useState("instagram");

  const load = useCallback(async () => {
    try { setJobs(await api<JobItem[]>("/jobs")); }
    catch { setNote({ ok: false, text: "Your content could not be loaded." }); }
  }, []);

  useEffect(() => {
    load();
    api<{ role?: string }>("/auth/me").then((u) => setIsManager(u.role === "manager")).catch(() => {});
  }, [load]);

  const sel_ = jobs.find((j) => j.id === selectedId) ?? null;

  // Fill the date, time and platform boxes whenever a different post is opened
  useEffect(() => {
    if (!sel_) return;
    const d = sel_.scheduled_at ? new Date(sel_.scheduled_at) : selectedDay;
    setEDate(key(d));
    setETime(sel_.scheduled_at ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : "10:00");
    setEPlat(sel_.scheduled_platform ?? "instagram");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, sel_?.scheduled_at, sel_?.scheduled_platform]);

  const scheduled = useMemo(() => jobs.filter((j) => j.scheduled_at), [jobs]);
  const inCursorMonth = useCallback((iso: string) => {
    const d = new Date(iso);
    return d.getFullYear() === cursor.getFullYear() && d.getMonth() === cursor.getMonth();
  }, [cursor]);
  const monthJobs = useMemo(() => scheduled.filter((j) => inCursorMonth(j.scheduled_at!)), [scheduled, inCursorMonth]);
  const matches = (j: JobItem) => platFilter === "all" || j.scheduled_platform === platFilter;

  const byDay = useMemo(() => {
    const m = new Map<string, JobItem[]>();
    for (const j of scheduled.filter(matches)) {
      const k = key(new Date(j.scheduled_at!));
      m.set(k, [...(m.get(k) ?? []), j].sort((a, b) => a.scheduled_at!.localeCompare(b.scheduled_at!)));
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduled, platFilter]);

  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }, [cursor]);

  const queueItems = jobs.filter((j) => !j.scheduled_at && QUEUE_STATUS.includes(j.status));
  const stats = {
    scheduled: monthJobs.filter((j) => j.status === "approved").length,
    published: monthJobs.filter((j) => j.status === "published").length,
    drafts: jobs.filter((j) => j.status === "draft").length,
    awaiting: jobs.filter((j) => j.status === "pending_approval").length,
  };
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const perDay = Array.from({ length: daysInMonth }, (_, i) => monthJobs.filter((j) => new Date(j.scheduled_at!).getDate() === i + 1).length);
  const maxDay = Math.max(1, ...perDay);
  const perPlat = PLAT.map((p) => ({ ...p, n: monthJobs.filter((j) => j.scheduled_platform === p.key).length }));
  const total = perPlat.reduce((s, p) => s + p.n, 0);

  const goMonth = (delta: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));
  const goToday = () => { setCursor(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDay(new Date()); };

  async function act(done: string, fn: () => Promise<unknown>) {
    setBusy(true); setNote(null);
    try { await fn(); await load(); setNote({ ok: true, text: done }); }
    catch (e) { setNote({ ok: false, text: (e as Error).message }); }
    finally { setBusy(false); }
  }
  const post = (path: string, body?: unknown) =>
    api(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });

  function saveSchedule(id: number) {
    if (!eDate || !eTime) { setNote({ ok: false, text: "Pick a date and a time." }); return; }
    const at = new Date(`${eDate}T${eTime}`);
    act("Scheduled.", () => api(`/jobs/${id}/schedule`, { method: "PUT", body: JSON.stringify({ scheduled_at: at.toISOString(), platform: ePlat }) }));
  }
  function reject(id: number) {
    const reason = window.prompt("Why is this being rejected? (optional)") ?? null;
    if (reason === null) return;
    act("Rejected.", () => post(`/jobs/${id}/reject`, { reason }));
  }
  function remove(id: number) {
    if (!window.confirm("Delete this content and its files? This cannot be undone.")) return;
    act("Deleted.", async () => { await api(`/jobs/${id}`, { method: "DELETE" }); setSelectedId(null); });
  }
  function duplicate(id: number) {
    act("Duplicated as a draft.", async () => { const r = (await post(`/jobs/${id}/duplicate`)) as { id: number }; setSelectedId(r.id); });
  }

  const Thumb = ({ j, cls }: { j: JobItem; cls: string }) => (
    <div className={`overflow-hidden bg-gradient-to-br from-purple-700/60 to-cyan-600/40 ${cls}`}>
      {j.thumb && <img src={`/api/assets/${j.thumb}/file`} alt="" className="h-full w-full object-cover" />}
    </div>
  );

  const ghost = "flex items-center justify-center gap-2 rounded-lg border border-violet-400/40 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-50";

  // ---------- right panel ----------
  function detail(j: JobItem) {
    const b = badge(j);
    const locked = j.status === "published" || j.status === "generating";
    return (
      <>
        <div className="mb-3 flex items-center justify-between">
          <button type="button" onClick={() => setSelectedId(null)} className="flex items-center gap-1 text-xs text-violet-200/70 hover:text-white"><ArrowLeft className="h-3.5 w-3.5" /> Back</button>
          <span className={`rounded-full px-2.5 py-0.5 text-xs ${b.cls}`}>{b.label}</span>
        </div>
        <Thumb j={j} cls="mb-3 aspect-video rounded-xl" />
        <div className="mb-3 font-semibold leading-snug">{title(j)}</div>

        {j.status === "approved" && (
          <div className="mb-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={eDate} onChange={(e) => setEDate(e.target.value)} className={sel} />
              <input type="time" value={eTime} onChange={(e) => setETime(e.target.value)} className={sel} />
            </div>
            <select value={ePlat} onChange={(e) => setEPlat(e.target.value)} className={sel}>
              {PLAT.map((p) => <option key={p.key} value={p.key} className={opt}>{p.name}</option>)}
            </select>
            <button type="button" disabled={busy} onClick={() => saveSchedule(j.id)} className="sf-btn flex h-10 w-full items-center justify-center gap-2 text-sm">
              <CalendarDays className="h-4 w-4" /> {j.scheduled_at ? "Reschedule" : "Schedule"}
            </button>
          </div>
        )}
        {j.status !== "approved" && j.scheduled_at && (
          <div className="mb-3 flex items-center gap-2 text-sm text-violet-100/80"><Clock className="h-4 w-4" />{new Date(j.scheduled_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</div>
        )}
        {j.status === "pending_approval" && (
          isManager ? (
            <div className="mb-3 grid grid-cols-2 gap-2">
              <button type="button" disabled={busy} onClick={() => act("Approved. You can schedule it now.", () => post(`/jobs/${j.id}/approve`))}
                className="sf-btn flex h-10 items-center justify-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4" /> Approve</button>
              <button type="button" disabled={busy} onClick={() => reject(j.id)}
                className="flex h-10 items-center justify-center gap-2 rounded-xl border border-red-400/50 text-sm text-red-300 hover:bg-red-500/10"><X className="h-4 w-4" /> Reject</button>
            </div>
          ) : <p className="mb-3 text-sm text-amber-200/90">Waiting for a manager to approve it. Nothing is posted until then.</p>
        )}
        {(j.status === "draft" || j.status === "rejected") && (
          <button type="button" disabled={busy} onClick={() => act("Sent for approval.", () => post(`/jobs/${j.id}/submit`))}
            className="sf-btn mb-3 flex h-10 w-full items-center justify-center gap-2 text-sm">Send for approval</button>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={busy || j.status === "generating"} onClick={() => duplicate(j.id)} className={ghost}><Copy className="h-4 w-4" /> Duplicate</button>
          <button type="button" disabled={busy || locked || j.status === "draft"} onClick={() => act("Moved to draft.", () => post(`/jobs/${j.id}/draft`))} className={ghost}><FileText className="h-4 w-4" /> Move to Draft</button>
          <button type="button" disabled={busy || j.status === "generating"} onClick={() => remove(j.id)}
            className="col-span-2 flex items-center justify-center gap-2 rounded-lg border border-red-400/50 px-3 py-2 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-50"><Trash2 className="h-4 w-4" /> Delete</button>
        </div>
      </>
    );
  }

  function rowBtn(j: JobItem, extra?: string) {
    const b = badge(j);
    return (
      <button key={j.id} type="button" onClick={() => { setSelectedId(j.id); setQueue(null); }}
        className="flex w-full items-center gap-2 rounded-xl border border-violet-400/20 bg-white/5 p-2 text-left hover:border-fuchsia-400/60">
        <Thumb j={j} cls="h-12 w-16 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 text-sm font-semibold leading-tight">{title(j)}</div>
          <div className="mt-1 flex items-center justify-between text-[11px]">
            <span className={`rounded-full px-2 py-0.5 ${b.cls}`}>{b.label}</span>
            <span className="text-violet-200/60">{extra}</span>
          </div>
        </div>
      </button>
    );
  }

  const queueList = queue === "approved" ? queueItems.filter((j) => j.status === "approved") : queueItems;
  const dayList = byDay.get(key(selectedDay)) ?? [];

  let right;
  if (sel_) right = detail(sel_);
  else if (queue) right = (
    <>
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={() => setQueue(null)} className="flex items-center gap-1 text-xs text-violet-200/70 hover:text-white"><ArrowLeft className="h-3.5 w-3.5" /> Back</button>
        <span className="text-xs text-violet-200/70">{queue === "approved" ? "Approved, ready to schedule" : "Not scheduled yet"}</span>
      </div>
      <div className="space-y-2">
        {queueList.length === 0 && <p className="text-sm text-violet-200/70">{queue === "approved" ? "Nothing approved yet. A manager approves content first." : "The queue is empty."}</p>}
        {queueList.map((j) => rowBtn(j))}
      </div>
    </>
  );
  else right = (
    <>
      <h2 className="mb-3 font-bold">{selectedDay.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</h2>
      <div className="space-y-2">
        {dayList.length === 0 && <p className="text-sm text-violet-200/70">Nothing scheduled for this day. Open the Content Queue to schedule approved content.</p>}
        {dayList.map((j) => rowBtn(j, fmtTime(new Date(j.scheduled_at!))))}
      </div>
    </>
  );

  return (
    <div className="pb-4">
      <div className="sf-panel mb-3 flex flex-wrap items-center justify-between gap-3 px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl border border-violet-400/40 bg-white/5"><CalendarDays className="h-6 w-6 text-purple-300" /></span>
          <div>
            <h1 className="text-2xl font-bold leading-tight">Content Calendar</h1>
            <p className="text-sm text-violet-200/70">Plan, schedule and approve your social media content across all platforms.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/content" className="sf-btn flex items-center gap-2 px-4 py-2.5 text-sm"><Plus className="h-4 w-4" /> Create Content</Link>
          <button type="button" disabled title="Coming soon" className={`${ghost} px-4`}><Layers className="h-4 w-4" /> Bulk Schedule</button>
          <button type="button" disabled title="Coming soon" className={`${ghost} px-4`}><Sparkles className="h-4 w-4" /> AI Plan (Auto)</button>
        </div>
      </div>
      {note && <p role="status" className={`mb-3 rounded-lg px-3 py-2 text-sm ${note.ok ? "bg-emerald-400/10 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>{note.text}</p>}

      <div className="grid gap-3 lg:grid-cols-[250px_1fr] xl:grid-cols-[250px_1fr_310px]">
        <div className="space-y-3">
          <section className="sf-panel p-3">
            <h2 className="mb-2 flex items-center gap-2 font-bold"><Zap className="h-4 w-4 text-purple-300" /> Quick Actions</h2>
            <div className="space-y-2">
              <button type="button" onClick={() => { setSelectedId(null); setQueue("approved"); }} className="sf-btn flex h-10 w-full items-center justify-center gap-2 text-sm"><Plus className="h-4 w-4" /> Schedule New Post</button>
              <button type="button" disabled title="Coming soon" className={`${ghost} w-full`}><Sparkles className="h-4 w-4" /> AI Content Plan</button>
              <button type="button" disabled title="Coming soon" className={`${ghost} w-full`}><Upload className="h-4 w-4" /> Bulk Upload &amp; Schedule</button>
              <button type="button" onClick={() => { setSelectedId(null); setQueue("all"); }} className={`${ghost} w-full`}><Layers className="h-4 w-4" /> Content Queue ({queueItems.length})</button>
            </div>
          </section>

          <section className="sf-panel p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-bold"><Link2 className="h-4 w-4 text-purple-300" /> Connected Accounts</h2>
              <Link href="/app/integrations" className="text-xs text-cyan-300 underline">Manage</Link>
            </div>
            <div className="space-y-1.5">
              {PLAT.map((p) => (
                <div key={p.key} className="flex items-center gap-2 rounded-lg border border-violet-400/20 bg-white/5 px-2 py-1.5 text-sm">
                  <BrandLogo brand={p.key} size={24} /><span className="flex-1">{p.name}</span>
                  <span className="rounded-full bg-slate-400/15 px-2 py-0.5 text-[10px] text-slate-300">Not connected</span>
                </div>
              ))}
            </div>
          </section>

          <section className="sf-panel p-3">
            <h2 className="mb-2 flex items-center gap-2 font-bold"><Activity className="h-4 w-4 text-purple-300" /> This Month Overview</h2>
            <div className="grid grid-cols-2 gap-2">
              {([[CalendarDays, stats.scheduled, "Scheduled"], [CheckCircle2, stats.published, "Published"], [FileText, stats.drafts, "Drafts"], [Clock, stats.awaiting, "Awaiting approval"]] as const).map(([Icon, n, l]) => (
                <div key={l} className="rounded-xl border border-violet-400/25 bg-white/5 p-2.5">
                  <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-fuchsia-300" /><span className="text-xl font-bold">{n}</span></div>
                  <div className="mt-0.5 text-[11px] text-violet-200/70">{l}</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="sf-panel p-3">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button type="button" aria-label="Previous month" onClick={() => goMonth(-1)} className="grid h-9 w-9 place-items-center rounded-lg border border-violet-400/40 bg-white/5 hover:bg-white/10"><ChevronLeft className="h-4 w-4" /></button>
            <div className="min-w-36 rounded-lg border border-violet-400/40 bg-white/5 px-4 py-1.5 text-center font-bold">{cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</div>
            <button type="button" aria-label="Next month" onClick={() => goMonth(1)} className="grid h-9 w-9 place-items-center rounded-lg border border-violet-400/40 bg-white/5 hover:bg-white/10"><ChevronRight className="h-4 w-4" /></button>
            <button type="button" onClick={goToday} className="rounded-lg border border-violet-400/40 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10">Today</button>
            <div className="ml-auto flex gap-1 rounded-xl border border-violet-400/25 bg-white/5 p-1 text-sm">
              {([["month", "Month"], ["list", "List"]] as const).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setView(k)} className={`rounded-lg px-3 py-1 ${view === k ? "sf-nav-active text-white" : "text-violet-200/80"}`}>{l}</button>
              ))}
              <button type="button" disabled title="Coming soon" className="rounded-lg px-3 py-1 text-violet-200/40">Week</button>
              <button type="button" disabled title="Coming soon" className="rounded-lg px-3 py-1 text-violet-200/40">Day</button>
            </div>
            <div className="relative">
              <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              <select value={platFilter} onChange={(e) => setPlatFilter(e.target.value)} className={`${sel} w-44 pl-9`} aria-label="Filter by platform">
                <option value="all" className={opt}>All Platforms</option>
                {PLAT.map((p) => <option key={p.key} value={p.key} className={opt}>{p.name}</option>)}
              </select>
            </div>
          </div>

          {view === "month" ? (
            <>
              <div className="mb-1 grid grid-cols-7 gap-1 text-center text-xs text-fuchsia-200/80">{WEEKDAYS.map((w) => <div key={w} className="py-1">{w}</div>)}</div>
              <div className="grid grid-cols-7 gap-1">
                {cells.map((d) => {
                  const k = key(d);
                  const inMonth = d.getMonth() === cursor.getMonth();
                  const list = byDay.get(k) ?? [];
                  const isSel = k === key(selectedDay);
                  return (
                    <div key={k} role="button" tabIndex={0} aria-label={`${d.toDateString()}, ${list.length} scheduled`}
                      onClick={() => { setSelectedDay(d); setSelectedId(null); setQueue(null); if (!inMonth) setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); }}
                      onKeyDown={(e) => { if (e.key === "Enter") setSelectedDay(d); }}
                      className={`min-h-[92px] cursor-pointer rounded-lg border p-1 transition ${isSel ? "border-fuchsia-400 shadow-[0_0_14px_rgba(217,70,239,0.45)]" : "border-violet-400/15 hover:border-violet-400/50"} ${inMonth ? "bg-white/[0.04]" : "opacity-40"}`}>
                      <div className={`mb-1 grid h-6 w-6 place-items-center rounded-full text-xs ${k === key(today) ? "bg-purple-500 font-bold" : ""}`}>{d.getDate()}</div>
                      {list.slice(0, 2).map((j) => (
                        <button key={j.id} type="button" onClick={(e) => { e.stopPropagation(); setSelectedDay(d); setSelectedId(j.id); setQueue(null); }}
                          className={`mb-1 block w-full rounded-md border bg-[#1d1052] px-1 py-0.5 text-left ${selectedId === j.id ? "border-fuchsia-400" : "border-violet-400/30"}`}>
                          <span className="flex items-center gap-1 text-[10px]">
                            {j.scheduled_platform && <BrandLogo brand={j.scheduled_platform as Brand} size={13} />}
                            {fmtTime(new Date(j.scheduled_at!))}
                            {j.status === "approved" && <CheckCircle2 className="ml-auto h-3 w-3 text-emerald-400" />}
                          </span>
                          <span className="block truncate text-[10px] text-violet-100/80">{title(j)}</span>
                        </button>
                      ))}
                      {list.length > 2 && <div className="text-[10px] text-violet-200/70">+{list.length - 2} more</div>}
                    </div>
                  );
                })}
              </div>
              {scheduled.length === 0 && <p className="mt-3 text-xs text-violet-200/70">Nothing is scheduled yet. After a manager approves content, press Schedule New Post to give it a date.</p>}
            </>
          ) : (
            <div className="space-y-2">
              {monthJobs.filter(matches).length === 0 && <p className="py-6 text-center text-sm text-violet-200/70">Nothing scheduled in this month.</p>}
              {[...monthJobs].filter(matches).sort((a, b) => a.scheduled_at!.localeCompare(b.scheduled_at!)).map((j) => {
                const d = new Date(j.scheduled_at!);
                return rowBtn(j, `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}, ${fmtTime(d)}`);
              })}
            </div>
          )}
        </section>

        <aside className="sf-panel p-4 lg:col-span-2 xl:col-span-1 xl:self-start">
          <h2 className="mb-3 flex items-center gap-2 font-bold"><CalendarDays className="h-4 w-4 text-purple-300" /> Scheduled Post</h2>
          {right}
        </aside>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.6fr_1fr]">
        <section className="sf-panel p-4">
          <h2 className="mb-3 flex items-center gap-2 font-bold"><Activity className="h-4 w-4 text-purple-300" /> Content Schedule <span className="font-normal text-violet-200/70">({cursor.toLocaleDateString("en-US", { month: "short", year: "numeric" })})</span></h2>
          <div className="flex h-36 gap-1">
            <div className="flex flex-col justify-between pb-4 text-[10px] text-violet-200/60"><span>{maxDay}</span><span>0</span></div>
            {perDay.map((n, i) => (
              <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${i + 1}: ${n} scheduled`}>
                <div className="w-full rounded-t bg-gradient-to-t from-purple-600 to-fuchsia-400" style={{ height: `${(n / maxDay) * 100}%`, minHeight: n ? 4 : 1, opacity: n ? 1 : 0.25 }} />
                <span className="text-[9px] text-violet-200/60">{i + 1}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="sf-panel p-4">
          <h2 className="mb-3 flex items-center gap-2 font-bold"><LayoutGrid className="h-4 w-4 text-purple-300" /> Platform Distribution</h2>
          <div className="flex items-center gap-4">
            <svg viewBox="0 0 36 36" className="h-32 w-32 shrink-0 -rotate-90" aria-hidden="true">
              <circle cx="18" cy="18" r="15.9155" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
              {(() => {
                let off = 0;
                return perPlat.filter((p) => p.n).map((p) => {
                  const pct = (p.n / total) * 100;
                  const el = <circle key={p.key} cx="18" cy="18" r="15.9155" fill="none" stroke={p.color} strokeWidth="4" strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={-off} />;
                  off += pct;
                  return el;
                });
              })()}
            </svg>
            <div className="absolute" />
            <div className="min-w-0 flex-1 text-sm">
              <div className="mb-2 text-xs text-violet-200/70">{total} total {total === 1 ? "post" : "posts"} this month</div>
              {perPlat.map((p) => (
                <div key={p.key} className="flex items-center gap-2 py-0.5 text-xs">
                  <BrandLogo brand={p.key} size={16} /><span className="flex-1 truncate">{p.name}</span>
                  <span className="text-violet-200/70">{total ? Math.round((p.n / total) * 100) : 0}% ({p.n})</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}