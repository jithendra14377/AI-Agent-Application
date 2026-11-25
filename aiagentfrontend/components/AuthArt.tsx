export function Waves() {
  const waves = [
    { d: "M-60 340 C 140 230, 280 120, 520 -30", g: "a", w: 2 },
    { d: "M-60 385 C 160 285, 320 190, 580 20", g: "a", w: 1.2 },
    { d: "M-80 860 C 240 780, 470 900, 820 980", g: "a", w: 2 },
    { d: "M1480 -30 C 1560 120, 1610 170, 1680 280", g: "a", w: 2 },
    { d: "M1400 940 C 1520 840, 1580 790, 1700 700", g: "b", w: 2 },
  ];
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1600 900"
      preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="sfw-a" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#a855f7" stopOpacity="0" />
          <stop offset=".5" stopColor="#d946ef" />
          <stop offset="1" stopColor="#7c3aed" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="sfw-b" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#22d3ee" stopOpacity="0" />
          <stop offset=".5" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#6366f1" stopOpacity="0" />
        </linearGradient>
        <filter id="sfw-blur"><feGaussianBlur stdDeviation="7" /></filter>
      </defs>
      <g fill="none" filter="url(#sfw-blur)" opacity=".5">
        {waves.map((w, i) => <path key={i} d={w.d} stroke={`url(#sfw-${w.g})`} strokeWidth={w.w * 5} vectorEffect="non-scaling-stroke" />)}
      </g>
      <g fill="none" opacity=".85">
        {waves.map((w, i) => <path key={i} d={w.d} stroke={`url(#sfw-${w.g})`} strokeWidth={w.w} vectorEffect="non-scaling-stroke" />)}
      </g>
    </svg>
  );
}

export function Mountains({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 800 190" preserveAspectRatio="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="mt-a" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a1a7a" />
          <stop offset="1" stopColor="#07031d" />
        </linearGradient>
      </defs>
      <path d="M0 190V120L80 86 150 118 250 60 350 120 450 84 560 130 680 90 800 124V190Z" fill="url(#mt-a)" opacity=".85" />
      <path d="M0 150L90 118 180 150 300 100 420 152 540 120 660 156 800 130V190H0Z" fill="#0b0630" />
      <path d="M0 120L80 86 150 118 250 60 350 120 450 84 560 130 680 90 800 124" fill="none" stroke="#7c5cff" strokeOpacity=".35" strokeWidth="1.5" />
    </svg>
  );
}

export function OrbitRing({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 340 340" className={`overflow-visible ${className}`} aria-hidden="true">
      <defs>
        <linearGradient id="orb" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#a855f7" />
          <stop offset=".55" stopColor="#6d7bff" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
        <filter id="orbf" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6" /></filter>
      </defs>
      <g fill="none" transform="rotate(-24 170 170)">
        <ellipse cx="170" cy="170" rx="160" ry="118" stroke="url(#orb)" strokeWidth="9" filter="url(#orbf)" opacity=".6" />
        <ellipse cx="170" cy="170" rx="160" ry="118" stroke="url(#orb)" strokeWidth="2.5" />
      </g>
      <path d="M30 290C10 330-40 345-120 330" stroke="url(#orb)" strokeWidth="2.5" fill="none" opacity=".9" />
    </svg>
  );
}

export function HeroRobot({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 440 480" className={className} role="img" aria-label="AI robot assistant">
      <defs>
        <radialGradient id="rb-glow" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#a855f7" stopOpacity=".55" />
          <stop offset="1" stopColor="#a855f7" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="rb-shell" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".6" stopColor="#e4dcff" />
          <stop offset="1" stopColor="#b9a8f2" />
        </linearGradient>
        <linearGradient id="rb-dark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#120c3d" />
          <stop offset="1" stopColor="#05031a" />
        </linearGradient>
        <filter id="rb-glowf" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <ellipse cx="215" cy="260" rx="215" ry="225" fill="url(#rb-glow)" />
      {/* left arm */}
      <path d="M128 350C92 360 76 398 86 438" stroke="url(#rb-shell)" strokeWidth="34" strokeLinecap="round" fill="none" />
      <circle cx="86" cy="440" r="19" fill="url(#rb-shell)" />
      {/* torso */}
      <path d="M112 338Q112 296 160 292L262 292Q312 296 312 340L306 440Q300 476 258 478L166 478Q122 476 116 440Z" fill="url(#rb-shell)" />
      <path d="M262 292Q312 296 312 340L306 440Q300 476 258 478L240 478Q282 470 284 430L286 330Q286 300 262 292Z" fill="#8f7fd6" opacity=".28" />
      <circle cx="212" cy="384" r="30" fill="#1b0f55" />
      <circle cx="212" cy="384" r="22" fill="none" stroke="#a855f7" strokeWidth="6" filter="url(#rb-glowf)" />
      <circle cx="212" cy="384" r="9" fill="none" stroke="#67e8f9" strokeWidth="3" />
      {/* right arm presenting the icons */}
      <path d="M300 352C346 350 382 318 398 270" stroke="url(#rb-shell)" strokeWidth="34" strokeLinecap="round" fill="none" />
      <g transform="translate(404 254) rotate(-20)">
        <rect x="-18" y="-24" width="36" height="46" rx="16" fill="url(#rb-shell)" />
        <rect x="-12" y="-44" width="9" height="26" rx="4.5" fill="url(#rb-shell)" />
        <rect x="-1" y="-48" width="9" height="30" rx="4.5" fill="url(#rb-shell)" />
        <rect x="10" y="-42" width="9" height="26" rx="4.5" fill="url(#rb-shell)" />
      </g>
      {/* neck and head */}
      <rect x="180" y="268" width="64" height="40" rx="14" fill="#9b8be0" />
      <ellipse cx="214" cy="170" rx="122" ry="112" fill="url(#rb-shell)" />
      <path d="M100 150C98 24 330 24 328 150" stroke="#cfc3fb" strokeWidth="14" fill="none" strokeLinecap="round" />
      {/* visor, eyes and smile */}
      <rect x="120" y="108" width="188" height="112" rx="54" fill="url(#rb-dark)" stroke="#3a2d96" strokeWidth="3" />
      <ellipse cx="170" cy="126" rx="52" ry="9" fill="#fff" opacity=".1" />
      <g filter="url(#rb-glowf)" stroke="#6aa8ff" strokeWidth="9" strokeLinecap="round" fill="none">
        <path d="M152 170Q170 140 188 170" />
        <path d="M240 170Q258 140 276 170" />
      </g>
      <path d="M198 196Q214 208 230 196" stroke="#3b82f6" strokeWidth="5" strokeLinecap="round" fill="none" />
      {/* headphone ear cups */}
      <ellipse cx="96" cy="172" rx="26" ry="42" fill="#efe9ff" />
      <ellipse cx="96" cy="172" rx="26" ry="42" fill="none" stroke="#f0abfc" strokeWidth="6" filter="url(#rb-glowf)" />
      <ellipse cx="332" cy="172" rx="22" ry="40" fill="#e7dfff" />
      <ellipse cx="332" cy="172" rx="22" ry="40" fill="none" stroke="#a78bfa" strokeWidth="5" filter="url(#rb-glowf)" />
    </svg>
  );
}

export function FeatureIcon({ name }: { name: "wand" | "layers" | "calendar" | "chart" }) {
  const p = {
    width: 30, height: 30, viewBox: "0 0 24 24", fill: "none", stroke: "#e9e1ff",
    strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  };
  if (name === "wand")
    return (
      <svg {...p}><path d="M4 20 15 9" /><path d="m14 6 4 4" /><path d="M17 3v3M15.5 4.5h3" /><path d="M6 4v2M5 5h2" /><path d="M20 14v2M19 15h2" /></svg>
    );
  if (name === "layers")
    return <svg {...p}><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 12 9 5 9-5" /><path d="m3 16 9 5 9-5" /></svg>;
  if (name === "calendar")
    return (
      <svg {...p}><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /><path d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" /></svg>
    );
  return <svg {...p}><path d="M7 20v-7M12 20V6M17 20v-10" /></svg>;
}