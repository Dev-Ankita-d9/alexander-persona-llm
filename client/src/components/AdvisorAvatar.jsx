function ElonFace({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
      <circle cx="20" cy="20" r="20" fill="#6366f1" fillOpacity="0.12" />
      {/* neck */}
      <rect x="17" y="30" width="6" height="5" rx="1.5" fill="#e0b88a" />
      {/* head — angular, narrow */}
      <ellipse cx="20" cy="20" rx="10.5" ry="12.5" fill="#e8c49a" />
      {/* ears */}
      <ellipse cx="9.5" cy="21" rx="2" ry="2.8" fill="#d4a875" />
      <ellipse cx="30.5" cy="21" rx="2" ry="2.8" fill="#d4a875" />
      {/* hair — swept-back dark, angular hairline */}
      <path
        d="M9.5 17 C9.5 9 14 4.5 20 4.5 C26 4.5 30.5 9 30.5 17 C29 10.5 25 8 20 8 C15 8 11 10.5 9.5 17Z"
        fill="#2a1a0a"
      />
      {/* eyes */}
      <ellipse cx="16.5" cy="20.5" rx="2" ry="2.2" fill="#18182a" />
      <ellipse cx="23.5" cy="20.5" rx="2" ry="2.2" fill="#18182a" />
      <circle cx="17.2" cy="19.6" r="0.65" fill="white" />
      <circle cx="24.2" cy="19.6" r="0.65" fill="white" />
      {/* slight smirk */}
      <path
        d="M17.5 27 Q20.5 29 23 27"
        stroke="#b8805a"
        strokeWidth="1.3"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BezosFace({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
      <circle cx="20" cy="20" r="20" fill="#f59e0b" fillOpacity="0.12" />
      {/* neck */}
      <rect x="16.5" y="30" width="7" height="5" rx="1.5" fill="#e0b070" />
      {/* head — wide, round, bald */}
      <ellipse cx="20" cy="20" rx="12" ry="13" fill="#f0c890" />
      {/* ears */}
      <ellipse cx="8" cy="21" rx="2.2" ry="3" fill="#d8a060" />
      <ellipse cx="32" cy="21" rx="2.2" ry="3" fill="#d8a060" />
      {/* tiny hair remnants on temples only */}
      <path
        d="M9 17 C9.5 12 11.5 9 14 8"
        stroke="#3a2818"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        strokeOpacity="0.7"
      />
      <path
        d="M31 17 C30.5 12 28.5 9 26 8"
        stroke="#3a2818"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        strokeOpacity="0.7"
      />
      {/* eyes — intense, wide */}
      <ellipse cx="16" cy="20" rx="2.3" ry="2" fill="#141414" />
      <ellipse cx="24" cy="20" rx="2.3" ry="2" fill="#141414" />
      <circle cx="16.9" cy="19.2" r="0.65" fill="white" />
      <circle cx="24.9" cy="19.2" r="0.65" fill="white" />
      {/* bold confident smile */}
      <path
        d="M14.5 26.5 Q20 31.5 25.5 26.5"
        stroke="#c07040"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GaryFace({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
      <circle cx="20" cy="20" r="20" fill="#ef4444" fillOpacity="0.12" />
      {/* neck */}
      <rect x="17" y="30" width="6" height="5" rx="1.5" fill="#c08060" />
      {/* head — round, full */}
      <ellipse cx="20" cy="20" rx="12" ry="13" fill="#d4956a" />
      {/* ears */}
      <ellipse cx="8" cy="21" rx="2.2" ry="3" fill="#b87848" />
      <ellipse cx="32" cy="21" rx="2.2" ry="3" fill="#b87848" />
      {/* dark full hair */}
      <path
        d="M8.5 16 C8.5 8.5 13 4.5 20 4.5 C27 4.5 31.5 8.5 31.5 16 C30 9.5 26 7 20 7 C14 7 10 9.5 8.5 16Z"
        fill="#160e04"
      />
      {/* stubble shadow on jaw */}
      <ellipse cx="20" cy="29" rx="8" ry="3.5" fill="#160e04" fillOpacity="0.15" />
      {/* eyes */}
      <ellipse cx="16" cy="20" rx="2.3" ry="2" fill="#160e04" />
      <ellipse cx="24" cy="20" rx="2.3" ry="2" fill="#160e04" />
      <circle cx="16.9" cy="19.2" r="0.65" fill="white" />
      <circle cx="24.9" cy="19.2" r="0.65" fill="white" />
      {/* big open energetic smile */}
      <path
        d="M14 26 Q20 32 26 26"
        stroke="#9a5030"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
      />
      {/* teeth */}
      <path d="M15.5 27 Q20 31 24.5 27" fill="white" fillOpacity="0.45" />
    </svg>
  );
}

function TalebFace({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
      <circle cx="20" cy="20" r="20" fill="#06b6d4" fillOpacity="0.12" />
      {/* neck */}
      <rect x="17" y="30" width="6" height="5" rx="1.5" fill="#c09060" />
      {/* head */}
      <ellipse cx="20" cy="20" rx="11.5" ry="13" fill="#d0a870" />
      {/* ears */}
      <ellipse cx="8.5" cy="21" rx="2" ry="2.8" fill="#b88040" />
      <ellipse cx="31.5" cy="21" rx="2" ry="2.8" fill="#b88040" />
      {/* dark wavy hair */}
      <path
        d="M8.5 16 C8.5 8 13 4 20 4 C27 4 31.5 8 31.5 16 C30 9 26 6.5 20 6.5 C14 6.5 10 9 8.5 16Z"
        fill="#160808"
      />
      {/* beard — full, scholarly */}
      <path
        d="M10 24 Q10 35 20 36 Q30 35 30 24 Q27 30 20 31 Q13 30 10 24Z"
        fill="#160808"
        fillOpacity="0.4"
      />
      {/* moustache */}
      <ellipse cx="20" cy="25.5" rx="5" ry="1.8" fill="#160808" fillOpacity="0.35" />
      {/* eyes — intense, thoughtful */}
      <ellipse cx="16" cy="20" rx="2.1" ry="2.2" fill="#160808" />
      <ellipse cx="24" cy="20" rx="2.1" ry="2.2" fill="#160808" />
      <circle cx="16.8" cy="19.2" r="0.65" fill="white" />
      <circle cx="24.8" cy="19.2" r="0.65" fill="white" />
      {/* slight frown — skeptical */}
      <path
        d="M17 27.5 Q20 26 23 27.5"
        stroke="#8a5830"
        strokeWidth="1.3"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

const FACE_MAP = {
  "vc-musk": ElonFace,
  "operator-bezos": BezosFace,
  "growth-gary": GaryFace,
  "skeptic-taleb": TalebFace,
};

export default function AdvisorAvatar({ advisorId, size = 36, className = "" }) {
  const Face = FACE_MAP[advisorId];
  if (!Face) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        className={className}
        aria-hidden
      >
        <circle cx="20" cy="20" r="20" fill="currentColor" fillOpacity="0.15" />
        <text x="20" y="25" textAnchor="middle" fontSize="16" fill="currentColor" fontWeight="700">
          ?
        </text>
      </svg>
    );
  }
  return (
    <span className={`advisor-avatar-wrap ${className}`} style={{ display: "inline-flex", flexShrink: 0 }}>
      <Face size={size} />
    </span>
  );
}
