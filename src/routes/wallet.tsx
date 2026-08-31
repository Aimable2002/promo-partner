import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RotateCcw, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Stat, StatusDot } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { endpoints, ApiError } from "@/lib/api";
import { packagePrice, packageName, type PackageRow } from "@/lib/supabase";
import { fmtDate, fmtMoney } from "@/lib/format";
import { useActiveAccount, useRequireAuth, usePackages } from "@/hooks/use-copydesk";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "Wallet, plans & billing — CopyDesk" },
      {
        name: "description",
        content:
          "Top up your CopyDesk wallet, compare subscription tiers, manage or reactivate billing and review your full transaction history.",
      },
      { property: "og:title", content: "Wallet, plans & billing — CopyDesk" },
      {
        property: "og:description",
        content: "Manage your wallet balance, subscription tier and payment history.",
      },
    ],
  }),
  component: WalletPage,
});

function pickStr(o: Record<string, unknown> | undefined | null, keys: string[], fallback = "—"): string {
  if (!o) return fallback;
  for (const k of keys) {
    const v = o[k];
    if (v !== undefined && v !== null && v !== "") return String(v);
  }
  return fallback;
}

function pickNum(o: Record<string, unknown> | undefined | null, keys: string[], fallback = 0): number {
  if (!o) return fallback;
  for (const k of keys) {
    const v = o[k];
    if (v !== undefined && v !== null && v !== "" && !Number.isNaN(Number(v))) return Number(v);
  }
  return fallback;
}

function WalletPage() {
  useRequireAuth();
  const { accounts, accountId, account, select, isLoading: accountsLoading } = useActiveAccount();
  const [amount, setAmount] = useState("100");
  const queryClient = useQueryClient();

  const walletQuery = useQuery({
    queryKey: ["wallet", accountId],
    queryFn: () => endpoints.wallet(accountId!),
    enabled: !!accountId,
  });

  const txQuery = useQuery({
    queryKey: ["wallet-transactions", accountId],
    queryFn: () => endpoints.walletTransactions(accountId!),
    enabled: !!accountId,
  });

  const billingQuery = useQuery({
    queryKey: ["billing", accountId],
    queryFn: () => endpoints.billing(accountId!),
    enabled: !!accountId,
  });

  const packagesQuery = usePackages();

  const wallet = walletQuery.data;
  const billing = billingQuery.data;
  const transactions = txQuery.data ?? [];
  const packages = packagesQuery.data ?? [];

  const balance = pickNum(wallet, ["balance", "wallet_balance", "amount"]);
  const localCurrency = pickStr(wallet, ["local_currency", "currency_code"], "");
  const fxRate = pickNum(wallet, ["fx_rate", "rate_per_usd", "rate"], 0);

  const billingStatusRaw = pickStr(billing, ["status", "subscription_status"], "cancelled");
  const status: "active" | "cancelled" = billingStatusRaw.toLowerCase().includes("active")
    ? "active"
    : "cancelled";
  const currentPackageCode = pickStr(billing, ["package_code", "current_package_code"], "");
  const currentPackage = packages.find((p) => p.code === currentPackageCode);
  const renews = pickStr(billing, ["current_period_end", "renews_at", "next_billing_date"], "");

  const spendThisMonth = useMemo(() => {
    const now = new Date();
    return transactions.reduce((sum, row) => {
      const dateStr = pickStr(row, ["created_at", "date", "timestamp"], "");
      const amt = pickNum(row, ["amount", "amount_usd", "value"]);
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return sum;
      if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return sum;
      if (amt < 0) return sum + Math.abs(amt);
      return sum;
    }, 0);
  }, [transactions]);

  const selectPackage = useMutation({
    mutationFn: (code: string) => endpoints.selectPackage(accountId!, code),
    onSuccess: () => {
      toast.success("Plan updated");
      void queryClient.invalidateQueries({ queryKey: ["billing", accountId] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof ApiError ? err.message : "Could not switch plan");
    },
  });

  const reactivate = useMutation({
    mutationFn: () => endpoints.reactivateBilling(accountId!),
    onSuccess: () => {
      toast.success("Subscription reactivated");
      void queryClient.invalidateQueries({ queryKey: ["billing", accountId] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof ApiError ? err.message : "Could not reactivate subscription");
    },
  });

  return (
    <AppShell
      title="Wallet & billing"
      subtitle="Fees are debited here — never from your broker account"
      actions={
        accounts.length > 1 ? (
          <Select value={accountId ?? undefined} onValueChange={select}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.account_id} value={a.account_id}>
                  {a.mt_login ?? a.account_id.slice(0, 8)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : undefined
      }
    >
      {!accountsLoading && !account ? (
        <div className="panel p-6 text-sm text-muted-foreground">No account yet.</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Wallet balance"
              value={walletQuery.isLoading ? "Loading…" : fmtMoney(balance)}
              accent
              hint={
                fxRate > 0 && localCurrency
                  ? `≈ ${(balance * fxRate).toLocaleString("en-US", { maximumFractionDigits: 0 })} ${localCurrency}`
                  : undefined
              }
            />
            <Stat
              label="Current plan"
              value={billingQuery.isLoading ? "Loading…" : currentPackage ? packageName(currentPackage) : currentPackageCode || "None"}
              hint={currentPackage ? `${fmtMoney(packagePrice(currentPackage))}/mo` : undefined}
            />
            <Stat
              label="Next charge"
              value={billingQuery.isLoading ? "Loading…" : fmtDate(renews)}
              hint={status === "cancelled" ? "Subscription cancelled" : "Auto-renew on"}
            />
            <Stat
              label="Spend this month"
              value={txQuery.isLoading ? "Loading…" : fmtMoney(spendThisMonth)}
              hint="Copy fees + subscription"
            />
          </div>

          <Tabs defaultValue="topup" className="mt-6">
            <TabsList className="flex-wrap">
              <TabsTrigger value="topup">Top up</TabsTrigger>
              <TabsTrigger value="plans">Plans</TabsTrigger>
              <TabsTrigger value="billing">Billing</TabsTrigger>
              <TabsTrigger value="history">Transactions</TabsTrigger>
            </TabsList>

            <TabsContent value="topup" className="mt-6">
              <div className="panel max-w-xl p-6">
                <h3 className="font-display font-semibold">Add funds to your wallet</h3>
                <div className="mt-5 flex flex-wrap gap-2">
                  {["25", "50", "100", "250", "500"].map((v) => (
                    <button
                      key={v}
                      onClick={() => setAmount(v)}
                      className={cn(
                        "num rounded-md border px-4 py-2 text-sm transition-colors",
                        amount === v ? "border-primary text-primary" : "border-border text-muted-foreground",
                      )}
                    >
                      ${v}
                    </button>
                  ))}
                </div>
                <div className="mt-5 space-y-1.5">
                  <Label htmlFor="amt">Custom amount (USD)</Label>
                  <Input id="amt" className="num" value={amount} onChange={(e) => setAmount(e.target.value)} />
                  {fxRate > 0 && localCurrency && (
                    <p className="text-xs text-muted-foreground">
                      ≈ {(Number(amount || 0) * fxRate).toLocaleString("en-US", { maximumFractionDigits: 0 })}{" "}
                      {localCurrency} at today's rate of {fxRate}.
                    </p>
                  )}
                </div>
                <Button asChild className="mt-6">
                  <Link
                    to="/checkout"
                    search={{ purpose: "wallet_topup", amount_usd: Number(amount) || 0 }}
                  >
                    <Plus className="mr-1 h-4 w-4" /> Continue to payment
                  </Link>
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="plans" className="mt-6">
              {packagesQuery.isLoading ? (
                <div className="panel p-6 text-sm text-muted-foreground">Loading…</div>
              ) : packages.length === 0 ? (
                <div className="panel p-6 text-sm text-muted-foreground">No plans available.</div>
              ) : (
                <div className="grid gap-6 lg:grid-cols-3">
                  {packages.map((p: PackageRow) => {
                    const isCurrent = p.code === currentPackageCode;
                    return (
                      <div
                        key={p.code}
                        className={cn("panel flex flex-col p-6", isCurrent && "ring-1 ring-primary/60")}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-display text-lg font-semibold">{packageName(p)}</span>
                          {isCurrent && <Badge>Current</Badge>}
                        </div>
                        <div className="num mt-3 text-3xl font-bold">
                          {fmtMoney(packagePrice(p))}
                          <span className="text-sm font-normal text-muted-foreground">/mo</span>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {p.duration_days}-day billing cycle
                        </p>
                        <ul className="mt-5 flex-1 space-y-2 text-sm text-muted-foreground">
                          <li>· {p.base_roster_size} roster slots included</li>
                          <li>· {fmtMoney(Number(p.slot_fee_per_slot))} per additional slot</li>
                          <li>· {fmtMoney(Number(p.infra_fee))} infrastructure fee</li>
                        </ul>
                        <Button
                          className="mt-6"
                          variant={isCurrent ? "outline" : "default"}
                          disabled={isCurrent || selectPackage.isPending}
                          onClick={() => selectPackage.mutate(p.code)}
                        >
                          {isCurrent ? "Current plan" : `Switch to ${packageName(p)}`}
                        </Button>
                        {!isCurrent && (
                          <Button asChild variant="ghost" size="sm" className="mt-2">
                            <Link
                              to="/checkout"
                              search={{
                                purpose: "package",
                                package_code: p.code,
                                amount_usd: packagePrice(p),
                              }}
                            >
                              Pay or use a promo code
                            </Link>
                          </Button>
                        )}

                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="billing" className="mt-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="panel p-6">
                  <h3 className="font-display font-semibold">Subscription</h3>
                  <div className="mt-4 flex items-center gap-3">
                    <Badge>{currentPackage ? packageName(currentPackage) : currentPackageCode || "None"}</Badge>
                    <StatusDot status={status} />
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">
                    {status === "active"
                      ? `Your plan renews on ${fmtDate(renews)}${currentPackage ? ` for ${fmtMoney(packagePrice(currentPackage))}` : ""}.`
                      : "Your subscription is cancelled. Copying is limited until you reactivate."}
                  </p>
                  <div className="mt-6 flex gap-2">
                    {status === "cancelled" && (
                      <Button onClick={() => reactivate.mutate()} disabled={reactivate.isPending}>
                        <RotateCcw className="mr-1 h-4 w-4" /> Reactivate subscription
                      </Button>
                    )}
                  </div>
                </div>

                <div className="panel p-6">
                  <h3 className="font-display font-semibold">Payment method</h3>
                  <div className="mt-4 flex items-center gap-3 rounded-md border border-border bg-surface-2 p-4">
                    <Smartphone className="h-5 w-5 text-primary" />
                    <div>
                      <div className="num text-sm">Mobile money</div>
                      <div className="text-xs text-muted-foreground">Used for top-ups and package payments</div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="history" className="mt-6">
              <div className="panel overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {txQuery.isLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                          Loading…
                        </TableCell>
                      </TableRow>
                    ) : transactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                          No transactions yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      transactions.map((t, i) => {
                        const reference = pickStr(t, ["reference", "id", "tx_id", "transaction_id"], "");
                        const date = pickStr(t, ["created_at", "date", "timestamp"], "");
                        const description = pickStr(t, ["description", "desc", "type"], "—");
                        const method = pickStr(t, ["method", "payment_method", "channel"], "—");
                        const amt = pickNum(t, ["amount", "amount_usd", "value"]);
                        const rowStatus = pickStr(t, ["status"], "completed");
                        return (
                          <TableRow key={reference || i}>
                            <TableCell className="num text-xs">
                              {reference ? (
                                <Link
                                  to="/payment-status"
                                  search={{ reference }}
                                  className="hover:text-primary"
                                >
                                  {reference}
                                </Link>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell className="num text-xs text-muted-foreground">{fmtDate(date)}</TableCell>
                            <TableCell>{description}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{method}</TableCell>
                            <TableCell className={cn("num text-right", amt >= 0 ? "text-long" : "")}>
                              {amt >= 0 ? "+" : "−"}
                              {fmtMoney(Math.abs(amt))}
                            </TableCell>
                            <TableCell className="text-right">
                              <StatusDot status={rowStatus} />
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </AppShell>
  );
}
