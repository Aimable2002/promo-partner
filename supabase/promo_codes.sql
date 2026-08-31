-- ============================================================================
-- Promo codes for subscriptions (single use)
-- Run this once in the Supabase SQL editor of the CopyDesk project.
-- ============================================================================

create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_percent int not null default 100 check (discount_percent between 1 and 100),
  package_code text,                       -- null = valid for any plan
  note text,
  expires_at timestamptz,
  is_active boolean not null default true,
  -- single-use bookkeeping
  redeemed_by uuid references auth.users (id) on delete set null,
  redeemed_account_id uuid,
  redeemed_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists promo_codes_code_idx on public.promo_codes (code);

grant select, insert, update, delete on public.promo_codes to authenticated;
grant all on public.promo_codes to service_role;

alter table public.promo_codes enable row level security;

-- Admin flag lives in the JWT's app_metadata (same trust model the FastAPI
-- /admin/* routes use). Only admins can read/manage the table directly;
-- ordinary users touch promo codes exclusively through the two functions below.
create or replace function public.is_admin_jwt()
returns boolean
language sql
stable
as $$
  select coalesce(
    ((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean),
    false
  )
$$;

drop policy if exists "admins manage promo codes" on public.promo_codes;
create policy "admins manage promo codes"
on public.promo_codes
for all
to authenticated
using (public.is_admin_jwt())
with check (public.is_admin_jwt());

-- ---------------------------------------------------------------- validate
-- Read-only check for the checkout screen. Never exposes other codes.
create or replace function public.validate_promo_code(_code text, _package_code text default null)
returns table (valid boolean, reason text, discount_percent int, package_code text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r public.promo_codes;
begin
  select * into r from public.promo_codes where upper(code) = upper(trim(_code));

  if not found then
    return query select false, 'Promo code not found', 0, null::text; return;
  end if;
  if not r.is_active then
    return query select false, 'This promo code is no longer active', 0, r.package_code; return;
  end if;
  if r.redeemed_at is not null then
    return query select false, 'This promo code has already been used', 0, r.package_code; return;
  end if;
  if r.expires_at is not null and r.expires_at < now() then
    return query select false, 'This promo code has expired', 0, r.package_code; return;
  end if;
  if r.package_code is not null and _package_code is not null
     and upper(r.package_code) <> upper(_package_code) then
    return query select false, 'This promo code is for a different plan', 0, r.package_code; return;
  end if;

  return query select true, 'Valid', r.discount_percent, r.package_code;
end;
$$;

-- ------------------------------------------------------------------ redeem
-- Atomically claims the code for the caller. A second attempt updates zero
-- rows, so a code can only ever be used once.
create or replace function public.redeem_promo_code(
  _code text,
  _account_id uuid default null,
  _package_code text default null
)
returns table (valid boolean, reason text, discount_percent int, package_code text)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  r public.promo_codes;
  v record;
begin
  if auth.uid() is null then
    return query select false, 'You must be signed in', 0, null::text; return;
  end if;

  select * into v from public.validate_promo_code(_code, _package_code);
  if not v.valid then
    return query select false, v.reason, 0, v.package_code; return;
  end if;

  update public.promo_codes
     set redeemed_by = auth.uid(),
         redeemed_account_id = _account_id,
         redeemed_at = now(),
         is_active = false
   where upper(code) = upper(trim(_code))
     and redeemed_at is null
     and is_active
  returning * into r;

  if not found then
    return query select false, 'This promo code has already been used', 0, null::text; return;
  end if;

  return query select true, 'Redeemed', r.discount_percent, r.package_code;
end;
$$;

revoke all on function public.validate_promo_code(text, text) from public;
revoke all on function public.redeem_promo_code(text, uuid, text) from public;
grant execute on function public.validate_promo_code(text, text) to authenticated, anon;
grant execute on function public.redeem_promo_code(text, uuid, text) to authenticated;
