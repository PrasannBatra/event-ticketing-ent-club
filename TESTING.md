# Test checklist (plan section 7)

Use these Ashoka accounts: **Organiser 1** (README step 4), **Student A**, **Student B**, **Organiser 2** (added from the Team page), and a third organiser for the access tests.
Create one event (capacity 2) as the Organiser first.

## Accounts
- [ ] Create an account with your Ashoka email (name, student ID, password). You're told to check your email; the link confirms it; you can then sign in.
- [ ] Create an account with a gmail address: refused. Also try `x@ashoka.edu.in.evil.com`: refused.
- [ ] Wrong password: "Wrong email or password." Unconfirmed email: told to confirm first.
- [ ] "Forgot your password?": the email arrives, the link opens "Choose a new password", the new password works, the old one doesn't.
- [ ] Reuse the same reset link a second time (or after a long wait): "This link has expired".
- [ ] Account page shows your name, email, student ID and role, and changes the password.
- [ ] Signed-out visitors are sent to sign in when they open My tickets, Buy ticket or /organiser.

## Roles
- [ ] Organiser 1 opens **Team**, searches a student, taps **Make organiser**. That person now lands on the organiser dashboard after signing in.
- [ ] Organiser 1 cannot change their own role.
- [ ] Organiser 1 creates an event. It appears on the student home page once sales open.
- [ ] A student opening `/team` or `/organiser` is told the page isn't for them.
- [ ] A student cannot call the organiser APIs (their token gets 403).

## Payments
- [ ] Student A: Buy ticket, upload a screenshot. Event page now says "Payment under review". My tickets shows "Under review". No QR yet.
- [ ] Student A tries Buy ticket again: blocked (already has a payment waiting).
- [ ] After approval, Student A tries to buy the same event again: blocked ("already have a ticket"). Still exactly one ticket.
- [ ] Upload a non-image renamed `.jpg` (e.g. a .txt): rejected with "must be a JPG, PNG or WebP".
- [ ] After Student A submits, the page says "we'll email your QR ticket to <their email>".
- [ ] Organiser: Payments to review shows A's screenshot with the right name and amount. Open the image.
- [ ] Reject with a reason: Student A sees "Payment not accepted" with that reason and can upload again.
- [ ] Student A uploads again, Organiser approves: the organiser sees "ticket was emailed to ...", the email arrives (check spam) with the QR, and the ticket is also in A's My tickets.
- [ ] Reject emails the reason to the student.
- [ ] "Resend ticket email" in the attendee list sends it again.
- [ ] Scan the QR in the email: it checks in. It does not work a second time.
- [ ] Click Approve twice quickly (or approve in two tabs): still exactly ONE ticket.

## Bulk review (create 6+ students with payments)
- [ ] Tick two students, press **Approve all except selected**: the confirmation names the count, and only the un-ticked students are approved and emailed. The two ticked ones are still waiting.
- [ ] **Approve selected**, **Approve all** and **Reject selected** (with a reason) each work. Rejected students get the reason by email.
- [ ] Upload the exact same screenshot file for two different students: both show "Same screenshot as 1 other payment", and **Approve all** skips them.
- [ ] A progress bar shows "Emailing tickets… 3 of 12". Close the tab halfway, reopen: "N emails waiting" with **Send now** finishes the rest, with no duplicates.
- [ ] Turn the Gmail password wrong on purpose: approved tickets stay queued, the organiser is told, and **Retry failed** works once it's fixed.
- [ ] Two organisers approving the same payments at the same moment: each student still gets exactly one ticket and one email.

## Tickets
- [ ] The ticket shows name, event, date, time, venue, ticket ID and QR.
- [ ] Scan the QR with any QR reader: it shows only a random code, no name or email.

## Scanner
- [ ] Organiser scans A's QR: green "Checked in" with A's name.
- [ ] Scan it again: amber "Already used" with the time of the first scan.
- [ ] Scan any other QR code (e.g. a website): red "Invalid ticket".
- [ ] Create a second event, scan A's ticket under it: red "Wrong event".
- [ ] Open the scanner on two phones and scan the same fresh ticket at the same moment: only one says "Checked in".
- [ ] Try on Android Chrome and iPhone Safari, in a dim room.

## Capacity (capacity 2)
- [ ] Two approved or waiting payments fill the event. Student C sees "Sales closed" and cannot upload. They never see a number.
- [ ] Organiser rejects one: Student C can now buy.
- [ ] Two students submit for the last seat at the same moment: only one gets in.

## Access control
- [ ] Student opens `/organiser`: told it's for organisers.
- [ ] Student cannot see another student's ticket (open another ticket's URL: "Ticket not found").
- [ ] Second organiser cannot open the first organiser's event page, attendees, screenshots, or scan its tickets.
- [ ] Sign up with a non-Ashoka email (e.g. gmail): rejected.
- [ ] Students cannot make themselves organisers (there is no way in the app).

## Dashboard and CSV
- [ ] Sold, revenue, checked-in and remaining capacity match what you did.
- [ ] Search finds attendees by name, email and ticket ID.
- [ ] Export CSV opens in Excel / Google Sheets with all 9 columns.

## Devices
- [ ] Android + Chrome, iPhone + Safari, on a slow network (throttle in browser tools).
