/*
# Remove student ID requirement + support Google OAuth signups

## Changes
1. Make `profiles.student_id` nullable so users who sign up via Google (without a student ID field) can still create a profile.
2. Update the `handle_new_user` trigger function to accept signups where student_id is missing or empty — it now defaults to an empty string instead of raising an exception.
3. This enables Google OAuth: when a user signs in with Google, Supabase creates an auth.users row and fires the same trigger. The profile gets name from Google's user metadata (or the email prefix as fallback) and no student_id.
4. The Ashoka email enforcement trigger stays in place — Google sign-in with a non-@ashoka.edu.in email will still be rejected at the database level.
*/

alter table public.profiles alter column student_id drop not null;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  v_name text;
  v_student_id text;
begin
  v_name := trim(coalesce(new.raw_user_meta_data->>'name', ''));
  v_student_id := trim(coalesce(new.raw_user_meta_data->>'student_id', ''));

  -- For OAuth signups (Google), name may come from provider metadata or be empty.
  -- Fall back to the part before @ in the email so the profile always has a display name.
  if length(v_name) = 0 then
    v_name := split_part(new.email, '@', 1);
  end if;

  insert into public.profiles (id, name, email, student_id)
  values (new.id, v_name, lower(new.email), nullif(v_student_id, ''));
  return new;
end $$;