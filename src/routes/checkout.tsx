import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Lock, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { endpoints, ApiError, type CheckoutBody } from "@/lib/api";
import { fmtMoney } from "@/lib/format";
import { useActiveAccount } from "@/hooks/use-copydesk";
import { validatePromoCode, redeemPromoCode, type PromoCheck } from "@/lib/promo";


type CheckoutSearch = {
  purpose?: "wallet_topup" | "package" | "challenge_entry";
  amount_usd?: number;
  package_code?: string;
  challenge_id?: string;
};

export const Route = createFileRoute("/checkout")({
  validateSearch: (search: Record<string, unknown>): CheckoutSearch => ({
    purpose:
      search.purpose === "package" || search.purpose === "challenge_entry"
        ? search.purpose
        : "wallet_topup",
    amount_usd: search.amount_usd !== undefined ? Number(search.amount_usd) : undefined,
    package_code: typeof search.package_code === "string" ? search.package_code : undefined,
    challenge_id: typeof search.challenge_id === "string" ? search.challenge_id : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Checkout — pay by mobile money | CopyDesk" },
      {
        name: "description",
        content:
          "Complete your CopyDesk payment by mobile money, with the total converted into your local currency before you confirm.",
      },
      { property: "og:title", content: "Checkout — CopyDesk" },
      {
        property: "og:description",
        content: "Pay by mobile money with transparent local-currency conversion.",
      },
    ],
  }),
  component: Checkout,
});

const NETWORKS = [
  { value: "mpesa", label: "M-Pesa (Safaricom)" },
  { value: "momo", label: "MTN MoMo" },
  { value: "airtel", label: "Airtel Money" },
];

function pickNum(o: Record<string, unknown> | undefined | null, keys: string[], fallback = 0): number {
  if (!o) return fallback;
  for (const k of keys) {
    const v = o[k];
    if (v !== undefined && v !== null && v !== "" && !Number.isNaN(Number(v))) return Number(v);
  }
  return fallback;
}

function pickStr(o: Record<string, unknown> | undefined | null, keys: string[], fallback = ""): string {
  if (!o) return fallback;
  for (const k of keys) {
    const v = o[k];
    if (v !== undefined && v !== null && v !== "") return String(v);
  }
  return fallback;
}

function Checkout() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { accountId } = useActiveAccount();
  const [ccy, setCcy] = useState("");
  const [network, setNetwork] = useState("mpesa");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<(PromoCheck & { code: string }) | null>(null);
  const [promoBusy, setPromoBusy] = useState(false);

  const subtotal = search.amount_usd ?? 0;
  const discount = promo ? (subtotal * promo.discount_percent) / 100 : 0;
  const total = Math.max(0, Number((subtotal - discount).toFixed(2)));
  const freeWithPromo = !!promo && total <= 0;

  const currenciesQuery = useQuery({
    queryKey: ["payment-currencies"],
    queryFn: () => endpoints.currencies(),
    staleTime: 300_000,
  });
  const currencies = (currenciesQuery.data ?? []).filter((c) => c.mobile_money);

  useEffect(() => {
    if (!ccy && currencies.length) setCcy(currencies[0]!.code);
  }, [currencies, ccy]);

  const cur = currencies.find((c) => c.code === ccy);

  const quoteQuery = useQuery({
    queryKey: ["payment-quote", total, ccy],
    queryFn: () => endpoints.quote({ amount_usd: total, currency: ccy }),
    enabled: total > 0 && !!ccy,
  });

  const localFallback = cur?.rate_per_usd ? total * cur.rate_per_usd : 0;
  const local = quoteQuery.data
    ? pickNum(quoteQuery.data, ["amount_local", "local_amount", "converted_amount", "amount"], localFallback)
    : localFallback;
  const rate = quoteQuery.data
    ? pickNum(quoteQuery.data, ["rate", "rate_per_usd", "fx_rate"], cur?.rate_per_usd ?? 0)
    : cur?.rate_per_usd ?? 0;

  const applyPromo = async () => {
    const code = promoInput.trim();
    if (!code) {
      toast.error("Enter a promo code");
      return;
    }
    setPromoBusy(true);
    try {
      const res = await validatePromoCode(code, search.package_code ?? null);
      if (!res.valid) {
        setPromo(null);
        toast.error(res.reason || "Invalid promo code");
        return;
      }
      setPromo({ ...res, code });
      toast.success(
        res.discount_percent >= 100
          ? "Promo applied — no payment needed"
          : `Promo applied — ${res.discount_percent}% off`,
      );
    } catch (err) {
      setPromo(null);
      toast.error(err instanceof Error ? err.message : "Could not check that promo code");
    } finally {
      setPromoBusy(false);
    }
  };

  const removePromo = () => {
    setPromo(null);
    setPromoInput("");
  };

  /** Full-comp promo: consume the code and activate the plan without payment. */
  const redeemFree = async () => {
    if (!promo) return;
    if (!accountId) {
      toast.error("No account selected");
      return;
    }
    setBusy(true);
    try {
      const res = await redeemPromoCode(promo.code, accountId, search.package_code ?? null);
      if (!res.valid) {
        setPromo(null);
        toast.error(res.reason || "This promo code can no longer be used");
        return;
      }
      if (search.purpose === "package" && search.package_code) {
        await endpoints.selectPackage(accountId, search.package_code);
      }
      toast.success("Promo code redeemed — your subscription is active");
      navigate({ to: "/wallet" });
    } catch (err) {
      toast.error(err instanceof ApiError || err instanceof Error ? err.message : "Could not redeem promo code");
    } finally {
      setBusy(false);
    }
  };


  const summaryLabel =
    search.purpose === "package"
      ? `Plan — ${search.package_code ?? ""}`
      : search.purpose === "challenge_entry"
        ? `Challenge entry — ${search.challenge_id ?? ""}`
        : "Wallet top-up";

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId) {
      toast.error("No account selected");
      return;
    }
    if (freeWithPromo) {
      await redeemFree();
      return;
    }
    if (!ccy) {
      toast.error("Choose a currency");
      return;
    }
    if (!phone || !network) {
      toast.error("Enter your mobile number and network");
      return;
    }
    setBusy(true);
    try {
      // A partial promo is consumed first: it must not survive a paid checkout.
      if (promo) {
        const res = await redeemPromoCode(promo.code, accountId, search.package_code ?? null);
        if (!res.valid) {
          setPromo(null);
          toast.error(res.reason || "This promo code can no longer be used");
          return;
        }
      }
      const body: CheckoutBody = {
        account_id: accountId,
        purpose: search.purpose ?? "wallet_topup",
        amount_usd: total > 0 ? total : null,
        package_code: search.purpose === "package" ? search.package_code ?? null : null,
        challenge_id: search.purpose === "challenge_entry" ? search.challenge_id ?? null : null,
        currency: ccy,
        method: "mobilemoney",
        phone_number: phone,
        network,
        redirect_url: `${window.location.origin}/payment-status`,
      };
      const res = await endpoints.checkout(body);
      const reference = pickStr(res, ["reference", "payment_reference", "ref"]);
      toast.success(reference ? `Payment submitted — reference ${reference}` : "Payment submitted");
      navigate({ to: "/payment-status", search: reference ? { reference } : {} });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <Logo />
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" /> Secure checkout
          </span>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-8 px-5 py-12 lg:grid-cols-[1.4fr_1fr]">
        <form onSubmit={pay}>
          <h1 className="text-2xl font-bold">Payment method</h1>

          <div className="panel mt-6 space-y-4 p-6">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Ticket className="h-4 w-4 text-primary" /> Promo code
            </div>
            {promo ? (
              <div className="flex flex-wrap items-center gap-3 rounded-md border border-primary/50 bg-surface-2 p-4">
                <Badge>{promo.code}</Badge>
                <span className="text-sm text-muted-foreground">
                  {promo.discount_percent >= 100
                    ? "Payment skipped — this plan is fully covered"
                    : `${promo.discount_percent}% off this order`}
                </span>
                <Button type="button" size="sm" variant="ghost" className="ml-auto" onClick={removePromo}>
                  Remove
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  placeholder="Enter promo code"
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void applyPromo();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={applyPromo} disabled={promoBusy}>
                  {promoBusy ? "Checking…" : "Apply"}
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Each promo code can be used once. A 100% code activates your subscription without payment.
            </p>
          </div>

          {!freeWithPromo && (
            <div className="panel mt-6 space-y-4 p-6">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Smartphone className="h-4 w-4 text-primary" /> Mobile money
              </div>
              <div className="space-y-1.5">
                <Label>Provider</Label>
                <Select value={network} onValueChange={setNetwork}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NETWORKS.map((n) => (
                      <SelectItem key={n.value} value={n.value}>
                        {n.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ph">Mobile number</Label>
                <Input
                  id="ph"
                  className="num"
                  placeholder="+254 7XX XXX XXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              {local > 0 && (
                <p className="text-xs text-muted-foreground">
                  You'll receive an STK push to authorise{" "}
                  {local.toLocaleString("en-US", { maximumFractionDigits: 0 })} {ccy}.
                </p>
              )}
            </div>
          )}

          <Button type="submit" size="lg" className="mt-6 w-full" disabled={busy}>
            {busy
              ? "Processing…"
              : freeWithPromo
                ? "Activate with promo code"
                : total > 0
                  ? `Pay ${fmtMoney(total)}`
                  : "Pay"}
          </Button>
        </form>

        <aside className="panel h-fit p-6">
          <h2 className="font-display font-semibold">Order summary</h2>
          <div className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{summaryLabel}</span>
              <span className="num">{fmtMoney(subtotal)}</span>
            </div>
            {promo && (
              <div className="flex justify-between text-primary">
                <span>Promo {promo.code}</span>
                <span className="num">−{fmtMoney(discount)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-3 text-base font-semibold">
              <span>Total</span>
              <span className="num">{fmtMoney(total)}</span>
            </div>
          </div>


          <div className="mt-6 space-y-1.5">
            <Label>Charge in</Label>
            <Select value={ccy} onValueChange={setCcy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.code} — {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {ccy && (
            <div className="mt-4 rounded-md border border-border bg-surface-2 p-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                You will be charged
              </div>
              <div className="num mt-1 text-2xl font-semibold text-primary">
                {local.toLocaleString("en-US", { maximumFractionDigits: 2 })} {ccy}
              </div>
              {rate > 0 && (
                <div className="num mt-1 text-xs text-muted-foreground">
                  1 USD = {rate} {ccy}
                </div>
              )}
            </div>
          )}

          <Badge variant="outline" className="mt-5 w-full justify-center py-1.5 text-[11px]">
            Cancel any time · no lock-in
          </Badge>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            <Link to="/wallet" className="hover:text-foreground">
              ← Back to billing
            </Link>
          </p>
        </aside>
      </div>
    </div>
  );
}
