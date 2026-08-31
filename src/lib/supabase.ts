import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  import.meta.env['VITE_SUPABASE_URL'] ?? "https://txdcattalsgunfolplvs.supabase.co";
const SUPABASE_KEY =
  import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] ??
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
  is_active: boolean;
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

/** Display price for a package: infra fee + baseline roster slot fees. */
export function packagePrice(p: PackageRow) {
  return Number(p.infra_fee) + Number(p.slot_fee_per_slot) * Number(p.base_roster_size);
}

export function packageName(p: PackageRow) {
  const months = Math.round(p.duration_days / 30);
  return months <= 1 ? "Monthly" : `${months}-month`;
}
