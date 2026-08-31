import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, ArrowUpRight } from "lucide-react";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/app-shell";
import { PnL, Stat, StatusDot } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtMoney } from "@/lib/format";
import { equityCurve, lastNDays } from "@/lib/trades";
import type { OpenPosition } from "@/lib/supabase";
import {
  useRequireAuth,
  useMyAccounts,
  useActiveAccount,
  useLiveAccountState,
  useAccountTrades,
  useAccountSubscriptions,
  useMastersDirectory,
  freshnessMs,
} from "@/hooks/use-copydesk";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — your copy-trading accounts | CopyDesk" },
      {
        name: "description",
        content:
          "Live balance, equity and status for every master and follower account you own, plus combined performance and open mirrored positions.",
      },
      { property: "og:title", content: "Dashboard — your copy-trading accounts | CopyDesk" },
      {
        property: "og:description",
        content: "Track equity, open exposure and mirrored fills across all connected accounts.",
      },
    ],
  }),
  component: Dashboard,
});

function positionSide(p: OpenPosition): "BUY" | "SELL" {
  const raw = (p.side ?? p.type ?? "").toString().toLowerCase();
  return raw.includes("sell") || raw === "1" ? "SELL" : "BUY";
}

function Dashboard() {
  useRequireAuth();
  const { data: accounts = [] } = useMyAccounts();
  const accountIds = useMemo(() => accounts.map((a) => a.account_id), [accounts]);
  const live = useLiveAccountState(accountIds);
  const { data: subsMap = {} } = useAccountSubscriptions(accountIds);
  const { data: directory = [] } = useMastersDirectory();
  const { accountId: activeAccountId } = useActiveAccount();
  const { data: activeTrades = [] } = useAccountTrades(activeAccountId);

  const masterName = (masterAccountId: string | null | undefined) =>
    masterAccountId
      ? directory.find((m) => m.account_id === masterAccountId)?.display_name ?? masterAccountId
      : null;

  const liveAccounts = accounts.filter((a) => a.status !== "closed");
  const equity = liveAccounts.reduce((s, a) => s + (live[a.account_id]?.equity ?? 0), 0);
  const balance = liveAccounts.reduce((s, a) => s + (live[a.account_id]?.balance ?? 0), 0);

  const openPositions = liveAccounts.flatMap((a) => {
    const positions = live[a.account_id]?.open_positions ?? [];
    const master = masterName(subsMap[a.account_id]?.master_account_id);
    return positions.map((p, i) => ({
      key: `${a.account_id}-${p.ticket ?? i}`,
      symbol: p.symbol,
      side: positionSide(p),
      lots: p.lots ?? p.volume ?? 0,
      entry: p.price_open ?? p.entry ?? 0,
      current: p.current_price ?? 0,
      pnl: p.pnl ?? 0,
      opened: p.time ?? p.opened_at ?? null,
      master,
    }));
  });
  const openPnl = openPositions.reduce((s, p) => s + p.pnl, 0);

  const activeAccount = accounts.find((a) => a.account_id === activeAccountId) ?? null;
  const activeLive = activeAccountId ? live[activeAccountId] : undefined;
  const realizedNet = activeTrades
    .filter((d) => d.entry === "out")
    .reduce((s, d) => s + (Number(d.pnl) || 0), 0);
  const startingBalance = (activeLive?.balance ?? 0) - realizedNet;
  const curve30 = lastNDays(equityCurve(activeTrades, startingBalance), 30);
  const chartData = curve30.map((p) => ({ t: p.t, equity: p.equity, balance: p.balance }));
  const return30d =
    curve30.length && startingBalance
      ? (((curve30[curve30.length - 1]!.balance - startingBalance) / startingBalance) * 100).toFixed(1)
      : "0.0";

  return (
    <AppShell
      title="Dashboard"
      subtitle="Sunday 16 Aug 2026 · markets open in 6h 30m"
      actions={
        <Button size="sm" asChild>
          <Link to="/onboarding">
            <Plus className="mr-1 h-4 w-4" /> Add account
          </Link>
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Combined equity" value={fmtMoney(equity)} hint={`${liveAccounts.length} live accounts`} />
        <Stat label="Combined balance" value={fmtMoney(balance)} />
        <Stat
          label="Open P&L"
          value={<PnL value={openPnl} className="text-2xl" />}
          hint={`${openPositions.length} mirrored positions`}
        />
        <Stat
          label="30-day return"
          value={`${Number(return30d) > 0 ? "+" : ""}${return30d}%`}
          accent
          hint="Active account"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="panel p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold">Combined equity curve</h2>
            <Badge variant="outline" className="text-[10px]">Last 30 days</Badge>
          </div>
          <div className="mt-5 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="t" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} minTickGap={40} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={54} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area type="monotone" dataKey="equity" stroke="var(--brand)" strokeWidth={2} fill="url(#eq)" />
                <Line type="monotone" dataKey="balance" stroke="var(--muted-foreground)" strokeWidth={1} dot={false} strokeDasharray="3 3" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel p-5">
          <h2 className="font-display font-semibold">Open mirrored positions</h2>
          <div className="mt-4 space-y-3">
            {openPositions.length === 0 && (
              <div className="text-sm text-muted-foreground">No open positions.</div>
            )}
            {openPositions.map((p) => (
              <div key={p.key} className="rounded-md border border-border bg-surface-2 p-3">
                <div className="flex items-center justify-between">
                  <span className="num text-sm font-medium">{p.symbol}</span>
                  <Badge
                    variant="outline"
                    className={p.side === "BUY" ? "border-long/40 text-long" : "border-short/40 text-short"}
                  >
                    {p.side} {p.lots}
                  </Badge>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="num">
                    {p.entry} → {p.current}
                  </span>
                  <PnL value={p.pnl} className="text-xs" />
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {p.master ?? "—"} · {p.opened ?? "—"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold">Your accounts</h2>
          <Link to="/trades" className="text-xs text-primary hover:underline">
            View trade history →
          </Link>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {accounts.map((a) => {
            const sub = subsMap[a.account_id];
            const m = masterName(sub?.master_account_id);
            const l = live[a.account_id];
            const openPnlForAccount = (l?.open_positions ?? []).reduce(
              (s, p) => s + (p.pnl ?? 0),
              0,
            );
            const provisioning = a.status !== "live";
            return (
              <Link
                key={a.account_id}
                to="/accounts/$accountId"
                params={{ accountId: a.account_id }}
                className="panel block p-5 transition-colors hover:border-primary/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{a.mt_login ?? a.account_id}</span>
                      <Badge variant="outline" className="shrink-0 text-[10px] capitalize">
                        {a.role}
                      </Badge>
                    </div>
                    <div className="num mt-1 text-xs text-muted-foreground">
                      {a.platform} · {a.broker} · #{a.mt_login}
                    </div>
                  </div>
                  <StatusDot status={a.status ?? "pending"} />
                </div>

                {provisioning ? (
                  <div className="mt-5 rounded-md border border-dashed border-border bg-surface-2 p-3 text-xs text-muted-foreground">
                    This account is still being provisioned — balance and equity will appear once it's live.
                  </div>
                ) : (
                  <div className="mt-5 grid grid-cols-3 gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Balance</div>
                      <div className="num text-sm font-medium">{fmtMoney(l?.balance ?? 0)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Equity</div>
                      <div className="num text-sm font-medium">{fmtMoney(l?.equity ?? 0)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Open P&L</div>
                      <PnL value={openPnlForAccount} className="text-sm" />
                    </div>
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                  <span>
                    {m ? `Copying ${m} · ${sub?.sizing_mode ?? ""}` : "Publishing signals"}
                  </span>
                  <span className="flex items-center gap-2">
                    {l?.updated_at && (
                      <span>{Math.round((freshnessMs(l.updated_at) ?? 0) / 1000)}s ago</span>
                    )}
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            );
          })}

          <Link
            to="/onboarding"
            className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <Plus className="mr-2 h-4 w-4" /> Connect another MT5 or cTrader account
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
