"use client";
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2, ChevronRight, Download, Film, FileText, FolderOpen, Globe, Image as ImageIcon,
  Layers, LayoutGrid, Lightbulb, Megaphone, Palette, Pencil, Plus, RefreshCw, Search,
  SlidersHorizontal, Sparkles, Video, X,
} from "lucide-react";
import { BrandLogo, type Brand } from "@/components/BrandLogo";
import { api } from "@/lib/api";
import { ContentActions } from "@/components/ContentActions";

type Step = { id: number; step_no: number; tool_name: string; status: "running" | "done" | "failed"; output: { error?: string; summary?: string } | null };
type Job = {
  id: number; status: string; seo_title: string | null; description: string | null;
  hashtags: string[]; copy_by_platform: Record<string, string>;
  steps: Step[]; assets: { id: number; kind: "image" | "video" }[];
};
type JobItem = { id: number; status: string; seo_title: string | null; instruction: string; created_at: string; thumb: number | null; images: number; has_video: boolean; aspect: string };
type CType = { key: string; label: string; hint: string };
type ModelOpt = { id: string; label: string };

type TabKey = "create" | "library" | "templates" | "brand" | "ideas" | "bulk";
type FormatKey = "post" | "image" | "video" | "reel" | "carousel";
type KindKey = "all" | "posts" | "images" | "videos" | "reels" | "carousels";

const TABS: { key: TabKey; label: string; Icon: typeof Sparkles }[] = [
  { key: "create", label: "Create Content", Icon: Sparkles },
  { key: "library", label: "Content Library", Icon: Layers },
  { key: "templates", label: "Templates", Icon: LayoutGrid },
  { key: "brand", label: "Brand Kit", Icon: Palette },
  { key: "ideas", label: "AI Ideas", Icon: Lightbulb },
  { key: "bulk", label: "Bulk Create", Icon: Layers },
];
const FORMATS: { key: FormatKey; label: string; Icon: typeof Sparkles }[] = [
  { key: "post", label: "Post", Icon: ImageIcon },
  { key: "image", label: "Image", Icon: ImageIcon },
  { key: "video", label: "Video", Icon: Video },
  { key: "reel", label: "Reel/Short", Icon: Film },
  { key: "carousel", label: "Carousel", Icon: Layers },
];
const FORMAT_HINT: Record<FormatKey, string> = {
  post: "Format chosen on screen: a social media post with copy and images. Make a video only if the request asks for one.",
  image: "Format chosen on screen: images only, no video.",
  video: "Format chosen on screen: include a video.",
  reel: "Format chosen on screen: a vertical 9:16 reel with a video.",
  carousel: "Format chosen on screen: a carousel of 5 images, no video.",
};
const TONES = ["Professional", "Friendly", "Playful", "Inspirational", "Bold", "Formal", "Warm"];
const PLATFORM_OPTS = ["All Platforms", "Instagram", "Facebook", "YouTube", "LinkedIn", "X", "TikTok"];
const PLATFORM_BRAND: Record<string, Brand> = { Instagram: "instagram", Facebook: "facebook", YouTube: "youtube", LinkedIn: "linkedin", X: "x", TikTok: "tiktok" };
const BRANDS: Brand[] = ["instagram", "facebook", "youtube", "linkedin", "x", "tiktok"];
const LANGS = ["English", "Hindi", "Telugu", "Tamil", "Kannada", "Malayalam", "Marathi", "Bengali", "Gujarati"];
const KINDS: { key: KindKey; label: string }[] = [
  { key: "all", label: "All" }, { key: "posts", label: "Posts" }, { key: "images", label: "Images" },
  { key: "videos", label: "Videos" }, { key: "reels", label: "Reels" }, { key: "carousels", label: "Carousels" },
];

const STEP_LABEL: Record<string, string> = {
  read_inputs: "Reading your attachments and links",
  plan_content: "Understanding your request",
  write_copy: "Writing SEO title, description and hashtags",
  generate_image: "Creating an image",
  generate_video: "Generating the AI video (can take a few minutes)",
  submit_for_approval: "Submitting for manager approval",
  agent_error: "Agent error",
};
const STATUS_TEXT: Record<string, string> = {
  generating: "The agent is working…",
  pending_approval: "Waiting for manager approval. Nothing has been posted.",
  failed: "The agent could not finish. See the error above.",
};
const BADGE: Record<string, { label: string; cls: string }> = {
  generating: { label: "Generating", cls: "bg-cyan-400/15 text-cyan-300" },
  pending_approval: { label: "Awaiting approval", cls: "bg-amber-400/15 text-amber-300" },
  approved: { label: "Approved", cls: "bg-emerald-400/15 text-emerald-300" },
  published: { label: "Published", cls: "bg-emerald-400/15 text-emerald-300" },
  rejected: { label: "Rejected", cls: "bg-red-400/15 text-red-300" },
  failed: { label: "Failed", cls: "bg-red-400/15 text-red-300" },
  draft: { label: "Draft", cls: "bg-slate-400/15 text-slate-300" },
};
const ICON = { running: "⏳", done: "✅", failed: "❌" } as const;

const OK_EXT = [".png", ".jpg", ".jpeg", ".webp", ".pdf", ".txt", ".md", ".csv"];
const MAX_FILES = 5;
const MAX_TOTAL = 9 * 1024 * 1024;
const MAX_PROMPT = 1500;

const sel = "h-10 w-full rounded-lg border border-violet-400/40 bg-[#160c3a] px-3 text-sm text-white outline-none focus:border-cyan-300 disabled:opacity-50";
const opt = "bg-[#160c3a] text-white";

export default function ContentStudio() {
  const [tab, setTab] = useState<TabKey>("create");
  const [format, setFormat] = useState<FormatKey>("post");
  const [ctype, setCtype] = useState("auto");
  const [model, setModel] = useState("auto");
  const [tone, setTone] = useState("Professional");
  const [platform, setPlatform] = useState("All Platforms");
  const [language, setLanguage] = useState("English");
  const [advanced, setAdvanced] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [types, setTypes] = useState<CType[]>([{ key: "auto", label: "Auto detect", hint: "" }]);
  const [models, setModels] = useState<ModelOpt[]>([]);
  const [jobId, setJobId] = useState<number | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [rtab, setRtab] = useState<"preview" | "caption" | "hashtags" | "variations">("preview");
  const [pplat, setPplat] = useState<Brand>("instagram");
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<KindKey>("all");
  const [statusF, setStatusF] = useState("all");
  const fileRef = useRef<HTMLInputElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const loadJobs = useCallback(() => {
    api<JobItem[]>("/jobs").then(setJobs).catch(() => {});
  }, []);

    const afterChange = useCallback(() => {
    loadJobs();
    if (jobId) api<Job>(`/jobs/${jobId}`).then(setJob).catch(() => {});
  }, [jobId, loadJobs]);

  const afterDelete = useCallback((id: number) => {
    loadJobs();
    if (id === jobId) { setJob(null); setJobId(null); }
  }, [jobId, loadJobs]);

  useEffect(() => {
    api<CType[]>("/content-types").then(setTypes).catch(() => {});
    api<ModelOpt[]>("/models").then(setModels).catch(() => {});
    loadJobs();
  }, [loadJobs]);

  // Poll the job every 1.5 s while the agent is working
  useEffect(() => {
    if (!jobId) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const j = await api<Job>(`/jobs/${jobId}`);
        if (stop) return;
        setJob(j);
        if (j.status !== "generating") { loadJobs(); return; }
      } catch (e) {
        setError("Could not load the job: " + (e as Error).message);
        return;
      }
      timer = setTimeout(tick, 1500);
    };
    tick();
    return () => { stop = true; clearTimeout(timer); };
  }, [jobId, loadJobs]);

  function addFiles(list: File[]) {
    setError("");
    const next = [...files];
    for (const f of list) {
      const ext = f.name.includes(".") ? "." + f.name.split(".").pop()!.toLowerCase() : "";
      if (!OK_EXT.includes(ext)) { setError(`${f.name || "That file"}: use images, PDF, TXT, MD or CSV.`); continue; }
      if (next.length >= MAX_FILES) { setError(`You can attach up to ${MAX_FILES} files.`); break; }
      next.push(f);
    }
    if (next.reduce((sum, f) => sum + f.size, 0) > MAX_TOTAL) { setError("Attachments are too large (9 MB in total)."); return; }
    setFiles(next);
  }

  function onPaste(e: React.ClipboardEvent) {
    const imgs = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) return;
    e.preventDefault();
    addFiles(imgs.map((f, i) => new File([f], `screenshot-${Date.now()}-${i}.png`, { type: f.type })));
  }

  // The screen choices are sent as plain-language hints. The user's own words win.
  function buildInstruction() {
    const lines = [prompt.trim(), "", FORMAT_HINT[format], `Tone: ${tone}.`];
    if (platform !== "All Platforms") lines.push(`Main platform: ${platform} (still write every platform's caption).`);
    if (language !== "English") lines.push(`Write all the text in ${language}.`);
    lines.push("If the request above names a number of images, a video length or a language, those exact words win over these screen choices.");
    return lines.join("\n");
  }

  async function start() {
    setError(""); setJob(null); setJobId(null); setStarting(true);
    try {
      const fd = new FormData();
      fd.append("instruction", buildInstruction());
      fd.append("content_type", ctype);
      fd.append("model", model);
      files.forEach((f) => fd.append("files", f));
      const { id } = await api<{ id: number }>("/jobs", { method: "POST", body: fd });
      setJobId(id);
      setRtab("preview");
      loadJobs();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStarting(false);
    }
  }

  function clearAll() {
    setTab("create"); setPrompt(""); setFiles([]); setError(""); setJob(null); setJobId(null);
    topRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function openJob(id: number) {
    setTab("create"); setError(""); setJob(null); setJobId(id); setRtab("preview");
    topRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  const working = starting || job?.status === "generating";
  const hint = types.find((t) => t.key === ctype)?.hint ?? "";
  const images = job?.assets.filter((a) => a.kind === "image") ?? [];
  const videos = job?.assets.filter((a) => a.kind === "video") ?? [];
  const captionFor = job ? (job.copy_by_platform[pplat] ?? job.description ?? "") : "";

  const filtered = useMemo(() => jobs.filter((j) => {
    const text = `${j.seo_title ?? ""} ${j.instruction}`.toLowerCase();
    if (search && !text.includes(search.toLowerCase())) return false;
    if (statusF !== "all" && j.status !== statusF) return false;
    switch (kind) {
      case "posts": return !!j.seo_title;
      case "images": return j.images > 0 && !j.has_video;
      case "videos": return j.has_video;
      case "reels": return j.has_video && j.aspect === "9:16";
      case "carousels": return j.images >= 4 && !j.has_video;
      default: return true;
    }
  }), [jobs, search, statusF, kind]);

  const libraryUI = (
    <section className="sf-panel mt-3 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="mr-2 flex items-center gap-2 text-lg font-bold">
          <FolderOpen className="h-5 w-5 text-purple-300" /> My Content Library <span className="font-normal text-violet-200/70">({jobs.length})</span>
        </h2>
        <div className="relative min-w-[190px] max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-200/60" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search content…"
            className="h-9 w-full rounded-lg border border-violet-400/40 bg-white/5 pl-9 pr-3 text-sm outline-none focus:border-cyan-300" />
        </div>
        <div className="flex flex-wrap gap-1">
          {KINDS.map((k) => (
            <button key={k.key} type="button" onClick={() => setKind(k.key)}
              className={`rounded-full px-3 py-1 text-xs ${kind === k.key ? "sf-nav-active" : "border border-violet-400/30 text-violet-200/80 hover:bg-white/5"}`}>
              {k.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <select disabled title="Available after publishing is connected" className={`${sel} h-9 w-36`}>
            <option className={opt}>All Platforms</option>
          </select>
          <select value={statusF} onChange={(e) => setStatusF(e.target.value)} className={`${sel} h-9 w-40`}>
            <option value="all" className={opt}>All Status</option>
            {Object.entries(BADGE).map(([k, v]) => <option key={k} value={k} className={opt}>{v.label}</option>)}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-violet-200/70">{jobs.length === 0 ? "No content yet. Create your first one above." : "Nothing matches these filters."}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6">
                    {filtered.map((j) => {
            const b = BADGE[j.status] ?? BADGE.draft;
            return (
              <div key={j.id} className="relative rounded-xl border border-violet-400/30 bg-white/5 transition hover:border-fuchsia-400/70">
                <button type="button" onClick={() => openJob(j.id)} className="block w-full overflow-hidden rounded-xl text-left">
                  <div className="relative aspect-video bg-gradient-to-br from-purple-700/60 to-cyan-600/40">
                    {j.thumb && (
                      <img src={`/api/assets/${j.thumb}/file`} alt="" className="h-full w-full object-cover"
                        onError={(e) => { e.currentTarget.style.display = "none"; }} />
                    )}
                    {j.has_video && <Film className="absolute left-2 top-2 h-4 w-4 drop-shadow" />}
                    <div className="absolute inset-x-0 bottom-0 line-clamp-2 bg-gradient-to-t from-black/85 to-transparent p-2 text-xs font-semibold leading-tight">
                      {j.seo_title || j.instruction}
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-2 py-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] ${b.cls}`}>{b.label}</span>
                    <span className="text-[10px] text-violet-200/50">
                      {new Date(j.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                </button>
                <div className="absolute right-2 top-2 z-10">
                  <ContentActions variant="card" job={{ id: j.id, status: j.status, title: j.seo_title }}
                    onChanged={afterChange} onDeleted={afterDelete} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );

  return (
    <div className="pb-4">
      <div ref={topRef} className="sf-panel mb-3 flex flex-wrap items-center justify-between gap-3 px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl border border-violet-400/40 bg-white/5">
            <FileText className="h-6 w-6 text-purple-300" />
          </span>
          <div>
            <h1 className="text-2xl font-bold leading-tight">Content Studio</h1>
            <p className="text-sm text-violet-200/70">Create, manage and approve AI-powered content for your social media platforms.</p>
          </div>
        </div>
        <button type="button" onClick={clearAll} className="sf-btn flex items-center gap-2 px-4 py-2.5 text-sm">
          <Plus className="h-4 w-4" /> New Content
        </button>
      </div>

      <div className="sf-panel mb-3 flex flex-wrap gap-1 p-1.5">
        {TABS.map(({ key, label, Icon }) => (
          <button key={key} type="button" onClick={() => setTab(key)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm transition ${tab === key ? "sf-nav-active text-white" : "text-violet-200/80 hover:bg-white/5"}`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "library" && libraryUI}

      {(tab === "templates" || tab === "brand" || tab === "ideas" || tab === "bulk") && (
        <div className="sf-panel grid min-h-60 place-items-center p-8 text-center">
          <div>
            <h2 className="text-xl font-bold">{TABS.find((t) => t.key === tab)?.label}</h2>
            <p className="mt-2 text-sm text-violet-200/70">Coming soon. {tab === "brand" ? "Your logo and brand colours will be set in Settings." : ""}</p>
          </div>
        </div>
      )}

      {tab === "create" && (
        <>
          <div className="grid gap-3 lg:grid-cols-[minmax(340px,430px)_1fr]">
            {/* ---------- AI Content Creator ---------- */}
            <section className="sf-panel self-start p-4">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
                <Sparkles className="h-5 w-5 text-purple-300" /> AI Content Creator
              </h2>

              <div className="mb-3 flex flex-wrap gap-1 rounded-xl border border-violet-400/25 bg-white/5 p-1">
                {FORMATS.map(({ key, label, Icon }) => (
                  <button key={key} type="button" onClick={() => setFormat(key)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs ${format === key ? "sf-nav-active text-white" : "text-violet-200/80 hover:bg-white/5"}`}>
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </button>
                ))}
              </div>
              {(format === "video" || format === "reel") && (
                <p className="mb-3 text-[11px] text-amber-200/80">Tip: add the length in your idea, for example “15 seconds”. If you don’t, the video is 10 seconds.</p>
              )}

              <label className="mb-1 block text-xs text-violet-200/80">Content type</label>
              <select value={ctype} onChange={(e) => setCtype(e.target.value)} className={sel}>
                {types.map((t) => <option key={t.key} value={t.key} className={opt}>{t.label}</option>)}
              </select>

              <label className="mb-1 mt-3 block text-xs text-violet-200/80">Describe your content idea <span className="text-red-300">*</span></label>
              <div className="rounded-xl border border-violet-400/40 bg-white/5 focus-within:border-cyan-300">
                <textarea
                  value={prompt}
                  maxLength={MAX_PROMPT}
                  onChange={(e) => setPrompt(e.target.value)}
                  onPaste={onPaste}
                  placeholder={hint ? `Example: ${hint}` : "Describe what you want, in a sentence or two."}
                  className="h-32 w-full resize-none bg-transparent p-3 text-sm outline-none"
                />
                {files.length > 0 && (
                  <div className="flex flex-wrap gap-2 px-3 pb-2">
                    {files.map((f, i) => (
                      <span key={i} className="flex items-center gap-1 rounded-full bg-purple-600/30 py-1 pl-2 pr-1 text-xs">
                        <FileText className="h-3 w-3" />
                        <span className="max-w-[9rem] truncate">{f.name}</span>
                        <button type="button" aria-label="Remove attachment" onClick={() => setFiles(files.filter((_, j) => j !== i))}
                          className="rounded-full p-0.5 hover:bg-white/20"><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-3 border-t border-violet-400/20 px-3 py-2">
                  <button type="button" onClick={() => fileRef.current?.click()} aria-label="Add files or pictures"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-violet-400/50 hover:bg-white/10">
                    <Plus className="h-4 w-4" />
                  </button>
                  <span className="flex-1 text-[11px] text-violet-200/60">Add files or pictures, paste a screenshot (Ctrl+V), or paste links in your idea.</span>
                  <span className="text-[11px] text-violet-200/60">{prompt.length}/{MAX_PROMPT}</span>
                </div>
              </div>
              <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.txt,.md,.csv" className="hidden"
                onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />

              <div className="mt-3 grid grid-cols-3 gap-2">
                <div>
                  <label className="mb-1 block text-xs text-violet-200/80">Content Tone</label>
                  <select value={tone} onChange={(e) => setTone(e.target.value)} className={sel}>
                    {TONES.map((t) => <option key={t} className={opt}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-violet-200/80">Target Platform</label>
                  <select value={platform} onChange={(e) => { setPlatform(e.target.value); if (PLATFORM_BRAND[e.target.value]) setPplat(PLATFORM_BRAND[e.target.value]); }} className={sel}>
                    {PLATFORM_OPTS.map((t) => <option key={t} className={opt}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-violet-200/80">Language</label>
                  <select value={language} onChange={(e) => setLanguage(e.target.value)} className={sel}>
                    {LANGS.map((t) => <option key={t} className={opt}>{t}</option>)}
                  </select>
                </div>
              </div>

              <button type="button" onClick={() => setAdvanced(!advanced)}
                className="mt-3 flex w-full items-center justify-between rounded-lg border border-violet-400/30 bg-white/5 px-3 py-2 text-sm hover:bg-white/10">
                <span className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" /> Advanced Options</span>
                <ChevronRight className={`h-4 w-4 transition ${advanced ? "rotate-90" : ""}`} />
              </button>
              {advanced && (
                <div className="mt-2 rounded-lg border border-violet-400/20 bg-white/5 p-3">
                  <label className="mb-1 block text-xs text-violet-200/80">AI model</label>
                  <select value={model} onChange={(e) => setModel(e.target.value)} className={sel}>
                    <option value="auto" className={opt}>Auto (recommended)</option>
                    {models.map((m) => <option key={m.id} value={m.id} className={opt}>{m.label}</option>)}
                  </select>
                  <p className="mt-1 text-[11px] text-violet-200/50">
                    Images: FLUX.1 schnell · Video: Magic Hour AI video. If the chosen model is busy, another one takes over.
                  </p>
                </div>
              )}

              {error && <p role="alert" className="mt-3 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">{error}</p>}

              <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                <button type="button" onClick={start} disabled={working || prompt.trim().length < 5}
                  className="sf-btn flex h-11 items-center justify-center gap-2 text-sm">
                  <Sparkles className="h-4 w-4" /> {working ? "Agent is working…" : "Generate Content"}
                </button>
                <button type="button" onClick={clearAll}
                  className="flex h-11 items-center gap-2 rounded-xl border border-violet-400/40 bg-white/5 px-5 text-sm hover:bg-white/10">
                  <RefreshCw className="h-4 w-4" /> Clear
                </button>
              </div>
            </section>

            {/* ---------- Generated content + platform previews ---------- */}
            <div className="grid gap-3 xl:grid-cols-[1fr_290px]">
              <section className="sf-panel p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-lg font-bold">
                    <Sparkles className="h-5 w-5 text-purple-300" /> AI Generated Content
                    {job?.status === "pending_approval" && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
                  </h2>
                  <div className="flex gap-2 text-xs">
                    <button type="button" onClick={start} disabled={working || prompt.trim().length < 5} title="Runs the idea on the left again"
                      className="flex items-center gap-1.5 rounded-lg border border-violet-400/40 bg-white/5 px-3 py-1.5 hover:bg-white/10 disabled:opacity-50">
                      <RefreshCw className="h-3.5 w-3.5" /> Regenerate
                    </button>
                    {/* <button type="button" disabled title="Editing arrives with the approval step"
                      className="flex items-center gap-1.5 rounded-lg border border-violet-400/40 bg-white/5 px-3 py-1.5 opacity-50">
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button> */}
                    <details className="relative">
                      <summary className={`flex list-none items-center gap-1.5 rounded-lg border border-violet-400/40 bg-white/5 px-3 py-1.5 ${job && job.assets.length ? "cursor-pointer hover:bg-white/10" : "pointer-events-none opacity-50"}`}>
                        <Download className="h-3.5 w-3.5" /> Download
                      </summary>
                      <div className="sf-panel absolute right-0 z-10 mt-1 w-40 p-1 text-sm">
                        {job?.assets.map((a, i) => (
                          <a key={a.id} href={`/api/assets/${a.id}/file?download=1`}
                            className="block rounded px-3 py-1.5 hover:bg-white/10">
                            {a.kind === "video" ? "Video" : `Image ${i + 1}`}
                                                {job && (
                      <ContentActions job={{ id: job.id, status: job.status, title: job.seo_title }}
                        onChanged={afterChange} onDeleted={afterDelete} />
                    )}
                          </a>
                        ))}
                      </div>
                    </details>
                  </div>
                </div>

                {!job && <p className="py-10 text-center text-sm text-violet-200/70">Nothing yet. Describe your idea, then press Generate Content.</p>}

                {job && (
                  <>
                    <details open={job.status === "generating" || job.status === "failed"} className="mb-3 rounded-lg border border-violet-400/20 bg-white/5 p-3">
                      <summary className="cursor-pointer text-sm font-semibold">Agent progress</summary>
                      <ul className="mt-2 space-y-2 text-sm">
                        {job.steps.map((s) => (
                          <li key={s.id}>
                            {ICON[s.status]} {STEP_LABEL[s.tool_name] ?? s.tool_name}
                            {s.output?.error && <div className="ml-6 text-xs text-red-300">{s.output.error}</div>}
                            {s.output?.summary && <div className="ml-6 text-xs text-cyan-200/80">{s.output.summary}</div>}
                          </li>
                        ))}
                      </ul>
                    </details>
                    <p className={`mb-3 rounded-lg px-3 py-2 text-sm ${job.status === "failed" ? "bg-red-500/15 text-red-300" : "bg-amber-400/10 text-amber-300"}`}>
                      {STATUS_TEXT[job.status] ?? (BADGE[job.status]?.label ?? job.status)}
                    </p>

                    <div className="mb-3 flex flex-wrap gap-1 rounded-xl border border-violet-400/25 bg-white/5 p-1 text-xs">
                      {([["preview", "Post Preview"], ["caption", "Caption"], ["hashtags", "Hashtags"], ["variations", "Platform Variations"]] as const).map(([k, l]) => (
                        <button key={k} type="button" onClick={() => setRtab(k)}
                          className={`rounded-lg px-3 py-1.5 ${rtab === k ? "sf-nav-active text-white" : "text-violet-200/80 hover:bg-white/5"}`}>{l}</button>
                      ))}
                    </div>

                    {!job.seo_title && <p className="text-sm text-violet-200/70">The content appears here as the agent finishes each step.</p>}

                    {job.seo_title && rtab === "preview" && (
                      <div className="space-y-3">
                        {videos.map((a) => <video key={a.id} controls src={`/api/assets/${a.id}/file`} className="w-full rounded-xl" />)}
                        {images.length > 0 && (
                          <div className={`grid gap-2 ${images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                            {images.map((a) => <img key={a.id} src={`/api/assets/${a.id}/file`} alt="Generated" className="w-full rounded-xl" />)}
                          </div>
                        )}
                        <div>
                          <div className="text-xs text-violet-200/70">SEO title</div>
                          <div className="text-lg font-bold">{job.seo_title}</div>
                        </div>
                        <div>
                          <div className="text-xs text-violet-200/70">Description</div>
                          <p className="whitespace-pre-wrap text-sm">{job.description}</p>
                        </div>
                      </div>
                    )}
                    {job.seo_title && rtab === "caption" && (
                      <div>
                        <div className="mb-1 text-xs text-violet-200/70">Caption for {pplat === "x" ? "X" : pplat.charAt(0).toUpperCase() + pplat.slice(1)}</div>
                        <p className="whitespace-pre-wrap rounded-xl border border-violet-400/20 bg-white/5 p-3 text-sm">{captionFor}</p>
                      </div>
                    )}
                    {job.seo_title && rtab === "hashtags" && (
                      <div className="flex flex-wrap gap-2">
                        {job.hashtags.map((h) => <span key={h} className="rounded-full bg-purple-600/30 px-3 py-1 text-sm text-cyan-200">{h}</span>)}
                      </div>
                    )}
                    {job.seo_title && rtab === "variations" && (
                      <div className="space-y-3">
                        {BRANDS.map((b) => (
                          <div key={b} className="rounded-xl border border-violet-400/20 bg-white/5 p-3">
                            <div className="mb-1 flex items-center gap-2 text-sm font-semibold"><BrandLogo brand={b} size={22} /><span className="capitalize">{b === "x" ? "X" : b}</span></div>
                            <p className="whitespace-pre-wrap text-sm">{job.copy_by_platform[b]}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </section>

              <section className="sf-panel self-start p-4">
                <h3 className="mb-3 flex items-center gap-2 font-bold"><Megaphone className="h-4 w-4 text-purple-300" /> Platform Previews</h3>
                <div className="mb-3 flex flex-wrap gap-2">
                  {BRANDS.map((b) => (
                    <button key={b} type="button" aria-label={b} onClick={() => setPplat(b)}
                      className={`rounded-xl p-0.5 transition ${pplat === b ? "ring-2 ring-fuchsia-400" : "opacity-70 hover:opacity-100"}`}>
                      <BrandLogo brand={b} size={36} />
                    </button>
                  ))}
                </div>
                {job?.seo_title ? (
                  <div className="overflow-hidden rounded-xl bg-white text-slate-900">
                    <div className="flex items-center gap-2 px-3 py-2">
                      <BrandLogo brand={pplat} size={26} />
                      <div className="text-xs font-semibold">yourbrand</div>
                    </div>
                    {videos[0] ? (
                      <video controls src={`/api/assets/${videos[0].id}/file`} className="w-full" />
                    ) : images[0] ? (
                      <img src={`/api/assets/${images[0].id}/file`} alt="" className="w-full" />
                    ) : (
                      <div className="aspect-square bg-slate-200" />
                    )}
                    <div className="space-y-1 px-3 py-2 text-xs">
                      <p className="line-clamp-6 whitespace-pre-wrap">{captionFor}</p>
                      <p className="text-blue-600">{job.hashtags.join(" ")}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-violet-200/70">The preview appears after the agent writes the copy.</p>
                )}
              </section>
            </div>
          </div>

          {libraryUI}
        </>
      )}
    </div>
  );
}





// "use client";
// import { useEffect, useRef, useState } from "react";
// import { FileText, Plus, X } from "lucide-react";
// import { Button } from "@/components/ui/button";
// import { api } from "@/lib/api";

// type Step = { id: number; step_no: number; tool_name: string; status: "running" | "done" | "failed"; output: { error?: string } | null };
// type Job = {
//   id: number; status: string; seo_title: string | null; description: string | null;
//   hashtags: string[]; copy_by_platform: Record<string, string>;
//   steps: Step[]; assets: { id: number; kind: "image" | "video" }[];
// };
// type CType = { key: string; label: string; hint: string };
// type ModelOpt = { id: string; label: string };

// const LABEL: Record<string, string> = {
//   read_inputs: "Reading your attachments and links",
//   write_copy: "Writing SEO title, description and hashtags",
//   generate_image: "Creating a scene image",
//   generate_video: "Building the video (up to 20 seconds)",
//   // plan_content: "Understanding your request",
//   // generate_video: "Generating the AI video (this can take a few minutes)",
//   submit_for_approval: "Submitting for manager approval",
//   agent_error: "Agent error",
// };
// const STATUS_TEXT: Record<string, string> = {
//   generating: "The agent is working…",
//   pending_approval: "Waiting for manager approval. Nothing has been posted.",
//   failed: "The agent could not finish. See the error above.",
// };
// const ICON = { running: "⏳", done: "✅", failed: "❌" } as const;

// const OK_EXT = [".png", ".jpg", ".jpeg", ".webp", ".pdf", ".txt", ".md", ".csv"];
// const MAX_FILES = 5;
// const MAX_TOTAL = 9 * 1024 * 1024;

// const sel = "h-10 w-full rounded-lg border border-violet-400/40 bg-[#1a1450] px-2 text-sm text-white outline-none focus:border-cyan-300";
// const opt = "bg-[#1a1450] text-white";

// export default function ContentPage() {
//   const [types, setTypes] = useState<CType[]>([{ key: "auto", label: "Auto detect", hint: "" }]);
//   const [models, setModels] = useState<ModelOpt[]>([]);
//   const [ctype, setCtype] = useState("auto");
//   const [model, setModel] = useState("auto");
//   const [prompt, setPrompt] = useState("");
//   const [files, setFiles] = useState<File[]>([]);
//   const [jobId, setJobId] = useState<number | null>(null);
//   const [job, setJob] = useState<Job | null>(null);
//   const [error, setError] = useState("");
//   const [starting, setStarting] = useState(false);
//   const fileRef = useRef<HTMLInputElement>(null);

//   // Load the content types and the models we have
//   useEffect(() => {
//     api<CType[]>("/content-types").then(setTypes).catch(() => {});
//     api<ModelOpt[]>("/models").then(setModels).catch(() => {});
//   }, []);

//   // Poll the job every 1.5 s while the agent is working
//   useEffect(() => {
//     if (!jobId) return;
//     let stop = false;
//     let timer: ReturnType<typeof setTimeout>;
//     const tick = async () => {
//       try {
//         const j = await api<Job>(`/jobs/${jobId}`);
//         if (stop) return;
//         setJob(j);
//         if (j.status !== "generating") return;
//       } catch (e) {
//         setError("Could not load the job: " + (e as Error).message);
//         return;
//       }
//       timer = setTimeout(tick, 1500);
//     };
//     tick();
//     return () => { stop = true; clearTimeout(timer); };
//   }, [jobId]);

//   function addFiles(list: File[]) {
//     setError("");
//     const next = [...files];
//     for (const f of list) {
//       const ext = f.name.includes(".") ? "." + f.name.split(".").pop()!.toLowerCase() : "";
//       if (!OK_EXT.includes(ext)) { setError(`${f.name || "That file"}: use images, PDF, TXT, MD or CSV.`); continue; }
//       if (next.length >= MAX_FILES) { setError(`You can attach up to ${MAX_FILES} files.`); break; }
//       next.push(f);
//     }
//     if (next.reduce((sum, f) => sum + f.size, 0) > MAX_TOTAL) { setError("Attachments are too large (9 MB in total)."); return; }
//     setFiles(next);
//   }

//   // Ctrl+V a screenshot straight into the box
//   function onPaste(e: React.ClipboardEvent) {
//     const imgs = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
//     if (!imgs.length) return;
//     e.preventDefault();
//     addFiles(imgs.map((f, i) => new File([f], `screenshot-${Date.now()}-${i}.png`, { type: f.type })));
//   }

//   async function start() {
//     setError(""); setJob(null); setJobId(null); setStarting(true);
//     try {
//       const fd = new FormData();
//       fd.append("instruction", prompt);
//       fd.append("content_type", ctype);
//       fd.append("model", model);
//       files.forEach((f) => fd.append("files", f));
//       const { id } = await api<{ id: number }>("/jobs", { method: "POST", body: fd });
//       setJobId(id);
//     } catch (e) {
//       setError((e as Error).message);
//     } finally {
//       setStarting(false);
//     }
//   }

//   const working = starting || job?.status === "generating";
//   const hint = types.find((t) => t.key === ctype)?.hint ?? "";
//   const images = job?.assets.filter((a) => a.kind === "image") ?? [];
//   const videos = job?.assets.filter((a) => a.kind === "video") ?? [];

//   return (
//     <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[400px_1fr]">
//       <section className="self-start rounded-2xl border border-violet-400/30 bg-white/5 p-4">
//         <h1 className="mb-3 text-lg font-bold">New content</h1>

//         <label className="mb-1 block text-xs text-violet-200/80">Content type</label>
//         <select value={ctype} onChange={(e) => setCtype(e.target.value)} className={sel}>
//           {types.map((t) => <option key={t.key} value={t.key} className={opt}>{t.label}</option>)}
//         </select>

//         <label className="mb-1 mt-3 block text-xs text-violet-200/80">AI model</label>
//         <select value={model} onChange={(e) => setModel(e.target.value)} className={sel}>
//           <option value="auto" className={opt}>Auto (recommended)</option>
//           {models.map((m) => <option key={m.id} value={m.id} className={opt}>{m.label}</option>)}
//         </select>
//         <p className="mt-1 text-[11px] text-violet-200/50">
//           Images: FLUX.1 schnell · Video: storyboard built with ffmpeg. If the chosen model is busy, another one takes over.
//         </p>

//         <div className="mt-3 rounded-xl border border-violet-400/40 bg-white/5 focus-within:border-cyan-300">
//           <textarea
//             value={prompt}
//             onChange={(e) => setPrompt(e.target.value)}
//             onPaste={onPaste}
//             placeholder={hint ? `Example: ${hint}` : "Describe what you want, in a sentence or two."}
//             className="h-32 w-full resize-none bg-transparent p-3 text-sm outline-none"
//           />
//           {files.length > 0 && (
//             <div className="flex flex-wrap gap-2 px-3 pb-2">
//               {files.map((f, i) => (
//                 <span key={i} className="flex items-center gap-1 rounded-full bg-purple-600/30 py-1 pl-2 pr-1 text-xs">
//                   <FileText className="h-3 w-3" />
//                   <span className="max-w-[9rem] truncate">{f.name}</span>
//                   <button type="button" aria-label="Remove attachment" onClick={() => setFiles(files.filter((_, j) => j !== i))}
//                     className="rounded-full p-0.5 hover:bg-white/20"><X className="h-3 w-3" /></button>
//                 </span>
//               ))}
//             </div>
//           )}
//           <div className="flex items-center gap-3 border-t border-violet-400/20 px-3 py-2">
//             <button type="button" onClick={() => fileRef.current?.click()} aria-label="Add files or pictures"
//               className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-violet-400/50 hover:bg-white/10">
//               <Plus className="h-4 w-4" />
//             </button>
//             <span className="text-[11px] text-violet-200/60">Add files or pictures, paste a screenshot (Ctrl+V), or paste links in your message.</span>
//           </div>
//         </div>
//         <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.txt,.md,.csv" className="hidden"
//           onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />

//         {error && <p role="alert" className="mt-3 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">{error}</p>}
//         <Button onClick={start} disabled={working || prompt.trim().length < 5}
//           className="mt-3 h-11 w-full bg-gradient-to-r from-purple-500 to-cyan-400 font-semibold text-white">
//           {working ? "Agent is working…" : "Run agent"}
//         </Button>
//       </section>

//       <section className="rounded-2xl border border-violet-400/30 bg-white/5 p-5">
//         <h2 className="mb-3 text-xl font-bold">Agent progress</h2>
//         {!job && <p className="text-sm text-violet-200/70">Nothing yet. Pick a content type, write a simple prompt, and run the agent.</p>}
//         {job && (
//           <>
//             <ul className="mb-4 space-y-2 text-sm">
//               {job.steps.map((s) => (
//                 <li key={s.id}>
//                   {ICON[s.status]} {LABEL[s.tool_name] ?? s.tool_name}
//                   {s.output?.error && <div className="ml-6 text-xs text-red-300">{s.output.error}</div>}
//                 </li>
//               ))}
//             </ul>
//             <p className={`mb-4 rounded-lg px-3 py-2 text-sm ${job.status === "failed" ? "bg-red-500/15 text-red-300" : "bg-amber-400/10 text-amber-300"}`}>
//               {STATUS_TEXT[job.status] ?? job.status}
//             </p>

//             {videos.map((a) => (
//               <video key={a.id} controls src={`/api/assets/${a.id}/file`} className="mb-4 w-full rounded-xl" />
//             ))}
//             {images.length > 0 && (
//               <div className="mb-4 grid grid-cols-2 gap-2">
//                 {images.map((a) => (
//                   // eslint-disable-next-line @next/next/no-img-element
//                   <img key={a.id} src={`/api/assets/${a.id}/file`} alt="Generated scene" className="w-full rounded-xl" />
//                 ))}
//               </div>
//             )}
//             {job.seo_title && (
//               <div className="space-y-3 text-sm">
//                 <div><div className="text-xs text-violet-200/70">SEO title</div><div className="font-semibold">{job.seo_title}</div></div>
//                 <div><div className="text-xs text-violet-200/70">Description</div><div className="whitespace-pre-wrap">{job.description}</div></div>
//                 <div><div className="text-xs text-violet-200/70">Hashtags</div><div className="text-cyan-300">{job.hashtags.join(" ")}</div></div>
//                 <details>
//                   <summary className="cursor-pointer text-xs text-violet-200/70">Caption for each platform</summary>
//                   {Object.entries(job.copy_by_platform).map(([p, text]) => (
//                     <div key={p} className="mt-2"><b className="capitalize">{p}:</b> {text}</div>
//                   ))}
//                 </details>
//               </div>
//             )}
//           </>
//         )}
//       </section>
//     </div>
//   );
// }