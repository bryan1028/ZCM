/** Zood (food) and Zind (prices) wordmarks. Small, hand-made SVGs so they stay crisp and weigh almost nothing. */

export function ZoodMark({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Zood" className="mark">
      <path d="M22 20c-4-4 4-7 0-12M32 22c-4-4 4-7 0-12M42 20c-4-4 4-7 0-12" fill="none" stroke="#e8531a" strokeWidth="3" strokeLinecap="round" opacity=".55" />
      <path d="M6 32h52c0 15-11 24-26 24S6 47 6 32z" fill="#e8531a" />
      <rect x="4" y="29" width="56" height="6" rx="3" fill="#c44614" />
      <circle cx="23" cy="42" r="3" fill="#fff" /><circle cx="41" cy="42" r="3" fill="#fff" />
      <circle cx="24" cy="43" r="1.4" fill="#1a1208" /><circle cx="42" cy="43" r="1.4" fill="#1a1208" />
      <path d="M26 49q6 6 12 0" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export function ZindMark({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Zind" className="mark">
      <circle cx="27" cy="27" r="19" fill="#e8f5ec" stroke="#1a6b3a" strokeWidth="5" />
      <path d="M41 41l16 16" stroke="#1a6b3a" strokeWidth="7" strokeLinecap="round" />
      <circle cx="20" cy="24" r="5" fill="#fff" stroke="#14572f" strokeWidth="1.5" /><circle cx="34" cy="24" r="5" fill="#fff" stroke="#14572f" strokeWidth="1.5" />
      <circle cx="21.5" cy="25.5" r="2.2" fill="#14572f" /><circle cx="35.5" cy="25.5" r="2.2" fill="#14572f" />
      <path d="M21 35q6 4 12 0" fill="none" stroke="#14572f" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
