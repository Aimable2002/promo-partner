import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, RotateCcw, Smartphone, Ticket } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Stat, StatusDot } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { endpoints, ApiError } from "@/lib/api";
import { packagePrice, packageName, type PackageRow } from "@/lib/supabase";
import { fmtDate, fmtMoney } from "@/lib/format";
import { useActiveAccount, useRequireAuth, usePackages } from "@/hooks/use-copydesk";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/billing")({
  head: () => ({
    meta: [
      { title: "Plans & billing — CopyDesk" },
      {
        name: "description",
        content:
          "Compare CopyDesk subscription packages, switch plans, redeem a promo code and manage or reactivate your subscription.",
      },
      { property: "og:title", content: "Plans & billing — CopyDesk" },
      {
        property: "og:description",
        content: "Compare subscription packages and manage your CopyDesk plan.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BillingPage,
});

function pickStr(o: Record<string, unknown> | undefined | null, keys: string[], fallback = "—"): string {
  if (!o) return fallback;
  for (const k of keys) {
    const v = o[k];
    if (v !== undefined && v !== null && v !== "") return String(v);
  }
  return fallback;
}

function BillingPage() {
  useRequireAuth();
  const { accounts, accountId, account, select, isLoading: accountsLoading } = useActiveAccount();
  const queryClient = useQueryClient();

  const billingQuery = useQuery({
    queryKey: ["billing", accountId],
    queryFn: () => endpoints.billing(accountId!),
    enabled: !!accountId,
  });

  const packagesQuery = usePackages();

  const billing = billingQuery.data;
  const packages = packagesQuery.data ?? [];

  const billingStatusRaw = pickStr(billing, ["status", "subscription_status"], "cancelled");
  const status: "active" | "cancelled" = billingStatusRaw.toLowerCase().includes("active")
    ? "active"
    : "cancelled";
  const currentPackageCode = pickStr(billing, ["package_code", "current_package_code"], "");
  const currentPackage = packages.find((p) => p.code === currentPackageCode);
  const renews = pickStr(billing, ["current_period_end", "renews_at", "next_billing_date"], "");

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
      title="Plans & billing"
      subtitle="One subscription per account — pay by mobile money or redeem a promo code"
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
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Stat
              label="Current plan"
              value={
                billingQuery.isLoading
                  ? "Loading…"
                  : currentPackage
                    ? packageName(currentPackage)
                    : currentPackageCode || "None"
              }
              accent
              hint={currentPackage ? `${fmtMoney(packagePrice(currentPackage))}/mo` : "No active subscription"}
            />
            <Stat
              label="Subscription status"
              value={billingQuery.isLoading ? "Loading…" : status === "active" ? "Active" : "Inactive"}
              hint={status === "active" ? "Copying enabled" : "Copying limited until you subscribe"}
            />
            <Stat
              label="Renews on"
              value={billingQuery.isLoading ? "Loading…" : fmtDate(renews)}
              hint={status === "cancelled" ? "Subscription cancelled" : "Auto-renew on"}
            />
          </div>

          <Tabs defaultValue="plans" className="mt-6">
            <TabsList className="flex-wrap">
              <TabsTrigger value="plans">Packages</TabsTrigger>
              <TabsTrigger value="subscription">Subscription</TabsTrigger>
            </TabsList>

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
                          <li className="flex gap-2">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            {p.base_roster_size} roster slots included
                          </li>
                          <li className="flex gap-2">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            {fmtMoney(Number(p.slot_fee_per_slot))} per additional slot
                          </li>
                          <li className="flex gap-2">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            Unlimited copied trades &amp; real-time relay
                          </li>
                        </ul>
                        <Button asChild className="mt-6" variant={isCurrent ? "outline" : "default"}>
                          <Link
                            to="/checkout"
                            search={{
                              purpose: "package",
                              package_code: p.code,
                              amount_usd: packagePrice(p),
                            }}
                          >
                            {isCurrent ? "Renew this plan" : `Choose ${packageName(p)}`}
                          </Link>
                        </Button>
                        <p className="mt-2 text-center text-xs text-muted-foreground">
                          Mobile money or promo code
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="subscription" className="mt-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="panel p-6">
                  <h3 className="font-display font-semibold">Your subscription</h3>
                  <div className="mt-4 flex items-center gap-3">
                    <Badge>{currentPackage ? packageName(currentPackage) : currentPackageCode || "None"}</Badge>
                    <StatusDot status={status} />
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">
                    {status === "active"
                      ? `Your plan renews on ${fmtDate(renews)}${currentPackage ? ` for ${fmtMoney(packagePrice(currentPackage))}` : ""}.`
                      : "You have no active subscription. Copying is limited until you subscribe."}
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    {status === "cancelled" && (
                      <Button onClick={() => reactivate.mutate()} disabled={reactivate.isPending}>
                        <RotateCcw className="mr-1 h-4 w-4" /> Reactivate subscription
                      </Button>
                    )}
                    <Button asChild variant={status === "cancelled" ? "outline" : "default"}>
                      <Link
                        to="/checkout"
                        search={{
                          purpose: "package",
                          ...(currentPackageCode ? { package_code: currentPackageCode } : {}),
                          ...(currentPackage ? { amount_usd: packagePrice(currentPackage) } : {}),
                        }}
                      >
                        <Ticket className="mr-1 h-4 w-4" /> Pay or redeem promo code
                      </Link>
                    </Button>
                  </div>
                </div>

                <div className="panel p-6">
                  <h3 className="font-display font-semibold">How you pay</h3>
                  <div className="mt-4 flex items-center gap-3 rounded-md border border-border bg-surface-2 p-4">
                    <Smartphone className="h-5 w-5 text-primary" />
                    <div>
                      <div className="num text-sm">Mobile money</div>
                      <div className="text-xs text-muted-foreground">
                        Charged in your local currency at checkout
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-3 rounded-md border border-border bg-surface-2 p-4">
                    <Ticket className="h-5 w-5 text-primary" />
                    <div>
                      <div className="num text-sm">Promo code</div>
                      <div className="text-xs text-muted-foreground">
                        Single-use codes discount or fully cover a subscription
                      </div>
                    </div>
                  </div>
                  <p className="mt-4 text-xs text-muted-foreground">
                    Subscriptions are charged per billing cycle — nothing is ever debited from your
                    broker account.
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </AppShell>
  );
}
