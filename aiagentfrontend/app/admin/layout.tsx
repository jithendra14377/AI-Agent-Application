"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Bell, ChartNoAxesCombined, ChevronDown, CircleHelp, Cpu, Crown, Database, FileText, Gauge, Home,
  LogOut, Megaphone, MessageCircle, Network, Search, Settings, Share2, ShieldCheck, Users, type LucideIcon,
} from "lucide-react";
import { api } from "@/lib/api";
import { initials, timeAgo } from "@/lib/format";

type Me = { name: string; email: string; role?: string };
type Note = { id: string; kind: string; title: string; text: string; at: string; href: string };

const NAV: { label: string; href: string; Icon: LucideIcon }[] = [
  { label: "Admin Dashboard", href: "/admin/dashboard", Icon: Home },
  { label: "User Management", href: "/admin/users", Icon: Users },
  { label: "Plans & Subscriptions", href: "/admin/plans", Icon: Database },
  { label: "Usage & Quotas", href: "/admin/usage", Icon: Gauge },
  { label: "Content Moderation", href: "/admin/review", Icon: ShieldCheck },
  { label: "AI Model Management", href: "/admin/ai-models", Icon: Cpu },
  { label: "Integrations Management", href: "/admin/integrations", Icon: Share2 },
  { label: "Workflows (Templates)", href: "/admin/workflows", Icon: Network },
  { label: "System Settings", href: "/admin/settings", Icon: Settings },
  { label: "Reports & Analytics", href: "/admin/reports", Icon: ChartNoAxesCombined },
  { label: "Audit Logs", href: "/admin/audit", Icon: FileText },
  { label: "Announcements", href: "/admin/announcements", Icon: Megaphone },
  { label: "Support & Tickets", href: "/admin/support", Icon: MessageCircle },
];

function LogoMark({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" style={{ filter: "drop-shadow(0 0 8px rgba(168,85,247,.6))" }}>
      <defs>
        <linearGradient id="adm-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c084fc" /><stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="25" fill="none" stroke="url(#adm-a)" strokeWidth="7" strokeLinecap="round" strokeDasharray="32 8.85" transform="rotate(-70 32 32)" />
      <circle cx="32" cy="32" r="14" fill="none" stroke="#a855f7" strokeWidth="6" strokeLinecap="round" strokeDasharray="70 18" transform="rotate(40 32 32)" />
      <circle cx="32" cy="32" r="4.5" fill="#e9d5ff" />
    </svg>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [unread, setUnread] = useState(0);
  const [online, setOnline] = useState<boolean | null>(null);
  const [bell, setBell] = useState(false);
  const [menu, setMenu] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Only a super admin may be here. Normal users go back to their own dashboard.
  useEffect(() => {
    api<Me>("/auth/me")
      .then((u) => (u.role === "super_admin" ? setMe(u) : router.replace("/app/dashboard")))
      .catch(() => router.replace("/login"));
  }, [router]);

  useEffect(() => {
    if (!me) return;
    const load = () => {
      api<{ items: Note[]; unread: number }>("/notifications")
        .then((r) => { setNotes(r.items); setUnread(r.unread); })
        .catch(() => {});
      api("/health").then(() => setOnline(true)).catch(() => setOnline(false));
    };
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [me]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBell(false);
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function toggleBell() {
    setMenu(false);
    const open = !bell;
    setBell(open);
    if (open && unread > 0) api("/notifications/seen", { method: "POST" }).then(() => setUnread(0)).catch(() => {});
  }

  async function logout() {
    await api("/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  const active = (href: string) => pathname === href || pathname.startsWith(href + "/");

  if (!me) return <div className="sf-bg grid h-screen place-items-center text-white">Loading…</div>;

  return (
    <div className="sf-bg flex h-screen flex-col text-white">
      <header className="flex items-center gap-4 px-5 py-2.5">
        <div className="flex items-center gap-3">
          <LogoMark />
          <div className="leading-tight">
            <div className="text-xl font-bold">Social<span className="text-purple-400">Flow AI</span></div>
            <div className="hidden text-[11px] text-violet-200/70 sm:block">AI Social Media Agent Studio</div>
          </div>
        </div>
        <span className="hidden items-center gap-2 rounded-xl border border-amber-400/50 bg-amber-400/10 px-3 py-1.5 text-sm font-semibold text-amber-200 md:flex">
          <Crown className="h-4 w-4 text-amber-300" /> ADMIN PORTAL
        </span>

        <div className="relative ml-auto hidden max-w-md flex-1 lg:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-200/60" />
          <input disabled title="Search arrives with User Management" placeholder="Search users, workflows, content…"
            className="h-10 w-full cursor-not-allowed rounded-xl border border-violet-400/30 bg-white/5 pl-9 pr-3 text-sm opacity-70 outline-none" />
        </div>

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <div className="relative" ref={bellRef}>
            <button type="button" aria-label="Notifications" onClick={toggleBell}
              className="relative grid h-10 w-10 place-items-center rounded-full border border-violet-400/40 bg-white/5 hover:bg-white/10">
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-fuchsia-500 px-1 text-[10px] font-bold">{unread}</span>
              )}
            </button>
            {bell && (
              <div className="sf-panel absolute right-0 z-30 mt-2 w-80 p-2 text-sm">
                <div className="px-3 py-2 font-semibold">Notifications</div>
                {notes.length === 0 && <p className="px-3 pb-3 text-xs text-violet-200/70">You are all caught up.</p>}
                {notes.map((n) => (
                  <Link key={n.id} href={n.href} onClick={() => setBell(false)} className="block rounded-lg px-3 py-2 hover:bg-white/10">
                    <div className="line-clamp-2">{n.text}</div>
                    <div className="truncate text-xs text-violet-200/60">{n.title} · {timeAgo(n.at)}</div>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <button type="button" aria-label="Help" className="grid h-10 w-10 place-items-center rounded-full border border-violet-400/40 bg-white/5 hover:bg-white/10">
            <CircleHelp className="h-5 w-5" />
          </button>
          <div className="relative" ref={menuRef}>
            <button type="button" aria-label="Profile menu" onClick={() => { setBell(false); setMenu(!menu); }}
              className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-white/5">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-purple-500 to-cyan-400 font-bold">{initials(me.name)}</span>
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-sm font-semibold">{me.name}</span>
                <span className="mt-0.5 inline-block rounded-md bg-purple-600/60 px-1.5 text-[10px]">Admin</span>
              </span>
              <ChevronDown className="h-4 w-4 text-violet-200/70" />
            </button>
            {menu && (
              <div className="sf-panel absolute right-0 z-30 mt-2 w-56 p-2 text-sm">
                <div className="px-3 py-2">
                  <div className="font-semibold">{me.name}</div>
                  <div className="truncate text-xs text-violet-200/70">{me.email}</div>
                  <div className="mt-1 text-xs text-amber-300">Super Admin</div>
                </div>
                <button type="button" onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-white/10">
                  <LogOut className="h-4 w-4" /> Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-3 px-3 pb-3">
        <aside className="sf-panel flex w-[250px] shrink-0 flex-col p-3">
          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
            {NAV.map(({ label, href, Icon }) => (
              <Link key={href} href={href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                  active(href) ? "sf-nav-active text-white" : "text-violet-100/85 hover:bg-white/5 hover:text-white"
                }`}>
                <Icon className="h-5 w-5 shrink-0" /> {label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-violet-400/30 bg-white/5 p-3">
            <Crown className="h-8 w-8 shrink-0 text-amber-300" />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="text-sm font-semibold">Platform Health</div>
              <div className={`flex items-center gap-1.5 text-xs ${online === false ? "text-red-300" : "text-emerald-300"}`}>
                <span className={`h-2 w-2 rounded-full ${online === false ? "bg-red-400" : online ? "bg-emerald-400" : "bg-slate-400"}`} />
                {online === null ? "Checking…" : online ? "Backend online" : "Backend not reachable"}
              </div>
            </div>
          </div>
        </aside>
        <main className="min-w-0 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}