"use client";
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useState } from "react";
import { Film, Image as ImageIcon, ThumbsDown, ThumbsUp } from "lucide-react";
import { BrandLogo, type Brand } from "@/components/BrandLogo";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/format";

type Pending = { id: number; seo_title: string | null; instruction: string; created_at: string; owner: string; thumb: number | null; has_video: boolean };
type Job = {
  id: number; seo_title: string | null; description: string | null; hashtags: string[];
  copy_by_platform: Record<string, string>; assets: { id: number; kind: "image" | "video" }[];
};

const BRANDS: Brand[] = ["instagram", "facebook", "youtube", "linkedin", "x", "tiktok"];
const NAMES: Record<string, string> = { instagram: "Instagram", facebook: "Facebook", youtube: "YouTube", linkedin: "LinkedIn", x: "X (Twitter)", tiktok: "TikTok" };

export default function ContentReview() {
  const [items, setItems] = useState<Pending[]>([]);
  const [selId, setSelId] = useState<number | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    api<Pending[]>("/approvals").then(setItems).catch((e) => setMsg({ ok: false, text: e.message }));
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!selId) return;
    api<Job>(`/jobs/${selId}`).then(setJob).catch((e) => setMsg({ ok: false, text: e.message }));
  }, [selId]);

  const shown = job && job.id === selId ? job : null;

  async function decide(approve: boolean) {
    if (!selId) return;
    setBusy(true); setMsg(null);
    try {
      await api(`/jobs/${selId}/${approve ? "approve" : "reject"}`, { method: "POST", body: JSON.stringify({ reason }) });
      setMsg({ ok: true, text: approve ? "Approved. Publishing is not connected yet, so nothing was posted." : "Rejected. The author can see your reason." });
      setSelId(null); setJob(null); setReason("");
      load();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 pb-4">
      <div className="sf-panel px-5 py-3">
        <h1 className="text-2xl font-bold leading-tight">Content Review</h1>
        <p className="text-sm text-violet-200/70">Review AI-generated content from your users. Nothing is published until you approve it.</p>
      </div>
      {msg && <p className={`rounded-xl px-4 py-2 text-sm ${msg.ok ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>{msg.text}</p>}

      <div className="grid gap-3 lg:grid-cols-[minmax(300px,380px)_1fr]">
        <section className="sf-panel max-h-[72vh] space-y-2 overflow-y-auto p-3">
          <h2 className="px-1 font-bold">Waiting for review ({items.length})</h2>
          {items.length === 0 && <p className="px-1 py-6 text-center text-sm text-violet-200/70">Nothing is waiting. 🎉</p>}
          {items.map((j) => (
            <button key={j.id} type="button" onClick={() => { setSelId(j.id); setMsg(null); setReason(""); }}
              className={`flex w-full items-center gap-3 rounded-xl border p-2 text-left transition ${selId === j.id ? "border-fuchsia-400/80 bg-white/10" : "border-violet-400/25 bg-white/5 hover:border-violet-400/60"}`}>
              <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-purple-700/60 to-cyan-600/40">
                {j.thumb ? <img src={`/api/assets/${j.thumb}/file`} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-5 w-5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 block text-sm font-semibold leading-tight">{j.seo_title || j.instruction}</span>
                <span className="mt-1 flex items-center gap-2 text-[11px] text-violet-200/60">
                  <span>{j.owner}</span><span>{timeAgo(j.created_at)}</span>{j.has_video && <Film className="h-3 w-3" />}
                </span>
              </span>
            </button>
          ))}
        </section>

        <section className="sf-panel p-4">
          {!shown && <p className="py-16 text-center text-sm text-violet-200/70">Select an item to review it.</p>}
          {shown && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold">{shown.seo_title ?? "Untitled"}</h2>
              {shown.assets.filter((a) => a.kind === "video").map((a) => (
                <video key={a.id} controls src={`/api/assets/${a.id}/file`} className="max-h-[420px] w-full rounded-xl" />
              ))}
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {shown.assets.filter((a) => a.kind === "image").map((a) => (
                  <img key={a.id} src={`/api/assets/${a.id}/file`} alt="" className="w-full rounded-xl" />
                ))}
              </div>
              <p className="whitespace-pre-wrap text-sm">{shown.description}</p>
              <div className="flex flex-wrap gap-2">
                {shown.hashtags.map((h) => <span key={h} className="rounded-full bg-purple-600/30 px-3 py-1 text-xs text-cyan-200">{h}</span>)}
              </div>
              <details className="rounded-lg border border-violet-400/20 bg-white/5 p-3">
                <summary className="cursor-pointer text-sm font-semibold">Captions for each platform</summary>
                {BRANDS.map((b) => (
                  <div key={b} className="mt-3 text-sm">
                    <div className="mb-1 flex items-center gap-2 font-semibold"><BrandLogo brand={b} size={20} />{NAMES[b]}</div>
                    <p className="whitespace-pre-wrap text-violet-100/90">{shown.copy_by_platform[b]}</p>
                  </div>
                ))}
              </details>
              <div className="space-y-2 border-t border-violet-400/20 pt-3">
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500}
                  placeholder="Reason (needed only if you reject)"
                  className="h-20 w-full resize-none rounded-lg border border-violet-400/40 bg-white/5 p-3 text-sm outline-none focus:border-cyan-300" />
                <div className="flex gap-2">
                  <button type="button" disabled={busy} onClick={() => decide(true)} className="sf-btn flex flex-1 items-center justify-center gap-2 py-2.5 text-sm">
                    <ThumbsUp className="h-4 w-4" /> Approve
                  </button>
                  <button type="button" disabled={busy || reason.trim().length < 3} onClick={() => decide(false)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-400/60 bg-red-500/15 py-2.5 text-sm text-red-200 hover:bg-red-500/25 disabled:opacity-50">
                    <ThumbsDown className="h-4 w-4" /> Reject
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}