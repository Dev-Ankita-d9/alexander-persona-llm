/**
 * Light squircle with line-art sparkles (outline-only star, +, and dot).
 */
const STROKE = "#1d4ed8";
const W = 1.5;

export default function BrandSparkleLogo({ size = 44, className = "" }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="24" height="24" rx="7" fill="#e8ecfb" />
      <path
        d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"
        fill="none"
        stroke={STROKE}
        strokeWidth={W}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d="M20 2v4"
        stroke={STROKE}
        strokeWidth={W}
        strokeLinecap="round"
      />
      <path
        d="M22 4h-4"
        stroke={STROKE}
        strokeWidth={W}
        strokeLinecap="round"
      />
      <circle
        cx="4"
        cy="20"
        r="2"
        fill="none"
        stroke={STROKE}
        strokeWidth={W}
      />
    </svg>
  );
}
