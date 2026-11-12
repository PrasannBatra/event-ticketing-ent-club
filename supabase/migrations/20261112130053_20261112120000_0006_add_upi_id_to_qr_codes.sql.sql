/*
# Add UPI ID to QR codes

## Overview
Organisers can now attach a UPI ID (e.g. "club@upi") to each QR code they upload, alongside the QR image and label.
Students at checkout will see both the QR image and the UPI ID so they can pay via either method.

## Modified Tables
- `event_upi_qrs` — adds `upi_id` (text, nullable) so each QR code can carry the UPI ID people can pay on.

## Security
- No RLS policy changes. Existing policies on event_upi_qrs already control insert/delete by organiser/admin.
- The new column is writable by anyone who can already INSERT into event_upi_qrs (organiser/admin via existing policy).
- GRANT UPDATE on event_upi_qrs to authenticated so organisers/admins can update the upi_id of existing rows if needed.
*/

alter table public.event_upi_qrs add column if not exists upi_id text;

-- Allow organisers/admins to update QR rows (e.g. to set/change the UPI ID).
-- The existing insert/delete policies already restrict to organiser/admin via event ownership checks.
drop policy if exists "update event upi qrs" on public.event_upi_qrs;
create policy "update event upi qrs" on public.event_upi_qrs for update to authenticated
  using (exists (select 1 from public.events e where e.id = event_upi_qrs.event_id and (e.organiser_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.events e where e.id = event_upi_qrs.event_id and (e.organiser_id = auth.uid() or public.is_admin())));

grant update on public.event_upi_qrs to authenticated;
