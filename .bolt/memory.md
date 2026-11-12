# Project memory

## Product intent & audience

- Event ticketing/payment platform for college or campus events
- Three user roles: **students** (checkout/pay), **organisers** (manage events, upload payment QRs), **admins** (oversight, export transactions)
- UPI-based payment flow: students pay via QR scan or direct UPI ID transfer

## Brand personality & voice

- Practical, student-facing utility; clear and instruction-oriented at checkout
- No strong marketing tone detected; UI copy is functional

## Visual design & UX direction

- Checkout page: payment-option cards, each showing a QR image **and** its associated UPI ID side-by-side
- Multiple QR/UPI options can be listed per event (different payees)
- Login page: "Continue with Google" button alongside other auth options
- Admin/organiser dashboards include form fields for UPI ID entry paired with QR image upload

## Decisions, constraints & rationale

- **Next.js** with **TypeScript** (strict enough to block builds on type errors)
- **Supabase** for Auth + database
  - Google OAuth provider must be enabled in Supabase dashboard (one-time manual setup); app code is ready
  - DB trigger on signup: falls back to email prefix as display name when Google metadata lacks one
- UPI ID is an optional-but-recommended field alongside each uploaded QR image
- API routes exist for admin and organiser transaction CSV export
- Build must pass cleanly (type errors in API routes previously blocked compilation — now fixed)

## Open questions & assumptions

- Supabase project URL and keys are configured via env vars (assumed)
- Google OAuth client ID/secret assumed configured or to be set in Supabase dashboard
- Payment verification flow (manual confirm vs automated) not yet detailed
- QR image storage assumed via Supabase Storage; exact bucket setup unconfirmed
- Event creation/editing UI scope beyond QR upload not fully specified