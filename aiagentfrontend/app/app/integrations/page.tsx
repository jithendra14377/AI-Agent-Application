"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Box, Brain, CircleCheck, CircleX, Clock, Cloud, Copy, Cpu, Database, Film, HardDrive, KeyRound,
  Layers, LayoutGrid, Link2, List, Lock, Megaphone, Pencil, Plus, Search, Send, Settings, Share2,
  ShieldCheck, Sparkles, Webhook, X, Zap, type LucideIcon,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { api } from "@/lib/api";

type Item = {
  key: string; name: string; category: string; status: "connected" | "not_connected" | "planned";
  description: string; env: string[]; key_label?: string | null;
};
type Act = { tool_name: string; status: string; created_at: string; job_id: number; title: string };

const CATS: { key: string; label: string; Icon: LucideIcon }[] = [
  { key: "all", label: "All Integrations", Icon: Link2 },
  { key: "social", label: "Social Media", Icon: Share2 },
  { key: "ai", label: "AI Models", Icon: Brain },
  { key: "storage", label: "Storage", Icon: Cloud },
  { key: "marketing", label: "Marketing Tools", Icon: Megaphone },
  { key: "automation", label: "Automation", Icon: Zap },
  { key: "custom", label: "Custom", Icon: ShieldCheck },
];
const BRAND = new Set(["instagram", "facebook", "youtube", "linkedin", "x", "tiktok"]);
const TILES: Record<string, { Icon: LucideIcon; cls: string }> = {
  brain: { Icon: Sparkles, cls: "from-blue-500 to-purple-600" },
  cloudflare: { Icon: Cloud, cls: "from-orange-400 to-orange-600" },
  magichour: { Icon: Film, cls: "from-pink-500 to-fuchsia-600" },
  postgres: { Icon: Database, cls: "from-sky-500 to-blue-700" },
  files: { Icon: HardDrive, cls: "from-slate-500 to-slate-700" },
  ffmpeg: { Icon: Zap, cls: "from-emerald-500 to-teal-600" },
  pinterest: { Icon: Share2, cls: "from-red-500 to-red-700" },
  telegram: { Icon: Send, cls: "from-sky-400 to-blue-500" },
};
const ACT_TEXT: Record<string, string> = {
  plan_content: "Request understood",
  write_copy: "Copy and hashtags written",
  generate_image: "Image generated",
  generate_video: "AI video generated",
  submit_for_approval: "Submitted for approval",
  agent_error: "Agent error",
};

function Tile({ item, size = 48 }: { item: Item; size?: number }) {
  if (BRAND.has(item.key)) return <BrandLogo brand={item.key} size={size} />;
  const t = TILES[item.key.startsWith("brain") ? "brain" : item.key] ?? { Icon: Box, cls: "from-slate-500 to-slate-700" };
  const I = t.Icon;
  return (
    <span className={`grid shrink-0 place-items-center rounded-xl bg-gradient-to-br ${t.cls}`} style={{ width: size, height: size }}>
      <I className="h-1/2 w-1/2 text-white" />
    </span>
  );
}

function Chip({ status }: { status: Item["status"] }) {
  if (status === "connected")
    return <span className="rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[11px] text-emerald-300">↑ Connected</span>;
  if (status === "planned")
    return <span className="rounded-md bg-amber-400/15 px-1.5 py-0.5 text-[11px] text-amber-300">Planned</span>;
  return <span className="rounded-md bg-slate-400/15 px-1.5 py-0.5 text-[11px] text-slate-300">Not connected</span>;
}

export default function IntegrationsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [acts, setActs] = useState<Act[]>([]);
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<Item | null>(null);
  const [allLogs, setAllLogs] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    api<Item[]>("/integrations").then(setItems).catch((e) => setErr(e.message));
    api<Act[]>("/activity").then(setActs).catch(() => {});
  }, []);

  const count = (c: string) => items.filter((i) => c === "all" || i.category === c).length;
  const connected = (c: string) => items.filter((i) => i.category === c && i.status === "connected").length;
  const core = items.filter((i) => i.category !== "social");
  const health = core.length ? Math.round((100 * core.filter((i) => i.status === "connected").length) / core.length) : 0;

  const shown = useMemo(
    () => items.filter((i) => (cat === "all" || i.category === cat) &&
      `${i.name} ${i.description}`.toLowerCase().includes(q.toLowerCase())),
    [items, cat, q],
  );

  const stats: { Icon: LucideIcon; n: string; label: string }[] = [
    { Icon: Link2, n: String(items.filter((i) => i.status === "connected").length), label: "Connected Integrations" },
    { Icon: Layers, n: String(connected("social")), label: "Social Media Accounts" },
    { Icon: Cpu, n: String(connected("ai")), label: "AI Models" },
    { Icon: Box, n: String(connected("storage")), label: "Storage Services" },
    { Icon: Zap, n: String(connected("marketing")), label: "Marketing Tools" },
    { Icon: CircleCheck, n: `${health}%`, label: "All Systems Active" },
  ];
  const keys = items.filter((i) => i.key_label);
  const logs = allLogs ? acts : acts.slice(0, 5);
  const soon = "Integrations are set in the server's .env file for now. Social accounts connect when publishing is built.";

  return (
    <div className="space-y-3 pb-4">
      <div className="sf-panel flex flex-wrap items-center justify-between gap-3 px-5 py-3">
        <div className="flex items-center gap-3">
          <Link2 className="h-9 w-9 text-purple-300" />
          <div>
            <h1 className="text-2xl font-bold leading-tight">Integrations</h1>
            <p className="text-sm text-violet-200/70">Connect your social media accounts, AI models, tools and other services to power your automation workflows.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setNote(soon)}
            className="flex items-center gap-2 rounded-xl border border-violet-400/40 bg-white/5 px-4 py-2.5 text-sm hover:bg-white/10">
            <LayoutGrid className="h-4 w-4" /> Integration Gallery
          </button>
          <button type="button" onClick={() => setNote(soon)} className="sf-btn flex items-center gap-2 px-4 py-2.5 text-sm">
            <Plus className="h-4 w-4" /> Add Integration
          </button>
        </div>
      </div>

      {(note || err) && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm text-amber-200">
          <span>{err || note}</span>
          <button type="button" aria-label="Dismiss" onClick={() => { setNote(""); setErr(""); }}><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="sf-panel flex flex-wrap gap-1 p-1.5">
        {CATS.map(({ key, label, Icon }) => (
          <button key={key} type="button" onClick={() => setCat(key)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm transition ${cat === key ? "sf-nav-active text-white" : "text-violet-200/80 hover:bg-white/5"}`}>
            <Icon className="h-4 w-4" /> {label}{key !== "all" && ` (${count(key)})`}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {stats.map(({ Icon, n, label }) => (
          <div key={label} className="sf-panel flex items-center gap-3 px-4 py-3">
            <Icon className="h-9 w-9 shrink-0 text-purple-300" />
            <div>
              <div className="text-2xl font-bold leading-tight">{n}</div>
              <div className="text-xs text-violet-200/70">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <section className="sf-panel p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto flex items-center gap-2 text-lg font-bold">
            <Link2 className="h-5 w-5 text-purple-300" /> Connected Integrations <span className="font-normal text-violet-200/70">({count("all")})</span>
          </h2>
          <div className="relative min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-200/60" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search integrations…"
              className="h-9 w-full rounded-lg border border-violet-400/40 bg-white/5 pl-9 pr-3 text-sm outline-none focus:border-cyan-300" />
          </div>
          <select value={cat} onChange={(e) => setCat(e.target.value)}
            className="h-9 rounded-lg border border-violet-400/40 bg-[#160c3a] px-2 text-sm text-white outline-none">
            <option value="all">All Categories</option>
            {CATS.filter((c) => c.key !== "all").map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <div className="flex gap-1 rounded-lg border border-violet-400/30 p-0.5">
            <button type="button" aria-label="Grid view" onClick={() => setView("grid")}
              className={`grid h-8 w-8 place-items-center rounded-md ${view === "grid" ? "sf-nav-active" : ""}`}><LayoutGrid className="h-4 w-4" /></button>
            <button type="button" aria-label="List view" onClick={() => setView("list")}
              className={`grid h-8 w-8 place-items-center rounded-md ${view === "list" ? "sf-nav-active" : ""}`}><List className="h-4 w-4" /></button>
          </div>
        </div>

        {shown.length === 0 ? (
          <p className="py-6 text-center text-sm text-violet-200/70">{items.length ? "Nothing matches your search." : "Loading…"}</p>
        ) : (
          <div className={`grid gap-3 ${view === "grid" ? "sm:grid-cols-2 xl:grid-cols-4" : "grid-cols-1"}`}>
            {shown.map((i) => (
              <div key={i.key} className="flex items-center gap-3 rounded-xl border border-violet-400/30 bg-white/5 p-3">
                <Tile item={i} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{i.name}</span>
                    <Chip status={i.status} />
                  </div>
                  <p className="truncate text-xs text-violet-200/70">{i.description}</p>
                </div>
                {i.status === "not_connected" && i.category === "social" && (
                  <button type="button"
                    onClick={() => setNote(`Connecting ${i.name} arrives with the publishing step. It needs a developer app and your approval on ${i.name}.`)}
                    className="rounded-lg border border-violet-400/40 px-2.5 py-1 text-xs hover:bg-white/10">Connect</button>
                )}
                <button type="button" aria-label={`Settings for ${i.name}`} onClick={() => setSelected(i)}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg hover:bg-white/10"><Settings className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        )}

        {selected && (
          <div className="mt-3 rounded-xl border border-violet-400/30 bg-white/5 p-4 text-sm">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold"><Tile item={selected} size={28} /> {selected.name}</div>
              <button type="button" aria-label="Close" onClick={() => setSelected(null)}><X className="h-4 w-4" /></button>
            </div>
            {selected.env.length > 0 ? (
              <>
                <p className="mb-2 text-violet-200/80">This is set by these lines in <code className="text-cyan-300">aiagentbackend/.env</code>. The values stay on the server. After you change them, restart the backend.</p>
                <div className="flex flex-wrap gap-2">
                  {selected.env.map((n) => <code key={n} className="rounded bg-black/40 px-2 py-1 text-xs text-cyan-200">{n}</code>)}
                </div>
              </>
            ) : (
              <p className="text-violet-200/80">
                {selected.status === "planned" ? "Planned. Posting to this platform is not supported yet." : "Nothing to configure here yet."}
              </p>
            )}
          </div>
        )}
      </section>

      <div className="grid gap-3 lg:grid-cols-3">
        <section className="sf-panel flex flex-col p-4">
          <h2 className="flex items-center gap-2 text-lg font-bold"><KeyRound className="h-5 w-5 text-purple-300" /> API Keys &amp; Credentials</h2>
          <p className="mb-3 text-xs text-violet-200/70">API keys for your integrations and AI services.</p>
          <div className="flex-1 space-y-1">
            {keys.length === 0 && <p className="text-sm text-violet-200/70">No keys found.</p>}
            {keys.map((i) => (
              <div key={i.key} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5">
                <Tile item={i} size={24} />
                <span className="flex-1 truncate text-sm">{i.key_label}</span>
                <span className={`rounded-md px-1.5 py-0.5 text-[11px] ${i.status === "connected" ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>
                  {i.status === "connected" ? "Active" : "Missing"}
                </span>
                <button type="button" disabled title="Keys are managed in the server's .env file" className="p-1 opacity-40"><Pencil className="h-4 w-4" /></button>
                <button type="button" disabled title="Keys never leave the server" className="p-1 opacity-40"><Copy className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-violet-200/60"><Lock className="h-3 w-3" /> Key values stay on the server and are never shown here.</p>
          <button type="button" onClick={() => setNote(soon)} className="sf-btn mt-3 flex h-10 items-center justify-center gap-2 text-sm">
            <Plus className="h-4 w-4" /> Add API Key
          </button>
        </section>

        <section className="sf-panel flex flex-col p-4">
          <h2 className="flex items-center gap-2 text-lg font-bold"><Webhook className="h-5 w-5 text-purple-300" /> Webhooks</h2>
          <p className="mb-3 text-xs text-violet-200/70">Connect external apps via webhooks.</p>
          <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-violet-400/30 p-4 text-center text-sm text-violet-200/70">
            No webhooks yet. They arrive together with publishing.
          </div>
          <button type="button" onClick={() => setNote("Webhooks arrive together with publishing.")} className="sf-btn mt-3 flex h-10 items-center justify-center gap-2 text-sm">
            <Plus className="h-4 w-4" /> Create Webhook
          </button>
        </section>

        <section className="sf-panel flex flex-col p-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold"><Clock className="h-5 w-5 text-purple-300" /> Integration Activity</h2>
              <p className="mb-3 text-xs text-violet-200/70">Recent agent activity and status.</p>
            </div>
            {acts.length > 5 && (
              <button type="button" onClick={() => setAllLogs(!allLogs)}
                className="rounded-lg border border-violet-400/40 bg-white/5 px-3 py-1 text-xs hover:bg-white/10">
                {allLogs ? "Show less" : "View All Logs"}
              </button>
            )}
          </div>
          <div className="flex-1 space-y-2">
            {logs.length === 0 && <p className="text-sm text-violet-200/70">No activity yet. Run the agent from Content.</p>}
            {logs.map((a, n) => (
              <div key={n} className="flex items-center gap-2 border-b border-violet-400/10 pb-2 text-sm last:border-0">
                {a.status === "done" ? <CircleCheck className="h-5 w-5 shrink-0 text-emerald-400" /> : <CircleX className="h-5 w-5 shrink-0 text-red-400" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate">{ACT_TEXT[a.tool_name] ?? a.tool_name}</div>
                  <div className="truncate text-xs text-violet-200/60">{a.title}</div>
                </div>
                <span className="shrink-0 text-[11px] text-violet-200/60">
                  {new Date(a.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}