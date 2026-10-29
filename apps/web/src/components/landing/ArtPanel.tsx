// Rich, layered SVG compositions standing in for AI-generated creative
// work. CREATIQ has no real generated artwork to showcase yet (the
// backend's default provider is a no-cost placeholder, see
// apps/api/src/services/ai/stub.provider.ts) — these are illustrative,
// hand-built abstract compositions in the brand palette, not a claim
// that any specific image was produced by CREATIQ or by a third party.
export type ArtPanelVariant =
  | "aurora"
  | "orbit"
  | "terrain"
  | "bloom"
  | "prism"
  | "waves";

function Aurora() {
  return (
    <svg viewBox="0 0 400 500" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="aurora-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1a0a18" />
          <stop offset="100%" stopColor="#3a0f34" />
        </linearGradient>
        <radialGradient id="aurora-glow" cx="50%" cy="20%" r="70%">
          <stop offset="0%" stopColor="#eaaa00" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#eaaa00" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="aurora-ribbon" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#eaaa00" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#dde3e8" stopOpacity="0.15" />
        </linearGradient>
      </defs>
      <rect width="400" height="500" fill="url(#aurora-bg)" />
      <circle cx="220" cy="90" r="220" fill="url(#aurora-glow)" />
      <path
        d="M-20 320 C 80 260, 160 380, 260 300 S 420 220, 460 280 L 460 520 L -20 520 Z"
        fill="url(#aurora-ribbon)"
        opacity="0.5"
      />
      <path
        d="M-20 380 C 100 340, 180 440, 300 360 S 420 300, 460 340 L 460 520 L -20 520 Z"
        fill="#dde3e8"
        opacity="0.08"
      />
      {Array.from({ length: 24 }).map((_, i) => (
        <circle
          key={i}
          cx={(i * 53 + 20) % 400}
          cy={(i * 97 + 40) % 500}
          r={i % 5 === 0 ? 2.4 : 1.1}
          fill="#dde3e8"
          opacity={0.25 + (i % 4) * 0.12}
        />
      ))}
    </svg>
  );
}

function Orbit() {
  return (
    <svg viewBox="0 0 400 500" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="orbit-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a0a26" />
          <stop offset="100%" stopColor="#120a11" />
        </linearGradient>
      </defs>
      <rect width="400" height="500" fill="url(#orbit-bg)" />
      <g transform="translate(200 230)">
        <ellipse cx="0" cy="0" rx="170" ry="60" fill="none" stroke="#eaaa00" strokeOpacity="0.35" strokeWidth="1.5" />
        <ellipse
          cx="0"
          cy="0"
          rx="170"
          ry="60"
          fill="none"
          stroke="#dde3e8"
          strokeOpacity="0.2"
          strokeWidth="1"
          transform="rotate(35)"
        />
        <ellipse
          cx="0"
          cy="0"
          rx="130"
          ry="45"
          fill="none"
          stroke="#dde3e8"
          strokeOpacity="0.25"
          strokeWidth="1"
          transform="rotate(-25)"
        />
        <circle cx="0" cy="0" r="46" fill="#eaaa00" />
        <circle cx="0" cy="0" r="46" fill="#3a0f34" opacity="0.25" />
        <circle cx="150" cy="18" r="8" fill="#dde3e8" />
        <circle cx="-120" cy="-30" r="5" fill="#dde3e8" opacity="0.8" />
        <circle cx="70" cy="-48" r="4" fill="#eaaa00" opacity="0.8" />
      </g>
      {Array.from({ length: 18 }).map((_, i) => (
        <circle
          key={i}
          cx={(i * 61 + 30) % 400}
          cy={(i * 83 + 20) % 500}
          r={i % 4 === 0 ? 2 : 1}
          fill="#dde3e8"
          opacity={0.2 + (i % 3) * 0.1}
        />
      ))}
    </svg>
  );
}

function Terrain() {
  return (
    <svg viewBox="0 0 400 500" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="terrain-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a0f34" />
          <stop offset="100%" stopColor="#1a0a18" />
        </linearGradient>
        <linearGradient id="terrain-far" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#dde3e8" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#dde3e8" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id="terrain-near" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#eaaa00" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#eaaa00" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <rect width="400" height="500" fill="url(#terrain-sky)" />
      <circle cx="300" cy="120" r="55" fill="#eaaa00" opacity="0.9" />
      <circle cx="300" cy="120" r="80" fill="#eaaa00" opacity="0.15" />
      <path d="M0 300 L0 230 Q100 180 200 240 T400 210 L400 300 Z" fill="url(#terrain-far)" />
      <path d="M0 500 L0 360 Q90 300 190 350 T400 320 L400 500 Z" fill="url(#terrain-near)" />
      <path d="M0 500 L0 410 Q120 380 240 420 T400 400 L400 500 Z" fill="#3a0f34" opacity="0.65" />
    </svg>
  );
}

function Bloom() {
  return (
    <svg viewBox="0 0 400 500" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="bloom-bg" cx="50%" cy="45%" r="75%">
          <stop offset="0%" stopColor="#3a0f34" />
          <stop offset="100%" stopColor="#160810" />
        </radialGradient>
      </defs>
      <rect width="400" height="500" fill="url(#bloom-bg)" />
      <g transform="translate(200 250)">
        {Array.from({ length: 10 }).map((_, i) => {
          const angle = (i / 10) * Math.PI * 2;
          const r = 95;
          return (
            <ellipse
              key={i}
              cx={Math.cos(angle) * r * 0.5}
              cy={Math.sin(angle) * r * 0.5}
              rx={70}
              ry={28}
              fill={i % 2 === 0 ? "#eaaa00" : "#dde3e8"}
              opacity={i % 2 === 0 ? 0.5 : 0.18}
              transform={`rotate(${(angle * 180) / Math.PI})`}
            />
          );
        })}
        <circle r="30" fill="#eaaa00" />
      </g>
    </svg>
  );
}

function Prism() {
  return (
    <svg viewBox="0 0 400 500" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="prism-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#160810" />
          <stop offset="100%" stopColor="#3a0f34" />
        </linearGradient>
      </defs>
      <rect width="400" height="500" fill="url(#prism-bg)" />
      <polygon points="200,60 340,220 200,380 60,220" fill="#dde3e8" opacity="0.08" />
      <polygon points="200,110 300,220 200,330 100,220" fill="#eaaa00" opacity="0.35" />
      <polygon points="200,150 265,220 200,290 135,220" fill="#eaaa00" opacity="0.8" />
      <line x1="200" x2="200" y1="60" y2="380" stroke="#dde3e8" strokeOpacity="0.2" strokeWidth="1" />
      <line x1="60" x2="340" y1="220" y2="220" stroke="#dde3e8" strokeOpacity="0.2" strokeWidth="1" />
      {Array.from({ length: 14 }).map((_, i) => (
        <circle
          key={i}
          cx={(i * 71 + 15) % 400}
          cy={(i * 59 + 420) % 500}
          r={1.4}
          fill="#dde3e8"
          opacity={0.3}
        />
      ))}
    </svg>
  );
}

function Waves() {
  return (
    <svg viewBox="0 0 400 500" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="waves-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#120a11" />
          <stop offset="100%" stopColor="#2a0a26" />
        </linearGradient>
      </defs>
      <rect width="400" height="500" fill="url(#waves-bg)" />
      {[0, 1, 2, 3, 4].map((i) => (
        <path
          key={i}
          d={`M-20 ${140 + i * 70} C 80 ${100 + i * 70}, 180 ${190 + i * 70}, 280 ${130 + i * 70} S 420 ${90 + i * 70}, 460 ${130 + i * 70}`}
          fill="none"
          stroke={i % 2 === 0 ? "#eaaa00" : "#dde3e8"}
          strokeOpacity={i % 2 === 0 ? 0.6 : 0.25}
          strokeWidth="2.5"
        />
      ))}
    </svg>
  );
}

const COMPOSITIONS: Record<ArtPanelVariant, () => React.ReactElement> = {
  aurora: Aurora,
  orbit: Orbit,
  terrain: Terrain,
  bloom: Bloom,
  prism: Prism,
  waves: Waves,
};

export function ArtPanel({
  variant = "aurora",
  className = "",
  label,
  children,
}: {
  variant?: ArtPanelVariant;
  className?: string;
  label: string;
  children?: React.ReactNode;
}) {
  const Composition = COMPOSITIONS[variant];

  return (
    <div
      role="img"
      aria-label={label}
      className={`relative overflow-hidden rounded-3xl ${className}`}
    >
      <Composition />
      {children}
    </div>
  );
}
