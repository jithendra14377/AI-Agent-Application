"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

type Step = { id: number; step_no: number; tool_name: string; status: "running" | "done" | "failed"; output: { error?: string } | null };
type Job = {
  id: number; status: string; seo_title: string | null; description: string | null;
  hashtags: string[]; copy_by_platform: Record<string, string>;
  steps: Step[]; assets: { id: number; kind: "image" | "video" }[];
};

const LABEL: Record<string, string> = {
  write_copy: "Writing SEO title, description and hashtags",
  generate_image: "Generating image",
  submit_for_approval: "Submitting for manager approval",
  agent_error: "Agent error",
};
const STATUS_TEXT: Record<string, string> = {
  generating: "The agent is working…",
  pending_approval: "Waiting for manager approval. Nothing has been posted.",
  failed: "The agent could not finish. See the error above.",
};
const ICON = { running: "⏳", done: "✅", failed: "❌" } as const;
const field = "w-full rounded-xl border border-violet-400/40 bg-white/5 p-3 text-sm outline-none focus:border-cyan-300";

export default function ContentPage() {
  const [instruction, setInstruction] = useState("");
  const [brief, setBrief] = useState("");
  const [jobId, setJobId] = useState<number | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);

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
      } catch {
        return;
      }
      timer = setTimeout(tick, 1500);
    };
    tick();
    return () => { stop = true; clearTimeout(timer); };
  }, [jobId]);

  async function start() {
    setError(""); setJob(null); setJobId(null); setStarting(true);
    try {
      const { id } = await api<{ id: number }>("/jobs", { method: "POST", body: JSON.stringify({ instruction, brief }) });
      setJobId(id);
    } catch (e) {
        setError("Could not load the job: " + (e as Error).message);
        return;
    //   setError((e as Error).message);
    } finally {
      setStarting(false);
    }
  }

  const working = starting || job?.status === "generating";

  return (
    <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-2">
      <section className="rounded-2xl border border-violet-400/30 bg-white/5 p-5">
        <h1 className="mb-1 text-xl font-bold">New content job</h1>
        <p className="mb-4 text-sm text-violet-200/70">The agent drafts everything. A manager must approve before anything is posted.</p>
        <label className="mb-1 block text-sm">Instruction for the agent</label>
        <textarea className={`${field} mb-3 h-24`} value={instruction} onChange={(e) => setInstruction(e.target.value)}
          placeholder="Create an image, an SEO title, a description and hashtags for this job opening." />
        <label className="mb-1 block text-sm">Brief (job post details)</label>
        <textarea className={`${field} mb-3 h-44`} value={brief} onChange={(e) => setBrief(e.target.value)}
          placeholder="Paste the job posting details here: role, location, requirements, how to apply…" />
        {error && <p role="alert" className="mb-3 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">{error}</p>}
        <Button onClick={start} disabled={working}
          className="h-11 w-full bg-gradient-to-r from-purple-500 to-cyan-400 font-semibold text-white">
          {working ? "Agent is working…" : "Run agent"}
        </Button>
      </section>

      <section className="rounded-2xl border border-violet-400/30 bg-white/5 p-5">
        <h2 className="mb-3 text-xl font-bold">Agent progress</h2>
        {!job && <p className="text-sm text-violet-200/70">Nothing yet. Run the agent to see each step live.</p>}
        {job && (
          <>
            <ul className="mb-4 space-y-2 text-sm">
              {job.steps.map((s) => (
                <li key={s.id}>
                  {ICON[s.status]} {LABEL[s.tool_name] ?? s.tool_name}
                  {s.output?.error && <div className="ml-6 text-xs text-red-300">{s.output.error}</div>}
                </li>
              ))}
            </ul>
            <p className={`mb-4 rounded-lg px-3 py-2 text-sm ${job.status === "failed" ? "bg-red-500/15 text-red-300" : "bg-amber-400/10 text-amber-300"}`}>
              {STATUS_TEXT[job.status] ?? job.status}
            </p>

            {job.assets.filter((a) => a.kind === "image").map((a) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={a.id} src={`/api/assets/${a.id}/file`} alt="Generated post" className="mb-4 w-full rounded-xl" />
            ))}
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