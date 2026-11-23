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

// const LABEL: Record<string, string> = {
//   read_inputs: "Reading your attachments and links",
//   write_copy: "Writing SEO title, description and hashtags",
//   generate_image: "Creating a scene image",
//   generate_video: "Building the video (up to 20 seconds)",
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

// export default function ContentPage() {
//   const [prompt, setPrompt] = useState("");
//   const [files, setFiles] = useState<File[]>([]);
//   const [jobId, setJobId] = useState<number | null>(null);
//   const [job, setJob] = useState<Job | null>(null);
//   const [error, setError] = useState("");
//   const [starting, setStarting] = useState(false);
//   const fileRef = useRef<HTMLInputElement>(null);

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
//   const images = job?.assets.filter((a) => a.kind === "image") ?? [];
//   const videos = job?.assets.filter((a) => a.kind === "video") ?? [];

//   return (
//     <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-2">
//       <section className="rounded-2xl border border-violet-400/30 bg-white/5 p-5">
//         <h1 className="mb-1 text-xl font-bold">New content</h1>
//         <p className="mb-4 text-sm text-violet-200/70">
//           Describe what you want on any topic. The agent creates the SEO title, description, hashtags, images and a short video. A manager must approve before anything is posted.
//         </p>

//         <div className="rounded-xl border border-violet-400/40 bg-white/5 focus-within:border-cyan-300">
//           <textarea
//             value={prompt}
//             onChange={(e) => setPrompt(e.target.value)}
//             onPaste={onPaste}
//             placeholder="Example: A cheetah hunting a deer in the African savanna. Make a 20 second video."
//             className="h-44 w-full resize-none bg-transparent p-3 text-sm outline-none"
//           />
//           {files.length > 0 && (
//             <div className="flex flex-wrap gap-2 px-3 pb-2">
//               {files.map((f, i) => (
//                 <span key={i} className="flex items-center gap-1 rounded-full bg-purple-600/30 py-1 pl-2 pr-1 text-xs">
//                   <FileText className="h-3 w-3" />
//                   <span className="max-w-[10rem] truncate">{f.name}</span>
//                   <button type="button" aria-label="Remove attachment" onClick={() => setFiles(files.filter((_, j) => j !== i))}
//                     className="rounded-full p-0.5 hover:bg-white/20"><X className="h-3 w-3" /></button>
//                 </span>
//               ))}
//             </div>
//           )}
//           <div className="flex items-center gap-3 border-t border-violet-400/20 px-3 py-2">
//             <button type="button" onClick={() => fileRef.current?.click()} aria-label="Add files or pictures"
//               className="grid h-8 w-8 place-items-center rounded-full border border-violet-400/50 hover:bg-white/10">
//               <Plus className="h-4 w-4" />
//             </button>
//             <span className="text-xs text-violet-200/60">Add files or pictures, paste a screenshot (Ctrl+V), or paste links in your message.</span>
//           </div>
//         </div>
//         <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.txt,.md,.csv" className="hidden"
//           onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />

//         {error && <p role="alert" className="mt-3 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">{error}</p>}
//         <Button onClick={start} disabled={working || prompt.trim().length < 5}
//           className="mt-4 h-11 w-full bg-gradient-to-r from-purple-500 to-cyan-400 font-semibold text-white">
//           {working ? "Agent is working…" : "Run agent"}
//         </Button>
//       </section>

//       <section className="rounded-2xl border border-violet-400/30 bg-white/5 p-5">
//         <h2 className="mb-3 text-xl font-bold">Agent progress</h2>
//         {!job && <p className="text-sm text-violet-200/70">Nothing yet. Run the agent to see each step live.</p>}
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

"use client";
import { useEffect, useRef, useState } from "react";
import { FileText, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

type Step = { id: number; step_no: number; tool_name: string; status: "running" | "done" | "failed"; output: { error?: string; summary?: string } | null };
type Job = {
  id: number; status: string; seo_title: string | null; description: string | null;
  hashtags: string[]; copy_by_platform: Record<string, string>;
  steps: Step[]; assets: { id: number; kind: "image" | "video" }[];
};
type CType = { key: string; label: string; hint: string };
type ModelOpt = { id: string; label: string };

const LABEL: Record<string, string> = {
  read_inputs: "Reading your attachments and links",
  write_copy: "Writing SEO title, description and hashtags",
  generate_image: "Creating a scene image",
  // generate_video: "Building the video (up to 20 seconds)",
  plan_content: "Understanding your request",
  generate_video: "Generating the AI video (this can take a few minutes)",
  submit_for_approval: "Submitting for manager approval",
  agent_error: "Agent error",
};
const STATUS_TEXT: Record<string, string> = {
  generating: "The agent is working…",
  pending_approval: "Waiting for manager approval. Nothing has been posted.",
  failed: "The agent could not finish. See the error above.",
};
const ICON = { running: "⏳", done: "✅", failed: "❌" } as const;

const OK_EXT = [".png", ".jpg", ".jpeg", ".webp", ".pdf", ".txt", ".md", ".csv"];
const MAX_FILES = 5;
const MAX_TOTAL = 9 * 1024 * 1024;

const sel = "h-10 w-full rounded-lg border border-violet-400/40 bg-[#1a1450] px-2 text-sm text-white outline-none focus:border-cyan-300";
const opt = "bg-[#1a1450] text-white";

export default function ContentPage() {
  const [types, setTypes] = useState<CType[]>([{ key: "auto", label: "Auto detect", hint: "" }]);
  const [models, setModels] = useState<ModelOpt[]>([]);
  const [ctype, setCtype] = useState("auto");
  const [model, setModel] = useState("auto");
  const [prompt, setPrompt] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [jobId, setJobId] = useState<number | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load the content types and the models we have
  useEffect(() => {
    api<CType[]>("/content-types").then(setTypes).catch(() => {});
    api<ModelOpt[]>("/models").then(setModels).catch(() => {});
  }, []);

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
        if (j.status !== "generating") return;
      } catch (e) {
        setError("Could not load the job: " + (e as Error).message);
        return;
      }
      timer = setTimeout(tick, 1500);
    };
    tick();
    return () => { stop = true; clearTimeout(timer); };
  }, [jobId]);

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

  // Ctrl+V a screenshot straight into the box
  function onPaste(e: React.ClipboardEvent) {
    const imgs = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) return;
    e.preventDefault();
    addFiles(imgs.map((f, i) => new File([f], `screenshot-${Date.now()}-${i}.png`, { type: f.type })));
  }

  async function start() {
    setError(""); setJob(null); setJobId(null); setStarting(true);
    try {
      const fd = new FormData();
      fd.append("instruction", prompt);
      fd.append("content_type", ctype);
      fd.append("model", model);
      files.forEach((f) => fd.append("files", f));
      const { id } = await api<{ id: number }>("/jobs", { method: "POST", body: fd });
      setJobId(id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStarting(false);
    }
  }

  const working = starting || job?.status === "generating";
  const hint = types.find((t) => t.key === ctype)?.hint ?? "";
  const images = job?.assets.filter((a) => a.kind === "image") ?? [];
  const videos = job?.assets.filter((a) => a.kind === "video") ?? [];

  return (
    <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[400px_1fr]">
      <section className="self-start rounded-2xl border border-violet-400/30 bg-white/5 p-4">
        <h1 className="mb-3 text-lg font-bold">New content</h1>

        <label className="mb-1 block text-xs text-violet-200/80">Content type</label>
        <select value={ctype} onChange={(e) => setCtype(e.target.value)} className={sel}>
          {types.map((t) => <option key={t.key} value={t.key} className={opt}>{t.label}</option>)}
        </select>

        <label className="mb-1 mt-3 block text-xs text-violet-200/80">AI model</label>
        <select value={model} onChange={(e) => setModel(e.target.value)} className={sel}>
          <option value="auto" className={opt}>Auto (recommended)</option>
          {models.map((m) => <option key={m.id} value={m.id} className={opt}>{m.label}</option>)}
        </select>
        <p className="mt-1 text-[11px] text-violet-200/50">
          Images: FLUX.1 schnell · Video: Magic Hour AI video. If the chosen model is busy, another one takes over.
        </p>

        <div className="mt-3 rounded-xl border border-violet-400/40 bg-white/5 focus-within:border-cyan-300">
          <textarea
            value={prompt}
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
            <span className="text-[11px] text-violet-200/60">Add files or pictures, paste a screenshot (Ctrl+V), or paste links in your message.</span>
          </div>
        </div>
        <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.txt,.md,.csv" className="hidden"
          onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />

        {error && <p role="alert" className="mt-3 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">{error}</p>}
        <Button onClick={start} disabled={working || prompt.trim().length < 5}
          className="mt-3 h-11 w-full bg-gradient-to-r from-purple-500 to-cyan-400 font-semibold text-white">
          {working ? "Agent is working…" : "Run agent"}
        </Button>
      </section>

      <section className="rounded-2xl border border-violet-400/30 bg-white/5 p-5">
        <h2 className="mb-3 text-xl font-bold">Agent progress</h2>
        {!job && <p className="text-sm text-violet-200/70">Nothing yet. Pick a content type, write a simple prompt, and run the agent.</p>}
        {job && (
          <>
            <ul className="mb-4 space-y-2 text-sm">
              {job.steps.map((s) => (
                <li key={s.id}>
                  {ICON[s.status]} {LABEL[s.tool_name] ?? s.tool_name}
                  {s.output?.error && <div className="ml-6 text-xs text-red-300">{s.output.error}</div>}
                  {s.output?.summary && <div className="ml-6 text-xs text-cyan-200/80">{s.output.summary}</div>}
                </li>
              ))}
            </ul>
            <p className={`mb-4 rounded-lg px-3 py-2 text-sm ${job.status === "failed" ? "bg-red-500/15 text-red-300" : "bg-amber-400/10 text-amber-300"}`}>
              {STATUS_TEXT[job.status] ?? job.status}
            </p>

            {videos.map((a) => (
              <video key={a.id} controls src={`/api/assets/${a.id}/file`} className="mb-4 w-full rounded-xl" />
            ))}
            {images.length > 0 && (
              <div className="mb-4 grid grid-cols-2 gap-2">
                {images.map((a) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={a.id} src={`/api/assets/${a.id}/file`} alt="Generated scene" className="w-full rounded-xl" />
                ))}
              </div>
            )}
            {job.seo_title && (
              <div className="space-y-3 text-sm">
                <div><div className="text-xs text-violet-200/70">SEO title</div><div className="font-semibold">{job.seo_title}</div></div>
                <div><div className="text-xs text-violet-200/70">Description</div><div className="whitespace-pre-wrap">{job.description}</div></div>
                <div><div className="text-xs text-violet-200/70">Hashtags</div><div className="text-cyan-300">{job.hashtags.join(" ")}</div></div>
                <details>
                  <summary className="cursor-pointer text-xs text-violet-200/70">Caption for each platform</summary>
                  {Object.entries(job.copy_by_platform).map(([p, text]) => (
                    <div key={p} className="mt-2"><b className="capitalize">{p}:</b> {text}</div>
                  ))}
                </details>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}