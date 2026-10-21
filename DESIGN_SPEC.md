## Handoff Spec: Ashoka Events (student app shell, home, event details)

### Overview
Mobile-first ticketing app. Dark navy backdrop, glassy rounded cards with a blue outline, pill buttons, and one crimson accent for the primary action. Students mostly use one hand on a phone, so primary actions sit at the bottom of the screen (floating tab bar, sticky "Buy ticket" bar).
Logo: `public/ashoka-logo.png` (header 40px high, login 56px high). Do not recolour or stretch it.

### Layout
- Page container: `max-w-6xl`, horizontal padding `space-4` (mobile) / `space-6` (sm+). Home and detail pages narrow to `max-w-5xl` / `max-w-2xl`.
- Home grid: 1 column (<640px), 2 columns (640-1023px), 3 columns (1024px+), gap `space-5`.
- Event details: single column, poster on top, white sheet overlapping it by `space-10`.

### Design Tokens Used (dark theme, Ashoka navy and crimson)
| Token | Value | Usage |
|-------|-------|-------|
| `paper` | #060A14 | Page background, with a soft navy glow top-left and a faint crimson glow top-right |
| `card` | #0E1524 | Cards, inputs, tab bar |
| `strong` / `navy` | #0B1F4A / #002060 | Stats panel, ticket header, banners (navy is the logo's blue) |
| `edge` | #27437F | Card outlines |
| `ink` | #EAF0FB | Main text |
| `muted` | #9AA6BD | Secondary text and icons |
| `line` | #222C44 | Dividers |
| `accent` | #C8102E (hover #A60D26) | Primary buttons, active tab, price actions (the logo's crimson) |
| `ultra` | #FF8A9A | Links and icons on dark |
| `good` / `bad` / `warn` | #0A7D4D / #D6334A / #F5A524 | Scan results. Chips use the lighter `-fg` text on `-soft` backgrounds |
| `radius-card` | 30px | Event cards and sheets |
| `radius-pill` | 9999px | Buttons, search, tab bar, chips |
| `font-display` | Fraunces | Event names and page headings |
| `font-sans` | Outfit | Everything else |

The QR panel on a ticket stays white so phone cameras can scan it. The logo uses `public/ashoka-logo-light.png` (white lettering) on dark.

### Components
| Component | Variant | Props | Notes |
|-----------|---------|-------|-------|
| EventCard | default, sold out | `event`, `soldOut` | Price tab bottom-right on poster. Sold out adds a "Sales closed" chip top-right. Never shows seat counts. |
| Heart button | off, on | none (local state) | 44px circle. Off: black with white heart. On: red, filled. |
| Button | primary, dark, outline | `disabled` | Pill. Primary is yellow with dark text. Outline is 5% black fill. |
| Tab bar (mobile) | student (2 tabs), organiser (3 tabs) | n/a | Floating black pill. Active tab is a white pill with icon and label; inactive tabs show icon only. Hidden from 768px up, where the header nav shows instead. |
| Search | default | `value` | Full-width pill, 56px high, search icon inside. Filters on name and venue. |
| Sort toggle | off, on | `aria-pressed` | 56px circle next to search. On = sort by lowest price. |

### States and Interactions
| Element | State | Behavior |
|---------|-------|----------|
| Event card | Hover (desktop) | Card background goes from 60% to 90% white, poster zooms to 103% over 500ms |
| Event card | Focus | 3px ink outline, 2px offset |
| Buy ticket | Sales open | Yellow, links to checkout |
| Buy ticket | Not signed in | Label becomes "Sign in to buy ticket", returns to checkout after login |
| Buy ticket | Sales closed or not open | Outline style, disabled. Not-open state also shows the open date |
| Buy ticket | Already has ticket | Black "View your ticket" button |
| Buy ticket | Organiser account | Disabled, with an explanation |
| Share | Tap | Native share sheet; falls back to copying the link and showing "Link copied" for 2s |
| Heart | Tap | Toggles saved state (not stored yet, V2) |

### Responsive Behavior
| Breakpoint | Changes |
|------------|---------|
| Desktop (>=1024px) | 3-column grid, top nav pills, no tab bar |
| Tablet (768-1023px) | 2-column grid, top nav pills, no tab bar |
| Mobile (<768px) | 1-column grid, floating tab bar, sticky Buy ticket bar sits above it |

### Edge Cases
- **Empty state**: "Nothing on sale right now", or "No events match your search" when a search is active.
- **Long text**: card title wraps (no limit); card blurb is cut at 2 lines; venue wraps below date and time.
- **Loading**: grey pulsing skeleton until the store is ready.
- **Error**: event not found shows a message and a "Back to events" button.
- **No poster**: generated artwork is used.

### Animation / Motion
| Element | Trigger | Animation | Duration | Easing |
|---------|---------|-----------|----------|--------|
| Poster | Card hover | Scale to 1.03 | 500ms | ease |
| Buttons, cards | Hover | Colour change | 150ms | ease |
| All motion | `prefers-reduced-motion` | Disabled | n/a | n/a |

### Accessibility Notes
- Focus order: logo, nav, search, sort toggle, cards (each card link, then its heart), then the tab bar.
- Icon-only buttons need `aria-label` (back, share, heart, sort, sign out). Heart and sort use `aria-pressed`.
- Date, time and venue are a description list with screen-reader-only labels.
- Active tab and nav link use `aria-current="page"`.
- White text on the crimson accent is 5.9:1. Muted text on cards is 7.4:1. Every text and background pair is at least 4.5:1, except the huge scan-result headline.
