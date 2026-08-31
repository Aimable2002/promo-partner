import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { Pause, Play, XCircle } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { PnL, Stat, StatusDot } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError, endpoints, type PayoutBody } from "@/lib/api";
import { fetchActiveSubscription } from "@/lib/supabase";
import { useLiveAccountState, useMastersDirectory, useMyAccounts } from "@/hooks/use-copydesk";
import { computeStats, dealSide, closedDeals } from "@/lib/trades";
import { fmtDate, fmtMoney, fmtTime } from "@/lib/format";

export const Route = createFileRoute("/accounts/$accountId")({
  head: () => ({
    meta: [
      { title: "Account controls | CopyDesk" },
      {
        name: "description",
        content:
          "Manage this account: pause or close copying, review performance, billing and trade activity.",
      },
    ],
  }),
  component: AccountDetails,
});

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function AccountDetails() {
  const { accountId } = useParams({ from: "/accounts/$accountId" });
  const queryClient = useQueryClient();
  const { data: accounts = [], isLoading: accountsLoading } = useMyAccounts();
  const account = accounts.find((a) => a.account_id === accountId) ?? null;
  const isMaster = account?.role === "master";

  const liveState = useLiveAccountState(accountId ? [accountId] : []);
  const live = liveState[accountId] ?? null;
  const balance = live?.balance ?? 0;
  const equity = live?.equity ?? 0;
  const positions = live?.open_positions ?? [];
  const openPnl = positions.reduce((s, p) => s + num(p.pnl), 0);

  const [busy, setBusy] = useState(false);

  const tradesQuery = useQuery({
    queryKey: ["account-trades", accountId],
    queryFn: () => endpoints.accountTrades(accountId),
    enabled: !!accountId,
  });
  const trades = tradesQuery.data ?? [];
  const stats = computeStats(trades, balance);
  const closed = closedDeals(trades).slice(-18).reverse();

  const subscriptionQuery = useQuery({
    queryKey: ["active-subscription", accountId],
    queryFn: () => fetchActiveSubscription(accountId),
    enabled: !!accountId && !isMaster,
  });
  const subscription = subscriptionQuery.data ?? null;

  const mastersDirectory = useMastersDirectory();
  const currentMaster = mastersDirectory.data?.find(
    (m) => m.account_id === subscription?.master_account_id,
  );

  const [switchOpen, setSwitchOpen] = useState(false);
  const [switchTarget, setSwitchTarget] = useState<string>("");

  const billingQuery = useQuery({
    queryKey: ["billing", accountId],
    queryFn: () => endpoints.billing(accountId),
    enabled: !!accountId && !isMaster,
  });

  const profileState = useState({ display_name: "", bio: "", country: "" });
  const [profile, setProfile] = profileState;

  const earningsQuery = useQuery({
    queryKey: ["master-earnings", accountId],
    queryFn: () => endpoints.masterEarnings(accountId),
    enabled: !!accountId && isMaster,
  });
  const payoutsQuery = useQuery({
    queryKey: ["master-payouts", accountId],
    queryFn: () => endpoints.masterPayouts(accountId),
    enabled: !!accountId && isMaster,
  });
  const followersQuery = useQuery({
    queryKey: ["master-followers", accountId],
    queryFn: () => endpoints.masterFollowers(accountId),
    enabled: !!accountId && isMaster,
  });

  const [payoutForm, setPayoutForm] = useState<PayoutBody>({
    amount: 0,
    recipient_name: "",
    recipient_phone: "",
    payout_method: "mobile_money",
    payout_account_number: "",
  });

  const refetchAccounts = () => queryClient.invalidateQueries({ queryKey: ["accounts"] });

  const pause = async () => {
    if (!accountId) return;
    setBusy(true);
    try {
      await endpoints.pauseAccount(accountId);
      toast.success("Copying paused — open positions untouched");
      refetchAccounts();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not pause account");
    } finally {
      setBusy(false);
    }
  };
  const resume = async () => {
    if (!accountId) return;
    setBusy(true);
    try {
      await endpoints.resumeAccount(accountId);
      toast.success("Copying resumed");
      refetchAccounts();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not resume account");
    } finally {
      setBusy(false);
    }
  };
  const close = async () => {
    if (!accountId) return;
    setBusy(true);
    try {
      await endpoints.closeAccount(accountId);
      toast.error("Account closed — all positions flattened");
      refetchAccounts();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not close account");
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = async () => {
    if (!accountId) return;
    try {
      await endpoints.updateMasterProfile(accountId, {
        display_name: profile.display_name,
        bio: profile.bio,
        country: profile.country || null,
      });
      toast.success("Profile saved");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not save profile");
    }
  };

  const submitPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId) return;
    try {
      await endpoints.requestPayout(accountId, payoutForm);
      toast.success("Payout request submitted — settled manually by admin");
      queryClient.invalidateQueries({ queryKey: ["master-payouts", accountId] });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not submit payout request");
    }
  };

  const doSwitch = async () => {
    if (!accountId || !switchTarget) return;
    try {
      await endpoints.switchMaster(accountId, switchTarget);
      toast.success("Master switched");
      queryClient.invalidateQueries({ queryKey: ["active-subscription", accountId] });
      setSwitchOpen(false);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not switch master");
    }
  };

  if (accountsLoading) {
    return (
      <AppShell title="Account" subtitle="Loading…">
        <div className="panel p-6 text-sm text-muted-foreground">Loading…</div>
      </AppShell>
    );
  }

  if (!account) {
    return (
      <AppShell title="Account not found" subtitle="">
        <div className="panel p-6 text-sm text-muted-foreground">
          This account doesn't exist or isn't yours.
        </div>
      </AppShell>
    );
  }

  const status = account.status ?? "unknown";

  return (
    <AppShell
      title={account.mt_login ? `Account #${account.mt_login}` : "Account"}
      subtitle={`${account.platform ?? "—"} · ${account.broker ?? "—"} · #${account.mt_login ?? "—"} · opened ${fmtDate(account.created_at)}`}
      actions={
        <div className="flex items-center gap-2">
          {status === "live" ? (
            <Button size="sm" variant="outline" onClick={pause} disabled={busy}>
              <Pause className="mr-1 h-4 w-4" /> Pause
            </Button>
          ) : (
            <Button size="sm" onClick={resume} disabled={busy || status === "closed"}>
              <Play className="mr-1 h-4 w-4" /> Resume
            </Button>
          )}
          <Button size="sm" variant="ghost" className="text-destructive" onClick={close} disabled={busy}>
            <XCircle className="mr-1 h-4 w-4" /> Close
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Balance" value={fmtMoney(balance)} />
        <Stat label="Equity" value={fmtMoney(equity)} />
        <Stat label="Open P&L" value={<PnL value={openPnl} className="text-2xl" />} />
        <div className="panel p-4">
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Status</div>
          <div className="mt-3">
            <StatusDot status={status} />
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            {!isMaster && currentMaster ? (
              <>
                Copying{" "}
                <Link
                  to="/masters/$masterId"
                  params={{ masterId: currentMaster.account_id }}
                  className="text-primary hover:underline"
                >
                  {currentMaster.display_name ?? "Master"}
                </Link>{" "}
                · {subscription?.sizing_mode} {subscription?.sizing_value ?? ""}
              </>
            ) : !isMaster ? (
              "Not currently copying a master"
            ) : (
              "Publishing signals to followers"
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="mt-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">{isMaster ? "Performance" : "Overview"}</TabsTrigger>
          {isMaster && <TabsTrigger value="profile">Public profile</TabsTrigger>}
          {isMaster && <TabsTrigger value="earnings">Earnings</TabsTrigger>}
          {isMaster && <TabsTrigger value="payouts">Payouts</TabsTrigger>}
          {isMaster && <TabsTrigger value="copiers">Copiers</TabsTrigger>}
          {!isMaster && <TabsTrigger value="subscription">Subscription</TabsTrigger>}
          <TabsTrigger value="log">Trade log</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-5">
          <div className="panel p-5">
            <h3 className="font-display font-semibold">Equity vs balance</h3>
            <div className="mt-5 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.curve}>
                  <defs>
                    <linearGradient id="ac" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="t" tick={ax} tickLine={false} axisLine={false} minTickGap={40} />
                  <YAxis tick={ax} tickLine={false} axisLine={false} width={58} />
                  <Tooltip contentStyle={tt} />
                  <Area type="monotone" dataKey="equity" stroke="var(--brand)" strokeWidth={2} fill="url(#ac)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          {!isMaster && (
            <div className="panel mt-6 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-display font-semibold">Current master</h3>
                <Button size="sm" variant="outline" onClick={() => setSwitchOpen((o) => !o)}>
                  Switch master
                </Button>
              </div>
              {switchOpen && (
                <div className="mt-4 flex flex-wrap items-end gap-3">
                  <div className="min-w-56 space-y-1.5">
                    <Label>New master</Label>
                    <Select value={switchTarget} onValueChange={setSwitchTarget}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a master" />
                      </SelectTrigger>
                      <SelectContent>
                        {(mastersDirectory.data ?? [])
                          .filter((m) => m.account_id !== subscription?.master_account_id)
                          .map((m) => (
                            <SelectItem key={m.account_id} value={m.account_id}>
                              {m.display_name ?? m.account_id.slice(0, 8)}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button size="sm" onClick={doSwitch} disabled={!switchTarget}>
                    Confirm switch
                  </Button>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {isMaster && (
          <TabsContent value="profile" className="mt-5">
            <div className="panel max-w-2xl p-6">
              <h3 className="font-display font-semibold">Editable public profile</h3>
              <div className="mt-5 grid gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="dn">Display name</Label>
                  <Input
                    id="dn"
                    value={profile.display_name}
                    onChange={(e) => setProfile((p) => ({ ...p, display_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bio2">Bio</Label>
                  <Textarea
                    id="bio2"
                    rows={4}
                    value={profile.bio}
                    onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="co">Country</Label>
                  <Input
                    id="co"
                    value={profile.country}
                    onChange={(e) => setProfile((p) => ({ ...p, country: e.target.value }))}
                  />
                </div>
                <Button className="w-fit" onClick={saveProfile}>
                  Save profile
                </Button>
              </div>
            </div>
          </TabsContent>
        )}

        {isMaster && (
          <TabsContent value="earnings" className="mt-5">
            {earningsQuery.isLoading ? (
              <div className="panel p-6 text-sm text-muted-foreground">Loading…</div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Earnings here are challenge rewards only — there is no performance-fee income.
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <Stat
                    label="Rewards this month"
                    value={fmtMoney(num((earningsQuery.data as Record<string, unknown> | undefined)?.this_month))}
                    accent
                  />
                  <Stat
                    label="Lifetime rewards"
                    value={fmtMoney(num((earningsQuery.data as Record<string, unknown> | undefined)?.lifetime ?? (earningsQuery.data as Record<string, unknown> | undefined)?.total))}
                  />
                  <Stat
                    label="Followers"
                    value={(followersQuery.data ?? []).length.toString()}
                  />
                </div>
              </>
            )}
          </TabsContent>
        )}

        {isMaster && (
          <TabsContent value="payouts" className="mt-5">
            <div className="panel overflow-hidden">
              <div className="p-5">
                <h3 className="font-display font-semibold">Request a payout</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Informational only — payouts are settled manually by an admin, there is no instant
                  transfer.
                </p>
                <form onSubmit={submitPayout} className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="amt">Amount</Label>
                    <Input
                      id="amt"
                      className="num"
                      type="number"
                      value={payoutForm.amount || ""}
                      onChange={(e) => setPayoutForm((p) => ({ ...p, amount: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rn">Recipient name</Label>
                    <Input
                      id="rn"
                      value={payoutForm.recipient_name}
                      onChange={(e) => setPayoutForm((p) => ({ ...p, recipient_name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rp">Recipient phone</Label>
                    <Input
                      id="rp"
                      value={payoutForm.recipient_phone}
                      onChange={(e) => setPayoutForm((p) => ({ ...p, recipient_phone: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Payout method</Label>
                    <Select
                      value={payoutForm.payout_method}
                      onValueChange={(v) =>
                        setPayoutForm((p) => ({ ...p, payout_method: v as PayoutBody["payout_method"] }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mobile_money">Mobile money</SelectItem>
                        <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                        <SelectItem value="crypto">Crypto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="pan">
                      {payoutForm.payout_method === "mobile_money"
                        ? "Phone number"
                        : payoutForm.payout_method === "bank_transfer"
                          ? "Bank account number"
                          : "Wallet address"}
                    </Label>
                    <Input
                      id="pan"
                      value={payoutForm.payout_account_number}
                      onChange={(e) => setPayoutForm((p) => ({ ...p, payout_account_number: e.target.value }))}
                    />
                  </div>
                  <Button type="submit" className="sm:col-span-2 w-fit">
                    Request payout
                  </Button>
                </form>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(payoutsQuery.data ?? []).map((p, i) => (
                    <TableRow key={String(p.id ?? i)}>
                      <TableCell className="num text-xs">{String(p.id ?? i)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{String(p.payout_method ?? "—")}</TableCell>
                      <TableCell className="num text-xs text-muted-foreground">
                        {fmtDate(p.created_at as string | undefined)}
                      </TableCell>
                      <TableCell className="num text-right">{fmtMoney(num(p.amount))}</TableCell>
                      <TableCell className="text-right">
                        <StatusDot status={String(p.status ?? "pending")} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        )}

        {isMaster && (
          <TabsContent value="copiers" className="mt-5">
            <div className="panel overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Copier</TableHead>
                    <TableHead>Broker</TableHead>
                    <TableHead>Sizing</TableHead>
                    <TableHead>Since</TableHead>
                    <TableHead className="text-right">Equity</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(followersQuery.data ?? []).map((c) => (
                    <TableRow key={c.follower_account_id}>
                      <TableCell className="num text-xs">{c.follower_account_id.slice(0, 8)}</TableCell>
                      <TableCell>{c.broker ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {c.sizing_mode ?? "—"} {c.sizing_value ?? ""}
                      </TableCell>
                      <TableCell className="num text-xs text-muted-foreground">{fmtDate(c.since)}</TableCell>
                      <TableCell className="num text-right">{fmtMoney(c.equity ?? 0)}</TableCell>
                      <TableCell className="text-right">
                        <StatusDot status={c.status ?? "unknown"} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        )}

        {!isMaster && (
          <TabsContent value="subscription" className="mt-5">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="panel p-6">
                <h3 className="font-display font-semibold">Subscription</h3>
                <div className="mt-4 text-2xl font-semibold">
                  {String(
                    (billingQuery.data as Record<string, unknown> | undefined)?.["package_code"] ??
                      "No plan",
                  )}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Copying stays enabled while this account has an active subscription. Nothing is
                  ever debited from your broker account.
                </p>
                <div className="mt-5 flex gap-2">
                  <Button asChild>
                    <Link to="/billing">Manage subscription</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link to="/checkout" search={{ purpose: "package" as const }}>
                      Pay or redeem promo
                    </Link>
                  </Button>
                </div>
              </div>
              <div className="panel p-6">
                <h3 className="font-display font-semibold">Plans</h3>
                <p className="mt-4 text-sm text-muted-foreground">
                  Compare packages and switch plans on the Plans &amp; billing page.
                </p>
              </div>
            </div>
          </TabsContent>
        )}

        <TabsContent value="log" className="mt-5">
          <div className="panel overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead className="text-right">Lots</TableHead>
                  <TableHead>Opened</TableHead>
                  <TableHead>Closed</TableHead>
                  <TableHead className="text-right">P&L</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {closed.map((t) => (
                  <TableRow key={String(t.deal_ticket)}>
                    <TableCell className="num text-xs text-muted-foreground">{t.deal_ticket}</TableCell>
                    <TableCell className="num font-medium">{t.symbol}</TableCell>
                    <TableCell className={dealSide(t) === "BUY" ? "text-long" : "text-short"}>
                      {dealSide(t)}
                    </TableCell>
                    <TableCell className="num text-right">{(t.lots ?? 0).toFixed(2)}</TableCell>
                    <TableCell className="num text-xs text-muted-foreground">{fmtTime(t.deal_time)}</TableCell>
                    <TableCell className="num text-xs text-muted-foreground">—</TableCell>
                    <TableCell className="text-right">
                      <PnL value={num(t.pnl)} className="text-sm" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

const ax = { fontSize: 11, fill: "var(--muted-foreground)" } as const;
const tt = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
} as const;
