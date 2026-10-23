/*
# Add Admin Role and Global Admin Functions

## Overview
Introduces an "admin" role that has global access across all events, users, orders, and tickets — not just their own. Admins can review any event's payments, issue tickets, send emails, view all users, manage all events, and validate tickets at the gate.

## Changes

### 1. Roles
- The `profiles.role` check constraint is extended to allow 'admin' in addition to 'student' and 'organiser'.
- A new helper `public.is_admin()` returns true if the current user is an admin.

### 2. Events table
- Adds `published` (boolean, default true) and `archived` (boolean, default false) columns.
- Admins can unpublish or archive events; unpublished/archived events don't appear on the public site.

### 3. Public events view
- Updated to exclude archived events and filter by the published flag.

### 4. New admin functions (all SECURITY DEFINER, authenticated only)
- `admin_stats()` — Global dashboard stats.
- `admin_users(p_search)` — All users with ticket counts.
- `admin_user_detail(p_user_id)` — Single user with orders and tickets.
- `admin_orders(p_event_id, p_status)` — All orders with buyer and event info.
- `admin_tickets(p_search)` — All tickets with buyer, event, and check-in info.
- `admin_all_events()` — All events including unpublished/archived with stats.
- `admin_event_stats(p_event_id)` — Stats for any single event.
- `admin_event_attendees(p_event_id)` — Attendees for any event.
- `admin_pending_payments(p_event_id)` — Pending payments for any event.
- `admin_review_payment(...)` — Review any payment (admin version).
- `admin_review_payments(...)` — Batch review any payments.
- `admin_check_in(...)` — Check in tickets for any event.
- `admin_claim_emails(...)` — Claim emails for any event.
- `admin_finish_email(...)` / `admin_requeue_failed(...)` / `admin_event_email_status(...)` / `admin_order_email_data(...)` — Email management for any event.
- `admin_create_event(...)` — Admin creates events.
- `admin_update_event(...)` — Admin edits any event.
- `admin_delete_event(p_event_id)` — Admin archives any event.
- `admin_list_users(p_search)` — List users for team management.
- `admin_set_user_role(...)` — Set any user's role including admin.

### 5. RLS updates
- Events, orders, tickets, profiles: admins can SELECT all rows.
- Events: admins can INSERT/UPDATE all rows.

### 6. Storage policies
- Admins can read any payment screenshot.
- Admins can upload posters.

### 7. Existing organiser functions remain unchanged.
*/

-- =====================================================================
-- 1. Extend role constraint to include 'admin'
-- =====================================================================
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('student', 'organiser', 'admin'));

-- =====================================================================
-- 2. is_admin helper
-- =====================================================================
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- =====================================================================
-- 3. Events: add published and archived columns
-- =====================================================================
alter table public.events add column if not exists published boolean not null default true;
alter table public.events add column if not exists archived boolean not null default false;

-- =====================================================================
-- 4. Update public_events view to exclude archived/unpublished
-- =====================================================================
create or replace view public.public_events as
select e.id, e.name, e.description, e.date, e.time, e.venue, e.poster_url, e.ticket_price,
       e.sales_open, e.sales_close,
       (e.capacity is not null and (
          (select count(*) from public.tickets t where t.event_id = e.id) +
          (select count(*) from public.orders o where o.event_id = e.id and o.payment_status = 'awaiting_review')
        ) >= e.capacity) as sold_out
from public.events e
where e.published = true and e.archived = false;
grant select on public.public_events to anon, authenticated;

-- =====================================================================
-- 5. RLS: admin access to all data
-- =====================================================================
drop policy if exists "own events: read" on public.events;
create policy "own events: read" on public.events for select to authenticated
  using (organiser_id = auth.uid() or public.is_admin());

drop policy if exists "own events: create" on public.events;
create policy "own events: create" on public.events for insert to authenticated
  with check (organiser_id = auth.uid() and (public.is_organiser() or public.is_admin()));

drop policy if exists "own events: edit" on public.events;
create policy "own events: edit" on public.events for update to authenticated
  using (organiser_id = auth.uid() or public.is_admin()) with check (organiser_id = auth.uid() or public.is_admin());

drop policy if exists "own orders" on public.orders;
create policy "own orders" on public.orders for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "own tickets" on public.tickets;
create policy "own tickets" on public.tickets for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

-- =====================================================================
-- 6. Storage: admin can read any payment screenshot
-- =====================================================================
drop policy if exists "organisers read their events' screenshots" on storage.objects;
create policy "organisers read their events' screenshots" on storage.objects for select to authenticated
  using (bucket_id = 'payment-screenshots' and (
    public.is_admin() or exists (
      select 1 from public.orders o join public.events e on e.id = o.event_id
      where o.screenshot_path = storage.objects.name and e.organiser_id = auth.uid())));

drop policy if exists "organisers upload posters" on storage.objects;
create policy "organisers upload posters" on storage.objects for insert to authenticated
  with check (bucket_id = 'posters' and (storage.foldername(name))[1] = auth.uid()::text and (public.is_organiser() or public.is_admin()));

-- =====================================================================
-- 7. Admin functions
-- =====================================================================

-- Global dashboard stats
create or replace function public.admin_stats()
returns jsonb language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
    'total_users', (select count(*) from public.profiles),
    'total_tickets', (select count(*) from public.tickets),
    'total_revenue', coalesce((select sum(o.amount) from public.orders o where o.payment_status = 'approved'), 0),
    'pending_approvals', (select count(*) from public.orders where payment_status = 'awaiting_review'),
    'total_events', (select count(*) from public.events where archived = false),
    'total_registrations', (select count(*) from public.orders where payment_status in ('awaiting_review', 'approved')),
    'checked_in', (select count(*) from public.tickets where status = 'used'),
    'approved_orders', (select count(*) from public.orders where payment_status = 'approved'),
    'rejected_orders', (select count(*) from public.orders where payment_status = 'rejected')
  );
$$;

-- All users with ticket counts
create or replace function public.admin_users(p_search text default '')
returns table (
  id uuid, name text, email text, role text, created_at timestamptz,
  ticket_count integer, order_count integer
)
language sql stable security definer set search_path = public, extensions as $$
  select p.id, p.name, p.email, p.role, p.created_at,
         (select count(*)::integer from public.tickets t where t.user_id = p.id),
         (select count(*)::integer from public.orders o where o.user_id = p.id)
  from public.profiles p
  where public.is_admin()
    and (coalesce(p_search, '') = '' or p.name ilike '%' || p_search || '%' or p.email ilike '%' || p_search || '%')
  order by p.created_at desc
  limit 100;
$$;

-- Single user detail with orders and tickets
create or replace function public.admin_user_detail(p_user_id uuid)
returns jsonb language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
    'user', (select to_jsonb(p) from public.profiles p where p.id = p_user_id),
    'orders', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', o.id, 'event_id', o.event_id, 'event_name', e.name,
        'amount', o.amount, 'payment_status', o.payment_status, 'reject_reason', o.reject_reason,
        'created_at', o.created_at, 'email_status', o.email_status,
        'ticket_id', (select t.id from public.tickets t where t.order_id = o.id)
      )), '[]'::jsonb)
      from public.orders o join public.events e on e.id = o.event_id
      where o.user_id = p_user_id
    ),
    'tickets', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', t.id, 'event_id', t.event_id, 'event_name', e.name,
        'status', t.status, 'checked_in_at', t.checked_in_at, 'created_at', t.created_at
      )), '[]'::jsonb)
      from public.tickets t join public.events e on e.id = t.event_id
      where t.user_id = p_user_id
    )
  );
$$;

-- All orders with buyer and event info, optional filters
create or replace function public.admin_orders(p_event_id uuid default null, p_status text default null)
returns table (
  order_id uuid, user_id uuid, buyer_name text, buyer_email text,
  event_id uuid, event_name text, amount numeric, payment_status text, reject_reason text,
  email_status text, screenshot_path text, created_at timestamptz,
  ticket_id text, ticket_status text, checked_in_at timestamptz
)
language sql stable security definer set search_path = public, extensions as $$
  select o.id, o.user_id, p.name, p.email, o.event_id, e.name, o.amount,
         o.payment_status, o.reject_reason, o.email_status, o.screenshot_path, o.created_at,
         t.id, t.status, t.checked_in_at
  from public.orders o
  join public.profiles p on p.id = o.user_id
  join public.events e on e.id = o.event_id
  left join public.tickets t on t.order_id = o.id
  where public.is_admin()
    and (p_event_id is null or o.event_id = p_event_id)
    and (p_status is null or o.payment_status = p_status)
  order by o.created_at desc
  limit 500;
$$;

-- All tickets with buyer and event info
create or replace function public.admin_tickets(p_search text default '')
returns table (
  ticket_id text, user_id uuid, buyer_name text, buyer_email text,
  event_id uuid, event_name text, status text, checked_in_at timestamptz, created_at timestamptz,
  order_id uuid, payment_status text, email_status text
)
language sql stable security definer set search_path = public, extensions as $$
  select t.id, t.user_id, p.name, p.email, t.event_id, e.name, t.status, t.checked_in_at, t.created_at,
         o.id, o.payment_status, o.email_status
  from public.tickets t
  join public.profiles p on p.id = t.user_id
  join public.events e on e.id = t.event_id
  join public.orders o on o.id = t.order_id
  where public.is_admin()
    and (coalesce(p_search, '') = '' or p.name ilike '%' || p_search || '%' or p.email ilike '%' || p_search || '%' or t.id ilike '%' || p_search || '%')
  order by t.created_at desc
  limit 200;
$$;

-- All events with stats (admin sees everything)
create or replace function public.admin_all_events()
returns table (
  id uuid, name text, description text, date date, "time" time, venue text,
  poster_url text, ticket_price numeric, capacity integer,
  sales_open timestamptz, sales_close timestamptz, organiser_id uuid, organiser_name text,
  published boolean, archived boolean, created_at timestamptz,
  sold integer, revenue numeric, checked_in integer, pending integer
)
language sql stable security definer set search_path = public, extensions as $$
  select e.id, e.name, e.description, e.date, e."time", e.venue, e.poster_url, e.ticket_price, e.capacity,
         e.sales_open, e.sales_close, e.organiser_id, p.name,
         e.published, e.archived, e.created_at,
         (select count(*)::integer from public.tickets t where t.event_id = e.id),
         coalesce((select sum(o.amount) from public.orders o where o.event_id = e.id and o.payment_status = 'approved'), 0),
         (select count(*)::integer from public.tickets t where t.event_id = e.id and t.status = 'used'),
         (select count(*)::integer from public.orders o where o.event_id = e.id and o.payment_status = 'awaiting_review')
  from public.events e
  left join public.profiles p on p.id = e.organiser_id
  order by e.created_at desc;
$$;

-- Stats for any single event
create or replace function public.admin_event_stats(p_event_id uuid)
returns jsonb language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
    'sold', (select count(*) from public.tickets t where t.event_id = p_event_id),
    'revenue', coalesce((select sum(o.amount) from public.orders o where o.event_id = p_event_id and o.payment_status = 'approved'), 0),
    'checked_in', (select count(*) from public.tickets t where t.event_id = p_event_id and t.status = 'used'),
    'pending', (select count(*) from public.orders o where o.event_id = p_event_id and o.payment_status = 'awaiting_review')
  );
$$;

-- Attendees for any event
create or replace function public.admin_event_attendees(p_event_id uuid)
returns table (
  ticket_id text, status text, checked_in_at timestamptz, bought_at timestamptz,
  user_id uuid, name text, email text, order_id uuid, amount numeric
)
language sql stable security definer set search_path = public, extensions as $$
  select t.id, t.status, t.checked_in_at, t.created_at, p.id, p.name, p.email, t.order_id, o.amount
  from public.tickets t
  join public.profiles p on p.id = t.user_id
  join public.orders o on o.id = t.order_id
  where t.event_id = p_event_id and public.is_admin()
  order by p.name;
$$;

-- Pending payments for any event
create or replace function public.admin_pending_payments(p_event_id uuid)
returns table (
  order_id uuid, amount numeric, screenshot_path text, submitted_at timestamptz,
  user_id uuid, name text, email text, duplicates integer
)
language sql stable security definer set search_path = public, extensions as $$
  select o.id, o.amount, o.screenshot_path, o.created_at, p.id, p.name, p.email,
         (select count(*)::integer from public.orders d
           where o.screenshot_hash is not null and d.screenshot_hash = o.screenshot_hash and d.id <> o.id)
  from public.orders o
  join public.profiles p on p.id = o.user_id
  where o.event_id = p_event_id and public.is_admin() and o.payment_status = 'awaiting_review'
  order by o.created_at;
$$;

-- Review any single payment (admin version)
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
    update public.orders set payment_status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), email_status = 'pending', email_claimed_at = null where id = o.id;
    insert into public.tickets (order_id, user_id, event_id) values (o.id, o.user_id, o.event_id)
      on conflict (order_id) do nothing;
  else
    update public.orders set payment_status = 'rejected', reject_reason = nullif(trim(p_reason), ''),
      reviewed_by = auth.uid(), reviewed_at = now(), email_status = 'pending', email_claimed_at = null where id = o.id;
  end if;
end $$;

-- Batch review any payments (admin version)
create or replace function public.admin_review_payments(p_order_ids uuid[], p_approve boolean, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare oid uuid; decided integer := 0; skipped integer := 0;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if coalesce(array_length(p_order_ids, 1), 0) > 500 then raise exception 'too_many'; end if;
  foreach oid in array coalesce(p_order_ids, '{}') loop
    begin
      if exists (select 1 from public.orders o where o.id = oid and o.payment_status = 'awaiting_review') then
        perform public.admin_review_payment(oid, p_approve, p_reason);
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

-- Check in tickets for any event (admin version)
create or replace function public.admin_check_in(p_token text, p_event_id uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare t public.tickets%rowtype; nm text; en text;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
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

-- Claim emails for any event (admin version)
create or replace function public.admin_claim_emails(p_event_id uuid, p_limit integer default 5)
returns table (order_id uuid, payment_status text, reject_reason text, ticket_id text, token text, name text, email text,
               event_id uuid, event_name text, event_date date, event_time time, venue text)
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
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
  select u.id, u.payment_status, u.reject_reason, t.id, t.token, p.name, p.email, ev.id, ev.name, ev.date, ev."time", ev.venue
    from upd u
    join public.events ev on ev.id = u.event_id
    join public.profiles p on p.id = u.user_id
    left join public.tickets t on t.order_id = u.id;
end $$;

create or replace function public.admin_finish_email(p_order_id uuid, p_ok boolean)
returns void language sql security definer set search_path = public, extensions as $$
  update public.orders o
     set email_status = case when p_ok then 'sent' else 'failed' end,
         emailed_at = case when p_ok then now() else o.emailed_at end
   where o.id = p_order_id and public.is_admin();
$$;

create or replace function public.admin_requeue_failed(p_event_id uuid)
returns integer language sql security definer set search_path = public, extensions as $$
  with u as (
    update public.orders o set email_status = 'pending', email_claimed_at = null
     where o.event_id = p_event_id and public.is_admin() and o.email_status = 'failed'
    returning 1)
  select count(*)::integer from u;
$$;

create or replace function public.admin_event_email_status(p_event_id uuid)
returns table (pending integer, sending integer, failed integer, sent integer)
language sql stable security definer set search_path = public, extensions as $$
  select count(*) filter (where o.email_status = 'pending')::integer,
         count(*) filter (where o.email_status = 'sending')::integer,
         count(*) filter (where o.email_status = 'failed')::integer,
         count(*) filter (where o.email_status = 'sent')::integer
    from public.orders o
   where o.event_id = p_event_id and public.is_admin();
$$;

create or replace function public.admin_order_email_data(p_order_id uuid)
returns table (payment_status text, reject_reason text, ticket_id text, token text, name text, email text,
               event_id uuid, event_name text, event_date date, event_time time, venue text)
language sql stable security definer set search_path = public, extensions as $$
  select o.payment_status, o.reject_reason, t.id, t.token, p.name, p.email, e.id, e.name, e.date, e."time", e.venue
  from public.orders o
  join public.events e on e.id = o.event_id
  join public.profiles p on p.id = o.user_id
  left join public.tickets t on t.order_id = o.id
  where o.id = p_order_id and public.is_admin();
$$;

-- Admin create event
create or replace function public.admin_create_event(
  p_name text, p_description text, p_date date, p_time time, p_venue text,
  p_poster_url text, p_ticket_price numeric, p_capacity integer,
  p_sales_open timestamptz, p_sales_close timestamptz
)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare e_id uuid;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  insert into public.events (name, description, date, "time", venue, poster_url, ticket_price, capacity,
    sales_open, sales_close, organiser_id)
  values (p_name, p_description, p_date, p_time, p_venue, p_poster_url, p_ticket_price, p_capacity,
    p_sales_open, p_sales_close, auth.uid())
  returning id into e_id;
  return e_id;
end $$;

-- Admin update any event
create or replace function public.admin_update_event(
  p_event_id uuid, p_name text, p_description text, p_date date, p_time time, p_venue text,
  p_poster_url text, p_ticket_price numeric, p_capacity integer,
  p_sales_open timestamptz, p_sales_close timestamptz, p_published boolean, p_archived boolean
)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  update public.events set
    name = p_name, description = p_description, date = p_date, "time" = p_time, venue = p_venue,
    poster_url = p_poster_url, ticket_price = p_ticket_price, capacity = p_capacity,
    sales_open = p_sales_open, sales_close = p_sales_close,
    published = p_published, archived = p_archived
  where id = p_event_id;
  if not found then raise exception 'event_not_found'; end if;
end $$;

-- Admin archive (soft delete) any event
create or replace function public.admin_delete_event(p_event_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  update public.events set archived = true where id = p_event_id;
  if not found then raise exception 'event_not_found'; end if;
end $$;

-- Admin list users
create or replace function public.admin_list_users(p_search text default '')
returns table (id uuid, name text, email text, student_id text, role text, created_at timestamptz)
language sql stable security definer set search_path = public, extensions as $$
  select p.id, p.name, p.email, p.student_id, p.role, p.created_at
  from public.profiles p
  where public.is_admin()
    and (coalesce(p_search, '') = '' or p.name ilike '%' || p_search || '%' or p.email ilike '%' || p_search || '%')
  order by p.created_at desc
  limit 100;
$$;

-- Admin set user role (can set admin too)
create or replace function public.admin_set_user_role(p_email text, p_role text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if p_role not in ('student', 'organiser', 'admin') then raise exception 'bad_role'; end if;
  update public.profiles set role = p_role
   where email = lower(trim(p_email)) and id <> auth.uid();
  if not found then raise exception 'user_not_found'; end if;
end $$;

-- =====================================================================
-- 8. Grant execute on admin functions to authenticated only
-- =====================================================================
revoke execute on function public.admin_stats(), public.admin_users(text), public.admin_user_detail(uuid),
  public.admin_orders(uuid, text), public.admin_tickets(text), public.admin_all_events(),
  public.admin_event_stats(uuid), public.admin_event_attendees(uuid), public.admin_pending_payments(uuid),
  public.admin_review_payment(uuid, boolean, text), public.admin_review_payments(uuid[], boolean, text),
  public.admin_check_in(text, uuid), public.admin_claim_emails(uuid, integer), public.admin_finish_email(uuid, boolean),
  public.admin_requeue_failed(uuid), public.admin_event_email_status(uuid), public.admin_order_email_data(uuid),
  public.admin_create_event(text, text, date, time, text, text, numeric, integer, timestamptz, timestamptz),
  public.admin_update_event(uuid, text, text, date, time, text, text, numeric, integer, timestamptz, timestamptz, boolean, boolean),
  public.admin_delete_event(uuid), public.admin_list_users(text), public.admin_set_user_role(text, text)
  from public, anon;
grant execute on function public.admin_stats(), public.admin_users(text), public.admin_user_detail(uuid),
  public.admin_orders(uuid, text), public.admin_tickets(text), public.admin_all_events(),
  public.admin_event_stats(uuid), public.admin_event_attendees(uuid), public.admin_pending_payments(uuid),
  public.admin_review_payment(uuid, boolean, text), public.admin_review_payments(uuid[], boolean, text),
  public.admin_check_in(text, uuid), public.admin_claim_emails(uuid, integer), public.admin_finish_email(uuid, boolean),
  public.admin_requeue_failed(uuid), public.admin_event_email_status(uuid), public.admin_order_email_data(uuid),
  public.admin_create_event(text, text, date, time, text, text, numeric, integer, timestamptz, timestamptz),
  public.admin_update_event(uuid, text, text, date, time, text, text, numeric, integer, timestamptz, timestamptz, boolean, boolean),
  public.admin_delete_event(uuid), public.admin_list_users(text), public.admin_set_user_role(text, text)
  to authenticated;