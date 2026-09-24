-- ============================================================================
-- BizFlow migration 0010 — Business Website linking
-- Adds an optional external website URL to the business profile.
-- Nullable: existing businesses are unaffected, and RLS already scopes the
-- whole `businesses` table to its owner, so no policy changes are needed.
-- Safe to re-run (IF NOT EXISTS / guarded constraint).
-- ============================================================================

alter table public.businesses
  add column if not exists website_url text;

comment on column public.businesses.website_url is
  'Optional external business website URL (http/https). Null = not connected.';

-- Light database-side guard mirroring the app's URL validation.
-- App-side normalization always stores a full http(s) URL.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'businesses_website_url_format'
  ) then
    alter table public.businesses
      add constraint businesses_website_url_format
      check (website_url is null or website_url ~* '^https?://\S+\.\S+');
  end if;
end $$;
