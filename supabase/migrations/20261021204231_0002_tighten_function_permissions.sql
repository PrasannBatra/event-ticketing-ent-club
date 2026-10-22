/*
# Tighten function execute permissions

## Changes
1. Revoke EXECUTE on trigger functions `enforce_ashoka_email` and `handle_new_user` from all roles — these are only called by database triggers, never via the API.
2. Revoke EXECUTE on `is_organiser` from anon — only authenticated users need it (it's used in RLS policies and by other functions).
3. The remaining SECURITY DEFINER functions (create_order, review_payments, check_in, etc.) are intentionally callable by authenticated users — each has internal authorization checks (auth.uid(), ownership, role verification).
4. The public_events view runs as its owner by default, which is intentional — it exposes only non-sensitive event data (no capacity counts, no ticket tokens) to the public.
*/

revoke execute on function public.enforce_ashoka_email() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.is_organiser() from public, anon;
grant execute on function public.is_organiser() to authenticated;