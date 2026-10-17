## Handoff Spec: Ashoka Events (student app shell, home, event details)

### Overview
Mobile-first ticketing app. Soft pastel backdrop, large rounded white cards, pill buttons, one yellow accent for the primary action. Students mostly use one hand on a phone, so primary actions sit at the bottom of the screen (floating tab bar, sticky "Buy ticket" bar).
Logo: `public/ashoka-logo.png` (header 40px high, login 56px high). Do not recolour or stretch it.

### Layout
- Page container: `max-w-6xl`, horizontal padding `space-4` (mobile) / `space-6` (sm+). Home and detail pages narrow to `max-w-5xl` / `max-w-2xl`.
- Home grid: 1 column (<640px), 2 columns (640-1023px), 3 columns (1024px+), gap `space-5`.
- Event details: single column, poster on top, white sheet overlapping it by `space-10`.

### Design Tokens Used
| Token | Value | Usage |
|-------|-------|-------|
| `color-accent` | #F2B83D | Primary buttons, price tab |
| `color-accent-dark` | #E3A62A | Primary button hover |
| `color-ink` | #151515 | Text, tab bar, dark buttons |
| `color-muted` | #6B7076 | Secondary text, icons |
| `color-paper` | #F2F3F5 | Page base |
| `color-backdrop` | #CCE2F2 to #E0F0EE to #F2F3F5 | Page gradient, top 560px, vertical |
| `color-heart` | #E5231F | Saved heart |
| `color-good` / `color-bad` / `color-warn` | #0B8A55 / #C62F3E / #F5A524 | Scan results, status chips |
| `radius-card` | 32px | Cards, detail sheet |
| `radius-media` | 26px | Poster inside a card |
| `radius-pill` | 9999px | Buttons, search, tab bar, chips |
| `font-family` | Outfit (variable) | All text |
| `font-title` | 24-36px / 500 | Event names |
| `font-body` | 16px / 400 | Descriptions |

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
- Text on yellow is #151515 (contrast above 9:1). Muted text on white is above 4.5:1.
