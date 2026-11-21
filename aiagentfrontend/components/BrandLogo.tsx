// /* eslint-disable @next/next/no-img-element */
// "use client";
// import { useState } from "react";

// export type Brand = "instagram" | "facebook" | "youtube" | "linkedin" | "x" | "tiktok";

// const BRANDS: Record<string, { label: string; fallback: string }> = {
//   instagram: { label: "Instagram", fallback: "IG" },
//   facebook: { label: "Facebook", fallback: "f" },
//   youtube: { label: "YouTube", fallback: "YT" },
//   linkedin: { label: "LinkedIn", fallback: "in" },
//   x: { label: "X", fallback: "X" },
//   tiktok: { label: "TikTok", fallback: "TT" },
// };

// export function BrandLogo({ brand, size = 48 }: { brand?: string; size?: number }) {
//   const [failed, setFailed] = useState(false);
//   const b = (brand && BRANDS[brand]) || { label: "", fallback: "?" };
//   return (
//     <span
//       className="grid shrink-0 place-items-center overflow-hidden rounded-[22%] bg-white shadow-[0_0_14px_#a855f799]"
//       style={{ width: size, height: size }}
//     >
//       {failed || !brand ? (
//         <b className="text-sm text-black">{b.fallback}</b>
//       ) : (
//         <img src={`/logos/${brand}.svg`} alt={b.label} onError={() => setFailed(true)}
//           className="h-[70%] w-[70%] object-contain" />
//       )}
//     </span>
//   );
// }

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

// X logo: black tile with a white X (change bg-black to bg-white and fill="#fff" to fill="#000" for a black X on white)
function XMark({ size }: { size: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-[22%] bg-black shadow-[0_0_14px_#a855f799] ring-1 ring-white/25"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 24 24" className="h-[55%] w-[55%]" fill="#fff" role="img" aria-label="X">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    </span>
  );
}

export function BrandLogo({ brand, size = 48 }: { brand?: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (brand === "x") return <XMark size={size} />;

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