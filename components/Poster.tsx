import type { EventT } from "@/lib/types";

/** Shows the uploaded poster, or generated artwork (Ashoka navy and crimson) when none was uploaded. */
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
          <rect width="400" height="500" fill="#0B2A66" />
          <circle cx="200" cy="215" r="125" fill="#C8102E" />
          <rect y="238" width="400" height="7" fill="#0B2A66" />
          <rect y="262" width="400" height="11" fill="#0B2A66" />
          <rect y="290" width="400" height="16" fill="#0B2A66" />
          <rect x="40" y="410" width="320" height="6" rx="3" fill="#EAF0FB" opacity=".5" />
          <rect x="40" y="430" width="200" height="6" rx="3" fill="#EAF0FB" opacity=".3" />
        </svg>
      );
    case 1:
      return (
        <svg {...common}>
          <rect width="400" height="500" fill="#C8102E" />
          <circle cx="0" cy="0" r="230" fill="#060A14" />
          <circle cx="400" cy="500" r="270" fill="#0B2A66" />
          <circle cx="320" cy="130" r="58" fill="#EAF0FB" />
          <circle cx="95" cy="390" r="40" fill="#EAF0FB" />
        </svg>
      );
    case 2:
      return (
        <svg {...common}>
          <rect width="400" height="500" fill="#060A14" />
          <g fill="none" strokeWidth="22">
            <circle cx="200" cy="250" r="190" stroke="#27437F" />
            <circle cx="200" cy="250" r="140" stroke="#C8102E" />
            <circle cx="200" cy="250" r="90" stroke="#EAF0FB" />
          </g>
          <circle cx="200" cy="250" r="38" fill="#C8102E" />
        </svg>
      );
    case 3:
      return (
        <svg {...common}>
          <rect width="400" height="500" fill="#123A7A" />
          <polygon points="0,500 200,110 400,500" fill="#EAF0FB" />
          <polygon points="110,500 260,250 410,500" fill="#0B1F4A" opacity=".95" />
          <polygon points="0,0 150,0 0,150" fill="#C8102E" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <rect width="400" height="500" fill="#7A1226" />
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const y = 120 + i * 62;
            return <path key={i} d={`M-20 ${y} Q 80 ${y - 60} 200 ${y} T 420 ${y}`} stroke="#060A14" strokeWidth="14" fill="none" />;
          })}
          <circle cx="310" cy="95" r="46" fill="#EAF0FB" />
        </svg>
      );
  }
}
