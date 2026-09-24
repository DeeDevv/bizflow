-- ============================================================================
-- BizFlow migration 0011 — User-initiated account deletion
--
-- The publishable key cannot delete auth users (that requires the admin
-- API), so deletion runs inside the database: a SECURITY DEFINER function
-- that removes the caller's OWN account and business data in one atomic
-- transaction. auth.uid() comes from the request's JWT, so a caller can
-- never target another user's row — the guard is in the SQL itself.
--
-- Safe to re-run (CREATE OR REPLACE).
-- ============================================================================

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only a signed-in user can delete themselves.
  if auth.uid() is null then
    raise exception 'You must be signed in to delete your account.';
  end if;

  -- 1. Remove their business. Every business table (products, customers,
  --    invoices, invoice_items, payments, receipts) cascades from
  --    businesses via ON DELETE CASCADE, so this clears all app data
  --    belonging to the account.
  delete from public.businesses where owner_user_id = auth.uid();

  -- 2. Remove the auth account itself (identities and sessions cascade
  --    inside the auth schema).
  delete from auth.users where id = auth.uid();
end;
$$;

-- Only signed-in users may call it; anonymous callers are locked out.
revoke execute on function public.delete_my_account() from anon;
grant execute on function public.delete_my_account() to authenticated;
