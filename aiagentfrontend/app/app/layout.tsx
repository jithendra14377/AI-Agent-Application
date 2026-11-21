"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, Bot, Calendar, FileText, Home, LogOut, Plug, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { Poppins } from "next/font/google";

const font = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-sans", display: "swap" });
type User = { name: string; email: string; plan: string };

// const TOP = [["Dashboard", "/dashboard"], ["Workflow", "/workflow"], ["Content", "/content"], ["Calendar", "/calendar"], ["Analytics", "/analytics"]] as const;
// const SIDE = [
//   [Home, "Home", "/dashboard"], [Bot, "Agents", "/workflow"], [FileText, "Content", "/content"],
//   [Calendar, "Calendar", "/calendar"], [BarChart3, "Analytics", "/analytics"],
//   [Plug, "Integrations", "/integrations"], [Settings, "Settings", "/settings"],
// ] as const;
const TOP = [
  ["Dashboard", "/app/dashboard"],
  ["Workflow", "/app/workflow"],
  ["Content", "/app/content"],
  ["Calendar", "/app/calendar"],
  ["Analytics", "/app/analytics"],
] as const;

const SIDE = [
  [Home, "Home", "/app/dashboard"],
  [Bot, "Agents", "/app/workflow"],
  [FileText, "Content", "/app/content"],
  [Calendar, "Calendar", "/app/calendar"],
  [BarChart3, "Analytics", "/app/analytics"],
  [Plug, "Integrations", "/app/integrations"],
  [Settings, "Settings", "/app/settings"],
] as const;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);

  // Guard: no valid login cookie means back to the login page
  useEffect(() => {
    api<User>("/auth/me").then(setUser).catch(() => router.replace("/login"));
  }, [router]);

  const active = (href: string) => pathname === href || pathname.startsWith(href + "/");

  async function logout() {
    await api("/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  if (!user) return <div className="grid h-screen place-items-center bg-[#07051a] text-white">Loading…</div>;

  return (
    <div className="flex h-screen flex-col bg-[#07051a] text-white">
      <header className="flex items-center justify-between border-b border-violet-400/20 px-5 py-3">
        <div className="text-xl font-bold">Social<span className="text-purple-400">Flow AI</span></div>
        <nav className="hidden gap-2 text-sm md:flex">
          {TOP.map(([label, href]) => (
            <Link key={label} href={href}
              className={`rounded-lg px-3 py-1 ${active(href) ? "bg-purple-600/40" : "text-violet-200/80 hover:text-white"}`}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <div className="text-right">
            <div className="font-semibold">{user.name}</div>
            <div className="text-xs text-purple-300">{user.plan}</div>
          </div>
          <Button size="icon" variant="ghost" onClick={logout} aria-label="Log out"><LogOut className="h-5 w-5" /></Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-24 flex-col items-center gap-3 border-r border-violet-400/20 py-4 text-[11px] sm:flex">
          {SIDE.map(([Icon, label, href]) => (
            <Link key={label} href={href}
              className={`flex w-20 flex-col items-center gap-1 rounded-xl px-2 py-2 ${active(href) ? "bg-purple-600/40" : "text-violet-200/80 hover:text-white"}`}>
              <Icon className="h-5 w-5" />{label}
            </Link>
          ))}
        </aside>
        <main className="flex-1 overflow-auto p-3">{children}</main>
      </div>
    </div>
  );
}