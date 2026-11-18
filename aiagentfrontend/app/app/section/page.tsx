"use client";
import { notFound, useParams } from "next/navigation";

const SECTIONS = ["content", "calendar", "analytics", "integrations", "settings"];

export default function SectionPage() {
  const { section } = useParams<{ section: string }>();
  if (!SECTIONS.includes(section)) notFound();
  const title = section.charAt(0).toUpperCase() + section.slice(1);
  return (
    <div className="grid h-full place-items-center rounded-2xl border border-dashed border-violet-400/30 text-center">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-violet-200/70">Temporary placeholder. The real {title.toLowerCase()} screen comes later.</p>
      </div>
    </div>
  );
}