/* eslint-disable @next/next/no-img-element */
"use client";
import { useState } from "react";

export type Brand = "instagram" | "facebook" | "youtube" | "linkedin" | "x" | "tiktok";

const BRANDS: Record<string, { label: string; fallback: string }> = {
  instagram: { label: "Instagram", fallback: "IG" },
  facebook: { label: "Facebook", fallback: "f" },
  youtube: { label: "YouTube", fallback: "YT" },
  linkedin: { label: "LinkedIn", fallback: "in" },
  x: { label: "X", fallback: "X" },
  tiktok: { label: "TikTok", fallback: "TT" },
};

export function BrandLogo({ brand, size = 48 }: { brand?: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const b = (brand && BRANDS[brand]) || { label: "", fallback: "?" };
  return (
    <span
      className="grid shrink-0 place-items-center overflow-hidden rounded-[22%] bg-white shadow-[0_0_14px_#a855f799]"
      style={{ width: size, height: size }}
    >
      {failed || !brand ? (
        <b className="text-sm text-black">{b.fallback}</b>
      ) : (
        <img src={`/logos/${brand}.svg`} alt={b.label} onError={() => setFailed(true)}
          className="h-[70%] w-[70%] object-contain" />
      )}
    </span>
  );
}