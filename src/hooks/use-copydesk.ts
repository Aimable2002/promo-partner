import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueries } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import {
  supabase,
  fetchMyAccounts,
  fetchActivePackages,
  fetchActiveSubscription,
  fetchActiveBillingPeriod,
  type AccountRow,
  type LiveAccountStateRow,
  type SubscriptionRow,
  type BillingPeriodRow,
} from "@/lib/supabase";
import { endpoints, type DirectoryMaster, type Deal } from "@/lib/api";
import { closedDeals, computeStats, type TradeStats } from "@/lib/trades";

/* ------------------------------------------------------------ session */

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoading(false);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, loading };
}

/** Redirects to /auth when there is no active session. */
export function useRequireAuth() {
  const { session, loading } = useSession();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);
  return { session, loading };
}

/** True once we know the signed-in user's `app_metadata.is_admin` flag.
 * That flag can only be set server-side (Supabase dashboard or the admin
 * API with the service-role key) - a signed-in user has no way to grant
 * it to themselves - matching the same trust assumption
 * admin_routes.py's `_authenticate_admin` relies on for every /admin/*
 * backend call. This is a UI convenience only (hide the link, bounce the
 * page); it is NOT what makes /admin/* safe - the backend check is. */
export function useIsAdmin() {
  const { session, loading } = useSession();
  const isAdmin = Boolean(
    (session?.user?.app_metadata as Record<string, unknown> | undefined)?.["is_admin"],
  );
  return { isAdmin, loading };
}

/** Redirects away from admin-only routes for anyone without the
 * `is_admin` app_metadata flag - same idea as useRequireAuth, but also
 * checks the admin flag once the session is known. */
export function useRequireAdmin() {
  const { session, loading: sessionLoading } = useSession();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const navigate = useNavigate();
  const loading = sessionLoading || adminLoading;
  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/auth" });
    else if (!isAdmin) navigate({ to: "/dashboard" });
  }, [loading, session, isAdmin, navigate]);
  return { session, isAdmin, loading };
}

/* ----------------------------------------------------------- accounts */

export function useMyAccounts() {
  const { session, loading } = useSession();
  return useQuery({
    queryKey: ["accounts", session?.user?.id ?? null],
    queryFn: fetchMyAccounts,
    enabled: !loading && !!session,
  });
}

const STORE_KEY = "copydesk.activeAccount";

/** The account currently in focus across app screens. */
export function useActiveAccount(filter?: (a: AccountRow) => boolean) {
  const { data: accounts = [], isLoading } = useMyAccounts();
  const pool = useMemo(() => (filter ? accounts.filter(filter) : accounts), [accounts, filter]);
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    if (!pool.length) return;
    const stored = typeof window === "undefined" ? null : window.localStorage.getItem(STORE_KEY);
    const valid = pool.find((a) => a.account_id === (id ?? stored));
    if (!valid) setId(pool[0]!.account_id);
    else if (!id) setId(valid.account_id);
  }, [pool, id]);

  const select = (next: string) => {
    setId(next);
    if (typeof window !== "undefined") window.localStorage.setItem(STORE_KEY, next);
  };

  return {
    accounts: pool,
    allAccounts: accounts,
    accountId: id,
    account: pool.find((a) => a.account_id === id) ?? null,
    select,
    isLoading,
  };
}

/* --------------------------------------------------- live account state */

export function useLiveAccountState(accountIds: string[]) {
  const key = accountIds.slice().sort().join(",");
  const [rows, setRows] = useState<Record<string, LiveAccountStateRow>>({});

  useEffect(() => {
    const ids = key ? key.split(",") : [];
    if (!ids.length) {
      setRows({});
      return;
    }
    let active = true;

    supabase
      .from("live_account_state")
      .select("*")
      .in("account_id", ids)
      .then(({ data }) => {
        if (!active || !data) return;
        const next: Record<string, LiveAccountStateRow> = {};
        for (const r of data as LiveAccountStateRow[]) next[r.account_id] = r;
        setRows(next);
      });

    const channel = supabase
      .channel(`live_state_${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_account_state" },
        (payload) => {
          const row = payload.new as LiveAccountStateRow | null;
          if (!row?.account_id || !ids.includes(row.account_id)) return;
          setRows((prev) => ({ ...prev, [row.account_id]: row }));
        },
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [key]);

  return rows;
}

/** now - updated_at, in ms (data freshness indicator). */
export function freshnessMs(updatedAt: string | null | undefined) {
  if (!updatedAt) return null;
  const t = new Date(updatedAt).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Date.now() - t);
}

/* ------------------------------------------------------------- shared */

export function useMastersDirectory() {
  return useQuery({
    queryKey: ["masters-directory"],
    queryFn: (): Promise<DirectoryMaster[]> => endpoints.mastersDirectory(),
    staleTime: 60_000,
  });
}

/** Real relay latency (from /platform/stats' avg_relay_latency_seconds_30d),
 * not "time since this account's live_account_state row last updated" -
 * that old proxy measured how stale the polling loop was, not how long a
 * copy actually takes to relay. Public endpoint, works logged-out too. */
export function usePlatformStats() {
  return useQuery({
    queryKey: ["platform-stats"],
    queryFn: endpoints.platformStats,
    staleTime: 60_000,
  });
}

export function useMasterTrades(accountId: string | null | undefined) {
  return useQuery({
    queryKey: ["master-trades", accountId],
    queryFn: () => endpoints.masterTrades(accountId!),
    enabled: !!accountId,
    staleTime: 60_000,
  });
}

export function useAccountTrades(accountId: string | null | undefined) {
  return useQuery({
    queryKey: ["account-trades", accountId],
    queryFn: () => endpoints.accountTrades(accountId!),
    enabled: !!accountId,
  });
}

export function usePackages() {
  return useQuery({ queryKey: ["packages"], queryFn: fetchActivePackages, staleTime: 300_000 });
}

/** The signed-in user's current subscription period (per-user, not per
 *  trading account). Null if they've never subscribed / are between plans. */
export function useActiveBillingPeriod() {
  const { session, loading } = useSession();
  return useQuery({
    queryKey: ["billing-period", session?.user?.id ?? null],
    queryFn: fetchActiveBillingPeriod,
    enabled: !loading && !!session,
  });
}

/** How many more FOLLOWER trading accounts the signed-in user is allowed to
 *  provision right now. Master accounts are exempt from subscriptions and
 *  never count against or are limited by this. A user with no active
 *  billing period has a limit of 0 -- they must subscribe before their
 *  first follower account. */
export function useFollowerAccountLimit() {
  const { accounts, isLoading: accountsLoading } = useActiveAccount();
  const { data: billingPeriod, isLoading: billingLoading } = useActiveBillingPeriod();

  const followerCount = accounts.filter((a) => a.role === "follower").length;
  const limit = billingPeriod?.max_trading_accounts ?? 0;
  const remaining = Math.max(0, limit - followerCount);

  return {
    followerCount,
    limit,
    remaining,
    atLimit: remaining <= 0,
    billingPeriod,
    isLoading: accountsLoading || billingLoading,
  };
}

/* ------------------------------------------------------- subscriptions */

export function useAccountSubscriptions(accountIds: string[]) {
  const key = accountIds.slice().sort().join(",");
  return useQuery({
    queryKey: ["account-subscriptions", key],
    queryFn: async () => {
      const ids = key ? key.split(",") : [];
      const entries = await Promise.all(
        ids.map(async (id) => [id, await fetchActiveSubscription(id)] as const),
      );
      return Object.fromEntries(entries) as Record<string, SubscriptionRow | null>;
    },
    enabled: !!key,
  });
}

/* --------------------------------------------------- master perf stats */

export function useMastersStats(accountIds: string[]) {
  const ids = useMemo(() => accountIds.slice(), [accountIds.join(",")]);
  const queries = useQueries({
    queries: ids.map((id) => ({
      queryKey: ["master-trades", id],
      queryFn: (): Promise<Deal[]> => endpoints.masterTrades(id),
      staleTime: 60_000,
    })),
  });
  // Public masters' live_account_state rows are now readable (RLS opened
  // up for is_public masters) - use the real current balance to back out
  // a startingBalance instead of assuming every master started at 0.
  const live = useLiveAccountState(ids);

  return useMemo(() => {
    const map = new Map<
      string,
      { stats: TradeStats | null; trades: Deal[]; isLoading: boolean; isError: boolean }
    >();
    ids.forEach((id, i) => {
      const q = queries[i];
      const trades = q?.data ?? [];
      const currentBalance = live[id]?.balance;
      let startingBalance = 0;
      if (currentBalance != null) {
        const realizedNet = closedDeals(trades).reduce((s, d) => s + (Number(d.pnl) || 0), 0);
        startingBalance = currentBalance - realizedNet;
      }
      map.set(id, {
        stats: q?.data ? computeStats(q.data, startingBalance) : null,
        trades,
        isLoading: q?.isLoading ?? false,
        isError: q?.isError ?? false,
      });
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, queries.map((q) => q.dataUpdatedAt).join(","), live]);
}

export function useMasterFollowers(accountId: string | null | undefined) {
  return useQuery({
    queryKey: ["master-followers", accountId],
    queryFn: () => endpoints.masterFollowers(accountId!),
    enabled: !!accountId,
  });
}
