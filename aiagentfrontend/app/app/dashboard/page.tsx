"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

type Summary = { agents: number; runs_today: number; success_rate: number; tokens_used: number };

export default function DashboardPage() {
  const [s, setS] = useState<Summary | null>(null);
  useEffect(() => { api<Summary>("/dashboard/summary").then(setS).catch(() => {}); }, []);

  const cards: [string, string | number][] = s
    ? [["Agents", s.agents], ["Runs today", s.runs_today], ["Success rate", `${s.success_rate}%`], ["Tokens used", s.tokens_used.toLocaleString()]]
    : [];

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Dashboard</h1>
      <p className="mb-5 text-sm text-violet-200/70">Sample numbers for now. They become real once runs are stored in the database.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-violet-400/30 bg-white/5 p-5">
            <div className="text-sm text-violet-200/70">{label}</div>
            <div className="mt-1 text-3xl font-bold">{value}</div>
          </div>
        ))}
      </div>
      <Link href="/workflow" className="mt-6 inline-block rounded-lg bg-purple-600/50 px-4 py-2 text-sm">Open workflow</Link>
    </div>
  );
}