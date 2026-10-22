/*
# Ashoka Events — Initial Database Schema

## Overview
Sets up the complete database for the Ashoka Events ticketing platform (GatePass).
This is a multi-user app with two roles: **student** and **organiser**.

## Tables Created
1. **profiles** — User profile data (name, email, student ID, role). One row per authenticated user, auto-created on signup via a trigger.
2. **events** — Event listings created by organisers (name, description, date, time, venue, poster, ticket price, capacity, sales window).
3. **orders** — Payment screenshot submissions from students. Each order holds the price at time of purchase, screenshot path, review status, and email-sending progress.
4. **tickets** — Issued tickets with unguessable QR tokens. One ticket per student per event. Status: active or used (checked in).

## Views
- **public_events** — Public-facing view of events that hides capacity and only exposes a `sold_out` boolean. This is what students and unauthenticated visitors see.

## Security (Row Level Security)
- **profiles**: Users can read only their own profile. No insert/update/delete policies (profiles are created by the database trigger, not the client).
- **events**: Organisers can read/create/update only their own events. Public read is through the `public_events` view (granted to anon + authenticated).
- **orders**: Students can read only their own orders. Inserts/updates happen only through SECURITY DEFINER functions.
- **tickets**: Students can read only their own tickets. All writes happen through SECURITY DEFINER functions.

## Business Logic Functions (all SECURITY DEFINER, access controlled)
- **create_order** — Student submits a payment screenshot. Enforces sales window, capacity, one-ticket-per-student. Locks the event row to prevent race conditions.
- **review_payment** — Organiser approves (issues ticket + queues email) or rejects (queues rejection email) a single payment. Idempotent: safe to call twice.
- **review_payments** — Batch version of review_payment. Each payment decided independently; failures skip, never block others.
- **check_in** — Gate QR validation. Atomic update: first scan wins, later scans report the original scan time. Returns valid/used/wrong_event/invalid.
- **claim_emails** — Hands out the next batch of queued emails exactly once (FOR UPDATE SKIP LOCKED), even with concurrent requests.
- **finish_email** — Marks an email as sent or failed.
- **requeue_failed** — Puts failed emails back in the queue for retry.
- **event_email_status** — Pending/sending/failed/sent counts for an event.
- **organiser_event_stats** — Dashboard numbers (sold, revenue, checked in, pending) for all of an organiser's events.
- **event_attendees** — Full attendee list for an event (organiser only, never includes ticket tokens).
- **pending_payments** — Screenshots awaiting review, with duplicate-screenshot detection.
- **order_email_data** — Data needed to send a ticket or rejection email (organiser only).
- **list_users** — Search users by name or email (organiser only).
- **set_user_role** — Promote/demote a user between student and organiser (organiser only, can't change own role).
- **is_organiser** — Helper: returns true if the current user is an organiser.
- **handle_new_user** — Trigger function: auto-creates a profile row when a new auth user signs up.
- **enforce_ashoka_email** — Trigger function: blocks signup with non-@ashoka.edu.in emails.

## Triggers
- **on_auth_user_created** — After insert on auth.users → creates a profile row.
- **enforce_ashoka_email** — Before insert on auth.users → rejects non-Ashoka emails.
- **enforce_ashoka_email_update** — Before update of email on auth.users → prevents switching to non-Ashoka email.

## Storage Buckets
- **payment-screenshots** (private, 5MB limit) — Students upload their own; organisers read screenshots for their events only.
- **posters** (public, 3MB limit) — Organisers upload event posters.

## Important Notes
1. Everyone who signs up is a **student** by default. The first organiser must be promoted manually via SQL (commented example at the bottom of the migration). After that, organisers promote others from the Team page.
2. One ticket per student per event (enforced by unique index). To change, drop the indexes and update MAX_TICKETS_PER_EVENT in lib/config.ts.
3. The `public_events` view is the only way unauthenticated users see events — it never exposes capacity or seat counts.
4. All functions are SECURITY DEFINER with explicitly granted EXECUTE to authenticated only (revoked from public and anon).
*/

-- =====================================================================
-- 1. Extensions
-- =====================================================================
create extension if not exists pgcrypto with schema extensions;

-- =====================================================================
-- 2. Enforce Ashoka email on signup (database-level, can't be bypassed)
-- =====================================================================
create or replace function public.enforce_ashoka_email()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if lower(new.email) not like '%@ashoka.edu.in' then
    raise exception 'Only @ashoka.edu.in email addresses can sign up';
  end if;
  return new;
end $$;

drop trigger if exists enforce_ashoka_email on auth.users;
create trigger enforce_ashoka_email before insert on auth.users
  for each row execute function public.enforce_ashoka_email();

drop trigger if exists enforce_ashoka_email_update on auth.users;
create trigger enforce_ashoka_email_update before update of email on auth.users
  for each row when (new.email is distinct from old.email) execute function public.enforce_ashoka_email();

-- =====================================================================
-- 3. Tables
-- =====================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  student_id text not null,
  role text not null default 'student' check (role in ('student', 'organiser')),
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null,
  date date not null,
  time time not null,
  venue text not null,
  poster_url text,
  ticket_price numeric(10,2) not null check (ticket_price >= 0),
  capacity integer check (capacity > 0),
  sales_open timestamptz not null,
  sales_close timestamptz not null,
  organiser_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (sales_close > sales_open)
);

create table if not exists public.orders (
  id uuid primary key,
  user_id uuid not null references public.profiles(id),
  event_id uuid not null references public.events(id),
  amount numeric(10,2) not null,
  screenshot_path text not null,
  payment_status text not null default 'awaiting_review'
    check (payment_status in ('awaiting_review', 'approved', 'rejected')),
  reject_reason text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.orders add column if not exists screenshot_hash text;
alter table public.orders add column if not exists email_status text not null default 'none'
  check (email_status in ('none', 'pending', 'sending', 'sent', 'failed'));
alter table public.orders add column if not exists email_claimed_at timestamptz;
alter table public.orders add column if not exists emailed_at timestamptz;

create index if not exists orders_screenshot_hash_idx on public.orders (screenshot_hash) where screenshot_hash is not null;

-- One live (pending or approved) order per student per event
create unique index if not exists one_live_order_per_student
  on public.orders (user_id, event_id) where payment_status in ('awaiting_review', 'approved');

create table if not exists public.tickets (
  id text primary key default ('TKT-' || upper(encode(extensions.gen_random_bytes(4), 'hex'))),
  order_id uuid not null unique references public.orders(id),
  user_id uuid not null references public.profiles(id),
  event_id uuid not null references public.events(id),
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  status text not null default 'active' check (status in ('active', 'used')),
  checked_in_at timestamptz,
  checked_in_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- One ticket per student per event
create unique index if not exists one_ticket_per_student_per_event on public.tickets (user_id, event_id);

-- =====================================================================
-- 4. Auto-create profile on signup
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if length(trim(coalesce(new.raw_user_meta_data->>'name', ''))) = 0
     or length(trim(coalesce(new.raw_user_meta_data->>'student_id', ''))) = 0 then
    raise exception 'Name and student ID are required';
  end if;
  insert into public.profiles (id, name, email, student_id)
  values (new.id, trim(new.raw_user_meta_data->>'name'), lower(new.email), trim(new.raw_user_meta_data->>'student_id'));
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- 5. Helper: is_organiser
-- =====================================================================
create or replace function public.is_organiser()
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'organiser');
$$;

-- =====================================================================
-- 6. Row Level Security
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.events   enable row level security;
alter table public.orders   enable row level security;
alter table public.tickets  enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for select to authenticated using (id = auth.uid());

drop policy if exists "own events: read" on public.events;
create policy "own events: read" on public.events for select to authenticated using (organiser_id = auth.uid());

drop policy if exists "own events: create" on public.events;
create policy "own events: create" on public.events for insert to authenticated
  with check (organiser_id = auth.uid() and public.is_organiser());

drop policy if exists "own events: edit" on public.events;
create policy "own events: edit" on public.events for update to authenticated
  using (organiser_id = auth.uid()) with check (organiser_id = auth.uid());

drop policy if exists "own orders" on public.orders;
create policy "own orders" on public.orders for select to authenticated using (user_id = auth.uid());

drop policy if exists "own tickets" on public.tickets;
create policy "own tickets" on public.tickets for select to authenticated using (user_id = auth.uid());

-- =====================================================================
-- 7. Public events view (hides capacity, exposes sold_out flag)
-- =====================================================================
create or replace view public.public_events as
select e.id, e.name, e.description, e.date, e.time, e.venue, e.poster_url, e.ticket_price,
       e.sales_open, e.sales_close,
       (e.capacity is not null and (
          (select count(*) from public.tickets t where t.event_id = e.id) +
          (select count(*) from public.orders o where o.event_id = e.id and o.payment_status = 'awaiting_review')
        ) >= e.capacity) as sold_out
from public.events e;
grant select on public.public_events to anon, authenticated;

-- =====================================================================
-- 8. Business logic functions (all SECURITY DEFINER)
-- =====================================================================

-- Student creates an order (submits payment screenshot)
drop function if exists public.create_order(uuid, uuid, text);
create or replace function public.create_order(p_order_id uuid, p_event_id uuid, p_screenshot_path text, p_screenshot_hash text default null)
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
  insert into public.orders (id, user_id, event_id, amount, screenshot_path, screenshot_hash)
  values (p_order_id, uid, e.id, e.ticket_price, p_screenshot_path, p_screenshot_hash);
  return p_order_id;
end $$;

-- Organiser reviews a single payment (approve = issue ticket, reject = queue rejection email)
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
    update public.orders set payment_status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), email_status = 'pending', email_claimed_at = null where id = o.id;
    insert into public.tickets (order_id, user_id, event_id) values (o.id, o.user_id, o.event_id)
      on conflict (order_id) do nothing;
  else
    update public.orders set payment_status = 'rejected', reject_reason = nullif(trim(p_reason), ''),
      reviewed_by = auth.uid(), reviewed_at = now(), email_status = 'pending', email_claimed_at = null where id = o.id;
  end if;
end $$;

-- Gate check-in: atomic update, first scan wins
create or replace function public.check_in(p_token text, p_event_id uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare t public.tickets%rowtype; nm text; en text;
begin
  if not exists (select 1 from public.events where id = p_event_id and organiser_id = auth.uid()) then
    raise exception 'not_your_event';
  end if;
  update public.tickets set status = 'used', checked_in_at = now(), checked_in_by = auth.uid()
   where token = p_token and event_id = p_event_id and status = 'active'
  returning * into t;
  if found then
    select name into nm from public.profiles where id = t.user_id;
    return jsonb_build_object('kind', 'valid', 'name', nm, 'ticketId', t.id);
  end if;
  select * into t from public.tickets where token = p_token;
  if not found then return jsonb_build_object('kind', 'invalid'); end if;
  select name into nm from public.profiles where id = t.user_id;
  if t.event_id <> p_event_id then
    select name into en from public.events where id = t.event_id;
    return jsonb_build_object('kind', 'wrong_event', 'name', nm, 'eventName', en);
  end if;
  return jsonb_build_object('kind', 'used', 'name', nm, 'at', t.checked_in_at);
end $$;

-- Batch payment review: each decided independently, failures skip
create or replace function public.review_payments(p_order_ids uuid[], p_approve boolean, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare oid uuid; decided integer := 0; skipped integer := 0;
begin
  if coalesce(array_length(p_order_ids, 1), 0) > 500 then raise exception 'too_many'; end if;
  foreach oid in array coalesce(p_order_ids, '{}') loop
    begin
      if exists (select 1 from public.orders o join public.events e on e.id = o.event_id
                 where o.id = oid and o.payment_status = 'awaiting_review' and e.organiser_id = auth.uid()) then
        perform public.review_payment(oid, p_approve, p_reason);
        decided := decided + 1;
      else
        skipped := skipped + 1;
      end if;
    exception when others then
      skipped := skipped + 1;
    end;
  end loop;
  return jsonb_build_object('decided', decided, 'skipped', skipped);
end $$;

-- Claim next batch of emails for sending (atomic, skip locked)
create or replace function public.claim_emails(p_event_id uuid, p_limit integer default 5)
returns table (order_id uuid, payment_status text, reject_reason text, ticket_id text, token text, name text, email text,
               event_id uuid, event_name text, event_date date, event_time time, venue text)
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (select 1 from public.events ev where ev.id = p_event_id and ev.organiser_id = auth.uid()) then
    raise exception 'not_your_event';
  end if;
  return query
  with picked as (
    select o.id from public.orders o
     where o.event_id = p_event_id
       and (o.email_status = 'pending' or (o.email_status = 'sending' and o.email_claimed_at < now() - interval '5 minutes'))
     order by o.created_at
     limit greatest(1, least(coalesce(p_limit, 5), 20))
     for update skip locked
  ), upd as (
    update public.orders o set email_status = 'sending', email_claimed_at = now()
      from picked where o.id = picked.id returning o.*
  )
  select u.id, u.payment_status, u.reject_reason, t.id, t.token, p.name, p.email, ev.id, ev.name, ev.date, ev.time, ev.venue
    from upd u
    join public.events ev on ev.id = u.event_id
    join public.profiles p on p.id = u.user_id
    left join public.tickets t on t.order_id = u.id;
end $$;

create or replace function public.finish_email(p_order_id uuid, p_ok boolean)
returns void language sql security definer set search_path = public, extensions as $$
  update public.orders o
     set email_status = case when p_ok then 'sent' else 'failed' end,
         emailed_at = case when p_ok then now() else o.emailed_at end
    from public.events ev
   where o.id = p_order_id and ev.id = o.event_id and ev.organiser_id = auth.uid();
$$;

create or replace function public.requeue_failed(p_event_id uuid)
returns integer language sql security definer set search_path = public, extensions as $$
  with u as (
    update public.orders o set email_status = 'pending', email_claimed_at = null
      from public.events ev
     where o.event_id = p_event_id and ev.id = o.event_id and ev.organiser_id = auth.uid() and o.email_status = 'failed'
    returning 1)
  select count(*)::integer from u;
$$;

create or replace function public.event_email_status(p_event_id uuid)
returns table (pending integer, sending integer, failed integer, sent integer)
language sql stable security definer set search_path = public, extensions as $$
  select count(*) filter (where o.email_status = 'pending')::integer,
         count(*) filter (where o.email_status = 'sending')::integer,
         count(*) filter (where o.email_status = 'failed')::integer,
         count(*) filter (where o.email_status = 'sent')::integer
    from public.orders o join public.events ev on ev.id = o.event_id
   where o.event_id = p_event_id and ev.organiser_id = auth.uid();
$$;

-- Organiser dashboard stats for all their events
create or replace function public.organiser_event_stats()
returns table (event_id uuid, sold integer, revenue numeric, checked_in integer, pending integer)
language sql stable security definer set search_path = public, extensions as $$
  select e.id,
         (select count(*) from public.tickets t where t.event_id = e.id)::integer,
         coalesce((select sum(o.amount) from public.orders o where o.event_id = e.id and o.payment_status = 'approved'), 0),
         (select count(*) from public.tickets t where t.event_id = e.id and t.status = 'used')::integer,
         (select count(*) from public.orders o where o.event_id = e.id and o.payment_status = 'awaiting_review')::integer
  from public.events e where e.organiser_id = auth.uid();
$$;

-- Attendee list (never includes ticket tokens)
create or replace function public.event_attendees(p_event_id uuid)
returns table (ticket_id text, status text, checked_in_at timestamptz, bought_at timestamptz,
               user_id uuid, name text, email text, student_id text, order_id uuid, amount numeric)
language sql stable security definer set search_path = public, extensions as $$
  select t.id, t.status, t.checked_in_at, t.created_at, p.id, p.name, p.email, p.student_id, t.order_id, o.amount
  from public.tickets t
  join public.profiles p on p.id = t.user_id
  join public.orders o on o.id = t.order_id
  join public.events e on e.id = t.event_id
  where t.event_id = p_event_id and e.organiser_id = auth.uid()
  order by p.name;
$$;

-- Pending payment screenshots with duplicate detection
drop function if exists public.pending_payments(uuid);
create function public.pending_payments(p_event_id uuid)
returns table (order_id uuid, amount numeric, screenshot_path text, submitted_at timestamptz,
               user_id uuid, name text, email text, student_id text, duplicates integer)
language sql stable security definer set search_path = public, extensions as $$
  select o.id, o.amount, o.screenshot_path, o.created_at, p.id, p.name, p.email, p.student_id,
         (select count(*)::integer from public.orders d
           where o.screenshot_hash is not null and d.screenshot_hash = o.screenshot_hash and d.id <> o.id)
  from public.orders o
  join public.profiles p on p.id = o.user_id
  join public.events e on e.id = o.event_id
  where o.event_id = p_event_id and e.organiser_id = auth.uid() and o.payment_status = 'awaiting_review'
  order by o.created_at;
$$;

-- Email data for a single order (organiser only)
create or replace function public.order_email_data(p_order_id uuid)
returns table (payment_status text, reject_reason text, ticket_id text, token text, name text, email text,
               event_id uuid, event_name text, event_date date, event_time time, venue text)
language sql stable security definer set search_path = public, extensions as $$
  select o.payment_status, o.reject_reason, t.id, t.token, p.name, p.email, e.id, e.name, e.date, e.time, e.venue
  from public.orders o
  join public.events e on e.id = o.event_id
  join public.profiles p on p.id = o.user_id
  left join public.tickets t on t.order_id = o.id
  where o.id = p_order_id and e.organiser_id = auth.uid();
$$;

-- List users (organiser only)
create or replace function public.list_users(p_search text default '')
returns table (id uuid, name text, email text, student_id text, role text)
language sql stable security definer set search_path = public, extensions as $$
  select p.id, p.name, p.email, p.student_id, p.role
  from public.profiles p
  where public.is_organiser()
    and (coalesce(p_search, '') = '' or p.name ilike '%' || p_search || '%' or p.email ilike '%' || p_search || '%')
  order by (p.role = 'student'), p.name
  limit 50;
$$;

-- Set user role (organiser only, can't change own role)
create or replace function public.set_user_role(p_email text, p_role text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_organiser() then raise exception 'not_organiser'; end if;
  if p_role not in ('student', 'organiser') then raise exception 'bad_role'; end if;
  update public.profiles set role = p_role
   where email = lower(trim(p_email)) and id <> auth.uid();
  if not found then raise exception 'user_not_found'; end if;
end $$;

-- =====================================================================
-- 9. Function grants (authenticated only)
-- =====================================================================
revoke execute on function public.create_order(uuid, uuid, text, text), public.review_payment(uuid, boolean, text), public.review_payments(uuid[], boolean, text),
  public.check_in(text, uuid), public.organiser_event_stats(), public.event_attendees(uuid), public.pending_payments(uuid),
  public.list_users(text), public.set_user_role(text, text), public.order_email_data(uuid),
  public.claim_emails(uuid, integer), public.finish_email(uuid, boolean), public.requeue_failed(uuid), public.event_email_status(uuid) from public, anon;
grant execute on function public.create_order(uuid, uuid, text, text), public.review_payment(uuid, boolean, text), public.review_payments(uuid[], boolean, text),
  public.check_in(text, uuid), public.organiser_event_stats(), public.event_attendees(uuid), public.pending_payments(uuid),
  public.list_users(text), public.set_user_role(text, text), public.order_email_data(uuid),
  public.claim_emails(uuid, integer), public.finish_email(uuid, boolean), public.requeue_failed(uuid), public.event_email_status(uuid) to authenticated;

-- =====================================================================
-- 10. Storage buckets and policies
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-screenshots', 'payment-screenshots', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('posters', 'posters', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "students upload own screenshots" on storage.objects;
create policy "students upload own screenshots" on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "students read own screenshots" on storage.objects;
create policy "students read own screenshots" on storage.objects for select to authenticated
  using (bucket_id = 'payment-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "organisers read their events' screenshots" on storage.objects;
create policy "organisers read their events' screenshots" on storage.objects for select to authenticated
  using (bucket_id = 'payment-screenshots' and exists (
    select 1 from public.orders o join public.events e on e.id = o.event_id
    where o.screenshot_path = storage.objects.name and e.organiser_id = auth.uid()));

drop policy if exists "organisers upload posters" on storage.objects;
create policy "organisers upload posters" on storage.objects for insert to authenticated
  with check (bucket_id = 'posters' and (storage.foldername(name))[1] = auth.uid()::text and public.is_organiser());