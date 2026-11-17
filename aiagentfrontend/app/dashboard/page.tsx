"use client";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlow, Background, Controls, MiniMap, addEdge, useNodesState, useEdgesState,
  type Connection, type Edge, type Node,
} from "@xyflow/react";
import { BarChart3, Bot, Calendar, FileText, Home, LogOut, Play, Plug, Save, Settings, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, WS_BASE } from "@/lib/api";
import { nodeTypes } from "@/components/nodes";

type User = { name: string; email: string; plan: string };
type Summary = { agents: number; runs_today: number; success_rate: number; tokens_used: number };

const src = (id: string, label: string, icon: string, color: string, y: number): Node =>
  ({ id, type: "source", position: { x: 0, y }, data: { label, icon, color } });
const tool = (id: string, label: string, sub: string, y: number): Node =>
  ({ id, type: "tool", position: { x: 800, y }, data: { label, sub } });

const INITIAL_NODES: Node[] = [
  src("ig", "Instagram", "IG", "#d6249f", 0), src("fb", "Facebook", "f", "#1877f2", 100),
  src("yt", "YouTube", "▶", "#ff0000", 200), src("li", "LinkedIn", "in", "#0a66c2", 300),
  src("x", "X (Twitter)", "X", "#000", 400),
  { id: "hub", type: "hub", position: { x: 400, y: 120 }, data: { label: "Hub" } },
  tool("content", "AI Content Generator", "Create Posts, Captions & Hashtags", 0),
  tool("image", "Image Generator", "Create Social Media Visuals", 100),
  tool("video", "Video Generator", "Create Reels, Shorts & Videos", 200),
  tool("publisher", "Social Media Publisher", "Publish to All Connected Platforms", 300),
];
const edge = (s: string, t: string): Edge => ({ id: `${s}-${t}`, source: s, target: t, animated: true, style: { stroke: "#a855f7", strokeWidth: 2 } });
const INITIAL_EDGES: Edge[] = [
  ...["ig", "fb", "yt", "li", "x"].map((s) => edge(s, "hub")),
  ...["content", "image", "video", "publisher"].map((t) => edge("hub", t)),
];

const NAV = [[Home, "Home"], [Bot, "Agents"], [Workflow, "Workflows"], [FileText, "Content"], [Calendar, "Calendar"], [BarChart3, "Analytics"], [Plug, "Integrations"], [Settings, "Settings"]] as const;
const GROUPS = { "Social Media Sources": ["Instagram", "Facebook", "YouTube", "LinkedIn", "X", "TikTok"], "AI Models": ["GPT", "Claude", "Gemini"], "Logic & Control": ["Condition", "Loop", "Delay", "Schedule"], Actions: ["Generate", "Publish", "Notify", "API Call"] };

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [status, setStatus] = useState<Record<string, "running" | "done">>({});
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  // Load user + data. Any 401 sends you back to login.
  useEffect(() => {
    Promise.all([
      api<User>("/auth/me"),
      api<Summary>("/dashboard/summary"),
      api<{ nodes: Node[]; edges: Edge[] }>("/workflows/default"),
    ])
      .then(([u, s, w]) => {
        setUser(u); setSummary(s);
        if (w.nodes.length) { setNodes(w.nodes); setEdges(w.edges); }
      })
      .catch(() => router.replace("/login"));
    return () => wsRef.current?.close();
  }, [router, setNodes, setEdges]);

  const onConnect = useCallback((c: Connection) => setEdges((e) => addEdge({ ...c, animated: true }, e)), [setEdges]);

  const shown = useMemo(() => nodes.map((n) => ({ ...n, data: { ...n.data, status: status[n.id] } })), [nodes, status]);

  async function runWorkflow() {
    setStatus({}); setRunning(true); setMsg("");
    try {
      const { run_id } = await api<{ run_id: string }>("/workflows/default/run", { method: "POST" });
      const ws = new WebSocket(`${WS_BASE}/ws/runs/${run_id}`);
      wsRef.current = ws;
      ws.onmessage = (m) => {
        const d = JSON.parse(m.data);
        if (d.node) setStatus((s) => ({ ...s, [d.node]: d.status }));
        if (d.type === "finished") { setRunning(false); setMsg("Workflow completed"); }
      };
      ws.onclose = () => setRunning(false);
    } catch { router.replace("/login"); }
  }

  async function save() {
    await api("/workflows/default", { method: "PUT", body: JSON.stringify({ nodes, edges }) });
    setMsg("Saved");
  }

  async function logout() {
    await api("/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  if (!user) return <div className="grid h-screen place-items-center bg-[#07051a] text-white">Loading…</div>;

  return (
    <div className="flex h-screen flex-col bg-[#07051a] text-white">
      <header className="flex items-center justify-between border-b border-violet-400/20 px-5 py-3">
        <div className="text-xl font-bold">Social<span className="text-purple-400">Flow AI</span></div>
        <nav className="hidden gap-6 text-sm md:flex">
          {["Dashboard", "Workflow", "Content", "Calendar", "Analytics"].map((t) => (
            <span key={t} className={t === "Workflow" ? "rounded-lg bg-purple-600/40 px-3 py-1" : "px-3 py-1 text-violet-200/80"}>{t}</span>
          ))}
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <div className="text-right"><div className="font-semibold">{user.name}</div>
            <div className="text-xs text-purple-300">{user.plan}</div></div>
          <Button size="icon" variant="ghost" onClick={logout} aria-label="Log out"><LogOut className="h-5 w-5" /></Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-20 flex-col items-center gap-4 border-r border-violet-400/20 py-4 text-[11px] sm:flex">
          {NAV.map(([Icon, label]) => (
            <div key={label} className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2 ${label === "Agents" ? "bg-purple-600/40" : "text-violet-200/80"}`}>
              <Icon className="h-5 w-5" />{label}
            </div>
          ))}
        </aside>

        <main className="flex flex-1 flex-col gap-3 overflow-hidden p-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-400/30 bg-white/5 px-4 py-2">
            <div className="text-sm">Project: <b>Social Media Automation v2.0</b></div>
            {summary && (
              <div className="hidden gap-5 text-xs text-violet-200/80 md:flex">
                <span>Agents <b className="text-white">{summary.agents}</b></span>
                <span>Runs today <b className="text-white">{summary.runs_today}</b></span>
                <span>Success <b className="text-white">{summary.success_rate}%</b></span>
                <span>Tokens <b className="text-white">{summary.tokens_used.toLocaleString()}</b></span>
              </div>
            )}
            <div className="flex items-center gap-2">
              {msg && <span className="text-xs text-emerald-300">{msg}</span>}
              <Button onClick={runWorkflow} disabled={running} className="bg-gradient-to-r from-fuchsia-500 to-purple-500">
                <Play className="mr-1 h-4 w-4" />{running ? "Running…" : "Run Workflow"}
              </Button>
              <Button variant="outline" onClick={save} className="border-violet-400/40 bg-white/5"><Save className="mr-1 h-4 w-4" />Save</Button>
            </div>
          </div>

          <div className="flex flex-1 gap-3 overflow-hidden">
            <aside className="hidden w-60 overflow-y-auto rounded-xl border border-violet-400/30 bg-white/5 p-3 lg:block">
              <h3 className="mb-3 font-bold">Components</h3>
              {Object.entries(GROUPS).map(([g, items]) => (
                <div key={g} className="mb-4">
                  <div className="mb-2 rounded-lg bg-white/10 px-3 py-1 text-sm">{g}</div>
                  <div className="grid grid-cols-3 gap-2">
                    {items.map((i) => (
                      <div key={i} className="rounded-lg border border-violet-400/30 bg-[#150f45] p-2 text-center text-[11px]">{i}</div>
                    ))}
                  </div>
                </div>
              ))}
            </aside>

            <div className="flex-1 overflow-hidden rounded-xl border border-violet-400/30">
              <ReactFlow nodes={shown} edges={edges} nodeTypes={nodeTypes}
                onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
                fitView className="dark">
                <Background gap={24} />
                <Controls />
                <MiniMap pannable zoomable />
              </ReactFlow>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}