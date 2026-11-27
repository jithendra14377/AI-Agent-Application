

"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { api } from "@/lib/api";
import { BrandTile } from "@/components/BrandTile";
import { FeatureIcon, HeroRobot, Mountains, OrbitRing, Waves } from "@/components/AuthArt";
import { LogoMark } from "@/components/LogoMark";

// const HOME = "/app/dashboard"; // where you land after signing in
const homeFor = (role?: string) => (role === "super_admin" ? "/admin/dashboard" : "/app/dashboard");

const ORBIT = [
  { b: "instagram", x: 112, y: 8, r: -6, d: 0 },
  { b: "facebook", x: 224, y: 44, r: 10, d: 0.8 },
  { b: "youtube", x: 34, y: 96, r: -8, d: 1.6 },
  { b: "linkedin", x: 130, y: 118, r: 6, d: 0.4 },
  { b: "x", x: 238, y: 150, r: 8, d: 1.2 },
  { b: "tiktok", x: 112, y: 230, r: -4, d: 2 },
] as const;

const FEATURES = [
  { icon: "wand", label: "AI Content Creation" },
  { icon: "layers", label: "Multi-Platform Publishing" },
  { icon: "calendar", label: "Smart Scheduling" },
  { icon: "chart", label: "Performance Analytics" },
] as const;

function Brand({ size, center = false, big = false }: { size: number; center?: boolean; big?: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${center ? "justify-center" : ""}`}>
      <LogoMark size={size} />
      <div className="text-left leading-tight">
        <div className={`${big ? "text-[2.1rem]" : "text-[1.9rem]"} font-bold`}>
          Social<span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">Flow AI</span>
        </div>
        <div className="text-sm text-slate-300/85">AI Social Media Agent Studio</div>
      </div>
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function MicrosoftLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 23 23" aria-hidden="true">
      <rect width="11" height="11" fill="#f25022" />
      <rect x="12" width="11" height="11" fill="#7fba00" />
      <rect y="12" width="11" height="11" fill="#00a4ef" />
      <rect x="12" y="12" width="11" height="11" fill="#ffb900" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [robotPhoto, setRobotPhoto] = useState(true); // uses /robot.png if you add one

  // Already signed in? Go straight in.
  useEffect(() => {
    api<{ role?: string }>("/auth/me").then((u) => router.replace(homeFor(u.role))).catch(() => {});
    // api("/auth/me").then(() => router.replace(HOME)).catch(() => {});
  }, [router]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(""); setNotice("");
    // Read the real field values too, because browser autofill can skip React's onChange
    const fd = new FormData(e.currentTarget);
    const em = String(fd.get("email") || email).trim();
    const pw = String(fd.get("password") || password);
    if (!em || !pw) { setError("Enter your email and password."); return; }
    setLoading(true);
    try {
      const res = await api<{ user: { role?: string } }>("/auth/login", { method: "POST", body: JSON.stringify({ email: em, password: pw, remember }) });
      router.replace(homeFor(res.user.role));
      // await api("/auth/login", { method: "POST", body: JSON.stringify({ email: em, password: pw, remember }) });
      // router.replace(HOME);
    } catch (err) {
      const x = err as { status?: number; message: string };
      setError(x.status === 401 ? "Incorrect username or password" : x.message);
    } finally {
      setLoading(false);
    }
  }

  const soon = (text: string) => (e: React.MouseEvent) => { e.preventDefault(); setNotice(text); };

  return (
    <div className="sf-auth-bg relative min-h-screen overflow-x-hidden text-white">
      <Waves />
      <div className="relative mx-auto grid min-h-screen max-w-[1700px] items-center gap-6 px-[4vw] py-8 lg:grid-cols-[1.18fr_1fr]">
        {/* ---------------- LEFT: brand, headline, robot, features ---------------- */}
        <section className="relative hidden min-h-[calc(100vh-4rem)] flex-col lg:flex">
          <Brand size={58} />
          <h1 className="mt-10 text-[clamp(2.4rem,3.7vw,3.7rem)] font-bold leading-[1.12] tracking-tight">
            Create Once.<br />Publish Everywhere.<br />
            with{" "}
            <span className="bg-gradient-to-r from-violet-400 via-indigo-300 to-cyan-300 bg-clip-text text-transparent">AI Agents</span>
          </h1>
          <p className="mt-5 max-w-[26rem] text-[1.05rem] leading-relaxed text-slate-300/90">
            Plan, create, automate, and publish content across all your social media platforms using powerful AI agents.
          </p>

          <div className="relative mt-3 h-[clamp(300px,40vh,430px)]">
            <Mountains className="pointer-events-none absolute -left-[8vw] bottom-0 h-[44%] w-[calc(100%+8vw)]" />
            {robotPhoto ? (
              <img src="/robot.png" alt="" onError={() => setRobotPhoto(false)}
                className="absolute bottom-0 left-0 h-full w-auto mix-blend-screen" />
            ) : (
              <HeroRobot className="absolute bottom-0 left-[1vw] h-full w-auto" />
            )}
            <div className="absolute left-[34%] top-[-3%] h-[340px] w-[340px] origin-top-left scale-[.85] 2xl:scale-100">
              <OrbitRing className="pointer-events-none absolute inset-0 h-full w-full" />
              {ORBIT.map((p) => (
                <div key={p.b} className="sf-float absolute"
                  style={{ left: p.x, top: p.y, animationDelay: `${p.d}s`, ["--r"]: `${p.r}deg` } as React.CSSProperties}>
                  <BrandTile brand={p.b} size={72} />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-start">
            {FEATURES.map((f, i) => (
              <div key={f.label} className="flex items-start">
                {i > 0 && <span className="mx-4 mt-2 h-14 w-px bg-violet-400/20" />}
                <div className="flex w-[118px] flex-col items-center gap-2 text-center text-[13px] leading-tight text-slate-200">
                  <span className="sf-feature"><FeatureIcon name={f.icon} /></span>
                  {f.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------- RIGHT: login card ---------------- */}
        <main className="sf-auth-card mx-auto flex w-full max-w-[640px] flex-col justify-center p-8 sm:p-11 lg:min-h-[min(780px,calc(100vh-3rem))] lg:justify-self-end">
          <div className="mb-6"><Brand size={62} center big /></div>
          <h2 className="text-center text-[2rem] font-bold">Welcome Back</h2>
          <p className="mb-7 mt-1 text-center text-[1.05rem] text-slate-300/90">Sign in to your SocialFlow AI account</p>

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-300/70" />
              <input name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email" autoComplete="email" aria-label="Email" className="sf-field" />
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-300/70" />
              <input name="password" type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password" autoComplete="current-password" aria-label="Password" className="sf-field" />
              <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300/70 hover:text-white">
                {show ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
              </button>
            </div>

            {error && <p role="alert" className="rounded-xl bg-red-500/15 px-4 py-2.5 text-sm text-red-300">{error}</p>}

            <div className="flex items-center justify-between pt-1 text-[0.95rem]">
              <label className="flex cursor-pointer items-center gap-3">
                <input type="checkbox" className="sf-check" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                Remember me
              </label>
              <a href="#" onClick={soon("Password reset is coming soon.")} className="text-fuchsia-400 hover:text-fuchsia-300">Forgot password?</a>
            </div>

            <button type="submit" disabled={loading} className="sf-signin mt-1 flex items-center justify-center gap-2">
              {loading ? "Signing in…" : <>Sign In <ArrowRight className="h-5 w-5" /></>}
            </button>
          </form>

          <div className="my-5 flex items-center gap-4 text-slate-200">
            <span className="h-px flex-1 bg-slate-400/30" />OR<span className="h-px flex-1 bg-slate-400/30" />
          </div>

          <div className="space-y-3">
            <button type="button" className="sf-social" onClick={soon("Google sign-in is not set up yet.")}>
              <GoogleG /> Continue with Google
            </button>
            <button type="button" className="sf-social" onClick={soon("Microsoft sign-in is not set up yet.")}>
              <MicrosoftLogo /> Continue with Microsoft
            </button>
          </div>

          {notice && <p className="mt-4 rounded-xl bg-violet-500/15 px-4 py-2.5 text-center text-sm text-violet-200">{notice}</p>}

          <p className="mt-6 text-center text-slate-300/90">
            Don&apos;t have an account?{" "}
            <a href="#" onClick={soon("The sign-up page is coming soon.")} className="font-medium text-fuchsia-400 hover:text-fuchsia-300">Sign Up</a>
          </p>
        </main>
      </div>
    </div>
  );
}