# Ashoka Events: campus event ticketing (frontend + backend in one project)

Next.js + React + Tailwind (frontend), Next.js API routes (backend), Supabase (database, file storage, login), Vercel (hosting), GitHub.
No payment gateway: students pay by UPI and **upload a screenshot**. The QR ticket is **emailed** once an organiser approves it.

## How it works

1. A student signs up with an **@ashoka.edu.in** email (name, email, student ID saved).
2. They open an event and tap **Buy ticket**. The next screen shows the UPI ID and amount, and asks them to **upload their payment screenshot**.
3. The event's organiser sees every screenshot under **Payments to review**. They can approve or reject one at a time, or tick people and use **Approve selected**, **Approve all**, **Approve all except selected**, or **Reject selected** (with a reason).
   Screenshots that were already uploaded for another payment are flagged as likely fakes, and **Approve all** skips them.
4. **Approve:** the backend creates each ticket (random QR code) and the **app emails it to the student** (in small batches, with a progress bar). It is also in the student's **My tickets**.
   **Reject:** the student is emailed the reason and can upload again.
   Emails that fail or haven't gone yet stay queued: the organiser presses **Send now** or **Retry failed**.
5. At the gate the organiser scans the QR. The database marks it used in one step, so a copied QR works once.

A student can never hold two tickets for one event. Capacity counts approved tickets plus screenshots waiting, so an event can't be oversold. Students never see seat counts.

## Login and accounts (Ashoka email only)
- **Create account:** name, Ashoka email, student ID, password. A confirmation link is emailed; the account works after the student clicks it ("send it again" is on the screen if it doesn't arrive).
- **Sign in / sign out**, **Forgot password** (emails a reset link to `/reset-password`), and an **Account** page (tap the circle at the top right) to see details and change the password.
- **Only `@ashoka.edu.in` works.** It is checked on the screen AND in the database, so it can't be bypassed: other domains are refused at sign-up, and nobody can switch their account to a non-Ashoka email later.
- Everyone starts as a student. Nobody can make themselves an organiser.

## Roles
- **Student:** everyone who signs up.
- **Organiser:** the one staff role (organiser and admin are the same thing). Creates events, reviews payments, scans tickets, exports attendees, and adds other organisers from the **Team** page.

## SET IT UP

### 1. GitHub
Upload everything inside the unzipped `ashoka-events` folder to your GitHub repo. Vercel redeploys by itself.

### 2. Database (Supabase)
1. Add Supabase from your Vercel project (**Storage / Integrations > Supabase**), or create a project at supabase.com.
   The Vercel way fills in the two connection keys for you.
2. In Supabase: **SQL Editor > New query**, paste ALL of `supabase/schema.sql`, click **Run**.
   It is safe to run again if you ever ran an older version.
3. **Authentication > Providers > Email**: turn **Confirm email** OFF while testing, ON before launch.
   **Authentication > URL Configuration**: set **Site URL** to your Vercel link, and under **Redirect URLs** add `https://YOUR-SITE.vercel.app/**` (needed so the confirm-email and reset-password links work).

### 3. Settings in Vercel
Vercel project > **Settings > Environment Variables**. Add (skip the first two if the integration already added them):

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase > Project Settings > API > Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the `anon public` key on the same page |
| `NEXT_PUBLIC_UPI_ID` | your club's UPI ID (shown at checkout) |
| `NEXT_PUBLIC_PAYEE_NAME` | e.g. Entrepreneurship Club |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | the Gmail address that will send tickets |
| `SMTP_PASS` | that Gmail account's **App password** (below) |
| `EMAIL_FROM` | `Ashoka Events <the same gmail address>` |

**Gmail App password (2 minutes):** sign in to the Gmail account > Google Account > **Security** > turn on **2-Step Verification** >
search **App passwords** > create one (name it "Ashoka Events") > copy the 16 letters (no spaces) into `SMTP_PASS`.
A normal Gmail account can send only a few hundred emails a day, which is fine for a campus event. Ticket emails may land in spam the first time; the ticket is always also in **My tickets**, and an organiser can press **Resend ticket email** in the attendee list.
Without the SMTP settings everything still works, but tickets are not emailed (students open them in My tickets).

Then **Deployments > latest > ... > Redeploy**, and open `https://YOUR-SITE.vercel.app/api/health`. You want `"ok": true`.

### 4. First organiser
Sign up on the site with the first organiser's Ashoka email, then in the Supabase SQL Editor run once:

```sql
update public.profiles set role = 'organiser' where email = 'organiser_name@ashoka.edu.in';
```
They sign in, open **Team** in the menu, and tap **Make organiser** next to anyone who has signed up. No more SQL needed.

### 5. Test it
Follow `TESTING.md` (about 20 minutes).

## Demo mode
If the two Supabase variables are missing, the site runs on sample data in the browser with a "Demo mode" banner. Nothing is real there, no emails are sent.

## The backend API (`app/api/*`)

| Duty | Endpoint | What it does |
|---|---|---|
| Event creation | `POST /api/events` | Organiser. Validates fields, stores the poster, creates the event (live immediately). |
| Event listing | `GET /api/events`, `GET /api/events/:id` | Public. Never includes capacity, only `sold_out`. |
| Order creation + capacity | `POST /api/orders` | Student. Checks the screenshot is a real image, then `create_order` checks the sales window, capacity and one-ticket limit under a lock. |
| Ticket issuance (one or many) | `POST /api/organiser/payments/review` | Organiser. `{ orderIds, approve, reason? }`. Each payment is decided on its own; one already decided is skipped. Approving creates the ticket and queues its email. Repeating never makes a second ticket. |
| Send the emails | `POST /api/organiser/events/:id/send-emails` | Organiser of that event. Sends the next few queued emails from the app (call again until `remaining` is 0). `{ retryFailed: true }` re-queues failures. |
| Resend one ticket email | `POST /api/organiser/payments/:orderId/resend` | Organiser of that event. |
| My Tickets | `GET /api/tickets`, `GET /api/orders` | A student sees only their own. |
| Ticket validation + check-in | `POST /api/checkin` | Organiser. `valid`, `used` (with first scan time), `wrong_event`, `invalid`; one atomic database update. |
| Dashboard + attendees | `GET /api/organiser/events`, `GET /api/organiser/events/:id` | Figures, attendees (never ticket codes), payments to review. |
| CSV export | `GET /api/organiser/events/:id/export` | Generated on the server. |
| Add / remove organisers | `GET /api/organiser/team`, `POST /api/organiser/team/role` | Organiser only. You can't change your own role. |
| Setup check | `GET /api/health` | Is the backend connected? |

Errors are always `{ "error": { "code": "...", "message": "..." } }`. Every call runs as the signed-in user, so the database access rules apply to it. No secret server key is needed.

## Files to know
| File | What it is |
|---|---|
| `app/api/**/route.ts` | Backend |
| `lib/server/email.ts` | Builds and sends the ticket email (with QR image) |
| `components/PaymentsPanel.tsx` | The review screen: tick people, approve / reject in bulk |
| `supabase/schema.sql` | Database, access rules, approval/check-in functions, storage |
| `lib/store-supabase.tsx` | Screens talk to the backend through this |
| `lib/store-demo.tsx`, `lib/seed.ts` | Demo mode (can be deleted later) |
| `lib/config.ts` | UPI details, tickets per student |
| `npm test` | Unit tests for input checks and the email |

## Limits to know
- Vercel's free plan rejects uploads over 4.5 MB. Screenshots are shrunk in the browser first.
- A failed upload can leave an unused image in storage. It's harmless.
- To allow several tickets per student per event: drop the indexes `one_live_order_per_student` and `one_ticket_per_student_per_event` in `schema.sql`, and raise `MAX_TICKETS_PER_EVENT` in `lib/config.ts`.
