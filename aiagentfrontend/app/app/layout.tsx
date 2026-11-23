"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Bell, Bot, CalendarDays, ChartNoAxesCombined, ChevronDown, CircleHelp,
  FileText, Home, LayoutGrid, LogOut, Network, Settings,
} from "lucide-react";
import { api } from "@/lib/api";

type User = { name: string; email: string; plan: string; role?: string };

const SIDE = [
  [Home, "Home", "/app/dashboard"],
  [Bot, "Agents", "/app/agents"],
  [Network, "Workflows", "/app/workflow"],
  [FileText, "Content", "/app/content"],
  [CalendarDays, "Calendar", "/app/calendar"],
  [ChartNoAxesCombined, "Analytics", "/app/analytics"],
  [LayoutGrid, "Integrations", "/app/integrations"],
  [Settings, "Settings", "/app/settings"],
] as const;

function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id="sf-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c084fc" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="19" fill="none" stroke="url(#sf-logo)" strokeWidth="6" strokeDasharray="22 6" strokeLinecap="round" />
      <circle cx="24" cy="24" r="8" fill="none" stroke="#a855f7" strokeWidth="4" />
    </svg>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Guard: no valid login cookie means back to the login page
  useEffect(() => {
    api<User>("/auth/me").then(setUser).catch(() => router.replace("/login"));
  }, [router]);

  // Close the profile menu when you click outside it
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const active = (href: string) => pathname === href || pathname.startsWith(href + "/");

  async function logout() {
    await api("/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  if (!user) return <div className="sf-bg grid h-screen place-items-center text-white">Loading…</div>;

  return (
    <div className="sf-bg flex h-screen flex-col text-white">
      <header className="flex items-center justify-between px-5 py-2.5">
        <div className="flex items-center gap-3">
          <LogoMark />
          <div className="leading-tight">
            <div className="text-xl font-bold">Social<span className="text-purple-400">Flow AI</span></div>
            <div className="hidden text-[11px] text-violet-200/70 sm:block">AI Social Media Agent Studio</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" aria-label="Notifications"
            className="relative grid h-10 w-10 place-items-center rounded-full border border-violet-400/40 bg-white/5 hover:bg-white/10">
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-fuchsia-400" />
          </button>
          <button type="button" aria-label="Help"
            className="grid h-10 w-10 place-items-center rounded-full border border-violet-400/40 bg-white/5 hover:bg-white/10">
            <CircleHelp className="h-5 w-5" />
          </button>

          <div className="relative" ref={menuRef}>
            <button type="button" onClick={() => setMenu(!menu)} aria-label="Profile menu"
              className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-white/5">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-purple-500 to-cyan-400 font-bold">
                {user.name.charAt(0).toUpperCase()}
              </span>
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-sm font-semibold">{user.name}</span>
                <span className="mt-0.5 inline-block rounded-md bg-purple-600/60 px-1.5 text-[10px]">{user.plan}</span>
              </span>
              <ChevronDown className="h-4 w-4 text-violet-200/70" />
            </button>
            {menu && (
              <div className="sf-panel absolute right-0 z-20 mt-2 w-56 p-2 text-sm">
                <div className="px-3 py-2">
                  <div className="font-semibold">{user.name}</div>
                  <div className="truncate text-xs text-violet-200/70">{user.email}</div>
                  <div className="mt-1 text-xs text-purple-300">{user.role === "manager" ? "Manager" : "Employee"}</div>
                </div>
                <Link href="/app/settings" onClick={() => setMenu(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-white/10">
                  <Settings className="h-4 w-4" /> Settings
                </Link>
                <button type="button" onClick={logout}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-white/10">
                  <LogOut className="h-4 w-4" /> Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-3 px-3 pb-3">
        <aside className="sf-panel flex w-[88px] shrink-0 flex-col items-center gap-1.5 overflow-y-auto py-3">
          {SIDE.map(([Icon, label, href]) => (
            <Link key={label} href={href} aria-label={label}
              className={`flex w-[72px] flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] transition ${
                active(href) ? "sf-nav-active text-white" : "text-violet-200/80 hover:bg-white/5 hover:text-white"
              }`}>
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}
        </aside>
        <main className="min-w-0 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

// "use client";
// import Link from "next/link";
// import { usePathname, useRouter } from "next/navigation";
// import { useEffect, useState } from "react";
// // import { BarChart3, Bot, Calendar, FileText, Home, LogOut, Plug, Settings } from "lucide-react";
// import { BarChart3, Bell,Bot, Calendar, ChevronDown,FileText, HelpCircle, Home, LayoutGrid, LogOut, Network, Settings, } from "lucide-react";
// import { Button } from "@/components/ui/button";
// import { api } from "@/lib/api";

// type User = { name: string; email: string; plan: string; role?: string };

// // const SIDE = [
// //   [Home, "Home", "/app/dashboard"],
// //   [Bot, "Agent Workflow", "/app/workflow"],
// //   [FileText, "Content", "/app/content"],
// //   [Calendar, "Calendar", "/app/calendar"],
// //   [BarChart3, "Analytics", "/app/analytics"],
// //   [Plug, "Integrations", "/app/integrations"],
// //   [Settings, "Settings", "/app/settings"],
// // ] as const;
// const SIDE = [
//   [Home, "Home", "/app/dashboard"],
//   [Bot, "Agents", "/app/agents"],
//   [Network, "Workflows", "/app/workflow"],
//   [FileText, "Content", "/app/content"],
//   [Calendar, "Calendar", "/app/calendar"],
//   [BarChart3, "Analytics", "/app/analytics"],
//   [LayoutGrid, "Integrations", "/app/integrations"],
//   [Settings, "Settings", "/app/settings"],
// ] as const;

// export default function AppLayout({ children }: { children: React.ReactNode }) {
//   const router = useRouter();
//   const pathname = usePathname();
//   const [user, setUser] = useState<User | null>(null);

//   // Guard: no valid login cookie means back to the login page
//   useEffect(() => {
//     api<User>("/auth/me").then(setUser).catch(() => router.replace("/login"));
//   }, [router]);

//   const active = (href: string) => pathname === href || pathname.startsWith(href + "/");

//   async function logout() {
//     await api("/auth/logout", { method: "POST" });
//     router.replace("/login");
//   }

//   if (!user) return <div className="grid h-screen place-items-center bg-[#07051a] text-white">Loading…</div>;

//   return (
//     <div className="flex h-screen flex-col bg-[#07051a] text-white">
//       <header className="flex items-center justify-between border-b border-violet-400/20 px-5 py-3">
//         <div className="text-xl font-bold">Social<span className="text-purple-400">Flow AI</span></div>
//         <div className="flex items-center gap-3 text-sm">
//           <div className="text-right">
//             <div className="font-semibold">{user.name}</div>
//             <div className="text-xs text-purple-300">{user.role === "manager" ? "Manager" : user.plan}</div>
//           </div>
//           <Button size="icon" variant="ghost" onClick={logout} aria-label="Log out"><LogOut className="h-5 w-5" /></Button>
//         </div>
//       </header>

//       <div className="flex flex-1 overflow-hidden">
//         <aside className="flex w-24 shrink-0 flex-col items-center gap-3 overflow-y-auto border-r border-violet-400/20 py-4 text-[11px]">
//           {SIDE.map(([Icon, label, href]) => (
//             <Link key={label} href={href}
//               className={`flex w-20 flex-col items-center gap-1 rounded-xl px-2 py-2 text-center leading-tight ${active(href) ? "bg-purple-600/40" : "text-violet-200/80 hover:text-white"}`}>
//               <Icon className="h-5 w-5" />{label}
//             </Link>
//           ))}
//         </aside>
//         <main className="flex-1 overflow-auto p-3">{children}</main>
//       </div>
//     </div>
//   );
// }