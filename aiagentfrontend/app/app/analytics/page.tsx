"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState } from "react";
import {
  Activity, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, Download, Eye, Heart,
  Lightbulb, Send, SlidersHorizontal, Sparkles, TrendingUp, Users,
} from "lucide-react";
import { BrandLogo, type Brand } from "@/components/BrandLogo";
import { api } from "@/lib/api";

type JobItem = {
  id: number; status: string; seo_title: string | null; instruction: string; created_at: string;
  scheduled_at: string | null; scheduled_platform: string | null; thumb: number | null; has_video: boolean;
};

const PLAT: { key: Brand; name: string; color: string }[] = [
  { key: "instagram", name: "Instagram", color: "#e1306c" },
  { key: "facebook", name: "Facebook", color: "#1877f2" },
  { key: "youtube", name: "YouTube", color: "#ff2d2d" },
  { key: "linkedin", name: "LinkedIn", color: "#0a8fe8" },
  { key: "x", name: "X (Twitter)", color: "#e5e7eb" },
  { key: "tiktok", name: "TikTok", color: "#22d3ee" },
];
const TABS = ["Overview", "Content Performance", "Audience", "Engagement", "Reach & Impressions", "Growth", "AI Insights"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SLOTS = ["8 AM", "10 AM", "12 PM", "2 PM", "4 PM", "6 PM", "8 PM", "10 PM"];
const BADGE: Record<string, string> = {
  published: "bg-purple-400/15 text-purple-300", approved: "bg-emerald-400/15 text-emerald-300",
};
const sel = "h-10 rounded-lg border border-violet-400/40 bg-[#160c3a] px-3 text-sm text-white outline-none focus:border-cyan-300";
const opt = "bg-[#160c3a] text-white";
const fmt = (n: number) => n.toLocaleString("en-US");

// Same numbers every time for the same month, so the sample data does not flicker
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const Sample = () => <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] text-amber-300">Sample data</span>;

function Spark({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(1, ...data);
  const pts = data.map((v, i) => `${(i / Math.max(1, data.length - 1)) * 90},${28 - (v / max) * 26}`).join(" ");
  return <svg viewBox="0 0 90 30" className="h-8 w-24"><polyline points={pts} fill="none" stroke={color} strokeWidth="2" /></svg>;
}

export default function AnalyticsPage() {
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [tab, setTab] = useState(0);
  const [cursor, setCursor] = useState(() => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), 1); });
  const [platform, setPlatform] = useState("all");
  const [metric, setMetric] = useState<"content" | "scheduled" | "impressions">("content");
  const [gran, setGran] = useState<"day" | "week">("day");
  const [hover, setHover] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<JobItem[]>("/jobs").then(setJobs).catch(() => setError("Your content numbers could not be loaded."));
  }, []);

  const y = cursor.getFullYear();
  const m = cursor.getMonth();
  const inMonth = (iso: string, mm = m, yy = y) => { const d = new Date(iso); return d.getMonth() === mm && d.getFullYear() === yy; };
  const pool = useMemo(() => jobs.filter((j) => platform === "all" || j.scheduled_platform === platform), [jobs, platform]);
  const created = pool.filter((j) => inMonth(j.created_at));
  const prevDate = new Date(y, m - 1, 1);
  const prevCreated = pool.filter((j) => inMonth(j.created_at, prevDate.getMonth(), prevDate.getFullYear())).length;
  const scheduledIn = pool.filter((j) => j.scheduled_at && inMonth(j.scheduled_at));
  const count = (f: (j: JobItem) => boolean) => created.filter(f).length;
  const pipe = {
    awaiting: count((j) => j.status === "pending_approval"),
    approved: count((j) => j.status === "approved" && !j.scheduled_at),
    scheduled: count((j) => j.status === "approved" && !!j.scheduled_at),
    published: count((j) => j.status === "published"),
    rejected: count((j) => j.status === "rejected"),
    drafts: count((j) => j.status === "draft"),
  };

  const n = new Date(y, m + 1, 0).getDate();
  const daily = (list: JobItem[], pick: (j: JobItem) => string) => {
    const a = Array(n).fill(0);
    for (const j of list) { const d = new Date(pick(j)); if (d.getMonth() === m && d.getFullYear() === y) a[d.getDate() - 1]++; }
    return a as number[];
  };
  const sample = useMemo(() => {
    const r = rng(y * 12 + m + 7);
    const impressions = Array.from({ length: n }, (_, i) => Math.round(40000 * (0.7 + r() * 0.6) * (0.6 + (0.9 * i) / n)));
    const total = impressions.reduce((s, v) => s + v, 0);
    return { impressions, total, reach: Math.round(total * 0.54), eng: Math.round(total * 0.062), followers: 12000 + Math.round(r() * 70000),
      d: [10 + Math.round(r() * 30), 10 + Math.round(r() * 30), 10 + Math.round(r() * 30), 5 + Math.round(r() * 20)] };
  }, [y, m, n]);

  const series = metric === "content" ? daily(created, (j) => j.created_at)
    : metric === "scheduled" ? daily(scheduledIn, (j) => j.scheduled_at!) : sample.impressions;
  const points = gran === "day" ? series : Array.from({ length: Math.ceil(n / 7) }, (_, w) => series.slice(w * 7, w * 7 + 7).reduce((s, v) => s + v, 0));
  const labels = gran === "day" ? points.map((_, i) => String(i + 1)) : points.map((_, i) => `W${i + 1}`);
  const rawMax = Math.max(1, ...points);
  const step = Math.pow(10, Math.floor(Math.log10(rawMax)));
  const maxY = Math.ceil(rawMax / step) * step;
  const W = 640, H = 220, PL = 48, PR = 12, PT = 12, PB = 26;
  const px = (i: number) => PL + (i * (W - PL - PR)) / Math.max(1, points.length - 1);
  const py = (v: number) => PT + (1 - v / maxY) * (H - PT - PB);
  const line = points.map((v, i) => `${px(i)},${py(v)}`).join(" ");

  const perPlat = PLAT.map((p) => ({ ...p, n: scheduledIn.filter((j) => j.scheduled_platform === p.key).length }));
  const platTotal = perPlat.reduce((s, p) => s + p.n, 0);
  const heat = Array.from({ length: 7 }, () => Array(8).fill(0) as number[]);
  for (const j of scheduledIn) {
    const d = new Date(j.scheduled_at!);
    heat[(d.getDay() + 6) % 7][Math.min(7, Math.max(0, Math.floor((d.getHours() - 8) / 2)))]++;
  }
  const heatMax = Math.max(1, ...heat.flat());

  const published = pool.filter((j) => j.status === "published");
  const topSource = published.length ? published : pool.filter((j) => j.status === "approved");
  const topPosts = [...topSource].sort((a, b) => (b.scheduled_at ?? b.created_at).localeCompare(a.scheduled_at ?? a.created_at)).slice(0, 3);

  const decided = jobs.filter((j) => ["approved", "published", "rejected"].includes(j.status));
  const okCount = decided.filter((j) => j.status !== "rejected").length;
  const topPlat = [...perPlat].sort((a, b) => b.n - a.n)[0];
  const videos = created.filter((j) => j.has_video).length;
  const waiting = jobs.filter((j) => j.status === "pending_approval").length;
  const insights = [
    { Icon: Clock, text: waiting ? `${waiting} ${waiting === 1 ? "item is" : "items are"} waiting for manager approval.` : "Nothing is waiting for approval." },
    { Icon: CheckCircle2, text: decided.length ? `${Math.round((okCount / decided.length) * 100)}% of reviewed content was approved (${okCount} of ${decided.length}).` : "Approval rate appears after the first review." },
    { Icon: CalendarDays, text: topPlat && topPlat.n ? `Most scheduled platform this month: ${topPlat.name} (${topPlat.n}).` : "Schedule approved content to see platform insights." },
    { Icon: Lightbulb, text: created.length ? `${videos} of ${created.length} items created this month include a video.` : "Create content to see your video and image mix." },
  ];

  const delta = prevCreated ? Math.round(((created.length - prevCreated) / prevCreated) * 100) : null;
  const range = `${new Date(y, m, 1).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} – ${new Date(y, m, n).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  function exportCsv() {
    const rows = [["id", "title", "status", "created", "scheduled_at", "platform"],
      ...created.map((j) => [j.id, j.seo_title || j.instruction, j.status, j.created_at, j.scheduled_at ?? "", j.scheduled_platform ?? ""])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `socialflow-report-${y}-${String(m + 1).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const kpis: { Icon: typeof Eye; label: string; value: string; delta: string; spark: number[]; color: string; real: boolean }[] = [
    { Icon: Users, label: "Total Reach", value: fmt(sample.reach), delta: "+28.4%", spark: sample.impressions, color: "#e879f9", real: false },
    { Icon: Eye, label: "Impressions", value: fmt(sample.total), delta: "+32.1%", spark: sample.impressions, color: "#22d3ee", real: false },
    { Icon: Heart, label: "Engagements", value: fmt(sample.eng), delta: "+45.7%", spark: sample.impressions, color: "#e879f9", real: false },
    { Icon: Send, label: "Content Created", value: fmt(created.length), delta: delta === null ? "–" : `${delta >= 0 ? "+" : ""}${delta}%`, spark: daily(created, (j) => j.created_at), color: "#22d3ee", real: true },
    { Icon: Users, label: "Followers", value: fmt(sample.followers), delta: "+12.6%", spark: sample.impressions, color: "#e879f9", real: false },
  ];

  return (
    <div className="pb-4">
      <div className="sf-panel mb-3 flex flex-wrap items-center justify-between gap-3 px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl border border-violet-400/40 bg-white/5"><Activity className="h-6 w-6 text-purple-300" /></span>
          <div>
            <h1 className="text-2xl font-bold leading-tight">Analytics &amp; Performance</h1>
            <p className="text-sm text-violet-200/70">Track your content pipeline. Platform numbers appear once your accounts are connected.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-violet-400/40 bg-white/5 px-1">
            <button type="button" aria-label="Previous month" onClick={() => setCursor(new Date(y, m - 1, 1))} className="grid h-9 w-8 place-items-center hover:text-white"><ChevronLeft className="h-4 w-4" /></button>
            <span className="px-1 text-sm">{range}</span>
            <button type="button" aria-label="Next month" onClick={() => setCursor(new Date(y, m + 1, 1))} className="grid h-9 w-8 place-items-center hover:text-white"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <select value={platform} onChange={(e) => setPlatform(e.target.value)} className={sel} aria-label="Platform">
            <option value="all" className={opt}>All Platforms</option>
            {PLAT.map((p) => <option key={p.key} value={p.key} className={opt}>{p.name}</option>)}
          </select>
          <button type="button" onClick={exportCsv} className="flex h-10 items-center gap-2 rounded-xl border border-cyan-300/60 bg-white/5 px-4 text-sm hover:bg-white/10"><Download className="h-4 w-4" /> Export Report</button>
        </div>
      </div>
      {error && <p role="alert" className="mb-3 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">{error}</p>}

      <div className="sf-panel mb-3 flex flex-wrap gap-1 p-1.5">
        {TABS.map((t, i) => (
          <button key={t} type="button" onClick={() => setTab(i)}
            className={`rounded-xl px-4 py-2 text-sm ${tab === i ? "sf-nav-active text-white" : "text-violet-200/80 hover:bg-white/5"}`}>{t}</button>
        ))}
      </div>

      {tab !== 0 ? (
        <div className="sf-panel grid min-h-60 place-items-center p-8 text-center">
          <div><h2 className="text-xl font-bold">{TABS[tab]}</h2><p className="mt-2 text-sm text-violet-200/70">Coming soon. Open Overview for your content numbers.</p></div>
        </div>
      ) : (
        <>
          <div className="mb-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {kpis.map((k) => (
              <section key={k.label} className="sf-panel p-3">
                <div className="flex items-center justify-between text-sm text-violet-100/90">
                  <span className="flex items-center gap-2"><k.Icon className="h-5 w-5 text-fuchsia-300" />{k.label}</span>
                  {!k.real && <Sample />}
                </div>
                <div className="mt-1 text-2xl font-bold">{k.value}</div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="rounded-md bg-emerald-400/15 px-1.5 py-0.5 text-xs text-emerald-300">{k.delta}</span>
                  <Spark data={k.spark} color={k.color} />
                </div>
              </section>
            ))}
          </div>

          <section className="sf-panel mb-3 p-3">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold"><Send className="h-4 w-4 text-purple-300" /> Content Pipeline <span className="font-normal text-violet-200/60">(items created this month)</span></h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {([["Awaiting approval", pipe.awaiting], ["Approved", pipe.approved], ["Scheduled", pipe.scheduled], ["Published", pipe.published], ["Rejected", pipe.rejected], ["Drafts", pipe.drafts]] as const).map(([l, v]) => (
                <div key={l} className="rounded-xl border border-violet-400/25 bg-white/5 p-2.5"><div className="text-xl font-bold">{v}</div><div className="text-[11px] text-violet-200/70">{l}</div></div>
              ))}
            </div>
          </section>

          <div className="mb-3 grid gap-3 xl:grid-cols-[1.6fr_1fr]">
            <section className="sf-panel p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 font-bold"><TrendingUp className="h-4 w-4 text-purple-300" /> Performance Over Time {metric === "impressions" && <Sample />}</h2>
                <div className="flex gap-2">
                  <select value={metric} onChange={(e) => setMetric(e.target.value as typeof metric)} className={`${sel} h-9`} aria-label="Metric">
                    <option value="content" className={opt}>Content created</option>
                    <option value="scheduled" className={opt}>Scheduled posts</option>
                    <option value="impressions" className={opt}>Impressions (sample)</option>
                  </select>
                  <div className="flex gap-1 rounded-xl border border-violet-400/25 bg-white/5 p-1 text-xs">
                    {(["day", "week"] as const).map((g) => (
                      <button key={g} type="button" onClick={() => setGran(g)} className={`rounded-lg px-3 py-1 capitalize ${gran === g ? "sf-nav-active text-white" : "text-violet-200/80"}`}>{g}</button>
                    ))}
                  </div>
                </div>
              </div>
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full" onMouseLeave={() => setHover(null)}
                onMouseMove={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  const x = ((e.clientX - r.left) / r.width) * W;
                  setHover(Math.min(points.length - 1, Math.max(0, Math.round(((x - PL) / (W - PL - PR)) * (points.length - 1)))));
                }}>
                <defs><linearGradient id="an-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a855f7" stopOpacity="0.55" /><stop offset="1" stopColor="#a855f7" stopOpacity="0.02" /></linearGradient></defs>
                {[0, 1, 2, 3, 4].map((i) => (
                  <g key={i}>
                    <line x1={PL} x2={W - PR} y1={py((maxY / 4) * i)} y2={py((maxY / 4) * i)} stroke="rgba(255,255,255,0.08)" />
                    <text x={PL - 6} y={py((maxY / 4) * i) + 3} textAnchor="end" fontSize="10" fill="#c4b5fd">{fmt(Math.round((maxY / 4) * i))}</text>
                  </g>
                ))}
                <polygon points={`${px(0)},${py(0)} ${line} ${px(points.length - 1)},${py(0)}`} fill="url(#an-area)" />
                <polyline points={line} fill="none" stroke="#c084fc" strokeWidth="2.5" />
                {labels.map((l, i) => (gran === "week" || i % 3 === 0) && <text key={i} x={px(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="#c4b5fd">{l}</text>)}
                {hover !== null && (
                  <g>
                    <circle cx={px(hover)} cy={py(points[hover])} r="4" fill="#fff" />
                    <rect x={Math.min(px(hover) - 50, W - 120)} y={Math.max(0, py(points[hover]) - 38)} width="104" height="28" rx="6" fill="#160c3a" stroke="#8b5cf6" />
                    <text x={Math.min(px(hover) - 50, W - 120) + 8} y={Math.max(0, py(points[hover]) - 38) + 18} fontSize="11" fill="#fff">{labels[hover]}: {fmt(points[hover])}</text>
                  </g>
                )}
              </svg>
            </section>

            <section className="sf-panel p-4">
              <h2 className="mb-3 flex items-center gap-2 font-bold"><SlidersHorizontal className="h-4 w-4 text-purple-300" /> Platform Performance <span className="text-xs font-normal text-violet-200/60">(scheduled posts)</span></h2>
              <div className="flex items-center gap-4">
                <div className="relative h-36 w-36 shrink-0">
                  <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90" aria-hidden="true">
                    <circle cx="18" cy="18" r="15.9155" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
                    {(() => { let off = 0; return perPlat.filter((p) => p.n).map((p) => { const pct = (p.n / platTotal) * 100; const el = <circle key={p.key} cx="18" cy="18" r="15.9155" fill="none" stroke={p.color} strokeWidth="4" strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={-off} />; off += pct; return el; }); })()}
                  </svg>
                  <div className="absolute inset-0 grid place-items-center text-center"><div><div className="text-xl font-bold">{platTotal}</div><div className="text-[10px] text-violet-200/70">Scheduled</div></div></div>
                </div>
                <div className="min-w-0 flex-1">
                  {perPlat.map((p) => (
                    <div key={p.key} className="flex items-center gap-2 py-0.5 text-xs"><BrandLogo brand={p.key} size={18} /><span className="flex-1 truncate">{p.name}</span><span className="text-violet-200/70">{platTotal ? Math.round((p.n / platTotal) * 100) : 0}% ({p.n})</span></div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <section className="sf-panel p-4">
              <div className="mb-2 flex items-center justify-between"><h2 className="font-bold">Top Performing Posts</h2>{!published.length && <span className="text-[10px] text-violet-200/60">Latest approved</span>}</div>
              <div className="space-y-2">
                {topPosts.length === 0 && <p className="text-sm text-violet-200/70">No approved or published content yet.</p>}
                {topPosts.map((j, i) => (
                  <div key={j.id} className="flex items-center gap-2 rounded-xl border border-violet-400/20 bg-white/5 p-2">
                    <div className="h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-purple-700/60 to-cyan-600/40">{j.thumb && <img src={`/api/assets/${j.thumb}/file`} alt="" className="h-full w-full object-cover" />}</div>
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-xs font-semibold leading-tight">{j.seo_title || j.instruction}</div>
                      <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] ${BADGE[j.status] ?? "bg-slate-400/15 text-slate-300"}`}>#{i + 1} · {j.status}</span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-violet-200/60">Views, likes and comments appear after posts are published.</p>
            </section>

            <section className="sf-panel p-4">
              <div className="mb-2 flex items-center justify-between"><h2 className="font-bold">Audience Demographics</h2><Sample /></div>
              <div className="flex items-center gap-3">
                <svg viewBox="0 0 36 36" className="h-24 w-24 shrink-0 -rotate-90" aria-hidden="true">
                  <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#60a5fa" strokeWidth="4" strokeDasharray="62 38" />
                  <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#e879f9" strokeWidth="4" strokeDasharray="36 64" strokeDashoffset="-62" />
                  <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#a78bfa" strokeWidth="4" strokeDasharray="2 98" strokeDashoffset="-98" />
                </svg>
                <div className="text-xs"><div>Male 62%</div><div>Female 36%</div><div>Other 2%</div></div>
              </div>
              <div className="mt-3 space-y-1.5 text-xs">
                {[["18 – 24", sample.d[0]], ["25 – 34", sample.d[1] + 20], ["35 – 44", sample.d[2]], ["45 +", sample.d[3]]].map(([l, v]) => (
                  <div key={l} className="flex items-center gap-2"><span className="w-14 text-violet-200/80">{l}</span><div className="h-2 flex-1 rounded bg-white/10"><div className="h-2 rounded bg-gradient-to-r from-purple-500 to-fuchsia-400" style={{ width: `${Math.min(100, Number(v) * 1.6)}%` }} /></div></div>
                ))}
              </div>
            </section>

            <section className="sf-panel p-4">
              <h2 className="mb-1 flex items-center gap-2 font-bold"><Clock className="h-4 w-4 text-purple-300" /> Posting Times</h2>
              <p className="mb-2 text-[11px] text-violet-200/60">When your scheduled posts go out this month.</p>
              <div className="grid grid-cols-[28px_repeat(8,1fr)] gap-1 text-[9px] text-violet-200/70">
                <span />{SLOTS.map((s) => <span key={s} className="text-center">{s.replace(" ", "")}</span>)}
                {heat.map((row, di) => (
                  <div key={di} className="contents">
                    <span className="self-center">{DAYS[di]}</span>
                    {row.map((v, si) => <div key={si} title={`${DAYS[di]} ${SLOTS[si]}: ${v}`} className="h-5 rounded" style={{ background: v ? `rgba(217,70,239,${0.25 + (0.75 * v) / heatMax})` : "rgba(124,58,237,0.18)" }} />)}
                  </div>
                ))}
              </div>
            </section>

            <section className="sf-panel flex flex-col p-4">
              <h2 className="mb-2 flex items-center gap-2 font-bold"><Sparkles className="h-4 w-4 text-purple-300" /> AI Insights &amp; Recommendations</h2>
              <div className="flex-1 space-y-2">
                {insights.map(({ Icon, text }) => (
                  <div key={text} className="flex gap-2 rounded-xl border border-violet-400/20 bg-white/5 p-2 text-xs"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-300" />{text}</div>
                ))}
              </div>
              <button type="button" disabled title="Coming soon" className="sf-btn mt-3 flex h-10 w-full items-center justify-center gap-2 text-sm"><Sparkles className="h-4 w-4" /> Generate AI Report</button>
            </section>
          </div>
        </>
      )}
    </div>
  );
}