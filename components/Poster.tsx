import type { EventT } from "@/lib/types";

/** Shows the uploaded poster, or generated artwork when the organiser hasn't uploaded one. */
export default function Poster({ event }: { event: Pick<EventT, "posterUrl" | "posterTheme"> }) {
  if (event.posterUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={event.posterUrl} alt="" className="h-full w-full object-cover" />;
  }
  const common = { viewBox: "0 0 400 500", preserveAspectRatio: "xMidYMid slice", className: "h-full w-full", "aria-hidden": true } as const;
  switch (event.posterTheme % 5) {
    case 0:
      return (
        <svg {...common}>
          <rect width="400" height="500" fill="#3A34E8" />
          <circle cx="200" cy="215" r="125" fill="#FFB224" />
          <rect y="238" width="400" height="7" fill="#3A34E8" />
          <rect y="262" width="400" height="11" fill="#3A34E8" />
          <rect y="290" width="400" height="16" fill="#3A34E8" />
          <rect x="40" y="410" width="320" height="6" rx="3" fill="#F5F3FB" opacity=".55" />
          <rect x="40" y="430" width="200" height="6" rx="3" fill="#F5F3FB" opacity=".35" />
        </svg>
      );
    case 1:
      return (
        <svg {...common}>
          <rect width="400" height="500" fill="#FFB224" />
          <circle cx="0" cy="0" r="230" fill="#1B1A3D" />
          <circle cx="400" cy="500" r="270" fill="#3A34E8" />
          <circle cx="320" cy="130" r="58" fill="#F5F3FB" />
          <circle cx="95" cy="390" r="40" fill="#F5F3FB" />
        </svg>
      );
    case 2:
      return (
        <svg {...common}>
          <rect width="400" height="500" fill="#1B1A3D" />
          <g fill="none" strokeWidth="22">
            <circle cx="200" cy="250" r="190" stroke="#3A34E8" />
            <circle cx="200" cy="250" r="140" stroke="#FFB224" />
            <circle cx="200" cy="250" r="90" stroke="#C62F3E" />
          </g>
          <circle cx="200" cy="250" r="38" fill="#F5F3FB" />
        </svg>
      );
    case 3:
      return (
        <svg {...common}>
          <rect width="400" height="500" fill="#0E9F8E" />
          <polygon points="0,500 200,110 400,500" fill="#F5F3FB" />
          <polygon points="110,500 260,250 410,500" fill="#1B1A3D" opacity=".9" />
          <polygon points="0,0 150,0 0,150" fill="#FFB224" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <rect width="400" height="500" fill="#F26B5B" />
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const y = 120 + i * 62;
            return <path key={i} d={`M-20 ${y} Q 80 ${y - 60} 200 ${y} T 420 ${y}`} stroke="#1B1A3D" strokeWidth="14" fill="none" />;
          })}
          <circle cx="310" cy="95" r="46" fill="#FFB224" />
        </svg>
      );
  }
}
