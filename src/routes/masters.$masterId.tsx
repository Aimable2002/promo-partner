import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Avatar, PnL, Stat } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtMoney, fmtTime } from "@/lib/format";
import { bySymbol, byHour, closedDeals, computeStats } from "@/lib/trades";
import {
  useMastersDirectory,
  useMasterTrades,
  useMyAccounts,
  useMasterFollowers,
  useLiveAccountState,
} from "@/hooks/use-copydesk";

export const Route = createFileRoute("/masters/$masterId")({
  head: () => ({
    meta: [
      { title: "Master track record | CopyDesk" },
      {
        name: "description",
        content: "Verified performance, drawdown and trading activity for this master account.",
      },
    ],
  }),
  component: MasterProfile,
});

const tt = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
} as const;

function MasterProfile() {
  const { masterId } = Route.useParams();
  const { data: directory = [], isLoading: directoryLoading } = useMastersDirectory();
  const { data: deals = [], isLoading: tradesLoading } = useMasterTrades(masterId);
  const { data: myAccounts = [] } = useMyAccounts();
  const liveState = useLiveAccountState(masterId ? [masterId] : []);

  const m = directory.find((x) => x.account_id === masterId);
  const isOwner = myAccounts.some((a) => a.account_id === masterId);
  const { data: followers = [] } = useMasterFollowers(isOwner ? masterId : null);

  if (directoryLoading) {
    return (
      <AppShell title="Loading…">
        <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>
      </AppShell>
    );
  }

  if (!m) {
    return (
      <AppShell title="Master not found">
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="max-w-md text-center">
            <h2 className="text-xl font-semibold text-foreground">Master not found</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This master doesn't exist or isn't public anymore.
            </p>
            <div className="mt-6">
              <Link
                to="/masters"
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Back to masters
              </Link>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  const closed = closedDeals(deals);
  const currentBalance = masterId ? liveState[masterId]?.balance : null;
  const realizedNet = closed.reduce((s, d) => s + (Number(d.pnl) || 0), 0);
  const startingBalance = currentBalance != null ? currentBalance - realizedNet : 0;
  const stats = computeStats(deals, startingBalance);
  const symbolBreakdown = bySymbol(deals);
  const hourBreakdown = byHour(deals);
  const recentTrades = closed.slice(-10).reverse();

  return (
    <AppShell
      title={m.display_name ?? m.account_id}
      subtitle={`${m.broker ?? "—"} · ${m.platform ?? "—"}`}
      actions={
        <Button size="sm" onClick={() => toast.success(`Copy setup started for ${m.display_name ?? m.account_id}`)}>
          Copy this master
        </Button>
      }
    >
      <div className="panel p-6">
        <div className="flex flex-wrap items-start gap-5">
          <Avatar name={m.display_name ?? m.account_id} size={64} />
          <div className="min-w-64 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-2xl font-bold">{m.display_name ?? m.account_id}</h2>
              <Badge variant="outline">{stats.trackRecordMonths} months verified</Badge>
              {m.country && <Badge variant="outline">{m.country}</Badge>}
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{m.bio}</p>
          </div>
        </div>
      </div>

      {tradesLoading ? (
        <div className="mt-6 p-10 text-center text-sm text-muted-foreground">Loading trade history…</div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="ROI" value={<PnL value={stats.roiPct} prefix="" suffix="%" digits={1} className="text-2xl" />} />
            <Stat label="Net P&L (all time)" value={<PnL value={stats.netPnl} digits={0} className="text-2xl" />} />
            <Stat label="Max drawdown" value={`${stats.maxDrawdownPct}%`} hint={`Risk score ${stats.riskScore}/10`} />
            <Stat label="Profit factor" value={stats.profitFactor.toFixed(2)} accent hint={`${stats.closedTrades} closed trades`} />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <div className="panel p-5 lg:col-span-2">
              <h3 className="font-display font-semibold">Equity growth</h3>
              <div className="mt-5 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.curve}>
                    <defs>
                      <linearGradient id="mp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="t" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} minTickGap={50} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={60} />
                    <Tooltip contentStyle={tt} />
                    <Area type="monotone" dataKey="equity" stroke="var(--brand)" strokeWidth={2} fill="url(#mp)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="panel p-5">
              <h3 className="font-display font-semibold">Risk profile</h3>
              <div className="mt-5 space-y-4">
                {[
                  { l: "Max drawdown", v: stats.maxDrawdownPct, max: 30, unit: "%" },
                  { l: "Win rate", v: stats.winRate, max: 100, unit: "%" },
                  { l: "Risk score", v: stats.riskScore, max: 10, unit: "/10" },
                ].map((r) => (
                  <div key={r.l}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{r.l}</span>
                      <span className="num">
                        {r.v}
                        {r.unit}
                      </span>
                    </div>
                    <Progress value={(r.v / r.max) * 100} className="mt-2 h-1.5" />
                  </div>
                ))}
              </div>
              <dl className="mt-6 space-y-2.5 border-t border-border pt-5 text-sm">
                <KV k="Average win" v={<PnL value={stats.avgWin} className="text-sm" />} />
                <KV k="Average loss" v={<PnL value={stats.avgLoss} className="text-sm" />} />
                <KV k="Track record" v={<span className="num">{stats.trackRecordMonths} months</span>} />
              </dl>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="panel p-5">
              <h3 className="font-display font-semibold">Performance by symbol</h3>
              <div className="mt-5 h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={symbolBreakdown}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="symbol" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={56} />
                    <Tooltip contentStyle={tt} cursor={{ fill: "var(--accent)" }} />
                    <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                      {symbolBreakdown.map((s) => (
                        <Cell key={s.symbol} fill={s.pnl >= 0 ? "var(--long)" : "var(--short)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="panel p-5">
              <h3 className="font-display font-semibold">Trading activity by hour (UTC)</h3>
              <div className="mt-5 h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourBreakdown}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={36} />
                    <Tooltip contentStyle={tt} cursor={{ fill: "var(--accent)" }} />
                    <Bar dataKey="trades" fill="var(--chart-2)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="panel mt-6 overflow-hidden">
            <div className="flex items-center justify-between p-5">
              <h3 className="font-display font-semibold">Recent completed trades</h3>
              <Link to="/trades" className="text-xs text-primary hover:underline">
                Full history →
              </Link>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead className="text-right">Lots</TableHead>
                  <TableHead>Closed</TableHead>
                  <TableHead className="text-right">P&L</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentTrades.map((t) => (
                  <TableRow key={String(t.deal_ticket)}>
                    <TableCell className="num font-medium">{t.symbol}</TableCell>
                    <TableCell>
                      <span className={t.type?.toLowerCase().includes("sell") ? "text-short" : "text-long"}>
                        {t.type?.toLowerCase().includes("sell") ? "SELL" : "BUY"}
                      </span>
                    </TableCell>
                    <TableCell className="num text-right">{Number(t.lots).toFixed(2)}</TableCell>
                    <TableCell className="num text-xs text-muted-foreground">{fmtTime(t.deal_time)}</TableCell>
                    <TableCell className="text-right">
                      <PnL value={Number(t.pnl) || 0} className="text-sm" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {isOwner && (
        <div className="panel mt-6 overflow-hidden">
          <div className="flex items-center justify-between p-5">
            <h3 className="font-display font-semibold">Followers</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Follower</TableHead>
                <TableHead>Broker</TableHead>
                <TableHead>Sizing</TableHead>
                <TableHead>Since</TableHead>
                <TableHead className="text-right">Equity</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {followers.map((c) => (
                <TableRow key={c.follower_account_id}>
                  <TableCell className="num text-xs">{c.follower_account_id}</TableCell>
                  <TableCell>{c.broker ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {c.sizing_mode ?? "—"} {c.sizing_value ?? ""}
                  </TableCell>
                  <TableCell className="num text-xs text-muted-foreground">
                    {c.since ? fmtTime(c.since) : "—"}
                  </TableCell>
                  <TableCell className="num text-right">{fmtMoney(c.equity ?? 0)}</TableCell>
                  <TableCell className="text-right text-xs capitalize text-muted-foreground">
                    {c.status ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
              {followers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="p-6 text-center text-sm text-muted-foreground">
                    No followers yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="mt-6">
        <h3 className="font-display font-semibold">Similar masters</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {directory
            .filter((x) => x.account_id !== m.account_id && x.platform === m.platform)
            .slice(0, 3)
            .map((x) => (
              <Link
                key={x.account_id}
                to="/masters/$masterId"
                params={{ masterId: x.account_id }}
                className="panel flex items-center gap-3 p-4 transition-colors hover:border-primary/50"
              >
                <Avatar name={x.display_name ?? x.account_id} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{x.display_name ?? x.account_id}</div>
                  <div className="truncate text-xs text-muted-foreground">{x.bio}</div>
                </div>
              </Link>
            ))}
        </div>
      </div>
    </AppShell>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}
