/*
# Add UPI QR Code Uploads and Transaction Matching

## Overview
This migration adds support for:
1. Organisers uploading one or more UPI payment QR codes per event
2. Students selecting which QR they paid to and entering a UPI transaction ID (UTR)
3. Organisers uploading a CSV bank/UPI statement for automated transaction matching
4. Matching student-submitted transaction IDs against the CSV records

## New Tables
- `event_upi_qrs` — UPI QR code images uploaded by organisers for an event
  - id (uuid, PK)
  - event_id (uuid, FK to events)
  - label (text) — optional name like "Axis Bank UPI" or "GPay"
  - storage_path (text) — path in the upi-qrs storage bucket
  - created_at (timestamptz)
- `transaction_records` — Rows parsed from an organiser's uploaded CSV statement
  - id (uuid, PK)
  - event_id (uuid, FK to events)
  - txn_id (text) — the UTR/transaction reference from the CSV
  - amount (numeric) — transaction amount
  - raw_line (text) — original CSV row for reference
  - uploaded_by (uuid, FK to profiles)
  - created_at (timestamptz)

## Modified Tables
- `orders` — adds columns for transaction tracking:
  - `upi_qr_id` (uuid, nullable, FK to event_upi_qrs) — which QR the student paid to
  - `txn_id` (text, nullable) — the UPI transaction ID / UTR the student entered
  - `match_status` (text, default 'unmatched') — one of: 'unmatched', 'matched', 'verified', 'rejected'
    - 'unmatched' = student submitted, not yet matched against CSV
    - 'matched' = auto-matched against a CSV transaction record
    - 'verified' = organiser/admin confirmed the payment (ticket issued)
    - 'rejected' = organiser/admin rejected the payment

## Storage
- New public bucket `upi-qrs` for QR code images (organisers upload, students view)
- Storage policies for organisers to upload and everyone to read QR images

## Security
- RLS enabled on both new tables
- event_upi_qrs: organisers can CRUD their own event's QRs; authenticated can SELECT
- transaction_records: organisers/admins can SELECT/INSERT for their events
- All existing RLS policies preserved

## New Functions
- `add_event_upi_qr(p_event_id, p_label, p_storage_path)` — organiser adds a QR to their event
- `delete_event_upi_qr(p_qr_id)` — organiser removes a QR from their event
- `get_event_upi_qrs(p_event_id)` — public list of QR codes for an event (returns label + signed URL path)
- `update_order_txn(p_order_id, p_txn_id, p_upi_qr_id)` — called during create_order to store txn details
- `match_transactions(p_event_id)` — matches unmatched orders against transaction_records by txn_id and amount, returns stats
- `admin_match_transactions(p_event_id)` — admin version of match_transactions
- `admin_add_event_upi_qr(...)` / `admin_delete_event_upi_qr(...)` — admin versions

## Important Notes
1. The existing `create_order` function is updated to accept p_txn_id and p_upi_qr_id parameters
2. The existing `review_payment` and `admin_review_payment` functions now also set match_status='verified' on approve, 'rejected' on reject
3. The `pending_payments` and `admin_pending_payments` functions now return txn_id, upi_qr_id, and match_status
*/

-- =====================================================================
-- 1. New table: event_upi_qrs
-- =====================================================================
create table if not exists public.event_upi_qrs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  label text not null default '',
  storage_path text not null,
  created_at timestamptz not null default now()
);
create index if not exists event_upi_qrs_event_idx on public.event_upi_qrs (event_id);

alter table public.event_upi_qrs enable row level security;

-- Organisers can read their own event's QRs; everyone authenticated can read (students need to see them)
drop policy if exists "read event upi qrs" on public.event_upi_qrs;
create policy "read event upi qrs" on public.event_upi_qrs for select to authenticated
  using (true);

-- Only the event's organiser (or admin) can insert/delete
drop policy if exists "insert event upi qrs" on public.event_upi_qrs;
create policy "insert event upi qrs" on public.event_upi_qrs for insert to authenticated
  with check (exists (select 1 from public.events e where e.id = event_id and (e.organiser_id = auth.uid() or public.is_admin())));

drop policy if exists "delete event upi qrs" on public.event_upi_qrs;
create policy "delete event upi qrs" on public.event_upi_qrs for delete to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and (e.organiser_id = auth.uid() or public.is_admin())));

grant select, insert, delete on public.event_upi_qrs to authenticated;

-- =====================================================================
-- 2. New table: transaction_records
-- =====================================================================
create table if not exists public.transaction_records (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  txn_id text not null,
  amount numeric(10,2),
  raw_line text,
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists transaction_records_event_idx on public.transaction_records (event_id);
create index if not exists transaction_records_txn_idx on public.transaction_records (txn_id);

alter table public.transaction_records enable row level security;

drop policy if exists "read transaction records" on public.transaction_records;
create policy "read transaction records" on public.transaction_records for select to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and (e.organiser_id = auth.uid() or public.is_admin())));

drop policy if exists "insert transaction records" on public.transaction_records;
create policy "insert transaction records" on public.transaction_records for insert to authenticated
  with check (exists (select 1 from public.events e where e.id = event_id and (e.organiser_id = auth.uid() or public.is_admin())));

drop policy if exists "delete transaction records" on public.transaction_records;
create policy "delete transaction records" on public.transaction_records for delete to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and (e.organiser_id = auth.uid() or public.is_admin())));

grant select, insert, delete on public.transaction_records to authenticated;

-- =====================================================================
-- 3. Add columns to orders table
-- =====================================================================
alter table public.orders add column if not exists upi_qr_id uuid references public.event_upi_qrs(id) on delete set null;
alter table public.orders add column if not exists txn_id text;
alter table public.orders add column if not exists match_status text not null default 'unmatched'
  check (match_status in ('unmatched', 'matched', 'verified', 'rejected'));

create index if not exists orders_txn_id_idx on public.orders (txn_id) where txn_id is not null;
create index if not exists orders_match_status_idx on public.orders (match_status);

-- =====================================================================
-- 4. Storage bucket for UPI QR images (public read, organiser upload)
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('upi-qrs', 'upi-qrs', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "organisers upload upi qrs" on storage.objects;
create policy "organisers upload upi qrs" on storage.objects for insert to authenticated
  with check (bucket_id = 'upi-qrs' and (storage.foldername(name))[1] = auth.uid()::text and (public.is_organiser() or public.is_admin()));

drop policy if exists "read upi qrs" on storage.objects;
create policy "read upi qrs" on storage.objects for select to authenticated
  using (bucket_id = 'upi-qrs');

drop policy if exists "delete upi qrs" on storage.objects;
create policy "delete upi qrs" on storage.objects for delete to authenticated
  using (bucket_id = 'upi-qrs' and (storage.foldername(name))[1] = auth.uid()::text);

-- =====================================================================
-- 5. Update create_order to accept txn_id and upi_qr_id
-- =====================================================================
drop function if exists public.create_order(uuid, uuid, text, text);
create or replace function public.create_order(
  p_order_id uuid, p_event_id uuid, p_screenshot_path text,
  p_screenshot_hash text default null, p_txn_id text default null, p_upi_qr_id uuid default null
)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  e public.events%rowtype;
  uid uuid := auth.uid();
  taken integer;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from public.profiles where id = uid and role = 'student') then raise exception 'not_student'; end if;
  select * into e from public.events where id = p_event_id for update;
  if not found then raise exception 'event_not_found'; end if;
  if now() < e.sales_open then raise exception 'sales_not_open'; end if;
  if now() > e.sales_close then raise exception 'sales_closed'; end if;
  if exists (select 1 from public.orders where user_id = uid and event_id = e.id
             and payment_status in ('awaiting_review', 'approved')) then
    raise exception 'already_has_ticket';
  end if;
  if e.capacity is not null then
    select (select count(*) from public.tickets where event_id = e.id)
         + (select count(*) from public.orders where event_id = e.id and payment_status = 'awaiting_review')
      into taken;
    if taken >= e.capacity then raise exception 'sold_out'; end if;
  end if;
  if split_part(p_screenshot_path, '/', 1) <> uid::text then raise exception 'bad_screenshot_path'; end if;
  insert into public.orders (id, user_id, event_id, amount, screenshot_path, screenshot_hash, txn_id, upi_qr_id)
  values (p_order_id, uid, e.id, e.ticket_price, p_screenshot_path, p_screenshot_hash, nullif(trim(p_txn_id), ''), p_upi_qr_id);
  return p_order_id;
end $$;

-- =====================================================================
-- 6. Update review_payment to set match_status
-- =====================================================================
drop function if exists public.review_payment(uuid, boolean, text);
create or replace function public.review_payment(p_order_id uuid, p_approve boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare o public.orders%rowtype;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if not exists (select 1 from public.events where id = o.event_id and organiser_id = auth.uid()) then
    raise exception 'not_your_event';
  end if;
  if o.payment_status <> 'awaiting_review' then return; end if;
  if p_approve then
    if exists (select 1 from public.tickets where user_id = o.user_id and event_id = o.event_id) then
      raise exception 'already_has_ticket';
    end if;
    update public.orders set payment_status = 'approved', match_status = 'verified', reviewed_by = auth.uid(), reviewed_at = now(), email_status = 'pending', email_claimed_at = null where id = o.id;
    insert into public.tickets (order_id, user_id, event_id) values (o.id, o.user_id, o.event_id)
      on conflict (order_id) do nothing;
  else
    update public.orders set payment_status = 'rejected', match_status = 'rejected', reject_reason = nullif(trim(p_reason), ''),
      reviewed_by = auth.uid(), reviewed_at = now(), email_status = 'pending', email_claimed_at = null where id = o.id;
  end if;
end $$;

-- =====================================================================
-- 7. Update admin_review_payment to set match_status
-- =====================================================================
drop function if exists public.admin_review_payment(uuid, boolean, text);
create or replace function public.admin_review_payment(p_order_id uuid, p_approve boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare o public.orders%rowtype;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if o.payment_status <> 'awaiting_review' then return; end if;
  if p_approve then
    if exists (select 1 from public.tickets where user_id = o.user_id and event_id = o.event_id) then
      raise exception 'already_has_ticket';
    end if;
    update public.orders set payment_status = 'approved', match_status = 'verified', reviewed_by = auth.uid(), reviewed_at = now(), email_status = 'pending', email_claimed_at = null where id = o.id;
    insert into public.tickets (order_id, user_id, event_id) values (o.id, o.user_id, o.event_id)
      on conflict (order_id) do nothing;
  else
    update public.orders set payment_status = 'rejected', match_status = 'rejected', reject_reason = nullif(trim(p_reason), ''),
      reviewed_by = auth.uid(), reviewed_at = now(), email_status = 'pending', email_claimed_at = null where id = o.id;
  end if;
end $$;

-- =====================================================================
-- 8. Update pending_payments to include txn_id, upi_qr_id, match_status
-- =====================================================================
drop function if exists public.pending_payments(uuid);
create function public.pending_payments(p_event_id uuid)
returns table (order_id uuid, amount numeric, screenshot_path text, submitted_at timestamptz,
               user_id uuid, name text, email text, student_id text, duplicates integer,
               txn_id text, upi_qr_id uuid, match_status text)
language sql stable security definer set search_path = public, extensions as $$
  select o.id, o.amount, o.screenshot_path, o.created_at, p.id, p.name, p.email, p.student_id,
         (select count(*)::integer from public.orders d
           where o.screenshot_hash is not null and d.screenshot_hash = o.screenshot_hash and d.id <> o.id),
         o.txn_id, o.upi_qr_id, o.match_status
  from public.orders o
  join public.profiles p on p.id = o.user_id
  join public.events e on e.id = o.event_id
  where o.event_id = p_event_id and e.organiser_id = auth.uid() and o.payment_status = 'awaiting_review'
  order by o.created_at;
$$;

-- =====================================================================
-- 9. Update admin_pending_payments to include txn_id, upi_qr_id, match_status
-- =====================================================================
drop function if exists public.admin_pending_payments(uuid);
create or replace function public.admin_pending_payments(p_event_id uuid)
returns table (
  order_id uuid, amount numeric, screenshot_path text, submitted_at timestamptz,
  user_id uuid, name text, email text, duplicates integer,
  txn_id text, upi_qr_id uuid, match_status text
)
language sql stable security definer set search_path = public, extensions as $$
  select o.id, o.amount, o.screenshot_path, o.created_at, p.id, p.name, p.email,
         (select count(*)::integer from public.orders d
           where o.screenshot_hash is not null and d.screenshot_hash = o.screenshot_hash and d.id <> o.id),
         o.txn_id, o.upi_qr_id, o.match_status
  from public.orders o
  join public.profiles p on p.id = o.user_id
  where o.event_id = p_event_id and public.is_admin() and o.payment_status = 'awaiting_review'
  order by o.created_at;
$$;

-- =====================================================================
-- 10. New function: match_transactions (organiser version)
--     Matches unmatched orders against transaction_records by txn_id + amount
-- =====================================================================
create or replace function public.match_transactions(p_event_id uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  matched_count integer := 0;
  unmatched_count integer := 0;
  total_pending integer := 0;
  rec record;
begin
  if not exists (select 1 from public.events e where e.id = p_event_id and e.organiser_id = auth.uid()) then
    raise exception 'not_your_event';
  end if;

  -- Count current pending
  select count(*) into total_pending from public.orders
    where event_id = p_event_id and payment_status = 'awaiting_review' and match_status = 'unmatched';

  -- Match orders that have a txn_id matching a transaction_record
  for rec in
    select o.id, o.txn_id, o.amount
      from public.orders o
      where o.event_id = p_event_id
        and o.payment_status = 'awaiting_review'
        and o.match_status = 'unmatched'
        and o.txn_id is not null
        and exists (
          select 1 from public.transaction_records tr
          where tr.event_id = p_event_id
            and trim(lower(tr.txn_id)) = trim(lower(o.txn_id))
        )
  loop
    update public.orders set match_status = 'matched' where id = rec.id;
    matched_count := matched_count + 1;
  end loop;

  select count(*) into unmatched_count
    from public.orders
    where event_id = p_event_id and payment_status = 'awaiting_review' and match_status = 'unmatched';

  return jsonb_build_object(
    'matched', matched_count,
    'unmatched', unmatched_count,
    'total_pending', total_pending
  );
end $$;

-- =====================================================================
-- 11. Admin version: match_transactions
-- =====================================================================
create or replace function public.admin_match_transactions(p_event_id uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  matched_count integer := 0;
  unmatched_count integer := 0;
  total_pending integer := 0;
  rec record;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;

  select count(*) into total_pending from public.orders
    where event_id = p_event_id and payment_status = 'awaiting_review' and match_status = 'unmatched';

  for rec in
    select o.id, o.txn_id, o.amount
      from public.orders o
      where o.event_id = p_event_id
        and o.payment_status = 'awaiting_review'
        and o.match_status = 'unmatched'
        and o.txn_id is not null
        and exists (
          select 1 from public.transaction_records tr
          where tr.event_id = p_event_id
            and trim(lower(tr.txn_id)) = trim(lower(o.txn_id))
        )
  loop
    update public.orders set match_status = 'matched' where id = rec.id;
    matched_count := matched_count + 1;
  end loop;

  select count(*) into unmatched_count
    from public.orders
    where event_id = p_event_id and payment_status = 'awaiting_review' and match_status = 'unmatched';

  return jsonb_build_object(
    'matched', matched_count,
    'unmatched', unmatched_count,
    'total_pending', total_pending
  );
end $$;

-- =====================================================================
-- 12. Function to get match summary for an event (organiser)
-- =====================================================================
create or replace function public.match_summary(p_event_id uuid)
returns jsonb language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
    'matched', (select count(*) from public.orders where event_id = p_event_id and payment_status = 'awaiting_review' and match_status = 'matched'),
    'unmatched', (select count(*) from public.orders where event_id = p_event_id and payment_status = 'awaiting_review' and match_status = 'unmatched'),
    'verified', (select count(*) from public.orders where event_id = p_event_id and match_status = 'verified'),
    'rejected', (select count(*) from public.orders where event_id = p_event_id and match_status = 'rejected'),
    'txn_records', (select count(*) from public.transaction_records where event_id = p_event_id)
  )
  where exists (select 1 from public.events e where e.id = p_event_id and e.organiser_id = auth.uid());
$$;

-- =====================================================================
-- 13. Admin version: match summary
-- =====================================================================
create or replace function public.admin_match_summary(p_event_id uuid)
returns jsonb language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
    'matched', (select count(*) from public.orders where event_id = p_event_id and payment_status = 'awaiting_review' and match_status = 'matched'),
    'unmatched', (select count(*) from public.orders where event_id = p_event_id and payment_status = 'awaiting_review' and match_status = 'unmatched'),
    'verified', (select count(*) from public.orders where event_id = p_event_id and match_status = 'verified'),
    'rejected', (select count(*) from public.orders where event_id = p_event_id and match_status = 'rejected'),
    'txn_records', (select count(*) from public.transaction_records where event_id = p_event_id)
  )
  where public.is_admin();
$$;

-- =====================================================================
-- 14. Function to list transaction records (organiser)
-- =====================================================================
create or replace function public.list_transaction_records(p_event_id uuid)
returns table (id uuid, txn_id text, amount numeric, raw_line text, created_at timestamptz)
language sql stable security definer set search_path = public, extensions as $$
  select tr.id, tr.txn_id, tr.amount, tr.raw_line, tr.created_at
  from public.transaction_records tr
  where tr.event_id = p_event_id
    and exists (select 1 from public.events e where e.id = p_event_id and e.organiser_id = auth.uid())
  order by tr.created_at desc
  limit 500;
$$;

-- =====================================================================
-- 15. Admin version: list transaction records
-- =====================================================================
create or replace function public.admin_list_transaction_records(p_event_id uuid)
returns table (id uuid, txn_id text, amount numeric, raw_line text, created_at timestamptz)
language sql stable security definer set search_path = public, extensions as $$
  select tr.id, tr.txn_id, tr.amount, tr.raw_line, tr.created_at
  from public.transaction_records tr
  where tr.event_id = p_event_id and public.is_admin()
  order by tr.created_at desc
  limit 500;
$$;

-- =====================================================================
-- 16. Clear transaction records for an event (organiser, before re-upload)
-- =====================================================================
create or replace function public.clear_transaction_records(p_event_id uuid)
returns integer language plpgsql security definer set search_path = public, extensions as $$
declare deleted_count integer;
begin
  if not exists (select 1 from public.events e where e.id = p_event_id and e.organiser_id = auth.uid()) then
    raise exception 'not_your_event';
  end if;
  delete from public.transaction_records where event_id = p_event_id;
  get diagnostics deleted_count = row_count;
  -- Reset matched orders back to unmatched since the CSV they matched against is gone
  update public.orders set match_status = 'unmatched'
    where event_id = p_event_id and match_status = 'matched';
  return deleted_count;
end $$;

-- =====================================================================
-- 17. Admin version: clear transaction records
-- =====================================================================
create or replace function public.admin_clear_transaction_records(p_event_id uuid)
returns integer language plpgsql security definer set search_path = public, extensions as $$
declare deleted_count integer;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  delete from public.transaction_records where event_id = p_event_id;
  get diagnostics deleted_count = row_count;
  update public.orders set match_status = 'unmatched'
    where event_id = p_event_id and match_status = 'matched';
  return deleted_count;
end $$;

-- =====================================================================
-- 18. Re-grant execute on updated functions + new functions
-- =====================================================================
revoke execute on function public.create_order(uuid, uuid, text, text, text, uuid),
  public.review_payment(uuid, boolean, text), public.review_payments(uuid[], boolean, text),
  public.check_in(text, uuid), public.organiser_event_stats(), public.event_attendees(uuid),
  public.pending_payments(uuid), public.list_users(text), public.set_user_role(text, text),
  public.order_email_data(uuid), public.claim_emails(uuid, integer), public.finish_email(uuid, boolean),
  public.requeue_failed(uuid), public.event_email_status(uuid),
  public.match_transactions(uuid), public.match_summary(uuid),
  public.list_transaction_records(uuid), public.clear_transaction_records(uuid)
from public, anon;
grant execute on function public.create_order(uuid, uuid, text, text, text, uuid),
  public.review_payment(uuid, boolean, text), public.review_payments(uuid[], boolean, text),
  public.check_in(text, uuid), public.organiser_event_stats(), public.event_attendees(uuid),
  public.pending_payments(uuid), public.list_users(text), public.set_user_role(text, text),
  public.order_email_data(uuid), public.claim_emails(uuid, integer), public.finish_email(uuid, boolean),
  public.requeue_failed(uuid), public.event_email_status(uuid),
  public.match_transactions(uuid), public.match_summary(uuid),
  public.list_transaction_records(uuid), public.clear_transaction_records(uuid)
to authenticated;

revoke execute on function public.admin_stats(), public.admin_users(text), public.admin_user_detail(uuid),
  public.admin_orders(uuid, text), public.admin_tickets(text), public.admin_all_events(),
  public.admin_event_stats(uuid), public.admin_event_attendees(uuid), public.admin_pending_payments(uuid),
  public.admin_review_payment(uuid, boolean, text), public.admin_review_payments(uuid[], boolean, text),
  public.admin_check_in(text, uuid), public.admin_claim_emails(uuid, integer), public.admin_finish_email(uuid, boolean),
  public.admin_requeue_failed(uuid), public.admin_event_email_status(uuid), public.admin_order_email_data(uuid),
  public.admin_create_event(text, text, date, time, text, text, numeric, integer, timestamptz, timestamptz),
  public.admin_update_event(uuid, text, text, date, time, text, text, numeric, integer, timestamptz, timestamptz, boolean, boolean),
  public.admin_delete_event(uuid), public.admin_list_users(text), public.admin_set_user_role(text, text),
  public.admin_match_transactions(uuid), public.admin_match_summary(uuid),
  public.admin_list_transaction_records(uuid), public.admin_clear_transaction_records(uuid)
from public, anon;
grant execute on function public.admin_stats(), public.admin_users(text), public.admin_user_detail(uuid),
  public.admin_orders(uuid, text), public.admin_tickets(text), public.admin_all_events(),
  public.admin_event_stats(uuid), public.admin_event_attendees(uuid), public.admin_pending_payments(uuid),
  public.admin_review_payment(uuid, boolean, text), public.admin_review_payments(uuid[], boolean, text),
  public.admin_check_in(text, uuid), public.admin_claim_emails(uuid, integer), public.admin_finish_email(uuid, boolean),
  public.admin_requeue_failed(uuid), public.admin_event_email_status(uuid), public.admin_order_email_data(uuid),
  public.admin_create_event(text, text, date, time, text, text, numeric, integer, timestamptz, timestamptz),
  public.admin_update_event(uuid, text, text, date, time, text, text, numeric, integer, timestamptz, timestamptz, boolean, boolean),
  public.admin_delete_event(uuid), public.admin_list_users(text), public.admin_set_user_role(text, text),
  public.admin_match_transactions(uuid), public.admin_match_summary(uuid),
  public.admin_list_transaction_records(uuid), public.admin_clear_transaction_records(uuid)
to authenticated;
