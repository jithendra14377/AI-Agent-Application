type B = "instagram" | "facebook" | "youtube" | "linkedin" | "x" | "tiktok";

const FB = "M279.14 288l14.22-92.66h-88.91v-60.13c0-25.35 12.42-50.06 52.24-50.06h40.42V6.26S260.43 0 225.36 0c-73.22 0-121.08 44.38-121.08 124.72v70.62H22.89V288h81.39v224h100.17V288z";
const LI = "M100.28 448H7.4V148.9h92.88zM53.79 108.1C24.09 108.1 0 83.5 0 53.8a53.79 53.79 0 0 1 107.58 0c0 29.7-24.1 54.3-53.79 54.3zM447.9 448h-92.68V302.4c0-34.7-.7-79.2-48.29-79.2-48.29 0-55.69 37.7-55.69 76.7V448h-92.78V148.9h89.08v40.8h1.3c12.4-23.5 42.69-48.3 87.88-48.3 94 0 111.28 61.9 111.28 142.3V448z";
const XP = "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z";
const TT = "M448,209.91a210.06,210.06,0,0,1-122.77-39.25V349.38A162.55,162.55,0,1,1,185,188.31V278.2a74.62,74.62,0,1,0,52.23,71.18V0l88,0a121.18,121.18,0,0,0,1.86,22.17h0A122.18,122.18,0,0,0,381,102.39a121.43,121.43,0,0,0,67,20.14Z";

const BG: Record<B, { bg: string; glow: string }> = {
  instagram: { bg: "linear-gradient(45deg,#f9ce34,#ee2a7b 48%,#6228d7)", glow: "rgba(238,42,123,.65)" },
  facebook: { bg: "#1877f2", glow: "rgba(24,119,242,.7)" },
  youtube: { bg: "#ff0000", glow: "rgba(255,40,40,.65)" },
  linkedin: { bg: "#0a66c2", glow: "rgba(10,102,194,.7)" },
  x: { bg: "#000", glow: "rgba(255,255,255,.28)" },
  tiktok: { bg: "#0a0a0a", glow: "rgba(37,244,238,.55)" },
};
const cls = "h-[52%] w-[52%]";

function Glyph({ brand }: { brand: B }) {
  switch (brand) {
    case "instagram":
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="#fff" strokeWidth="2">
          <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.2" cy="6.8" r="1.2" fill="#fff" stroke="none" />
        </svg>
      );
    case "facebook":
      return <svg viewBox="0 0 320 512" className={cls}><path fill="#fff" d={FB} /></svg>;
    case "youtube":
      return (
        <svg viewBox="0 0 24 24" className="h-[60%] w-[60%]">
          <rect x="2.5" y="5.5" width="19" height="13" rx="4" fill="#fff" />
          <path d="M10 9.2v5.6l4.8-2.8z" fill="#f00" />
        </svg>
      );
    case "linkedin":
      return <svg viewBox="0 0 448 512" className={cls}><path fill="#fff" d={LI} /></svg>;
    case "x":
      return <svg viewBox="0 0 24 24" className="h-[50%] w-[50%]"><path fill="#fff" d={XP} /></svg>;
    default:
      return (
        <svg viewBox="0 0 448 512" className={cls}>
          <path fill="#25f4ee" d={TT} transform="translate(-12 -8)" />
          <path fill="#fe2c55" d={TT} transform="translate(12 8)" />
          <path fill="#fff" d={TT} />
        </svg>
      );
  }
}

export function BrandTile({ brand, size = 72, className = "", style }: {
  brand: B; size?: number; className?: string; style?: React.CSSProperties;
}) {
  const c = BG[brand];
  return (
    <span role="img" aria-label={brand}
      className={`grid shrink-0 place-items-center ${className}`}
      style={{
        width: size, height: size, borderRadius: "22%", background: c.bg,
        boxShadow: `0 0 26px ${c.glow}, inset 0 0 0 1px rgba(255,255,255,.14)`, ...style,
      }}>
      <Glyph brand={brand} />
    </span>
  );
}