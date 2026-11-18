"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { BrandLogo, type Brand } from "@/components/BrandLogo";
// const ICONS = [
//   ["IG", "bg-gradient-to-br from-orange-400 via-pink-500 to-indigo-500"],
//   ["f", "bg-blue-600"], ["▶", "bg-red-600"], ["in", "bg-sky-700"], ["X", "bg-black"], ["♪", "bg-zinc-900"],
// ];
const BRANDS: Brand[] = ["instagram", "facebook", "youtube", "linkedin", "x", "tiktok"];
const FEATURES = ["AI Content Creation", "Multi-Platform Publishing", "Smart Scheduling", "Performance Analytics"];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Auto-login: if the cookie is still valid, go straight to the dashboard
  // useEffect(() => {
  //   api("/auth/me").then(() => router.replace("/dashboard")).catch(() => {});
  // }, [router]);
  useEffect(() => {
  api("/auth/me")
    .then(() => router.replace("/app/dashboard"))
    .catch(() => {});
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api("/auth/login", { method: "POST", body: JSON.stringify({ email, password, remember }) });
      router.replace("/app/dashboard");
    } catch (err) {
      const x = err as { status?: number; message: string };
      setError(x.status === 401 ? "Incorrect username or password" : x.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen items-center gap-10 bg-[radial-gradient(circle_at_10%_15%,#4c1d95aa,transparent_45%),radial-gradient(circle_at_90%_90%,#0891b255,transparent_45%)] bg-[#07051a] px-[5vw] py-10 text-white lg:grid-cols-[1.1fr_1fr]">
      {/* LEFT */}
      <section className="hidden lg:block">
        <Logo />
        <h1 className="mt-7 text-5xl font-bold leading-tight">
          Create Once.<br />Publish Everywhere.<br />with{" "}
          <span className="bg-gradient-to-r from-purple-400 to-cyan-300 bg-clip-text text-transparent">AI Agents</span>
        </h1>
        <p className="mt-4 max-w-sm text-violet-200/80">
          Plan, create, automate, and publish content across all your social media platforms using powerful AI agents.
        </p>
        <div className="my-8 flex items-center gap-8">
          <div className="grid h-44 w-44 place-items-center rounded-full bg-gradient-to-br from-white to-violet-300 text-7xl shadow-[0_0_40px_#a855f7]">🤖</div>
          <div className="grid grid-cols-3 gap-4">
            {/* {ICONS.map(([t, c]) => (
              <div key={t} className={`grid h-14 w-14 animate-bounce place-items-center rounded-2xl font-bold shadow-[0_0_18px_#a855f7] ${c}`}>{t}</div>
            ))} */}
            {BRANDS.map((b) => (
              <div key={b} className="animate-bounce"><BrandLogo brand={b} size={60} /></div>
        ))}
          </div>
        </div>
        <div className="flex gap-5 text-center text-xs text-violet-200/80">
          {FEATURES.map((f) => (
            <div key={f} className="w-24">
              <div className="mx-auto mb-2 h-14 w-14 rounded-2xl border border-violet-400/40 bg-white/5" />
              {f}
            </div>
          ))}
        </div>
      </section>

      {/* RIGHT */}
      <main className="mx-auto w-full max-w-[540px] rounded-[28px] border border-violet-400/40 bg-[#191446]/60 p-9 shadow-[0_0_45px_#7c3aed66] backdrop-blur-xl">
        <div className="mb-5 flex justify-center"><Logo /></div>
        <h2 className="text-center text-3xl font-bold">Welcome Back</h2>
        <p className="mb-6 mt-1 text-center text-violet-200/80">Sign in to your SocialFlow AI account</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 opacity-70" />
            <Input type="email" required placeholder="Enter your email" value={email}
              onChange={(e) => setEmail(e.target.value)} className="h-12 border-violet-400/40 bg-white/5 pl-12" />
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 opacity-70" />
            <Input type={show ? "text" : "password"} required placeholder="Enter your password" value={password}
              onChange={(e) => setPassword(e.target.value)} className="h-12 border-violet-400/40 bg-white/5 px-12" />
            <button type="button" onClick={() => setShow(!show)} aria-label="Toggle password"
              className="absolute right-4 top-1/2 -translate-y-1/2 opacity-70">
              {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>

          {error && <p role="alert" className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">{error}</p>}

          <div className="flex items-center justify-between text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-purple-500" />
              Remember me
            </label>
            <a href="#" className="text-purple-400">Forgot password?</a>
          </div>

          <Button type="submit" disabled={loading}
            className="h-12 w-full bg-gradient-to-r from-purple-500 to-cyan-400 text-base font-semibold text-white shadow-[0_0_22px_#22d3ee66]">
            {loading ? "Signing in…" : "Sign In →"}
          </Button>
        </form>

        <div className="my-5 flex items-center gap-3 text-violet-200/70">
          <span className="h-px flex-1 bg-violet-400/30" />OR<span className="h-px flex-1 bg-violet-400/30" />
        </div>
        <Button type="button" variant="outline" className="mb-3 h-12 w-full border-violet-400/40 bg-white/5">Continue with Google</Button>
        <Button type="button" variant="outline" className="h-12 w-full border-violet-400/40 bg-white/5">Continue with Microsoft</Button>
        <p className="mt-5 text-center text-violet-200/80">Don&apos;t have an account? <a href="#" className="text-purple-400">Sign Up</a></p>
      </main>
    </div>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="h-11 w-11 rounded-full border-[6px] border-purple-500 shadow-[0_0_18px_#a855f7]" />
      <div>
        <div className="text-2xl font-bold leading-none">Social<span className="text-purple-400">Flow AI</span></div>
        <small className="text-violet-200/70">AI Social Media Agent Studio</small>
      </div>
    </div>
  );
}