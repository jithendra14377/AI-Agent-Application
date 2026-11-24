"use client";
import "@xyflow/react/dist/style.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ReactFlow, ReactFlowProvider, Background, MiniMap, Handle, Position, useNodesState, useEdgesState,
  useReactFlow, useViewport, type Edge, type Node, type NodeProps,
} from "@xyflow/react";
import {
  Activity, Aperture, Asterisk, Bell, Bot, CalendarClock, CalendarDays, CheckCircle2, ChevronDown, Clock,
  Code, FileText, Film, GitBranch, Hand, Image as ImageIcon, Layers, Lock, Menu, MoreVertical, Play,
  Repeat, Save, Send, Sparkles, ZoomIn, ZoomOut,
} from "lucide-react";
import { BrandLogo, type Brand } from "@/components/BrandLogo";
import { api } from "@/lib/api";

type Part = { ready: boolean; detail: string };
type AgentStatus = { content: Part; image: Part; video: Part; publisher: Part; platforms: Record<string, boolean> };
type ToolKey = "content" | "image" | "video" | "publisher";

const SOURCES: [string, Brand][] = [
  ["Instagram", "instagram"], ["Facebook", "facebook"], ["YouTube", "youtube"], ["LinkedIn", "linkedin"], ["X (Twitter)", "x"],
];
const TOOLS: { key: ToolKey; title: string; sub: string; Icon: typeof FileText; teal: boolean }[] = [
  { key: "content", title: "AI Content Generator", sub: "Create Posts, Captions & Hashtags", Icon: FileText, teal: false },
  { key: "image", title: "Image Generator", sub: "Create Social Media Visuals", Icon: ImageIcon, teal: true },
  { key: "video", title: "Video Generator", sub: "Create Reels, Shorts & Videos", Icon: Film, teal: true },
  { key: "publisher", title: "Social Media Publisher", sub: "Publish to All Connected Platforms", Icon: Send, teal: true },
];

const BASE_NODES: Node[] = [
  ...SOURCES.map(([label, brand], i): Node => ({ id: `s-${brand}`, type: "source", position: { x: 0, y: i * 110 }, data: { label, brand } })),
  { id: "hub", type: "hub", position: { x: 440, y: 95 }, data: {} },
  ...TOOLS.map((t, i): Node => ({ id: `t-${t.key}`, type: "tool", position: { x: 800, y: i * 120 - 10 }, data: { ...t, Icon: undefined, ready: false, detail: "" } })),
];
const BASE_EDGES: Edge[] = [
  ...SOURCES.map(([, b]): Edge => ({ id: `s-${b}-hub`, source: `s-${b}`, target: "hub", animated: true, style: { stroke: "#c084fc", strokeWidth: 2 } })),
  ...TOOLS.map((t): Edge => ({ id: `hub-${t.key}`, source: "hub", target: `t-${t.key}`, animated: true, style: { stroke: "#22d3ee", strokeWidth: 2 } })),
];

const HEX = "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)";

function SourceNode({ data }: NodeProps) {
  const d = data as unknown as { label: string; brand: Brand; connected?: boolean };
  return (
    <div title={d.connected ? "Connected" : "Not connected yet"} className="relative flex items-center gap-3 rounded-full border border-violet-400/60 bg-[#160c3a] py-1.5 pl-1.5 pr-8 shadow-[0_0_18px_rgba(168,85,247,0.45)]">
      <span className="rounded-full ring-2 ring-fuchsia-400/60"><BrandLogo brand={d.brand} size={42} /></span>
      <span className="text-sm font-semibold text-white">{d.label}</span>
      {d.connected
        ? <CheckCircle2 className="absolute right-2 top-1/2 h-5 w-5 -translate-y-1/2 text-emerald-400" />
        : <Lock className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />}
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-0 !bg-fuchsia-400" />
    </div>
  );
}

function HubNode() {
  return (
    <div className="relative drop-shadow-[0_0_22px_rgba(168,85,247,0.85)]">
      <div style={{ clipPath: HEX }} className="h-[250px] w-[230px] bg-gradient-to-b from-fuchsia-400 to-cyan-400 p-[3px]">
        <div style={{ clipPath: HEX }} className="grid h-full w-full place-items-center bg-gradient-to-b from-[#3b1d8f] to-[#150a45] text-center text-white">
          <div className="flex flex-col items-center px-8">
            <Bot className="mb-2 h-12 w-12 text-cyan-300" />
            <div className="text-xl font-extrabold leading-tight">Social Media<br />AI Agent Hub</div>
            <Sparkles className="mt-3 h-4 w-4 text-fuchsia-300" />
          </div>
        </div>
      </div>
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-fuchsia-400" />
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-0 !bg-cyan-300" />
    </div>
  );
}

function ToolNode({ data }: NodeProps) {
  const d = data as unknown as { key: ToolKey; title: string; sub: string; teal: boolean; ready: boolean; detail: string };
  const T = TOOLS.find((t) => t.key === d.key)!;
  const tone = d.teal ? "border-cyan-300/70 shadow-[0_0_18px_rgba(34,211,238,0.35)]" : "border-fuchsia-400/70 shadow-[0_0_18px_rgba(217,70,239,0.4)]";
  return (
    <div title={d.detail} className={`relative flex w-[330px] items-center gap-3 rounded-2xl border bg-[#12103d] px-4 py-3 text-white ${tone}`}>
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-cyan-300" />
      <T.Icon className={`h-9 w-9 shrink-0 ${d.teal ? "text-cyan-200" : "text-fuchsia-200"}`} />
      <div className="min-w-0">
        <div className="font-bold leading-tight">{d.title}</div>
        <div className="text-xs text-violet-100/80">{d.sub}</div>
        {d.detail && <div className={`mt-0.5 text-[11px] ${d.ready ? "text-emerald-300" : "text-amber-300"}`}>{d.detail}</div>}
      </div>
      {d.ready
        ? <CheckCircle2 className="absolute right-2 top-2 h-5 w-5 text-emerald-400" />
        : <Lock className="absolute right-2.5 top-2.5 h-4 w-4 text-slate-400" />}
    </div>
  );
}
const nodeTypes = { source: SourceNode, hub: HubNode, tool: ToolNode };

const PALETTE: { title: string; cols: number; items: { label: string; brand?: Brand; Icon?: typeof Bot }[] }[] = [
  { title: "Social Media Sources", cols: 3, items: [
    { label: "Instagram", brand: "instagram" }, { label: "Facebook", brand: "facebook" }, { label: "YouTube", brand: "youtube" },
    { label: "LinkedIn", brand: "linkedin" }, { label: "X (Twitter)", brand: "x" }, { label: "TikTok", brand: "tiktok" }] },
  { title: "AI Models", cols: 3, items: [{ label: "GPT", Icon: Aperture }, { label: "Claude", Icon: Asterisk }, { label: "Gemini", Icon: Sparkles }] },
  { title: "Logic & Control", cols: 4, items: [{ label: "Condition", Icon: GitBranch }, { label: "Loop", Icon: Repeat }, { label: "Delay", Icon: Clock }, { label: "Schedule", Icon: CalendarClock }] },
  { title: "Actions", cols: 4, items: [{ label: "Generate", Icon: Sparkles }, { label: "Publish", Icon: Send }, { label: "Notify", Icon: Bell }, { label: "API Call", Icon: Code }] },
];
const TILES: { label: string; Icon: typeof Bot; href: string }[] = [
  { label: "Plan Content", Icon: Sparkles, href: "/app/content" },
  { label: "Generate Assets", Icon: Layers, href: "/app/content" },
  { label: "Schedule & Publish", Icon: CalendarDays, href: "/app/calendar" },
  { label: "Track Performance", Icon: Activity, href: "/app/analytics" },
];

function Inner() {
  const router = useRouter();
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { zoom } = useViewport();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(BASE_NODES);
  const [edges, , onEdgesChange] = useEdgesState<Edge>(BASE_EDGES);
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [showPalette, setShowPalette] = useState(true);
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const [pan, setPan] = useState(false);
  const [menu, setMenu] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    api<AgentStatus>("/agents/status").then(setStatus).catch(() => setMsg({ ok: false, text: "Could not check the agent tools." }));
    api<{ nodes: Node[] }>("/workflows/agents")
      .then((w) => { if (w.nodes.some((n) => n.id === "hub")) setNodes(w.nodes); })
      .catch(() => {});
  }, [setNodes]);

  const shown = useMemo(() => nodes.map((n) => {
    if (n.type === "source") return { ...n, data: { ...n.data, connected: !!status?.platforms[(n.data as { brand: string }).brand] } };
    if (n.type === "tool") {
      const p = status?.[(n.data as { key: ToolKey }).key];
      return { ...n, data: { ...n.data, ready: !!p?.ready, detail: p?.detail ?? "" } };
    }
    return n;
  }), [nodes, status]);

  async function save() {
    try {
      await api("/workflows/agents", { method: "PUT", body: JSON.stringify({ nodes, edges }) });
      setMsg({ ok: true, text: "Layout saved." });
    } catch { setMsg({ ok: false, text: "Could not save the layout." }); }
  }
  function reset() {
    setNodes(BASE_NODES); setMenu(false);
    setTimeout(() => fitView({ padding: 0.12, duration: 300 }), 50);
  }

  const btn = "grid h-9 w-9 place-items-center rounded-lg text-violet-100 hover:bg-white/10";

  return (
    <div className="pb-4">
      <div className="sf-panel mb-3 flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Show or hide components" onClick={() => setShowPalette(!showPalette)}
            className="grid h-10 w-10 place-items-center rounded-lg border border-violet-400/40 bg-white/5 hover:bg-white/10"><Menu className="h-5 w-5" /></button>
          <div className="flex items-center gap-2 text-sm">Project: <b>Social Media Automation v2.0</b><ChevronDown className="h-4 w-4" /></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {msg && <span className={`text-xs ${msg.ok ? "text-emerald-300" : "text-amber-300"}`}>{msg.text}</span>}
          <div className="flex items-center rounded-xl border border-violet-400/40 bg-white/5 px-1">
            <button type="button" aria-label="Zoom out" onClick={() => zoomOut({ duration: 200 })} className={btn}><ZoomOut className="h-4 w-4" /></button>
            <span className="w-14 text-center text-sm">{Math.round(zoom * 100)}%</span>
            <button type="button" aria-label="Zoom in" onClick={() => zoomIn({ duration: 200 })} className={btn}><ZoomIn className="h-4 w-4" /></button>
            <button type="button" aria-label="Lock nodes and pan" title="Pan mode: nodes stay in place" onClick={() => setPan(!pan)} className={`${btn} ${pan ? "bg-purple-600/50" : ""}`}><Hand className="h-4 w-4" /></button>
          </div>
          <button type="button" onClick={() => router.push("/app/workflow")} title="Runs happen on the Workflows screen"
            className="sf-btn flex h-10 items-center gap-2 px-4 text-sm"><Play className="h-4 w-4" /> Run Workflow</button>
          <button type="button" onClick={save} className="flex h-10 items-center gap-2 rounded-xl border border-violet-400/40 bg-white/5 px-4 text-sm hover:bg-white/10"><Save className="h-4 w-4" /> Save</button>
          <div className="relative">
            <button type="button" aria-label="More" onClick={() => setMenu(!menu)} className="grid h-10 w-10 place-items-center rounded-xl border border-violet-400/40 bg-white/5 hover:bg-white/10"><MoreVertical className="h-4 w-4" /></button>
            {menu && (
              <div className="sf-panel absolute right-0 z-20 mt-2 w-44 p-1 text-sm">
                <button type="button" onClick={reset} className="w-full rounded-lg px-3 py-2 text-left hover:bg-white/10">Reset layout</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={`grid gap-3 ${showPalette ? "lg:grid-cols-[250px_1fr]" : ""}`}>
        {showPalette && (
          <aside className="sf-panel max-h-[640px] self-start overflow-y-auto p-3">
            <h2 className="mb-3 text-lg font-bold">Components</h2>
            {PALETTE.map((g) => (
              <div key={g.title} className="mb-3">
                <button type="button" onClick={() => setClosed({ ...closed, [g.title]: !closed[g.title] })}
                  className="mb-2 flex w-full items-center justify-between rounded-lg bg-white/10 px-3 py-1.5 text-sm">
                  {g.title}<ChevronDown className={`h-4 w-4 transition ${closed[g.title] ? "-rotate-90" : ""}`} />
                </button>
                {!closed[g.title] && (
                  <div className={`grid gap-1.5 ${g.cols === 3 ? "grid-cols-3" : "grid-cols-4"}`}>
                    {g.items.map(({ label, brand, Icon }) => (
                      <div key={label} title="Adding new components comes in a later step"
                        className="flex flex-col items-center gap-1 rounded-xl border border-violet-400/30 bg-[#160c3a] py-2 text-center text-[10px] text-violet-100/90">
                        {brand ? <BrandLogo brand={brand} size={34} /> : Icon && <Icon className="h-7 w-7 text-fuchsia-300" />}
                        {label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </aside>
        )}

        <div>
          <div className="sf-panel h-[560px] overflow-hidden p-0">
            <ReactFlow nodes={shown} edges={edges} nodeTypes={nodeTypes} className="dark" fitView fitViewOptions={{ padding: 0.1 }}
              onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} nodesDraggable={!pan} nodesConnectable={false}
              minZoom={0.3} maxZoom={1.6} proOptions={{ hideAttribution: true }}>
              <Background gap={26} />
              <MiniMap pannable zoomable className="!rounded-xl !border !border-violet-400/40 !bg-[#150f45]" style={{ width: 190, height: 120 }} />
            </ReactFlow>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {TILES.map(({ label, Icon, href }) => (
              <Link key={label} href={href}
                className="sf-panel flex flex-col items-center gap-1.5 px-3 py-4 text-center text-sm transition hover:border-fuchsia-400/70">
                <Icon className="h-7 w-7 text-fuchsia-300" />{label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AgentsPage() {
  return <ReactFlowProvider><Inner /></ReactFlowProvider>;
}