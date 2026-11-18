"use client";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlow, Background, Controls, MiniMap, addEdge, useNodesState, useEdgesState,
  type Connection, type Edge, type Node,
} from "@xyflow/react";
import { Play, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, WS_BASE } from "@/lib/api";
import { nodeTypes } from "@/components/nodes";
import type { Brand } from "@/components/BrandLogo";

const src = (id: string, label: string, brand: Brand, y: number): Node =>
  ({ id, type: "source", position: { x: 0, y }, data: { label, brand } });
const tool = (id: string, label: string, sub: string, y: number): Node =>
  ({ id, type: "tool", position: { x: 800, y }, data: { label, sub } });

const INITIAL_NODES: Node[] = [
  src("ig", "Instagram", "instagram", 0), src("fb", "Facebook", "facebook", 100),
  src("yt", "YouTube", "youtube", 200), src("li", "LinkedIn", "linkedin", 300), src("x", "X (Twitter)", "x", 400),
  { id: "hub", type: "hub", position: { x: 400, y: 120 }, data: { label: "Hub" } },
  tool("content", "AI Content Generator", "Create Posts, Captions & Hashtags", 0),
  tool("image", "Image Generator", "Create Social Media Visuals", 100),
  tool("video", "Video Generator", "Create Reels, Shorts & Videos", 200),
  tool("publisher", "Social Media Publisher", "Publish after manager approval", 300),
];
const edge = (s: string, t: string): Edge => ({ id: `${s}-${t}`, source: s, target: t, animated: true, style: { stroke: "#a855f7", strokeWidth: 2 } });
const INITIAL_EDGES: Edge[] = [
  ...["ig", "fb", "yt", "li", "x"].map((s) => edge(s, "hub")),
  ...["content", "image", "video", "publisher"].map((t) => edge("hub", t)),
];
const GROUPS = { "Social Media Sources": ["Instagram", "Facebook", "YouTube", "LinkedIn", "X", "TikTok"], "AI Models": ["GPT", "Claude", "Gemini"], "Logic & Control": ["Condition", "Loop", "Delay", "Schedule"], Actions: ["Generate", "Publish", "Notify", "API Call"] };

type Msg = { tone: "ok" | "warn"; text: string } | null;

export default function WorkflowPage() {
  const router = useRouter();
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [status, setStatus] = useState<Record<string, "running" | "done">>({});
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    api<{ nodes: Node[]; edges: Edge[] }>("/workflows/default")
      .then((w) => { if (w.nodes.length) { setNodes(w.nodes); setEdges(w.edges); } })
      .catch(() => {});
    return () => wsRef.current?.close();
  }, [setNodes, setEdges]);

  const onConnect = useCallback((c: Connection) => setEdges((e) => addEdge({ ...c, animated: true }, e)), [setEdges]);
  const shown = useMemo(() => nodes.map((n) => ({ ...n, data: { ...n.data, status: status[n.id] } })), [nodes, status]);

  async function runWorkflow() {
    setStatus({}); setRunning(true); setMsg(null);
    try {
      const { run_id } = await api<{ run_id: string }>("/workflows/default/run", { method: "POST" });
      const ws = new WebSocket(`${WS_BASE}/ws/runs/${run_id}`);
      wsRef.current = ws;
      ws.onmessage = (m) => {
        const d = JSON.parse(m.data);
        if (d.node) setStatus((s) => ({ ...s, [d.node]: d.status }));
        if (d.type === "finished") {
          setRunning(false);
          setMsg({ tone: "warn", text: "Test run finished. Nothing was posted to any platform. Real posting will start only after manager approval." });
        }
      };
      ws.onclose = () => setRunning(false);
    } catch { router.replace("/login"); }
  }

  async function save() {
    await api("/workflows/default", { method: "PUT", body: JSON.stringify({ nodes, edges }) });
    setMsg({ tone: "ok", text: "Workflow saved." });
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-400/30 bg-white/5 px-4 py-2">
        <div className="text-sm">Project: <b>Social Media Automation v2.0</b></div>
        <div className="flex items-center gap-2">
          {msg && <span className={`max-w-md text-xs ${msg.tone === "ok" ? "text-emerald-300" : "text-amber-300"}`}>{msg.text}</span>}
          <Button onClick={runWorkflow} disabled={running} className="bg-gradient-to-r from-fuchsia-500 to-purple-500">
            <Play className="mr-1 h-4 w-4" />{running ? "Running…" : "Run Workflow"}
          </Button>
          <Button variant="outline" onClick={save} className="border-violet-400/40 bg-white/5"><Save className="mr-1 h-4 w-4" />Save</Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-3">
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
    </div>
  );
}