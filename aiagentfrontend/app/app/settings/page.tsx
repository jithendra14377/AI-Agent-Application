"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell, Camera, CalendarClock, CalendarDays, CreditCard, FileText, Globe, Key, Lightbulb, Lock, Mail,
  Megaphone, MessageSquare, Monitor, Moon, MoreVertical, Palette, Pencil, Plus, Save, Send, Settings, Share2,
  ShieldCheck, SlidersHorizontal, Sparkles, Sun, Upload, User, Users, X, Zap,
} from "lucide-react";
import { api } from "@/lib/api";

type Prefs = { theme: string; notifications: Record<string, boolean> };
type Workspace = {
  workspace_name: string; language: string; timezone: string; date_format: string;
  brand_colors: string[]; brand_font: string; automation: Record<string, boolean>;
};
type Settings = { workspace: Workspace; has_logo: boolean; me: { name: string; email: string; plan: string; role: string; prefs: Prefs } };
type Member = { id: number; name: string; email: string; role: string; plan: string; is_active: boolean };
type AuditRow = { id: number; action: string; created_at: string; actor: string | null; job_title: string | null; job_id: number | null };
type Note = { ok: boolean; text: string } | null;

const LANGS = ["English", "Hindi", "Telugu", "Tamil", "Kannada", "Malayalam", "Marathi", "Bengali", "Gujarati"];
const TZS: [string, string][] = [
  ["Asia/Kolkata", "(GMT+05:30) India Standard Time"], ["UTC", "(GMT+00:00) UTC"], ["Asia/Dubai", "(GMT+04:00) Gulf Standard Time"],
  ["Asia/Singapore", "(GMT+08:00) Singapore Time"], ["Europe/London", "(GMT+00:00) London"],
  ["America/New_York", "(GMT-05:00) New York"], ["America/Los_Angeles", "(GMT-08:00) Los Angeles"], ["Australia/Sydney", "(GMT+10:00) Sydney"],
];
const FONTS = ["Poppins", "Inter", "Montserrat", "Roboto", "Playfair Display"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const AUDIT_TEXT: Record<string, string> = {
  job_created: "Created content", submitted_for_approval: "Submitted for approval", job_approved: "Approved content",
  job_rejected: "Rejected content", job_resubmitted: "Sent back for approval", job_scheduled: "Scheduled content",
  job_moved_to_draft: "Moved content to draft", job_duplicated: "Duplicated content", job_deleted: "Deleted content",
  member_added: "Added a team member", member_updated: "Changed a team member", password_changed: "Changed a password",
  workspace_updated: "Updated workspace settings", profile_updated: "Updated a profile",
};

function dateEx(fmt: string) {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  if (fmt === "DD/MM/YYYY") return `${dd}/${mm}/${d.getFullYear()}`;
  if (fmt === "YYYY-MM-DD") return `${d.getFullYear()}-${mm}-${dd}`;
  return `${MONTHS[d.getMonth()]} ${dd}, ${d.getFullYear()}`;
}

const field = "h-10 w-full rounded-lg border border-violet-400/40 bg-[#160c3a] px-3 text-sm text-white outline-none focus:border-cyan-300 disabled:opacity-60";
const opt = "bg-[#160c3a] text-white";
const ghost = "flex items-center justify-center gap-2 rounded-lg border border-violet-400/40 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10 disabled:opacity-50";

function Toggle({ on, onChange, disabled, label }: { on: boolean; onChange: () => void; disabled?: boolean; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={onChange}
      className={`h-6 w-11 shrink-0 rounded-full p-0.5 transition disabled:opacity-50 ${on ? "bg-purple-500" : "bg-white/20"}`}>
      <span className={`block h-5 w-5 rounded-full bg-white transition ${on ? "translate-x-5" : ""}`} />
    </button>
  );
}

function Card({ id, Icon, title, sub, right, children, className = "" }: {
  id: string; Icon: typeof Settings; title: string; sub?: string; right?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section id={`set-${id}`} className={`sf-panel scroll-mt-2 p-4 ${className}`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-bold"><Icon className="h-5 w-5 text-purple-300" /> {title}</h2>
          {sub && <p className="mt-0.5 text-xs text-violet-200/70">{sub}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export default function SettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [team, setTeam] = useState<Member[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [note, setNote] = useState<Note>(null);
  const [active, setActive] = useState("general");
  const [ws, setWs] = useState({ workspace_name: "", language: "English", timezone: "Asia/Kolkata", date_format: "MMM DD, YYYY" });
  const [theme, setTheme] = useState("dark");
  const [colors, setColors] = useState<string[]>([]);
  const [font, setFont] = useState("Poppins");
  const [hasLogo, setHasLogo] = useState(false);
  const [logoV, setLogoV] = useState(0);
  const [editName, setEditName] = useState<string | null>(null);
  const [pw, setPw] = useState<{ cur: string; nw: string; cf: string } | null>(null);
  const [inv, setInv] = useState<{ name: string; email: string; password: string; role: string } | null>(null);
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const isMgr = s?.me.role === "manager";

  const loadTeam = useCallback(async () => { try { setTeam(await api<Member[]>("/team")); } catch {} }, []);
  const load = useCallback(async () => {
    try {
      const d = await api<Settings>("/settings");
      setS(d);
      setWs({ workspace_name: d.workspace.workspace_name, language: d.workspace.language, timezone: d.workspace.timezone, date_format: d.workspace.date_format });
      setTheme(d.me.prefs.theme); setColors(d.workspace.brand_colors); setFont(d.workspace.brand_font); setHasLogo(d.has_logo);
      loadTeam();
      if (d.me.role === "manager") api<AuditRow[]>("/audit").then(setAudit).catch(() => {});
    }  catch (e) { setNote({ ok: false, text: "Settings could not be loaded: " + (e as Error).message }); }
  }, [loadTeam]);
  useEffect(() => { load(); }, [load]);

  async function run(done: string, fn: () => Promise<unknown>) {
    setBusy(true); setNote(null);
    try { await fn(); setNote({ ok: true, text: done }); }
    catch (e) { setNote({ ok: false, text: (e as Error).message }); }
    finally { setBusy(false); }
  }
  const put = (path: string, body: unknown) => api(path, { method: "PUT", body: JSON.stringify(body) });
  const go = (id: string) => { setActive(id); document.getElementById(`set-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); };

  const saveGeneral = () => run("Settings saved.", async () => {
    if (isMgr) await put("/settings/workspace", ws);
    await put("/settings/me", { theme });
  });
  const saveName = () => run("Profile saved. Reload the page to see the new name in the top bar.", async () => {
    await put("/settings/me", { name: editName }); setEditName(null); await load();
  });
  async function flipNotif(k: string) {
    if (!s) return;
    const next = { ...s.me.prefs.notifications, [k]: !s.me.prefs.notifications[k] };
    setS({ ...s, me: { ...s.me, prefs: { ...s.me.prefs, notifications: next } } });
    try { await put("/settings/me", { notifications: next }); } catch { setNote({ ok: false, text: "Could not save." }); load(); }
  }
  async function flipAuto(k: string) {
    if (!s || !isMgr) return;
    const next = { ...s.workspace.automation, [k]: !s.workspace.automation[k] };
    setS({ ...s, workspace: { ...s.workspace, automation: next } });
    try { await put("/settings/workspace", { automation: next }); } catch { setNote({ ok: false, text: "Could not save." }); load(); }
  }
  const saveBrand = () => run("Brand kit saved.", () => put("/settings/workspace", { brand_colors: colors, brand_font: font }));
  const uploadLogo = (f: File) => run("Logo uploaded.", async () => {
    const fd = new FormData(); fd.append("file", f);
    await api("/brand/logo", { method: "POST", body: fd }); setHasLogo(true); setLogoV(Date.now());
  });
  const changePassword = () => {
    if (!pw) return;
    if (pw.nw !== pw.cf) { setNote({ ok: false, text: "The new passwords do not match." }); return; }
    run("Password changed.", async () => { await api("/auth/change-password", { method: "POST", body: JSON.stringify({ current: pw.cur, new: pw.nw }) }); setPw(null); });
  };
  const addMember = () => inv && run("Member added. Share the temporary password with them privately.", async () => {
    await api("/team", { method: "POST", body: JSON.stringify(inv) }); setInv(null); await loadTeam();
  });
  const patchMember = (id: number, body: object, done: string) => run(done, async () => { await put(`/team/${id}`, body); setMenuFor(null); await loadTeam(); });

  const MENU: [typeof Settings, string, string | null][] = [
    [Settings, "General", "general"], [User, "Profile", "profile"], [Users, "Team & Members", "team"],
    [CreditCard, "Subscription & Billing", "billing"], [Key, "API Keys", null], [Share2, "Social Accounts", "/app/integrations"],
    [Bell, "Notifications", "notifications"], [ShieldCheck, "Security", "security"], [Palette, "Brand Kit", "brand"],
    [Zap, "Automation", "automation"], [SlidersHorizontal, "Preferences", "general"], [FileText, "Audit Logs", isMgr ? "audit" : null],
  ];

  if (!s) return <div className="sf-panel p-8 text-center text-sm text-violet-200/70">{note ? note.text : "Loading settings…"}</div>;
  const n = s.me.prefs.notifications;
  const a = s.workspace.automation;

  return (
    <div className="pb-4">
      <div className="sf-panel mb-3 flex items-center gap-3 px-5 py-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl border border-violet-400/40 bg-white/5"><Settings className="h-6 w-6 text-purple-300" /></span>
        <div>
          <h1 className="text-2xl font-bold leading-tight">Settings</h1>
          <p className="text-sm text-violet-200/70">Manage your account, team, security and workspace preferences.</p>
        </div>
      </div>
      {note && <p role="status" className={`mb-3 rounded-lg px-3 py-2 text-sm ${note.ok ? "bg-emerald-400/10 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>{note.text}</p>}

      <div className="grid gap-3 lg:grid-cols-[250px_1fr]">
        <nav aria-label="Settings sections" className="sf-panel self-start p-3 lg:sticky lg:top-0">
          {MENU.map(([Icon, label, target], i) => {
            const cls = `flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${active === target && target && !target.startsWith("/") ? "sf-nav-active text-white" : "text-violet-100/90 hover:bg-white/5"}`;
            if (target?.startsWith("/")) return <Link key={i} href={target} className={cls}><Icon className="h-5 w-5" />{label}</Link>;
            return (
              <button key={i} type="button" disabled={!target} title={target ? "" : "Coming soon"} onClick={() => target && go(target)}
                className={`${cls} ${target ? "" : "opacity-40"}`}><Icon className="h-5 w-5" />{label}</button>
            );
          })}
        </nav>

        <div className="space-y-3">
          <div className="grid gap-3 xl:grid-cols-2">
            <Card id="general" Icon={Settings} title="General Settings" sub={isMgr ? undefined : "Only managers can change workspace settings. Your theme is saved for you."}>
              <div className="space-y-3 text-sm">
                <label className="block"><span className="mb-1 block text-xs text-violet-200/80">Workspace Name</span>
                  <input value={ws.workspace_name} disabled={!isMgr} maxLength={100} onChange={(e) => setWs({ ...ws, workspace_name: e.target.value })} className={field} /></label>
                <label className="block"><span className="mb-1 flex items-center gap-1 text-xs text-violet-200/80"><Globe className="h-3.5 w-3.5" /> Default Language</span>
                  <select value={ws.language} disabled={!isMgr} onChange={(e) => setWs({ ...ws, language: e.target.value })} className={field}>
                    {LANGS.map((l) => <option key={l} className={opt}>{l}</option>)}</select></label>
                <label className="block"><span className="mb-1 block text-xs text-violet-200/80">Default Time Zone</span>
                  <select value={ws.timezone} disabled={!isMgr} onChange={(e) => setWs({ ...ws, timezone: e.target.value })} className={field}>
                    {TZS.map(([v, l]) => <option key={v} value={v} className={opt}>{l}</option>)}</select></label>
                <label className="block"><span className="mb-1 block text-xs text-violet-200/80">Date Format</span>
                  <select value={ws.date_format} disabled={!isMgr} onChange={(e) => setWs({ ...ws, date_format: e.target.value })} className={field}>
                    {["MMM DD, YYYY", "DD/MM/YYYY", "YYYY-MM-DD"].map((f) => <option key={f} value={f} className={opt}>{f} ({dateEx(f)})</option>)}</select></label>
                <div>
                  <span className="mb-1 block text-xs text-violet-200/80">Theme</span>
                  <div className="grid grid-cols-3 gap-2">
                    {([["light", "Light", Sun], ["dark", "Dark", Moon], ["system", "System", Monitor]] as const).map(([k, l, Icon]) => (
                      <button key={k} type="button" disabled={k !== "dark"} title={k !== "dark" ? "Only the dark theme is available for now" : ""} onClick={() => setTheme(k)}
                        className={`flex h-10 items-center justify-center gap-2 rounded-lg border text-sm ${theme === k ? "sf-nav-active" : "border-violet-400/40 bg-white/5"} disabled:opacity-40`}>
                        <Icon className="h-4 w-4" />{l}</button>
                    ))}
                  </div>
                </div>
                <button type="button" disabled={busy} onClick={saveGeneral} className="sf-btn mx-auto flex h-11 w-60 items-center justify-center gap-2 text-sm"><Save className="h-4 w-4" /> Save Changes</button>
              </div>
            </Card>

            <div className="space-y-3">
              <Card id="profile" Icon={User} title="Profile Information"
                right={editName === null && <button type="button" onClick={() => setEditName(s.me.name)} className={ghost}><Pencil className="h-4 w-4" /> Edit Profile</button>}>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <span className="grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-purple-500 to-cyan-400 text-3xl font-bold">{s.me.name.charAt(0).toUpperCase()}</span>
                    <span title="Photo upload comes later" className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border border-violet-400/60 bg-[#160c3a]"><Camera className="h-4 w-4" /></span>
                  </div>
                  <div className="min-w-0 flex-1">
                    {editName === null ? <div className="text-lg font-bold">{s.me.name}</div> : (
                      <div className="flex gap-2">
                        <input value={editName} maxLength={100} onChange={(e) => setEditName(e.target.value)} aria-label="Name" className={field} />
                        <button type="button" disabled={busy} onClick={saveName} className="sf-btn px-3 text-sm">Save</button>
                        <button type="button" onClick={() => setEditName(null)} aria-label="Cancel" className={ghost}><X className="h-4 w-4" /></button>
                      </div>
                    )}
                    <div className="truncate text-sm text-violet-200/80">{s.me.email}</div>
                    <div className="mt-1 flex gap-2 text-xs"><span className="rounded-md bg-purple-600/60 px-2 py-0.5">{s.me.plan}</span><span className="rounded-md bg-white/10 px-2 py-0.5">{isMgr ? "Manager" : "Member"}</span></div>
                  </div>
                </div>
              </Card>

              <Card id="billing" Icon={CreditCard} title="Subscription & Billing" right={<button type="button" disabled title="Coming soon" className={ghost}>Manage Plan</button>}>
                <div className="rounded-xl border border-violet-400/25 bg-white/5 p-3">
                  <div className="flex items-center gap-2"><span className="text-lg font-bold">{s.me.plan}</span><span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-xs text-emerald-300">Active</span></div>
                  <p className="mt-1 text-xs text-violet-200/70">Billing is not connected yet. Plan changes are made by an administrator.</p>
                </div>
              </Card>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            <Card id="team" Icon={Users} title={`Team & Members (${team.length})`}
              right={isMgr && inv === null && <button type="button" onClick={() => setInv({ name: "", email: "", password: "", role: "member" })} className={ghost}><Plus className="h-4 w-4" /> Invite Member</button>}>
              {!isMgr && <p className="mb-2 text-xs text-violet-200/70">Only managers can see and manage the whole team.</p>}
              {inv && (
                <div className="mb-3 grid gap-2 rounded-xl border border-violet-400/25 bg-white/5 p-3 sm:grid-cols-2">
                  <input placeholder="Full name" value={inv.name} onChange={(e) => setInv({ ...inv, name: e.target.value })} className={field} />
                  <input placeholder="Email" type="email" value={inv.email} onChange={(e) => setInv({ ...inv, email: e.target.value })} className={field} />
                  <input placeholder="Temporary password" type="password" value={inv.password} onChange={(e) => setInv({ ...inv, password: e.target.value })} className={field} />
                  <select value={inv.role} onChange={(e) => setInv({ ...inv, role: e.target.value })} className={field}>
                    <option value="member" className={opt}>Member</option><option value="manager" className={opt}>Manager</option></select>
                  <div className="flex gap-2 sm:col-span-2">
                    <button type="button" disabled={busy} onClick={addMember} className="sf-btn h-10 flex-1 text-sm">Add member</button>
                    <button type="button" onClick={() => setInv(null)} className={ghost}>Cancel</button>
                  </div>
                </div>
              )}
              <div className="overflow-x-auto text-sm">
                <div className="grid min-w-[420px] grid-cols-[1.6fr_1fr_0.8fr_40px] gap-2 border-b border-violet-400/20 pb-1 text-xs text-violet-200/70"><span>Member</span><span>Role</span><span>Status</span><span /></div>
                {team.map((m) => (
                  <div key={m.id} className="grid min-w-[420px] grid-cols-[1.6fr_1fr_0.8fr_40px] items-center gap-2 border-b border-violet-400/10 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-purple-500 to-cyan-400 text-sm font-bold">{m.name.charAt(0).toUpperCase()}</span>
                      <div className="min-w-0"><div className="truncate font-semibold">{m.name}{m.email === s.me.email ? " (You)" : ""}</div><div className="truncate text-xs text-violet-200/70">{m.email}</div></div>
                    </div>
                    {isMgr && m.email !== s.me.email ? (
                      <select value={m.role} disabled={busy} onChange={(e) => patchMember(m.id, { role: e.target.value }, "Role updated.")} aria-label={`Role of ${m.name}`} className={`${field} h-9`}>
                        <option value="manager" className={opt}>Manager</option><option value="member" className={opt}>Member</option></select>
                    ) : <span className="text-violet-100/90">{m.role === "manager" ? "Manager" : "Member"}</span>}
                    <span className="flex items-center gap-1.5 text-xs"><span className={`h-2 w-2 rounded-full ${m.is_active ? "bg-emerald-400" : "bg-slate-400"}`} />{m.is_active ? "Active" : "Inactive"}</span>
                    <div className="relative">
                      {isMgr && m.email !== s.me.email && (
                        <>
                          <button type="button" aria-label="Member actions" onClick={() => setMenuFor(menuFor === m.id ? null : m.id)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/10"><MoreVertical className="h-4 w-4" /></button>
                          {menuFor === m.id && (
                            <div className="sf-panel absolute right-0 z-20 mt-1 w-40 p-1 text-sm">
                              <button type="button" onClick={() => patchMember(m.id, { is_active: !m.is_active }, m.is_active ? "Member deactivated." : "Member activated.")} className="w-full rounded-lg px-3 py-2 text-left hover:bg-white/10">{m.is_active ? "Deactivate" : "Activate"}</button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card id="security" Icon={ShieldCheck} title="Security & Access">
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3"><Lock className="h-6 w-6 text-fuchsia-300" /><div><div className="font-semibold">Change Password</div><div className="text-xs text-violet-200/70">Update your account password</div></div></div>
                  <button type="button" onClick={() => setPw(pw ? null : { cur: "", nw: "", cf: "" })} className={ghost}>{pw ? "Close" : "Change"}</button>
                </div>
                {pw && (
                  <div className="grid gap-2 rounded-xl border border-violet-400/25 bg-white/5 p-3">
                    <input type="password" autoComplete="current-password" placeholder="Current password" value={pw.cur} onChange={(e) => setPw({ ...pw, cur: e.target.value })} className={field} />
                    <input type="password" autoComplete="new-password" placeholder="New password (8+ characters, a letter and a number)" value={pw.nw} onChange={(e) => setPw({ ...pw, nw: e.target.value })} className={field} />
                    <input type="password" autoComplete="new-password" placeholder="Repeat new password" value={pw.cf} onChange={(e) => setPw({ ...pw, cf: e.target.value })} className={field} />
                    <button type="button" disabled={busy} onClick={changePassword} className="sf-btn h-10 text-sm">Update password</button>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3"><ShieldCheck className="h-6 w-6 text-fuchsia-300" /><div><div className="font-semibold">Two-Factor Authentication (2FA)</div><div className="text-xs text-violet-200/70">Coming soon</div></div></div>
                  <Toggle on={false} onChange={() => {}} disabled label="Two-factor authentication" />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3"><Monitor className="h-6 w-6 text-fuchsia-300" /><div><div className="font-semibold">Active Sessions</div><div className="text-xs text-violet-200/70">Manage devices where you are signed in</div></div></div>
                  <button type="button" disabled title="Coming soon" className={ghost}>View Sessions</button>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3"><Key className="h-6 w-6 text-fuchsia-300" /><div><div className="font-semibold">App Access & Permissions</div><div className="text-xs text-violet-200/70">Control third-party app access</div></div></div>
                  <button type="button" disabled title="Coming soon" className={ghost}>Manage</button>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid gap-3 xl:grid-cols-3">
            <Card id="notifications" Icon={Bell} title="Notifications" sub="Choose what notifications you want to receive.">
              <div className="space-y-3 text-sm">
                {([["email", Mail, "Email Notifications", "Updates, reports and important alerts"], ["in_app", MessageSquare, "In-App Notifications", "Workflow, content and system updates"], ["marketing", Megaphone, "Marketing & Product Updates", "New features, tips and offers"]] as const).map(([k, Icon, t, d]) => (
                  <div key={k} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3"><Icon className="h-6 w-6 shrink-0 text-fuchsia-300" /><div><div className="font-semibold">{t}</div><div className="text-xs text-violet-200/70">{d}</div></div></div>
                    <Toggle on={!!n[k]} onChange={() => flipNotif(k)} label={t} />
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-violet-200/60">Your choices are saved. Sending starts when email and alerts are connected.</p>
            </Card>

            <Card id="brand" Icon={Palette} title="Brand Kit" sub="Keep your brand identity consistent across all content.">
              <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = ""; }} />
              <div className="grid grid-cols-[130px_1fr] gap-3">
                <button type="button" disabled={!isMgr || busy} onClick={() => fileRef.current?.click()}
                  className="grid h-32 place-items-center rounded-xl border-2 border-dashed border-violet-400/50 p-2 text-center text-xs hover:bg-white/5 disabled:opacity-60">
                  {hasLogo ? <img src={`/api/brand/logo?v=${logoV}`} alt="Brand logo" className="max-h-24 max-w-full object-contain" /> : (
                    <span className="flex flex-col items-center gap-1"><Upload className="h-6 w-6 text-fuchsia-300" />Upload Logo<span className="text-[10px] text-violet-200/60">PNG, JPG (Max 5MB)</span></span>
                  )}
                </button>
                <div className="space-y-2 text-xs">
                  <div>
                    <div className="mb-1 text-violet-200/80">Brand Colors</div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {colors.map((c, i) => (
                        <button key={i} type="button" disabled={!isMgr} title="Click to remove" onClick={() => setColors(colors.filter((_, j) => j !== i))}
                          className="h-7 w-7 rounded-md border border-white/30" style={{ background: c }} aria-label={`Remove colour ${c}`} />
                      ))}
                      {isMgr && colors.length < 6 && (
                        <label className="grid h-7 w-7 cursor-pointer place-items-center rounded-md border border-violet-400/50 hover:bg-white/10" title="Add a colour">
                          <Plus className="h-4 w-4" /><input type="color" className="sr-only" onChange={(e) => setColors([...colors, e.target.value])} />
                        </label>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-violet-200/80">Brand Fonts</div>
                    <select value={font} disabled={!isMgr} onChange={(e) => setFont(e.target.value)} className={`${field} h-9`}>{FONTS.map((f) => <option key={f} className={opt}>{f}</option>)}</select>
                  </div>
                </div>
              </div>
              <button type="button" disabled={!isMgr || busy} onClick={saveBrand} className="sf-btn mt-3 flex h-10 w-full items-center justify-center gap-2 text-sm"><Pencil className="h-4 w-4" /> Save Brand Kit</button>
              {!isMgr && <p className="mt-2 text-[11px] text-violet-200/60">Only managers can change the brand kit.</p>}
            </Card>

            <Card id="automation" Icon={Zap} title="Automation Preferences" sub="Control default behaviors for your AI workflows.">
              <div className="space-y-3 text-sm">
                {([["auto_publish", Send, "Auto Publish Approved Content"], ["ai_captions", Sparkles, "AI Caption & Hashtag Generation"], ["auto_reschedule", CalendarClock, "Auto Reschedule Failed Posts"], ["suggestions", Lightbulb, "Enable Content Suggestions"]] as const).map(([k, Icon, t]) => (
                  <div key={k} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-3"><Icon className="h-5 w-5 shrink-0 text-fuchsia-300" />{t}</span>
                    <Toggle on={!!a[k]} onChange={() => flipAuto(k)} disabled={!isMgr} label={t} />
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-violet-200/60">{isMgr ? "Saved. These take effect when publishing is connected. Nothing is posted without manager approval." : "Only managers can change automation."}</p>
            </Card>
          </div>

          {isMgr && (
            <Card id="audit" Icon={FileText} title="Audit Logs" sub="The latest 30 actions in your workspace.">
              <div className="max-h-72 space-y-1.5 overflow-y-auto text-sm">
                {audit.length === 0 && <p className="text-violet-200/70">No activity yet.</p>}
                {audit.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center gap-x-3 rounded-lg border border-violet-400/15 bg-white/5 px-3 py-1.5">
                    <CalendarDays className="h-4 w-4 text-fuchsia-300" />
                    <span className="w-36 shrink-0 text-xs text-violet-200/70">{new Date(r.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span>
                    <span className="font-semibold">{r.actor ?? "System"}</span>
                    <span>{AUDIT_TEXT[r.action] ?? r.action.replace(/_/g, " ")}</span>
                    {r.job_title && <span className="truncate text-violet-200/70">· {r.job_title}</span>}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}