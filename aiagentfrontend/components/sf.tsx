import type { ComponentType, ReactNode } from "react";

type Icon = ComponentType<{ className?: string }>;

// The glowing panel used on every screen in the mockups.
export function GlassCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-violet-400/30 bg-white/5 p-4 shadow-[0_0_24px_rgba(124,58,237,0.12)] ${className}`}>
      {children}
    </section>
  );
}

// Title bar at the top of each page: icon, title, one-line description, and actions on the right.
export function PageHeader({ icon: Icon, title, subtitle, actions }: {
  icon: Icon; title: string; subtitle?: string; actions?: ReactNode;
}) {
  return (
    <header className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-400/30 bg-white/5 px-5 py-3">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl border border-violet-400/40 bg-purple-600/20 text-fuchsia-300">
          <Icon className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-xl font-bold leading-tight">{title}</h1>
          {subtitle && <p className="text-sm text-violet-200/70">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

// A number card: icon, label, big value, optional change like "+28.4%".
export function StatCard({ icon: Icon, label, value, delta }: {
  icon: Icon; label: string; value: string | number; delta?: string;
}) {
  return (
    <GlassCard>
      <div className="flex items-center gap-2 text-sm text-violet-200/80">
        <Icon className="h-5 w-5 text-fuchsia-300" />{label}
      </div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
      {delta && (
        <span className="mt-2 inline-block rounded-md bg-emerald-400/15 px-2 py-0.5 text-xs text-emerald-300">{delta}</span>
      )}
    </GlassCard>
  );
}

// The purple-to-pink button (Run Workflow, Generate Content, Create Content).
export function GradientButton({ children, className = "", ...props }:
  React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...props}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-purple-500 px-4 text-sm font-semibold text-white shadow-[0_0_16px_rgba(217,70,239,0.45)] transition hover:brightness-110 disabled:opacity-50 ${className}`}>
      {children}
    </button>
  );
}
