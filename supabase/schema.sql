-- =====================================================================
-- Ashoka Events: database, access rules and storage (run once in the
-- Supabase SQL Editor: Dashboard -> SQL Editor -> New query -> paste -> Run)
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- 1. Only @ashoka.edu.in addresses can sign up (enforced in the database,
--    so it cannot be bypassed from the browser)
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 2. Tables (plan section 5.2)
-- ---------------------------------------------------------------------
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
  capacity integer check (capacity > 0),            -- optional, organiser-only
  sales_open timestamptz not null,
  sales_close timestamptz not null,
  organiser_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (sales_close > sales_open)
);

-- One row per payment screenshot. The amount is stored here so a later
-- price change never alters what an earlier student was charged.
create table if not exists public.orders (
  id uuid primary key,
  user_id uuid not null references public.profiles(id),
  event_id uuid not null references public.events(id),
  amount numeric(10,2) not null,
  screenshot_path text not null,                    -- file in the private payment-screenshots bucket
  payment_status text not null default 'awaiting_review'
    check (payment_status in ('awaiting_review', 'approved', 'rejected')),
  reject_reason text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

update public.profiles set role = 'organiser' where role = 'admin';   -- (older versions had a separate admin role)
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('student', 'organiser'));

-- A student can have only one live (pending or approved) order per event.
-- To allow several tickets per student, drop this index and change MAX_TICKETS_PER_EVENT in lib/config.ts.
create unique index if not exists one_live_order_per_student
  on public.orders (user_id, event_id) where payment_status in ('awaiting_review', 'approved');

create table if not exists public.tickets (
  id text primary key default ('TKT-' || upper(encode(extensions.gen_random_bytes(4), 'hex'))),
  order_id uuid not null unique references public.orders(id),   -- unique = one ticket per payment, never two
  user_id uuid not null references public.profiles(id),
  event_id uuid not null references public.events(id),
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),  -- the only thing the QR holds
  status text not null default 'active' check (status in ('active', 'used')),
  checked_in_at timestamptz,
  checked_in_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- One ticket per student per event, no matter what. (To allow several, drop this index and
-- one_live_order_per_student, then raise MAX_TICKETS_PER_EVENT in lib/config.ts.)
create unique index if not exists one_ticket_per_student_per_event on public.tickets (user_id, event_id);

-- ---------------------------------------------------------------------
-- 3. Profile is created automatically when someone signs up
-- ---------------------------------------------------------------------
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

create or replace function public.is_organiser()
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'organiser');
$$;

drop function if exists public.is_admin();

-- ---------------------------------------------------------------------
-- 4. Row level security (plan section 5.3)
--    There is no policy that lets anyone edit profiles, so nobody can make
--    themselves an organiser. Promote people by hand (see the bottom).
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.events   enable row level security;
alter table public.orders   enable row level security;
alter table public.tickets  enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists "own events: read" on public.events;
create policy "own events: read" on public.events   for select to authenticated using (organiser_id = auth.uid());
drop policy if exists "own events: create" on public.events;
create policy "own events: create" on public.events   for insert to authenticated
  with check (organiser_id = auth.uid() and public.is_organiser());
drop policy if exists "own events: edit" on public.events;
create policy "own events: edit" on public.events   for update to authenticated
  using (organiser_id = auth.uid()) with check (organiser_id = auth.uid());
drop policy if exists "own orders" on public.orders;
create policy "own orders" on public.orders   for select to authenticated using (user_id = auth.uid());
drop policy if exists "own tickets" on public.tickets;
create policy "own tickets" on public.tickets  for select to authenticated using (user_id = auth.uid());
-- Orders and tickets can only be written by the functions below.

-- What students see: no capacity, only a "sold out" flag. Ticket tokens are never in here.
create or replace view public.public_events as
select e.id, e.name, e.description, e.date, e.time, e.venue, e.poster_url, e.ticket_price,
       e.sales_open, e.sales_close,
       (e.capacity is not null and (
          (select count(*) from public.tickets t where t.event_id = e.id) +
          (select count(*) from public.orders o where o.event_id = e.id and o.payment_status = 'awaiting_review')
        ) >= e.capacity) as sold_out
from public.events e;
grant select on public.public_events to anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. Functions that hold the business rules
-- ---------------------------------------------------------------------

-- Student submits a payment screenshot. Checks the sales window, capacity and the
-- one-ticket limit. The event row is locked so two students can't take the last seat together.
create or replace function public.create_order(p_order_id uuid, p_event_id uuid, p_screenshot_path text)
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
  insert into public.orders (id, user_id, event_id, amount, screenshot_path)
  values (p_order_id, uid, e.id, e.ticket_price, p_screenshot_path);
  return p_order_id;
end $$;

-- Organiser approves or rejects a screenshot. Approving issues the ticket.
-- Safe to call twice: the second call does nothing, so one payment can never give two tickets.
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
      raise exception 'already_has_ticket';   -- never issue a second ticket to the same student for the same event
    end if;
    update public.orders set payment_status = 'approved', reviewed_by = auth.uid(), reviewed_at = now() where id = o.id;
    insert into public.tickets (order_id, user_id, event_id) values (o.id, o.user_id, o.event_id)
      on conflict (order_id) do nothing;
  else
    update public.orders set payment_status = 'rejected', reject_reason = nullif(trim(p_reason), ''),
      reviewed_by = auth.uid(), reviewed_at = now() where id = o.id;
  end if;
end $$;

-- Gate check-in. One atomic UPDATE: if two scanners read the same QR at once, only one gets 'valid'.
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

-- Organiser dashboard numbers for all of their events
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

-- Screenshots waiting for the organiser's decision
create or replace function public.pending_payments(p_event_id uuid)
returns table (order_id uuid, amount numeric, screenshot_path text, submitted_at timestamptz,
               user_id uuid, name text, email text, student_id text)
language sql stable security definer set search_path = public, extensions as $$
  select o.id, o.amount, o.screenshot_path, o.created_at, p.id, p.name, p.email, p.student_id
  from public.orders o
  join public.profiles p on p.id = o.user_id
  join public.events e on e.id = o.event_id
  where o.event_id = p_event_id and e.organiser_id = auth.uid() and o.payment_status = 'awaiting_review'
  order by o.created_at;
$$;

-- What the server needs to email a student after a decision. Only the event's organiser can call it,
-- and the ticket code goes to the server (to build the QR in the email), never to the organiser's browser.
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

-- Organisers only: list people and add / remove organisers (the very first organiser is made by hand, see the bottom)
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

create or replace function public.set_user_role(p_email text, p_role text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_organiser() then raise exception 'not_organiser'; end if;
  if p_role not in ('student', 'organiser') then raise exception 'bad_role'; end if;
  update public.profiles set role = p_role
   where email = lower(trim(p_email)) and id <> auth.uid();
  if not found then raise exception 'user_not_found'; end if;
end $$;

revoke execute on function public.create_order(uuid, uuid, text), public.review_payment(uuid, boolean, text),
  public.check_in(text, uuid), public.organiser_event_stats(), public.event_attendees(uuid),
  public.pending_payments(uuid), public.list_users(text), public.set_user_role(text, text), public.order_email_data(uuid) from public, anon;
grant execute on function public.create_order(uuid, uuid, text), public.review_payment(uuid, boolean, text),
  public.check_in(text, uuid), public.organiser_event_stats(), public.event_attendees(uuid),
  public.pending_payments(uuid), public.list_users(text), public.set_user_role(text, text), public.order_email_data(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 6. File storage
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-screenshots', 'payment-screenshots', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('posters', 'posters', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Screenshots live at <student id>/<order id>.<ext>. Students can add and read only their own.
drop policy if exists "students upload own screenshots" on storage.objects;
create policy "students upload own screenshots" on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "students read own screenshots" on storage.objects;
create policy "students read own screenshots" on storage.objects for select to authenticated
  using (bucket_id = 'payment-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);
-- An organiser can read only the screenshots paid for their own events.
drop policy if exists "organisers read their events' screenshots" on storage.objects;
create policy "organisers read their events' screenshots" on storage.objects for select to authenticated
  using (bucket_id = 'payment-screenshots' and exists (
    select 1 from public.orders o join public.events e on e.id = o.event_id
    where o.screenshot_path = storage.objects.name and e.organiser_id = auth.uid()));
drop policy if exists "organisers upload posters" on storage.objects;
create policy "organisers upload posters" on storage.objects for insert to authenticated
  with check (bucket_id = 'posters' and (storage.foldername(name))[1] = auth.uid()::text and public.is_organiser());

-- ---------------------------------------------------------------------
-- 7. Roles. Everyone who signs up is a student. There is one staff role: organiser.
--    The FIRST organiser is made by hand (after they have signed up). Organisers then add other
--    organisers from the Team page in the app, so no more SQL is needed.
-- ---------------------------------------------------------------------
-- update public.profiles set role = 'organiser' where email = 'name_ug2026@ashoka.edu.in';
