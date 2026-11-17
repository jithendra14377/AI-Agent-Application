import { Handle, Position, type NodeProps, type NodeTypes } from "@xyflow/react";
import { Bot, CheckCircle2 } from "lucide-react";

type D = { label: string; sub?: string; icon?: string; color?: string; status?: "running" | "done" };

const ring = (s?: string) =>
  s === "running" ? "animate-pulse ring-2 ring-cyan-300" : s === "done" ? "ring-1 ring-emerald-400" : "";

export function SourceNode({ data }: NodeProps) {
  const d = data as unknown as D;
  return (
    <div className={`flex items-center gap-2 rounded-full border border-purple-400/50 bg-[#150f45] py-1 pl-1 pr-4 text-white ${ring(d.status)}`}>
      <span className="grid h-10 w-10 place-items-center rounded-full text-sm font-bold" style={{ background: d.color }}>{d.icon}</span>
      <span className="font-medium">{d.label}</span>
      {d.status === "done" && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export function HubNode({ data }: NodeProps) {
  const d = data as unknown as D;
  return (
    <div className={`grid h-44 w-44 place-items-center rounded-3xl border-2 border-purple-400 bg-[#1a1260] text-center text-white shadow-[0_0_35px_#a855f7] ${ring(d.status)}`}>
      <div>
        <Bot className="mx-auto mb-1 h-8 w-8 text-cyan-300" />
        <div className="font-bold leading-tight">Social Media<br />AI Agent Hub</div>
      </div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export function ToolNode({ data }: NodeProps) {
  const d = data as unknown as D;
  return (
    <div className={`w-72 rounded-xl border border-cyan-400/60 bg-[#0b2a4a]/80 p-3 text-white ${ring(d.status)}`}>
      <div className="flex items-center justify-between">
        <b>{d.label}</b>
        {d.status === "done" && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
      </div>
      <div className="text-xs text-cyan-100/70">{d.sub}</div>
      <Handle type="target" position={Position.Left} />
    </div>
  );
}

export const nodeTypes = { source: SourceNode, hub: HubNode, tool: ToolNode } as unknown as NodeTypes;