import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  import.meta.env["VITE_SUPABASE_URL"] ?? "https://txdcattalsgunfolplvs.supabase.co";
const SUPABASE_KEY =
  import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ??
  "sb_publishable_53Cd7i_2CFH4tEHAp43m6w_icqeHPmJ";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: typeof window !== "undefined",
    autoRefreshToken: typeof window !== "undefined",
    storage: typeof window === "undefined" ? undefined : window.localStorage,
  },
});

/* ---------------------------------------------------------------- types */

export type AccountRole = "master" | "follower";
export type SizingMode = "proportional" | "fixed-lot" | "micro-scale" | "risk-percent";

export type AccountRow = {
  account_id: string;
  user_id: string;
  role: AccountRole;
  platform: string | null;
  broker: string | null;
  mt_login: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type SubscriptionRow = {
  id: string;
  follower_account_id: string;
  master_account_id: string;
  sizing_mode: SizingMode | null;
  sizing_value: number | null;
  active: boolean;
  created_at: string | null;
};

export type OpenPosition = {
  ticket?: number | string;
  symbol: string;
  type?: string;
  side?: string;
  lots?: number;
  volume?: number;
  price_open?: number;
  entry?: number;
  current_price?: number;
  pnl?: number;
  time?: string;
  opened_at?: string;
};

export type LiveAccountStateRow = {
  account_id: string;
  balance: number | null;
  equity: number | null;
  open_positions: OpenPosition[] | null;
  updated_at: string | null;
};

export type PackageRow = {
  code: string;
  duration_days: number;
  infra_fee: number;
  slot_fee_per_slot: number;
  base_roster_size: number;
  /** Max number of FOLLOWER trading accounts a subscriber on this package
   *  may provision. Has no effect on master accounts, which are exempt
   *  from subscriptions entirely. */
  max_trading_accounts: number;
  is_active: boolean;
  created_at?: string | null;
};

/** A user's billing period, keyed by user_id (not by trading account) --
 *  one active subscription per platform user, independent of how many
 *  trading accounts they own. */
export type BillingPeriodRow = {
  id: string;
  user_id: string;
  package_code: string;
  duration_days: number;
  infra_fee: number;
  slot_fee_per_slot: number;
  base_roster_size: number;
  max_trading_accounts: number;
  purchased_extra_slots: number;
  status: "active" | "grace" | "closed";
  grace_started_at: string | null;
  started_at: string;
  renews_at: string;
  created_at?: string | null;
};

export type ChallengeRow = {
  id: string;
  name: string;
  description: string | null;
  is_fixed: boolean;
  fee: number;
  profit_target_pct: number;
  max_daily_loss_pct: number;
  max_drawdown_pct: number;
  min_days: number;
  reward_amount: number | null;
  active: boolean;
  created_at?: string | null;
};

export type EnrollmentStatus = "enrolled" | "passed" | "breached" | "failed" | "left" | "reset";

export type MasterChallengeEnrollmentRow = {
  id: string;
  master_account_id: string;
  challenge_id: string;
  status: EnrollmentStatus;
  starting_equity: number | null;
  peak_equity: number | null;
  day_start_equity: number | null;
  day_start_date: string | null;
  breach_reason: string | null;
  enrolled_at: string | null;
};

export type ChallengeEquityCurveRow = {
  id: string;
  enrollment_id: string;
  snapshot_date: string;
  equity: number;
};

export type WalletTransactionRow = {
  id: string;
  account_id: string;
  amount: number;
  type: string;
  created_at: string;
};

/* ------------------------------------------------------------- helpers */

export async function getSessionUser() {
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export async function fetchMyAccounts(): Promise<AccountRow[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AccountRow[];
}

export async function fetchActiveSubscription(
  followerAccountId: string,
): Promise<SubscriptionRow | null> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("follower_account_id", followerAccountId)
    .eq("active", true)
    .maybeSingle();
  if (error) throw error;
  return (data as SubscriptionRow | null) ?? null;
}

export async function fetchActivePackages(): Promise<PackageRow[]> {
  const { data, error } = await supabase
    .from("packages")
    .select("*")
    .eq("is_active", true)
    .order("duration_days", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PackageRow[];
}

/** All packages including disabled ones -- admin package management only. */
export async function fetchAllPackages(): Promise<PackageRow[]> {
  const { data, error } = await supabase
    .from("packages")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PackageRow[];
}

export type NewPackageInput = {
  code: string;
  duration_days: number;
  infra_fee: number;
  slot_fee_per_slot: number;
  base_roster_size: number;
  max_trading_accounts: number;
};

export async function createPackage(input: NewPackageInput): Promise<PackageRow> {
  const { data, error } = await supabase
    .from("packages")
    .insert({ ...input, is_active: true })
    .select("*")
    .single();
  if (error) throw error;
  return data as PackageRow;
}

export async function updatePackage(
  code: string,
  patch: Partial<Omit<NewPackageInput, "code">>,
): Promise<void> {
  const { error } = await supabase.from("packages").update(patch).eq("code", code);
  if (error) throw error;
}

export async function setPackageActive(code: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from("packages")
    .update({ is_active: isActive })
    .eq("code", code);
  if (error) throw error;
}

/** The signed-in user's current billing period, if any. There is at most
 *  one active/grace period per user (subscriptions are per-user, not per
 *  trading account). Returns null if the user has never subscribed or is
 *  between periods. */
export async function fetchActiveBillingPeriod(): Promise<BillingPeriodRow | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase
    .from("billing_periods")
    .select("*")
    .eq("user_id", auth.user.id)
    .in("status", ["active", "grace"])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as BillingPeriodRow | null) ?? null;
}

/** Display price for a package: infra fee + baseline roster slot fees. */
export function packagePrice(p: PackageRow) {
  return Number(p.infra_fee) + Number(p.slot_fee_per_slot) * Number(p.base_roster_size);
}

export function packageName(p: PackageRow) {
  const months = Math.round(p.duration_days / 30);
  return months <= 1 ? "Monthly" : `${months}-month`;
}
