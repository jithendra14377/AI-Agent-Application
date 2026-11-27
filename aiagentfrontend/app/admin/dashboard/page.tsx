"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Calendar, CircleCheck, CircleX, Cpu, Crown, Database, Download, FileText, Film, Image as ImageIcon,
  Layers, Network, Settings, Share2, Users, Video, type LucideIcon,
} from "lucide-react";
import { api } from "@/lib/api";
import { initials, timeAgo } from "@/lib/format";

type Overview = {
  month: string; days: number;
  kpi: { total_users: number; users_delta: number | null; active_subs: number; runs: number; runs_delta: number | null; content: number; content_delta: number | null };
  series: { users: number[]; content: number[]; steps: number[] };
  plans: { plan: string; n: number }[];
  recent_users: { id: number; name: string; email: string; plan: string; is_active: boolean; created_at: string }[];
  activity: { id: number; action: string; created_at: string; actor: string | null }[];
  top: { images: number; videos: number; posts: number; carousels: number; reels: number };
  health: { name: string; ok: boolean; note: string }[];
  uptime_seconds: number; db_ms: number;
};

const COLORS = { users: "#a855f7", content: "#38bdf8", steps: "#ec4899" } as const;
const PLAN_COLORS = ["#a855f7", "#38bdf8", "#f59e0b", "#2dd4bf", "#ec4899"];
const ACTION: Record<string, string> = {
  job_created: "created new content", job_approved: "approved content", job_rejected: "rejected content",
  job_resubmitted: "sent content for approval again", job_scheduled: "scheduled content",
  job_moved_to_draft: "moved content to draft", job_duplicated: "duplicated content", job_deleted: "deleted content",
  member_added: "added a new member", member_updated: "updated a member", workspace_updated: "updated workspace settings",
  profile_updated: "updated a profile", password_changed: "changed a password", admin_login: "signed in to the admin portal",
  submitted_for_approval: "submitted content for approval",
};
const TOP = [
  { key: "images", label: "AI Image Generation", color: "#a855f7", Icon: ImageIcon },
  { key: "videos", label: "AI Video Generation", color: "#38bdf8", Icon: Video },
  { key: "posts", label: "Social Post (Text)", color: "#ec4899", Icon: FileText },
  { key: "reels", label: "Reels / Shorts", color: "#f59e0b", Icon: Film },
  { key: "carousels", label: "Carousel / Multi-post", color: "#2dd4bf", Icon: Layers },
] as const;
const TILES: { label: string; href: string; Icon: LucideIcon }[] = [
  { label: "Manage Users", href: "/admin/users", Icon: Users },
  { label: "Manage Plans", href: "/admin/plans", Icon: Crown },
  { label: "AI Models", href: "/admin/ai-models", Icon: Cpu },
  { label: "Workflows", href: "/admin/workflows", Icon: Network },
  { label: "Content Review", href: "/admin/review", Icon: ImageIcon },
  { label: "Integrations", href: "/admin/integrations", Icon: Share2 },
  { label: "System Settings", href: "/admin/settings", Icon: Settings },
];

function Spark({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(1, ...data);
  const pts = data.map((v, i) => `${(i / Math.max(1, data.length - 1)) * 100},${27 - (v / max) * 23}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-8 w-24">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Delta({ v }: { v: number | null }) {
  if (v == null) return <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs text-violet-200/70">No earlier data</span>;
  const up = v >= 0;
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${up ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>
      {up ? "↑ +" : "↓ "}{v}%
    </span>
  );
}

function UsageChart({ series, days }: { series: Overview["series"]; days: number }) {
  const W = 640, H = 230, L = 36, R = 12, T = 12, B = 26;
  const max = Math.max(4, ...series.users, ...series.content, ...series.steps);
  const nice = Math.ceil(max / 4) * 4;
  const x = (i: number) => L + (days <= 1 ? 0 : (i * (W - L - R)) / (days - 1));
  const y = (v: number) => T + (1 - v / nice) * (H - T - B);
  const line = (a: number[]) => a.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = (a: number[]) => `${line(a)} L${x(a.length - 1).toFixed(1)} ${y(0)} L${x(0)} ${y(0)}Z`;
  const ticks = [0, 1, 2, 3, 4].map((t) => (nice * t) / 4);
  const xs = Array.from(new Set([0, 3, 6, 9, 12, 15, 18, 21, 24, 27, days - 1])).filter((i) => i < days);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full">
      <defs>
        {(Object.keys(COLORS) as (keyof typeof COLORS)[]).map((k) => (
          <linearGradient key={k} id={`ug-${k}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={COLORS[k]} stopOpacity=".45" /><stop offset="1" stopColor={COLORS[k]} stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,.08)" />
          <text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#a5a3d0">{t}</text>
        </g>
      ))}
      {(["steps", "content", "users"] as const).map((k) => (
        <g key={k}>
          <path d={area(series[k])} fill={`url(#ug-${k})`} />
          <path d={line(series[k])} fill="none" stroke={COLORS[k]} strokeWidth="2.2" strokeLinejoin="round" />
        </g>
      ))}
      {xs.map((i) => <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="11" fill="#a5a3d0">{i + 1}</text>)}
    </svg>
  );
}

function Donut({ plans, total }: { plans: { plan: string; n: number }[]; total: number }) {
  const R = 52, C = 2 * Math.PI * R;
  let off = 0;
  return (
    <div className="relative h-44 w-44 shrink-0">
      <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
        <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="18" />
        {total > 0 && plans.map((p, i) => {
          const len = (p.n / total) * C;
          const el = (
            <circle key={p.plan} cx="70" cy="70" r={R} fill="none" stroke={PLAN_COLORS[i % PLAN_COLORS.length]}
              strokeWidth="18" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} />
          );
          off += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div><div className="text-2xl font-bold leading-tight">{total.toLocaleString()}</div><div className="text-xs text-violet-200/70">Total Users</div></div>
      </div>
    </div>
  );
}

function exportCsv(d: Overview) {
  const rows: [string, string | number][] = [
    ["Month", d.month], ["Total users", d.kpi.total_users], ["Paid subscriptions", d.kpi.active_subs],
    ["Agent runs (content jobs)", d.kpi.runs], ["Media files generated", d.kpi.content],
    ...d.plans.map((p): [string, number] => [`Plan: ${p.plan}`, p.n]),
  ];
  const csv = "Metric,Value\n" + rows.map(([a, b]) => `"${String(a).replace(/"/g, '""')}",${b}`).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url; a.download = `socialflow-report-${d.month}.csv`; a.click();
  URL.revokeObjectURL(url);
}

export default function AdminDashboard() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [d, setD] = useState<Overview | null>(null);
  const [pending, setPending] = useState(0);
  const [err, setErr] = useState("");

  const months = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const dt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      return { value: dt.toISOString().slice(0, 7), label: dt.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }) };
    });
  }, []);

  useEffect(() => {
    let live = true;
    api<Overview>(`/admin/overview?month=${month}`)
      .then((r) => { if (live) { setD(r); setErr(""); } })
      .catch((e) => { if (live) setErr(e.message); });
    return () => { live = false; };
  }, [month]);

  useEffect(() => {
    api<unknown[]>("/approvals").then((r) => setPending(r.length)).catch(() => {});
  }, []);

  if (err) return <p className="rounded-xl bg-red-500/15 px-4 py-3 text-sm text-red-300">Could not load the dashboard: {err}</p>;
  if (!d) return <p className="p-6 text-sm text-violet-200/70">Loading…</p>;

  const k = d.kpi;
  const total = k.total_users;
  const cards: { label: string; value: string; delta?: number | null; note?: string; Icon: LucideIcon; cls: string; spark?: number[]; color: string }[] = [
    { label: "Total Users", value: total.toLocaleString(), delta: k.users_delta, Icon: Users, cls: "from-purple-600/45 to-purple-950/40 border-purple-400/60", spark: d.series.users, color: "#c084fc" },
    { label: "Paid Subscriptions", value: String(k.active_subs), Icon: Crown, cls: "from-blue-600/40 to-blue-950/40 border-blue-400/60", color: "#60a5fa", note: "Users on a paid plan" },
    { label: "Agent Runs", value: k.runs.toLocaleString(), delta: k.runs_delta, Icon: Layers, cls: "from-fuchsia-600/40 to-fuchsia-950/40 border-fuchsia-400/60", spark: d.series.content, color: "#f0abfc" },
    { label: "Media Generated", value: k.content.toLocaleString(), delta: k.content_delta, Icon: FileText, cls: "from-sky-600/40 to-sky-950/40 border-sky-400/60", spark: d.series.steps, color: "#38bdf8" },
    { label: "Platform Revenue", value: "—", Icon: Database, cls: "from-emerald-600/35 to-emerald-950/40 border-emerald-400/60", color: "#34d399", note: "Billing is not connected yet" },
  ];
  const topMax = Math.max(1, ...TOP.map((t) => d.top[t.key]));
  const healthy = d.health.every((h) => h.ok);
  const up = d.uptime_seconds;
  const upText = up >= 3600 ? `${Math.floor(up / 3600)}h ${Math.floor((up % 3600) / 60)}m` : `${Math.max(1, Math.floor(up / 60))}m`;

  return (
    <div className="space-y-3 pb-4">
      <div className="sf-panel flex flex-wrap items-center justify-between gap-3 px-5 py-3">
        <div>
          <h1 className="text-2xl font-bold leading-tight">Admin Dashboard</h1>
          <p className="text-sm text-violet-200/70">Monitor platform performance, users, content and system health.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 rounded-xl border border-violet-400/40 bg-white/5 px-3 py-2 text-sm">
            <Calendar className="h-4 w-4 text-violet-200/80" />
            <select value={month} onChange={(e) => setMonth(e.target.value)} className="bg-transparent outline-none">
              {months.map((m) => <option key={m.value} value={m.value} className="bg-[#160c3a]">{m.label}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => exportCsv(d)} className="sf-btn flex items-center gap-2 px-4 py-2.5 text-sm">
            <Download className="h-4 w-4" /> Export Report
          </button>
        </div>
      </div>

      {pending > 0 && (
        <Link href="/admin/review" className="flex items-center justify-between rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-2.5 text-sm text-amber-200 hover:bg-amber-400/15">
          <span><b>{pending}</b> content item{pending === 1 ? " is" : "s are"} waiting for your review.</span>
          <span className="font-semibold">Review now →</span>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className={`rounded-2xl border bg-gradient-to-br p-4 shadow-[0_0_22px_rgba(124,58,237,.18)] ${c.cls}`}>
            <div className="flex items-center gap-3">
              <c.Icon className="h-9 w-9 shrink-0" />
              <div>
                <div className="text-sm text-white/85">{c.label}</div>
                <div className="text-2xl font-bold leading-tight">{c.value}</div>
              </div>
            </div>
            <div className="mt-3 flex items-end justify-between gap-2">
              {c.delta !== undefined ? <Delta v={c.delta} /> : <span className="text-xs text-white/60">{c.note}</span>}
              {c.spark && <Spark data={c.spark} color={c.color} />}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.6fr_1fr_1fr]">
        <section className="sf-panel p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold">Platform Usage Overview</h2>
            <div className="flex gap-4 text-xs">
              {([["users", "Users"], ["content", "Content jobs"], ["steps", "Agent steps"]] as const).map(([key, label]) => (
                <span key={key} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[key] }} />{label}</span>
              ))}
            </div>
          </div>
          <div className="h-56"><UsageChart series={d.series} days={d.days} /></div>
        </section>

        <section className="sf-panel p-4">
          <h2 className="mb-2 font-bold">Plan-wise Users</h2>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Donut plans={d.plans} total={total} />
            <ul className="space-y-2 text-sm">
              {d.plans.map((p, i) => (
                <li key={p.plan} className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-sm" style={{ background: PLAN_COLORS[i % PLAN_COLORS.length] }} />
                  <span className="w-24">{p.plan.replace(" Plan", "")}</span>
                  <span className="text-violet-200/80">{total ? Math.round((100 * p.n) / total) : 0}% ({p.n})</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="sf-panel p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-bold">System Health</h2>
            <span className={`rounded-full px-3 py-0.5 text-xs ${healthy ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-400/20 text-amber-200"}`}>
              {healthy ? "Healthy" : "Needs attention"}
            </span>
          </div>
          <ul className="divide-y divide-violet-400/15 text-sm">
            {d.health.map((h) => (
              <li key={h.name} className="flex items-center justify-between py-2" title={h.note}>
                <span>{h.name}</span>
                <span className={`flex items-center gap-1.5 ${h.ok ? "text-emerald-300" : "text-red-300"}`}>
                  {h.ok ? <CircleCheck className="h-4 w-4" /> : <CircleX className="h-4 w-4" />}
                  {h.ok ? "Operational" : "Problem"}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-between rounded-lg border border-violet-400/20 bg-white/5 px-3 py-2 text-xs text-violet-100/90">
            <span>Running for: <b>{upText}</b></span>
            <span>Database: <b>{d.db_ms} ms</b></span>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {TILES.map(({ label, href, Icon }) => (
          <Link key={label} href={href} className="sf-panel relative flex flex-col items-center gap-2 px-3 py-4 text-center text-sm transition hover:border-fuchsia-400/70">
            <Icon className="h-8 w-8 text-purple-200" />
            {label}
            {label === "Content Review" && pending > 0 && (
              <span className="absolute right-2 top-2 grid h-5 min-w-5 place-items-center rounded-full bg-fuchsia-500 px-1 text-[11px] font-bold">{pending}</span>
            )}
          </Link>
        ))}
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <section className="sf-panel p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-bold">Recent Users</h2>
            <Link href="/admin/users" className="text-xs text-violet-200/80 hover:text-white">View All</Link>
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-violet-200/60">
              <tr><th className="pb-2 font-normal">User</th><th className="pb-2 font-normal">Plan</th><th className="pb-2 font-normal">Status</th><th className="pb-2 font-normal">Joined On</th></tr>
            </thead>
            <tbody>
              {d.recent_users.map((u) => (
                <tr key={u.id} className="border-t border-violet-400/10">
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <span className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-purple-500 to-cyan-400 text-xs font-bold">
                        {initials(u.name)}
                        <img src={`/api/users/${u.id}/photo`} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }}
                          className="absolute inset-0 h-full w-full object-cover" />
                      </span>
                      <span className="min-w-0 leading-tight">
                        <span className="block truncate font-medium">{u.name}</span>
                        <span className="block max-w-[9rem] truncate text-xs text-violet-200/60">{u.email}</span>
                      </span>
                    </div>
                  </td>
                  <td><span className="rounded-full border border-blue-400/50 bg-blue-500/10 px-2 py-0.5 text-xs">{u.plan.replace(" Plan", "")}</span></td>
                  <td><span className={`flex items-center gap-1 text-xs ${u.is_active ? "text-emerald-300" : "text-slate-400"}`}><span className={`h-2 w-2 rounded-full ${u.is_active ? "bg-emerald-400" : "bg-slate-500"}`} />{u.is_active ? "Active" : "Inactive"}</span></td>
                  <td className="text-xs text-violet-100/80">{new Date(u.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="sf-panel p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-bold">Recent Activities (Audit Logs)</h2>
            <Link href="/admin/audit" className="text-xs text-violet-200/80 hover:text-white">View All</Link>
          </div>
          <ul className="space-y-3 text-sm">
            {d.activity.length === 0 && <li className="text-violet-200/70">No activity yet.</li>}
            {d.activity.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3">
                <span><b>{a.actor ?? "The AI agent"}</b> {ACTION[a.action] ?? a.action.replace(/_/g, " ")}</span>
                <span className="shrink-0 text-xs text-violet-200/60">{timeAgo(a.created_at)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="sf-panel p-4">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Top Content by Generation</h2></div>
          <ul className="space-y-3 text-sm">
            {TOP.map(({ key, label, color, Icon }) => (
              <li key={key} className="flex items-center gap-3">
                <Icon className="h-5 w-5 shrink-0 text-violet-200/80" />
                <span className="w-36 shrink-0">{label}</span>
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/10">
                  <span className="block h-full rounded-full" style={{ width: `${(d.top[key] / topMax) * 100}%`, background: color }} />
                </span>
                <span className="w-10 text-right text-violet-100/90">{d.top[key]}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}