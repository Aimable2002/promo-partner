import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, Search, XCircle } from "lucide-react";
import { Logo, StatusDot } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { endpoints } from "@/lib/api";
import { fmtDate, fmtMoney } from "@/lib/format";

type PaymentStatusSearch = { reference?: string };

export const Route = createFileRoute("/payment-status")({
  validateSearch: (search: Record<string, unknown>): PaymentStatusSearch => ({
    reference: typeof search.reference === "string" ? search.reference : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Payment status lookup — CopyDesk" },
      {
        name: "description",
        content:
          "Enter a payment reference to check whether your CopyDesk transaction is pending, completed or failed, with method and amount details.",
      },
      { property: "og:title", content: "Payment status lookup — CopyDesk" },
      {
        property: "og:description",
        content: "Look up any CopyDesk payment reference to see its current status.",
      },
    ],
  }),
  component: PaymentStatus,
});

function pickStr(o: Record<string, unknown> | undefined | null, keys: string[], fallback = ""): string {
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

function PaymentStatus() {
  const search = Route.useSearch();
  const [ref, setRef] = useState(search.reference ?? "");
  const [activeRef, setActiveRef] = useState<string | null>(search.reference ?? null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (search.reference) {
      setRef(search.reference);
      setActiveRef(search.reference);
    }
  }, [search.reference]);

  const statusQuery = useQuery({
    queryKey: ["payment-status", activeRef],
    queryFn: () => endpoints.paymentStatus(activeRef!),
    enabled: !!activeRef,
    refetchInterval: (query) => {
      const status = pickStr(query.state.data as Record<string, unknown> | undefined, ["status"], "pending");
      return status === "pending" ? 4000 : false;
    },
  });

  const lookup = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = ref.trim();
    if (!trimmed) return;
    if (trimmed === activeRef) {
      void queryClient.invalidateQueries({ queryKey: ["payment-status", activeRef] });
    } else {
      setActiveRef(trimmed);
    }
  };

  const data = statusQuery.data;
  const notFound = activeRef !== null && statusQuery.isFetched && !statusQuery.isLoading && !data;
  const status = pickStr(data, ["status"], "");
  const amount = pickNum(data, ["amount_usd", "amount", "value"]);
  const description = pickStr(data, ["description", "purpose", "type"], "—");
  const method = pickStr(data, ["method", "payment_method", "channel"], "—");
  const date = pickStr(data, ["created_at", "date", "timestamp"], "");

  const Icon =
    status === "successful" || status === "completed"
      ? CheckCircle2
      : status === "failed"
        ? XCircle
        : Clock;
  const tone =
    status === "successful" || status === "completed"
      ? "text-long"
      : status === "failed"
        ? "text-short"
        : "text-warn";

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-3xl items-center px-5">
          <Logo />
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-16">
        <h1 className="text-3xl font-bold">Check a payment</h1>
        <p className="mt-2 text-muted-foreground">
          Enter the reference from your receipt, bank narration or SMS confirmation.
        </p>

        <form onSubmit={lookup} className="panel mt-8 flex flex-wrap items-end gap-3 p-5">
          <div className="min-w-56 flex-1 space-y-1.5">
            <Label htmlFor="ref">Payment reference</Label>
            <Input id="ref" className="num" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="TX-88214" />
          </div>
          <Button type="submit">
            <Search className="mr-1 h-4 w-4" /> Look up
          </Button>
        </form>

        {notFound && (
          <div className="panel mt-6 p-6 text-sm text-muted-foreground">
            No payment found for <span className="num text-foreground">{activeRef}</span>. References
            look like <span className="num">TX-88214</span>.
          </div>
        )}

        {statusQuery.isLoading && activeRef && (
          <div className="panel mt-6 p-6 text-sm text-muted-foreground">Loading…</div>
        )}

        {data && (
          <div className="panel mt-6 p-6">
            <div className="flex items-center gap-3">
              <Icon className={`h-6 w-6 ${tone}`} />
              <div>
                <div className="font-display text-xl font-semibold capitalize">{status || "unknown"}</div>
                <div className="text-xs text-muted-foreground">Reference {activeRef}</div>
              </div>
              <div className="ml-auto text-right">
                <div className="num text-2xl font-semibold">{fmtMoney(Math.abs(amount))}</div>
                <StatusDot status={status || "pending"} />
              </div>
            </div>
            <dl className="mt-6 grid gap-3 border-t border-border pt-5 text-sm sm:grid-cols-2">
              <Row k="Description" v={description} />
              <Row k="Method" v={method} />
              <Row k="Date" v={fmtDate(date)} />
              <Row k="Direction" v={amount >= 0 ? "Credit to wallet" : "Debit from wallet"} />
            </dl>
            {status === "pending" && (
              <p className="mt-5 rounded-md border border-border bg-surface-2 p-4 text-xs text-muted-foreground">
                Awaiting settlement confirmation from the payment provider. Your wallet is credited
                automatically once funds clear — no action needed.
              </p>
            )}
            {status === "failed" && (
              <Button asChild className="mt-5">
                <Link to="/checkout">Retry payment</Link>
              </Button>
            )}
          </div>
        )}

        <p className="mt-10 text-xs text-muted-foreground">
          <Link to="/wallet" className="hover:text-foreground">
            ← Back to wallet
          </Link>
        </p>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{k}</dt>
      <dd className="mt-0.5">{v}</dd>
    </div>
  );
}
