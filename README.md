# Ashoka Events: campus event ticketing (front-end)

Next.js 14 (App Router) + React + Tailwind CSS. Front-end for the "Plan of Action: Campus Event Ticketing Platform (MVP)".
Styled after the reference mobile design and using the Ashoka University logo (`public/ashoka-logo.png`). Design tokens and component states are in `DESIGN_SPEC.md`.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
```

Everything runs on sample data stored in your browser's localStorage, so the whole journey works with no backend.
On the sign-in page, use **Demo access** to enter as a student or an organiser (**Reset demo data** restores the seed).

## What's built

**Student:** sign in / create account (Google + email), event discovery, event details, checkout with payment
states (review, gateway, verifying, success, failed), My Tickets, ticket screen with QR (QR holds only the random token).

**Organiser:** your events, create event (with poster upload and live preview), ticket configuration
(price, sales window, optional capacity), sales dashboard, searchable attendee list, CSV export, phone-camera QR scanner
with full-screen Valid / Already used / Wrong event / Invalid results.

Plan rules honoured in the UI: students never see seat counts (only "Tickets available" / "Sales closed"),
no approval step, one price per event, no notifications.

## Wiring it to the real backend

All business logic lives in one file: `lib/store.tsx`. Functions marked `SERVER` must become API calls, because the
plan requires payment, capacity and check-in to be decided on the server:

| Store function | Replace with |
| --- | --- |
| `signInWithEmail`, Google button in `app/login` | Supabase Auth (Google with `hd=ashoka.edu.in`, email fallback) |
| `startOrder` | `POST /api/orders`: check window and capacity, create the Razorpay order |
| `completePayment` | Not called from the browser. The verified webhook issues the ticket (idempotent); the checkout page polls the order until it is `paid` |
| `checkIn` | `POST /api/checkin`: one atomic `UPDATE ... WHERE status = 'active'` |
| `createEvent`, `attendees`, `getStats` | Supabase queries protected by row level security (plan 5.3) |
| Poster upload in `app/organiser/events/new` | Supabase Storage |

The payment panel in `app/checkout/[id]/page.tsx` is a placeholder for Razorpay Checkout.
Types in `lib/types.ts` match the data model in section 5.2.

## Notes

- The camera scanner needs HTTPS (or localhost). Vercel preview links are HTTPS, so it works on phones there.
- `MAX_TICKETS_PER_EVENT` in `lib/config.ts` covers open decision #7 (tickets per student per event).
- `RequireRole` is a UX guard only; real access control must be enforced in the database.
