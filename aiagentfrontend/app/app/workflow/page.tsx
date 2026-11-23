// "use client";
// import "@xyflow/react/dist/style.css";
// import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// import { useRouter } from "next/navigation";
// import {
//   ReactFlow, Background, Controls, MiniMap, addEdge, useNodesState, useEdgesState,
//   type Connection, type Edge, type Node,
// } from "@xyflow/react";
// import { Play, Save } from "lucide-react";
// import { Button } from "@/components/ui/button";
// import { api, WS_BASE } from "@/lib/api";
// import { nodeTypes } from "@/components/nodes";
// import type { Brand } from "@/components/BrandLogo";

// const src = (id: string, label: string, brand: Brand, y: number): Node =>
//   ({ id, type: "source", position: { x: 0, y }, data: { label, brand } });
// const tool = (id: string, label: string, sub: string, y: number): Node =>
//   ({ id, type: "tool", position: { x: 800, y }, data: { label, sub } });

// const INITIAL_NODES: Node[] = [
//   src("ig", "Instagram", "instagram", 0), src("fb", "Facebook", "facebook", 100),
//   src("yt", "YouTube", "youtube", 200), src("li", "LinkedIn", "linkedin", 300), src("x", "X (Twitter)", "x", 400),
//   { id: "hub", type: "hub", position: { x: 400, y: 120 }, data: { label: "Hub" } },
//   tool("content", "AI Content Generator", "Create Posts, Captions & Hashtags", 0),
//   tool("image", "Image Generator", "Create Social Media Visuals", 100),
//   tool("video", "Video Generator", "Create Reels, Shorts & Videos", 200),
//   tool("publisher", "Social Media Publisher", "Publish after manager approval", 300),
// ];
// const edge = (s: string, t: string): Edge => ({ id: `${s}-${t}`, source: s, target: t, animated: true, style: { stroke: "#a855f7", strokeWidth: 2 } });
// const INITIAL_EDGES: Edge[] = [
//   ...["ig", "fb", "yt", "li", "x"].map((s) => edge(s, "hub")),
//   ...["content", "image", "video", "publisher"].map((t) => edge("hub", t)),
// ];
// const GROUPS = { "Social Media Sources": ["Instagram", "Facebook", "YouTube", "LinkedIn", "X", "TikTok"], "AI Models": ["GPT", "Claude", "Gemini"], "Logic & Control": ["Condition", "Loop", "Delay", "Schedule"], Actions: ["Generate", "Publish", "Notify", "API Call"] };

// type Msg = { tone: "ok" | "warn"; text: string } | null;

// export default function WorkflowPage() {
//   const router = useRouter();
//   const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
//   const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
//   const [status, setStatus] = useState<Record<string, "running" | "done">>({});
//   const [running, setRunning] = useState(false);
//   const [msg, setMsg] = useState<Msg>(null);
//   const wsRef = useRef<WebSocket | null>(null);

//   useEffect(() => {
//     api<{ nodes: Node[]; edges: Edge[] }>("/workflows/default")
//       .then((w) => { if (w.nodes.length) { setNodes(w.nodes); setEdges(w.edges); } })
//       .catch(() => {});
//     return () => wsRef.current?.close();
//   }, [setNodes, setEdges]);

//   const onConnect = useCallback((c: Connection) => setEdges((e) => addEdge({ ...c, animated: true }, e)), [setEdges]);
//   const shown = useMemo(() => nodes.map((n) => ({ ...n, data: { ...n.data, status: status[n.id] } })), [nodes, status]);

//   async function runWorkflow() {
//     setStatus({}); setRunning(true); setMsg(null);
//     try {
//       const { run_id } = await api<{ run_id: string }>("/workflows/default/run", { method: "POST" });
//       const ws = new WebSocket(`${WS_BASE}/ws/runs/${run_id}`);
//       wsRef.current = ws;
//       ws.onmessage = (m) => {
//         const d = JSON.parse(m.data);
//         if (d.node) setStatus((s) => ({ ...s, [d.node]: d.status }));
//         if (d.type === "finished") {
//           setRunning(false);
//           setMsg({ tone: "warn", text: "Test run finished. Nothing was posted to any platform. Real posting will start only after manager approval." });
//         }
//       };
//       ws.onclose = () => setRunning(false);
//     } catch { router.replace("/login"); }
//   }

//   async function save() {
//     await api("/workflows/default", { method: "PUT", body: JSON.stringify({ nodes, edges }) });
//     setMsg({ tone: "ok", text: "Workflow saved." });
//   }

//   return (
//     <div className="flex h-full flex-col gap-3">
//       <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-400/30 bg-white/5 px-4 py-2">
//         <div className="text-sm">Project: <b>Social Media Automation v2.0</b></div>
//         <div className="flex items-center gap-2">
//           {msg && <span className={`max-w-md text-xs ${msg.tone === "ok" ? "text-emerald-300" : "text-amber-300"}`}>{msg.text}</span>}
//           <Button onClick={runWorkflow} disabled={running} className="bg-gradient-to-r from-fuchsia-500 to-purple-500">
//             <Play className="mr-1 h-4 w-4" />{running ? "Running…" : "Run Workflow"}
//           </Button>
//           <Button variant="outline" onClick={save} className="border-violet-400/40 bg-white/5"><Save className="mr-1 h-4 w-4" />Save</Button>
//         </div>
//       </div>

//       <div className="flex min-h-0 flex-1 gap-3">
//         <aside className="hidden w-60 overflow-y-auto rounded-xl border border-violet-400/30 bg-white/5 p-3 lg:block">
//           <h3 className="mb-3 font-bold">Components</h3>
//           {Object.entries(GROUPS).map(([g, items]) => (
//             <div key={g} className="mb-4">
//               <div className="mb-2 rounded-lg bg-white/10 px-3 py-1 text-sm">{g}</div>
//               <div className="grid grid-cols-3 gap-2">
//                 {items.map((i) => (
//                   <div key={i} className="rounded-lg border border-violet-400/30 bg-[#150f45] p-2 text-center text-[11px]">{i}</div>
//                 ))}
//               </div>
//             </div>
//           ))}
//         </aside>
//         <div className="flex-1 overflow-hidden rounded-xl border border-violet-400/30">
//           <ReactFlow nodes={shown} edges={edges} nodeTypes={nodeTypes}
//             onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
//             fitView className="dark">
//             <Background gap={24} />
//             <Controls />
//             <MiniMap pannable zoomable />
//           </ReactFlow>
//         </div>
//       </div>
//     </div>
//   );
// }


"use client";
/* eslint-disable @next/next/no-img-element */
import "@xyflow/react/dist/style.css";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow, Background, Controls, MiniMap, Handle, Position, useNodesState, useEdgesState,
  type Edge, type Node, type NodeProps,
} from "@xyflow/react";
import {
  AlignLeft, Braces, CalendarClock, CheckCircle2, ChevronDown, ClipboardList, Clapperboard, Clock,
  Cpu, FileText, Film, GitBranch, Hash, Image as ImageIcon, Loader2, Lock, MinusCircle, Play,
  Repeat, Save, Search, Send, Sparkles, Terminal, UserCheck, Webhook, X, XCircle,
} from "lucide-react";
import { BrandLogo, type Brand } from "@/components/BrandLogo";
import { api } from "@/lib/api";

type Status = "idle" | "running" | "done" | "failed" | "waiting" | "skipped" | "locked";
type Step = { id: number; step_no: number; tool_name: string; status: "running" | "done" | "failed"; output: { error?: string; summary?: string } | null };
type Job = {
  id: number; status: string; seo_title: string | null; description: string | null; hashtags: string[];
  steps: Step[]; assets: { id: number; kind: "image" | "video" }[];
};
type CType = { key: string; label: string; hint: string };
type ModelOpt = { id: string; label: string };
type StepData = { label: string; icon: keyof typeof ICONS; status: Status; desc: string };
type Log = { time: string; text: string; state: "ok" | "fail" | "run" };

const ICONS = { start: Play, input: FileText, content: Cpu, images: ImageIcon, video: Film, caption: Hash, approval: UserCheck, publish: Send };
const PLATFORMS: [string, Brand][] = [
  ["Instagram", "instagram"], ["Facebook", "facebook"], ["YouTube", "youtube"],
  ["LinkedIn", "linkedin"], ["X (Twitter)", "x"], ["TikTok", "tiktok"],
];

const mk = (id: string, label: string, icon: keyof typeof ICONS, x: number, y: number, desc: string): Node =>
  ({ id, type: "step", position: { x, y }, data: { label, icon, status: "idle", desc } });

const BASE_NODES: Node[] = [
  mk("start", "Start", "start", 0, 150, "Starts the workflow when you press Run Workflow."),
  mk("input", "Topic / Idea Input", "input", 150, 140, "Your topic or idea. Write it in Settings."),
  mk("content", "AI Content Generator", "content", 330, 140, "The AI agent that plans and writes your content."),
  mk("images", "Generate Images", "images", 540, 10, "Creates the scene images (FLUX.1 schnell)."),
  mk("video", "Generate Video", "video", 540, 140, "Builds a short video from the scene images."),
  mk("caption", "Create Caption & Hashtags", "caption", 540, 270, "Writes the SEO title, description, hashtags and a caption for each platform."),
  mk("approval", "Approval (Review)", "approval", 740, 140, "A manager reviews the draft. Nothing is posted without approval."),
  mk("publish", "Publish to Social Media", "publish", 910, 140, "Posts the approved content. Switched off until your accounts are connected."),
  ...PLATFORMS.map(([label, brand], i): Node => ({
    id: `p-${brand}`, type: "platform", position: { x: 1110, y: -25 + i * 66 }, data: { label, brand },
  })),
];
const ed = (s: string, t: string): Edge => ({ id: `${s}-${t}`, source: s, target: t, style: { stroke: "#a855f7", strokeWidth: 2 } });
const BASE_EDGES: Edge[] = [
  ed("start", "input"), ed("input", "content"),
  ed("content", "images"), ed("content", "video"), ed("content", "caption"),
  ed("images", "approval"), ed("video", "approval"), ed("caption", "approval"),
  ed("approval", "publish"), ...PLATFORMS.map(([, b]) => ed("publish", `p-${b}`)),
];
const PIPELINE = ["start", "input", "content", "images", "video", "caption", "approval"];

const BADGE: Record<Status, { Icon: typeof Clock; cls: string; text: string }> = {
  idle: { Icon: Clock, cls: "hidden", text: "Not run yet" },
  running: { Icon: Loader2, cls: "animate-spin text-cyan-300", text: "Running" },
  done: { Icon: CheckCircle2, cls: "text-emerald-400", text: "Done" },
  failed: { Icon: XCircle, cls: "text-red-400", text: "Failed" },
  waiting: { Icon: Clock, cls: "text-amber-300", text: "Waiting for manager" },
  skipped: { Icon: MinusCircle, cls: "text-slate-400", text: "Skipped" },
  locked: { Icon: Lock, cls: "text-slate-400", text: "Locked" },
};

function StepNode({ data, selected }: NodeProps) {
  const d = data as unknown as StepData;
  const Icon = ICONS[d.icon];
  const b = BADGE[d.status];
  const round = d.icon === "start";
  const ring =
    d.status === "running" ? "border-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.6)]"
    : d.status === "failed" ? "border-red-400"
    : d.status === "waiting" ? "border-amber-300 shadow-[0_0_16px_rgba(252,211,77,0.45)]"
    : d.status === "locked" ? "border-slate-500/50 opacity-60"
    : "border-violet-400/60 shadow-[0_0_14px_rgba(139,92,246,0.35)]";
  return (
    <div className={`relative border bg-[#160c3a] text-center text-xs text-white ${round ? "grid h-16 w-16 place-items-center rounded-full" : "w-[132px] rounded-xl px-2 py-2.5"} ${ring} ${selected ? "outline outline-2 outline-fuchsia-400" : ""}`}>
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-violet-400" />
      <div className={round ? "" : "flex flex-col items-center gap-1"}>
        <Icon className="h-5 w-5 text-fuchsia-300" />
        {!round && <span className="leading-tight">{d.label}</span>}
      </div>
      {round && <span className="absolute -bottom-5 text-[11px]">{d.label}</span>}
      <b.Icon className={`absolute -right-2 -top-2 h-5 w-5 rounded-full bg-[#160c3a] ${b.cls}`} />
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-0 !bg-violet-400" />
    </div>
  );
}

function PlatformNode({ data }: NodeProps) {
  const d = data as unknown as { label: string; brand: Brand };
  return (
    <div className="relative flex w-[150px] items-center gap-2 rounded-xl border border-slate-500/50 bg-[#160c3a] px-2 py-2 text-xs text-white opacity-60">
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-violet-400" />
      <BrandLogo brand={d.brand} size={24} />
      <span>{d.label}</span>
      <Lock className="absolute -right-2 -top-2 h-4 w-4 rounded-full bg-[#160c3a] text-slate-400" />
    </div>
  );
}
const nodeTypes = { step: StepNode, platform: PlatformNode };

const PALETTE: { title: string; items: [typeof Play | null, string, Brand?][] }[] = [
  { title: "Triggers", items: [[Play, "Manual"], [CalendarClock, "Schedule"], [Webhook, "Webhook"], [ClipboardList, "Form"]] },
  { title: "AI Actions", items: [[Sparkles, "AI Content"], [ImageIcon, "AI Image"], [Clapperboard, "AI Video"], [AlignLeft, "Caption"]] },
  { title: "Social Media", items: PLATFORMS.map(([, b]) => [null, b, b] as [null, string, Brand]) },
  { title: "Utilities", items: [[GitBranch, "Condition"], [Clock, "Delay"], [Repeat, "Loop"], [Braces, "Variable"]] },
];

const LOG_TEXT: Record<string, [string, string]> = {
  read_inputs: ["Reading attachments and links", "Attachments and links read"],
  plan_content: ["Understanding the request", "Request understood"],
  write_copy: ["Writing title, description and hashtags", "Copy written (title, description, hashtags)"],
  generate_image: ["Creating a scene image", "Scene image created"],
  generate_video: ["Building the video", "Video ready"],
  submit_for_approval: ["Submitting for approval", "Submitted. Waiting for manager approval"],
  agent_error: ["Agent error", "Agent error"],
};

const sel = "h-10 w-full rounded-lg border border-violet-400/40 bg-[#160c3a] px-3 text-sm text-white outline-none focus:border-cyan-300";
const opt = "bg-[#160c3a] text-white";

function fold(list: Step[]): Status | null {
  if (!list.length) return null;
  if (list.some((s) => s.status === "running")) return "running";
  if (list.some((s) => s.status === "done")) return "done";
  return "failed";
}

export default function WorkflowPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(BASE_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(BASE_EDGES);
  const [selected, setSelected] = useState("content");
  const [ptab, setPtab] = useState<"settings" | "prompt" | "output">("settings");
  const [topic, setTopic] = useState("");
  const [ctype, setCtype] = useState("auto");
  const [model, setModel] = useState("auto");
  const [length, setLength] = useState<"Short" | "Medium" | "Long">("Medium");
  const [emojis, setEmojis] = useState(true);
  const [types, setTypes] = useState<CType[]>([{ key: "auto", label: "Auto detect", hint: "" }]);
  const [models, setModels] = useState<ModelOpt[]>([]);
  const [jobId, setJobId] = useState<number | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [starting, setStarting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const seen = useRef(new Set<string>());

  useEffect(() => {
    api<CType[]>("/content-types").then(setTypes).catch(() => {});
    api<ModelOpt[]>("/models").then(setModels).catch(() => {});
    api<{ nodes: Node[]; edges: Edge[] }>("/workflows/default")
      .then((w) => { if (w.nodes.some((n) => n.id === "start")) { setNodes(w.nodes); setEdges(w.edges); } })
      .catch(() => {});
  }, [setNodes, setEdges]);

  const addLog = useCallback((text: string, state: Log["state"]) => {
    setLogs((l) => [...l, { time: new Date().toLocaleTimeString("en-GB"), text, state }]);
  }, []);

  const absorb = useCallback((j: Job) => {
    for (const s of j.steps) {
      const key = `${s.id}:${s.status}`;
      if (seen.current.has(key)) continue;
      seen.current.add(key);
      const [run, ok] = LOG_TEXT[s.tool_name] ?? [s.tool_name, s.tool_name];
      if (s.status === "running") addLog(run + "…", "run");
      else if (s.status === "done") addLog(s.output?.summary ? `${ok}: ${s.output.summary}` : ok, "ok");
      else addLog(`${run} failed: ${s.output?.error ?? "unknown error"}`, "fail");
    }
  }, [addLog]);

  // Poll the real job while the agent is working
  useEffect(() => {
    if (!jobId) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const j = await api<Job>(`/jobs/${jobId}`);
        if (stop) return;
        setJob(j);
        absorb(j);
        if (j.status !== "generating") {
          setFinishedAt(Date.now());
          addLog(j.status === "pending_approval" ? "Workflow finished. Waiting for manager approval. Nothing was posted." : "Workflow stopped. See the errors above.", j.status === "failed" ? "fail" : "ok");
          return;
        }
      } catch (e) {
        setMsg({ ok: false, text: "Could not load the run: " + (e as Error).message });
        return;
      }
      timer = setTimeout(tick, 1500);
    };
    tick();
    return () => { stop = true; clearTimeout(timer); };
  }, [jobId, absorb, addLog]);

  useEffect(() => {
    if (!startedAt || finishedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [startedAt, finishedAt]);

  const hint = types.find((t) => t.key === ctype)?.hint ?? "";
  const generating = starting || job?.status === "generating";

  function buildInstruction() {
    return [
      topic.trim(), "",
      `Content length: ${length} (short = brief, medium = normal, long = detailed).`,
      emojis ? "Use emojis in the captions." : "Do not use emojis.",
    ].join("\n");
  }

  async function run() {
    if (topic.trim().length < 5) {
      setSelected("input"); setPtab("settings");
      setMsg({ ok: false, text: "Write your topic first (at least 5 characters)." });
      return;
    }
    setMsg(null); setJob(null); setJobId(null); setLogs([]); seen.current = new Set();
    setStarting(true); setStartedAt(Date.now()); setFinishedAt(null);
    addLog(`Workflow started. Topic: “${topic.trim().slice(0, 80)}”`, "ok");
    try {
      const fd = new FormData();
      fd.append("instruction", buildInstruction());
      fd.append("content_type", ctype);
      fd.append("model", model);
      const { id } = await api<{ id: number }>("/jobs", { method: "POST", body: fd });
      setJobId(id);
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
      addLog((e as Error).message, "fail");
      setFinishedAt(Date.now());
    } finally {
      setStarting(false);
    }
  }

  async function save() {
    try {
      await api("/workflows/default", { method: "PUT", body: JSON.stringify({ nodes, edges }) });
      setMsg({ ok: true, text: "Workflow saved." });
    } catch {
      setMsg({ ok: false, text: "Could not save the workflow." });
    }
  }

  // Turn the real job steps into a status for each node
  const statuses = useMemo<Record<string, Status>>(() => {
    const begun = !!job || starting;
    const finished = !!job && job.status !== "generating";
    const of = (name: string) => fold(job?.steps.filter((s) => s.tool_name === name) ?? []);
    const rest: Status = finished ? "skipped" : "idle";
    const st: Record<string, Status> = {
      start: begun ? "done" : "idle",
      input: of("read_inputs") ?? (begun ? "done" : "idle"),
      content: !begun ? "idle" : job && job.steps.length ? "done" : job?.status === "failed" ? "failed" : "running",
      caption: of("write_copy") ?? (begun ? rest : "idle"),
      images: of("generate_image") ?? (begun ? rest : "idle"),
      video: of("generate_video") ?? (begun ? rest : "idle"),
      approval: job?.status === "pending_approval" ? "waiting" : "idle",
      publish: "locked",
    };
    return st;
  }, [job, starting]);

  const shown = useMemo(() => nodes.map((n) =>
    n.type === "step" ? { ...n, data: { ...n.data, status: statuses[n.id] ?? "idle" } } : n), [nodes, statuses]);

  const completed = PIPELINE.filter((id) => ["done", "waiting", "skipped"].includes(statuses[id])).length;
  const elapsed = startedAt ? Math.max(0, Math.round(((finishedAt ?? now) - startedAt) / 1000)) : 0;
  const generated = job?.assets.length ?? 0;
  const lastRun = !startedAt ? "No runs yet" : generating ? "Running" : job?.status === "failed" || (!job && finishedAt) ? "Failed" : "Success";

  const node = nodes.find((n) => n.id === selected);
  const nd = node?.data as unknown as (StepData & { brand?: Brand }) | undefined;
  const images = job?.assets.filter((a) => a.kind === "image") ?? [];
  const videos = job?.assets.filter((a) => a.kind === "video") ?? [];

  function outputPanel() {
    if (!job) return <p className="text-sm text-violet-200/70">No output yet. Run the workflow.</p>;
    if (selected === "images") return images.length ? (
      <div className="grid grid-cols-2 gap-2">{images.map((a) => <img key={a.id} src={`/api/assets/${a.id}/file`} alt="" className="rounded-lg" />)}</div>
    ) : <p className="text-sm text-violet-200/70">No images yet.</p>;
    if (selected === "video") return videos.length ? <video controls src={`/api/assets/${videos[0].id}/file`} className="w-full rounded-lg" /> : <p className="text-sm text-violet-200/70">No video.</p>;
    if (selected === "caption") return job.seo_title ? (
      <div className="space-y-2 text-sm">
        <div className="font-semibold">{job.seo_title}</div>
        <p className="line-clamp-5 text-violet-100/80">{job.description}</p>
        <p className="text-cyan-300">{job.hashtags.join(" ")}</p>
      </div>
    ) : <p className="text-sm text-violet-200/70">Not written yet.</p>;
    if (selected === "approval") return <p className="text-sm">{statuses.approval === "waiting" ? "Waiting for a manager. Nothing has been posted." : "Not submitted yet."}</p>;
    return <p className="text-sm text-violet-200/70">{BADGE[statuses[selected] ?? "idle"].text}.</p>;
  }

  return (
    <div className="pb-4">
      <div className="sf-panel mb-3 flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
        <div className="text-sm">Workflow: <b>Social Media Auto Publish v2.0</b></div>
        <div className="flex flex-wrap items-center gap-2">
          {msg && <span className={`max-w-sm text-xs ${msg.ok ? "text-emerald-300" : "text-amber-300"}`}>{msg.text}</span>}
          {job?.status === "pending_approval" && (
            <Link href="/app/content" className="text-xs text-cyan-300 underline">Open in Content Studio</Link>
          )}
          <button type="button" onClick={run} disabled={generating} className="sf-btn flex h-10 items-center gap-2 px-4 text-sm">
            <Play className="h-4 w-4" /> {generating ? "Running…" : "Run Workflow"}
          </button>
          <button type="button" onClick={save}
            className="flex h-10 items-center gap-2 rounded-xl border border-violet-400/40 bg-white/5 px-4 text-sm hover:bg-white/10">
            <Save className="h-4 w-4" /> Save
          </button>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[230px_1fr_310px]">
        <aside className="sf-panel max-h-[540px] self-start overflow-y-auto p-3">
          <h2 className="mb-2 font-bold">Components</h2>
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-200/60" />
            <input disabled placeholder="Search components…" className="h-9 w-full rounded-lg border border-violet-400/30 bg-white/5 pl-8 text-xs" />
          </div>
          {PALETTE.map((g) => (
            <div key={g.title} className="mb-3">
              <div className="mb-2 flex items-center justify-between rounded-lg bg-white/10 px-3 py-1.5 text-sm">{g.title}<ChevronDown className="h-4 w-4" /></div>
              <div className="grid grid-cols-4 gap-1.5">
                {g.items.map(([Icon, label, brand]) => (
                  <div key={label} title="Adding new nodes comes in a later step"
                    className="flex flex-col items-center gap-1 rounded-lg border border-violet-400/30 bg-[#160c3a] py-2 text-[10px] text-violet-100/90">
                    {brand ? <BrandLogo brand={brand} size={22} /> : Icon && <Icon className="h-5 w-5 text-fuchsia-300" />}
                    {brand ? "" : label}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </aside>

        <div className="sf-panel h-[540px] overflow-hidden p-0">
          <ReactFlow nodes={shown} edges={edges} nodeTypes={nodeTypes} className="dark" fitView fitViewOptions={{ padding: 0.12 }}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
            onNodeClick={(_, n) => { setSelected(n.id); setPtab("settings"); }}
            nodesConnectable={false} proOptions={{ hideAttribution: true }}>
            <Background gap={24} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable className="!bg-[#150f45]" />
          </ReactFlow>
        </div>

        <aside className="sf-panel max-h-[540px] self-start overflow-y-auto p-4">
          <div className="mb-3 flex items-start justify-between">
            <h2 className="font-bold">Node Configuration</h2>
          </div>
          {nd && (
            <>
              <div className="mb-3">
                <div className="font-semibold">{nd.label}</div>
                <p className="text-xs text-violet-200/70">{nd.desc ?? (selected.startsWith("p-") ? "Platform. Posting is switched off until the account is connected." : "")}</p>
              </div>
              <div className="mb-3 flex gap-1 rounded-xl border border-violet-400/25 bg-white/5 p-1 text-xs">
                {(["settings", "prompt", "output"] as const).map((k) => (
                  <button key={k} type="button" onClick={() => setPtab(k)}
                    className={`flex-1 rounded-lg py-1.5 capitalize ${ptab === k ? "sf-nav-active text-white" : "text-violet-200/80 hover:bg-white/5"}`}>{k}</button>
                ))}
              </div>

              {ptab === "settings" && selected === "input" && (
                <div>
                  <label className="mb-1 block text-xs text-violet-200/80">Topic or idea</label>
                  <textarea value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={1500}
                    placeholder={hint ? `Example: ${hint}` : "Describe your topic or idea."}
                    className="h-36 w-full resize-none rounded-lg border border-violet-400/40 bg-white/5 p-3 text-sm outline-none focus:border-cyan-300" />
                  <p className="mt-1 text-[11px] text-violet-200/60">For files and links, use Content Studio.</p>
                </div>
              )}
              {ptab === "settings" && selected === "content" && (
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs text-violet-200/80">AI Model</label>
                    <select value={model} onChange={(e) => setModel(e.target.value)} className={sel}>
                      <option value="auto" className={opt}>Auto (recommended)</option>
                      {models.map((m) => <option key={m.id} value={m.id} className={opt}>{m.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-violet-200/80">Content Type</label>
                    <select value={ctype} onChange={(e) => setCtype(e.target.value)} className={sel}>
                      {types.map((t) => <option key={t.key} value={t.key} className={opt}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-violet-200/80">Content Length</label>
                    <div className="flex gap-1 rounded-xl border border-violet-400/25 bg-white/5 p-1 text-xs">
                      {(["Short", "Medium", "Long"] as const).map((l) => (
                        <button key={l} type="button" onClick={() => setLength(l)}
                          className={`flex-1 rounded-lg py-1.5 ${length === l ? "sf-nav-active text-white" : "text-violet-200/80"}`}>{l}</button>
                      ))}
                    </div>
                  </div>
                  <button type="button" onClick={() => setEmojis(!emojis)} className="flex w-full items-center justify-between text-sm">
                    Include Emojis
                    <span className={`h-6 w-11 rounded-full p-0.5 transition ${emojis ? "bg-purple-500" : "bg-white/20"}`}>
                      <span className={`block h-5 w-5 rounded-full bg-white transition ${emojis ? "translate-x-5" : ""}`} />
                    </span>
                  </button>
                </div>
              )}
              {ptab === "settings" && selected !== "input" && selected !== "content" && (
                <p className="text-sm text-violet-200/80">
                  {selected.startsWith("p-") || selected === "publish"
                    ? "Publishing is switched off. It turns on after a manager approves content and your accounts are connected."
                    : "This step has no settings. It runs on its own."}
                </p>
              )}
              {ptab === "prompt" && (
                selected === "content" || selected === "input" ? (
                  <pre className="whitespace-pre-wrap rounded-lg border border-violet-400/20 bg-white/5 p-3 text-xs">{buildInstruction().trim() || "Write your topic first."}</pre>
                ) : <p className="text-sm text-violet-200/70">This step has no prompt.</p>
              )}
              {ptab === "output" && outputPanel()}
            </>
          )}
        </aside>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1.4fr]">
        <section className="sf-panel p-4">
          <div className="mb-3 flex items-center gap-3">
            <h2 className="font-bold">Workflow Execution</h2>
            <span className={`rounded-full px-2.5 py-0.5 text-xs ${lastRun === "Failed" ? "bg-red-400/15 text-red-300" : lastRun === "Running" ? "bg-cyan-400/15 text-cyan-300" : "bg-emerald-400/15 text-emerald-300"}`}>
              Last Run: {lastRun}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[["Execution Time", `${elapsed}s`], ["Nodes Completed", `${completed} / ${PIPELINE.length}`], ["Content Generated", generated], ["Platforms Published", 0]].map(([l, v]) => (
              <div key={l} className="rounded-xl border border-violet-400/25 bg-white/5 p-3">
                <div className="text-[11px] text-violet-200/70">{l}</div>
                <div className="mt-1 text-2xl font-bold">{v}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="sf-panel p-4">
          <h2 className="mb-2 flex items-center gap-2 font-bold"><Terminal className="h-4 w-4 text-purple-300" /> Execution Logs</h2>
          <div className="max-h-44 space-y-1.5 overflow-y-auto text-xs">
            {logs.length === 0 && <p className="text-violet-200/70">No logs yet. Write a topic in the Topic / Idea Input node and press Run Workflow.</p>}
            {logs.map((l, i) => (
              <div key={i} className="flex gap-3">
                <span>{l.state === "ok" ? "✅" : l.state === "fail" ? "❌" : "⏳"}</span>
                <span className="w-16 shrink-0 text-violet-200/60">{l.time}</span>
                <span className={l.state === "fail" ? "text-red-300" : ""}>{l.text}</span>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setLogs([])} className="mt-2 flex items-center gap-1 text-[11px] text-violet-200/60 hover:text-white"><X className="h-3 w-3" /> Clear logs</button>
        </section>
      </div>
    </div>
  );
}