"use client";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";

const PAGES: Record<string, { title: string; note: string }> = {
  users: { title: "User Management", note: "List, search, add and deactivate user accounts. Built next." },
  plans: { title: "Plans & Subscriptions", note: "Needs billing, which is not connected yet." },
  usage: { title: "Usage & Quotas", note: "Per-user limits for images, videos and agent runs. Built after User Management." },
  "ai-models": { title: "AI Model Management", note: "See and choose the AI brains and media tools." },
  integrations: { title: "Integrations Management", note: "Connect social accounts. Needs the publishing step." },
  workflows: { title: "Workflows (Templates)", note: "Shared workflow templates for your users." },
  settings: { title: "System Settings", note: "Workspace name, brand kit and defaults." },
  reports: { title: "Reports & Analytics", note: "Downloadable reports. The dashboard already exports a CSV." },
  audit: { title: "Audit Logs", note: "The full history of who did what. Built next." },
  announcements: { title: "Announcements", note: "Messages shown to all users." },
  support: { title: "Support & Tickets", note: "A help desk for your users." },
};

export default function AdminSection() {
  const { section } = useParams<{ section: string }>();
  const page = PAGES[section];
  if (!page) notFound();
  return (
    <div className="sf-panel grid min-h-80 place-items-center p-8 text-center">
      <div>
        <h1 className="text-2xl font-bold">{page.title}</h1>
        <p className="mt-2 text-sm text-violet-200/70">{page.note}</p>
        <Link href="/admin/dashboard" className="sf-btn mt-5 inline-block px-5 py-2.5 text-sm">Back to the dashboard</Link>
      </div>
    </div>
  );
}