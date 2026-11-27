"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, MoreHorizontal, Pencil, Trash2, X } from "lucide-react";
import { api } from "@/lib/api";

export type ActionJob = { id: number; status: string; title?: string | null };
type Full = {
  id: number; status: string; seo_title: string | null; description: string | null; hashtags: string[];
  copy_by_platform: Record<string, string>; rejection_reason?: string | null;
  assets: { id: number; kind: "image" | "video" }[];
};

const PLATFORMS = [
  ["instagram", "Instagram"], ["facebook", "Facebook"], ["youtube", "YouTube"],
  ["linkedin", "LinkedIn"], ["x", "X (Twitter)"], ["tiktok", "TikTok"],
] as const;
const EDITABLE = ["draft", "rejected", "pending_approval"];
const STATUS: Record<string, string> = {
  generating: "Generating", pending_approval: "Awaiting approval", approved: "Approved",
  published: "Published", rejected: "Rejected", failed: "Failed", draft: "Draft",
};
const input = "w-full rounded-lg border border-violet-400/40 bg-white/5 p-2.5 text-sm outline-none focus:border-cyan-300";
const item = "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40";

function Modal({ title, onClose, wide, children }: { title: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  // Rendered on document.body so the glass panels around it can't clip or move it
  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/70 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={title}
        className={`sf-panel mx-auto my-8 w-full p-5 text-white ${wide ? "max-w-3xl" : "max-w-md"}`}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-1 hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function ContentActions({ job, onChanged, onDeleted, variant = "header" }: {
  job: ActionJob; onChanged: () => void; onDeleted: (id: number) => void; variant?: "header" | "card";
}) {
  const [menu, setMenu] = useState(false);
  const [modal, setModal] = useState<null | "view" | "edit" | "delete">(null);
  const [full, setFull] = useState<Full | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [tags, setTags] = useState("");
  const [caps, setCaps] = useState<Record<string, string>>({});
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const out = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setMenu(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(false); };
    document.addEventListener("mousedown", out);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", out); document.removeEventListener("keydown", key); };
  }, [menu]);

  const canEdit = EDITABLE.includes(job.status);
  const canDelete = job.status !== "generating";
  const closeModal = () => { setModal(null); setError(""); };

  async function openFull(kind: "view" | "edit") {
    setMenu(false); setError(""); setFull(null); setModal(kind);
    try {
      const f = await api<Full>(`/jobs/${job.id}`);
      setFull(f);
      setTitle(f.seo_title ?? ""); setDesc(f.description ?? "");
      setTags((f.hashtags ?? []).join(" ")); setCaps(f.copy_by_platform ?? {});
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function save() {
    setBusy(true); setError("");
    try {
      const hashtags = tags.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean);
      await api(`/jobs/${job.id}`, {
        method: "PATCH",
        body: JSON.stringify({ seo_title: title, description: desc, hashtags, copy_by_platform: caps }),
      });
      setModal(null);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true); setError("");
    try {
      await api(`/jobs/${job.id}`, { method: "DELETE" });
      setModal(null);
      onDeleted(job.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const trigger = variant === "card"
    ? "grid h-8 w-8 place-items-center rounded-full border border-white/25 bg-black/55 hover:bg-black/80"
    : "grid h-8 w-8 place-items-center rounded-lg border border-violet-400/40 bg-white/5 hover:bg-white/10";

  return (
    <div ref={box} className="relative" onClick={(e) => e.stopPropagation()}>
      <button type="button" aria-label="More actions" aria-haspopup="menu" aria-expanded={menu}
        onClick={() => setMenu(!menu)} className={trigger}>
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {menu && (
        <div role="menu" className="sf-panel absolute right-0 z-30 mt-1 w-44 p-1 text-sm">
          <button role="menuitem" type="button" onClick={() => openFull("view")} className={item}>
            <Eye className="h-4 w-4" /> View
          </button>
          <button role="menuitem" type="button" disabled={!canEdit} onClick={() => openFull("edit")}
            title={canEdit ? undefined : "Only drafts, rejected items and items awaiting approval can be edited"} className={item}>
            <Pencil className="h-4 w-4" /> Edit
          </button>
          <button role="menuitem" type="button" disabled={!canDelete}
            onClick={() => { setMenu(false); setError(""); setModal("delete"); }}
            title={canDelete ? undefined : "Wait for the agent to finish"} className={`${item} text-red-300 hover:bg-red-500/15`}>
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      )}

      {modal === "view" && (
        <Modal title="View content" wide onClose={closeModal}>
          {error && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">{error}</p>}
          {!full && !error && <p className="py-8 text-center text-sm text-violet-200/70">Loading…</p>}
          {full && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xl font-bold">{full.seo_title ?? "Untitled"}</h3>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs">{STATUS[full.status] ?? full.status}</span>
              </div>
              {full.status === "rejected" && full.rejection_reason && (
                <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300"><b>Rejected:</b> {full.rejection_reason}</p>
              )}
              {full.assets.filter((a) => a.kind === "video").map((a) => (
                <video key={a.id} controls src={`/api/assets/${a.id}/file`} className="max-h-[420px] w-full rounded-xl" />
              ))}
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {full.assets.filter((a) => a.kind === "image").map((a) => (
                  <img key={a.id} src={`/api/assets/${a.id}/file`} alt="" className="w-full rounded-xl"
                    onError={(e) => { e.currentTarget.style.display = "none"; }} />
                ))}
              </div>
              <p className="whitespace-pre-wrap text-sm">{full.description}</p>
              <div className="flex flex-wrap gap-2">
                {(full.hashtags ?? []).map((h) => <span key={h} className="rounded-full bg-purple-600/30 px-3 py-1 text-xs text-cyan-200">{h}</span>)}
              </div>
              <details className="rounded-lg border border-violet-400/20 bg-white/5 p-3">
                <summary className="cursor-pointer text-sm font-semibold">Captions for each platform</summary>
                {PLATFORMS.map(([k, label]) => (
                  <div key={k} className="mt-3 text-sm">
                    <div className="mb-1 font-semibold">{label}</div>
                    <p className="whitespace-pre-wrap text-violet-100/90">{full.copy_by_platform?.[k]}</p>
                  </div>
                ))}
              </details>
            </div>
          )}
        </Modal>
      )}

      {modal === "edit" && (
        <Modal title="Edit content" wide onClose={closeModal}>
          {!full && !error && <p className="py-8 text-center text-sm text-violet-200/70">Loading…</p>}
          {full && (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-violet-200/80">SEO title</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className={input} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-violet-200/80">Description</label>
                <textarea value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={5000} rows={4} className={`${input} resize-y`} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-violet-200/80">Hashtags (separate with spaces)</label>
                <input value={tags} onChange={(e) => setTags(e.target.value)} className={input} />
              </div>
              <details className="rounded-lg border border-violet-400/20 bg-white/5 p-3">
                <summary className="cursor-pointer text-sm font-semibold">Captions for each platform</summary>
                {PLATFORMS.map(([k, label]) => (
                  <div key={k} className="mt-3">
                    <label className="mb-1 flex justify-between text-xs text-violet-200/80">
                      <span>{label}</span>{k === "x" && <span>{(caps[k] ?? "").length}/280</span>}
                    </label>
                    <textarea value={caps[k] ?? ""} onChange={(e) => setCaps({ ...caps, [k]: e.target.value })} rows={3} className={`${input} resize-y`} />
                  </div>
                ))}
              </details>
              <p className="text-xs text-violet-200/60">Images and video can&apos;t be edited here. Use Regenerate to make new ones.</p>
            </div>
          )}
          {error && <p className="mt-3 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">{error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={closeModal} className="rounded-xl border border-violet-400/40 px-4 py-2 text-sm hover:bg-white/10">Cancel</button>
            <button type="button" onClick={save} disabled={busy || !full} className="sf-btn px-5 py-2 text-sm">{busy ? "Saving…" : "Save changes"}</button>
          </div>
        </Modal>
      )}

      {modal === "delete" && (
        <Modal title="Delete this content?" onClose={closeModal}>
          <p className="text-sm text-violet-100/90">
            <b>{job.title || "Untitled"}</b> will be deleted permanently: its text, images, video and uploaded files are removed from the server. This cannot be undone.
          </p>
          {error && <p className="mt-3 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">{error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={closeModal} className="rounded-xl border border-violet-400/40 px-4 py-2 text-sm hover:bg-white/10">Cancel</button>
            <button type="button" onClick={remove} disabled={busy}
              className="rounded-xl border border-red-400/60 bg-red-500/80 px-5 py-2 text-sm font-semibold hover:bg-red-500 disabled:opacity-60">
              {busy ? "Deleting…" : "Delete"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}