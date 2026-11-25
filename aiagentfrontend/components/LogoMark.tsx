import { useId } from "react";

export function LogoMark({ size = 56 }: { size?: number }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="SocialFlow AI"
      style={{ filter: "drop-shadow(0 0 10px rgba(168,85,247,.65))" }}>
      <defs>
        <linearGradient id={`${id}a`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c084fc" />
          <stop offset=".55" stopColor="#6366f1" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
        <linearGradient id={`${id}b`} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f0abfc" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="26" fill="none" stroke={`url(#${id}a)`} strokeWidth="7" strokeLinecap="round"
        strokeDasharray="32 8.85" transform="rotate(-70 32 32)" />
      <circle cx="32" cy="32" r="15.5" fill="none" stroke={`url(#${id}b)`} strokeWidth="6" strokeLinecap="round"
        strokeDasharray="70 27.4" transform="rotate(40 32 32)" />
      <circle cx="32" cy="32" r="4.6" fill="#e9d5ff" />
    </svg>
  );
}