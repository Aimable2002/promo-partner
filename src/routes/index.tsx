import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Gauge,
  LineChart,
  Scale,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { MarketingFooter, MarketingNav } from "@/components/marketing";
import { Avatar, PnL, SectionTitle } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMastersDirectory, useMastersStats, usePackages } from "@/hooks/use-copydesk";
import { packageName, packagePrice } from "@/lib/supabase";
import { fmtMoney } from "@/lib/format";
import { bySymbol } from "@/lib/trades";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CopyDesk — Real-time copy trading for MT5 & cTrader" },
      {
        name: "description",
        content:
          "Mirror a verified master trader's live forex and CFD fills into your own MT5 or cTrader account in under 40ms, with risk-normalised position sizing.",
      },
      { property: "og:title", content: "CopyDesk — Real-time copy trading for MT5 & cTrader" },
      {
        property: "og:description",
        content:
          "Fill-level trade replication from verified masters into your own broker account. Transparent stats, risk-normalised sizing, micro-account support.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { data: masters = [] } = useMastersDirectory();
  const { data: packages = [] } = usePackages();

  const statsMap = useMastersStats(masters);

  const ranked = useMemo(() => {
    return masters
      .map((m) => ({
        master: m,
        ...(statsMap.get(m.account_id) ?? {
          stats: null,
          trades: [],
          isLoading: true,
          isError: false,
        }),
      }))
      .sort((a, b) => (b.stats?.roiPct ?? -Infinity) - (a.stats?.roiPct ?? -Infinity));
  }, [masters, statsMap]);

  const top = ranked.slice(0, 3);

  const symbols = useMemo(() => {
    const allTrades = top.flatMap((t) => t.trades ?? []);
    return bySymbol(allTrades)
      .slice(0, 12)
      .map((s) => s.symbol);
  }, [top]);

  const totalClosedTrades = top.reduce((sum, t) => sum + (t.stats?.closedTrades ?? 0), 0);

  const heroTiles: { label: string; value: string; icon: typeof ShieldCheck }[] = [
    ...(masters.length > 0
      ? [{ label: "Verified masters", value: masters.length.toString(), icon: ShieldCheck }]
      : []),
    ...(totalClosedTrades > 0
      ? [
          {
            label: "Closed trades from featured masters",
            value: totalClosedTrades.toLocaleString(),
            icon: Activity,
          },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen">
      <MarketingNav />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-40" />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "var(--gradient-glow)" }}
        />
        <div className="relative mx-auto max-w-7xl px-5 pb-16 pt-20 sm:pt-28">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground">
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-long" />
            Relay live · {masters.length} verified masters onboard
          </div>
          <h1 className="mt-6 max-w-4xl text-5xl font-bold leading-[1.03] sm:text-6xl lg:text-7xl">
            Their fill. <span className="brand-gradient-text">Your account.</span>
            <br />
            Thirty-eight milliseconds apart.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            CopyDesk mirrors a master trader's live forex and CFD positions straight into your own
            MT5 or cTrader account at your broker — sized to your equity, your risk, your rules. No
            pooled funds. No withdrawal of your capital. Ever.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link to="/auth">
                Start copying <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/masters">Browse masters</Link>
            </Button>
          </div>

          {heroTiles.length > 0 && (
            <div className="mt-14 grid max-w-2xl gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
              {heroTiles.map((s) => (
                <div key={s.label} className="bg-surface p-5">
                  <s.icon className="h-4 w-4 text-primary" />
                  <div className="num mt-3 text-2xl font-semibold">{s.value}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ticker */}
        {symbols.length > 0 && (
          <div className="relative flex overflow-hidden border-t border-border bg-surface/60 py-2.5">
            <div className="ticker-track flex shrink-0 gap-8 whitespace-nowrap px-4">
              {[...symbols, ...symbols].map((s, i) => (
                <span
                  key={s + i}
                  className="num flex items-center gap-2 text-xs text-muted-foreground"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Brokers */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-5 py-12">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <p className="text-sm text-muted-foreground">
              Connects to any MT5-based broker — plus cTrader for masters
            </p>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3 font-display text-sm font-semibold text-muted-foreground">
              {[
                "IC Markets",
                "Pepperstone",
                "Exness",
                "Vantage",
                "FXPesa",
                "FxPro (cTrader)",
                "Axi (cTrader)",
              ].map((b) => (
                <span key={b}>{b}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-b border-border">
        <div className="mx-auto max-w-7xl px-5 py-20">
          <SectionTitle
            eyebrow="From signup to mirrored fills"
            title="Four steps. Roughly nine minutes."
            sub="You never send us your money. You connect a read-and-trade API session to your own broker account, and we push orders into it."
          />
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                n: "01",
                t: "Create your desk",
                d: "Sign up and pick your side: publish your trades as a master, or copy someone as a follower.",
              },
              {
                n: "02",
                t: "Connect your broker",
                d: "Enter your MT5 login, server and investor-grade trading credentials — or link cTrader via OAuth if you're a master.",
              },
              {
                n: "03",
                t: "Set your sizing rule",
                d: "Proportional, fixed lot, or % risk per trade. Micro-scaling drops to 0.01 lots so a $200 account still receives every signal.",
              },
              {
                n: "04",
                t: "Go live",
                d: "The relay opens, modifies and closes positions in your account the moment the master's fill is confirmed.",
              },
            ].map((s) => (
              <div key={s.n} className="panel p-6">
                <div className="num text-sm font-semibold text-primary">{s.n}</div>
                <h3 className="mt-3 text-lg font-semibold">{s.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="border-b border-border bg-surface/30">
        <div className="mx-auto max-w-7xl px-5 py-20">
          <SectionTitle
            eyebrow="Why traders trust the relay"
            title="Copy trading fails on the details. We built for the details."
          />
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {[
              {
                icon: Zap,
                t: "Real-time fill replication",
                d: "We don't poll a statement every 30 seconds. We subscribe to execution events and place your order on confirmation — median 38ms, p99 under 140ms. Partial fills, SL/TP edits and partial closes all replicate.",
              },
              {
                icon: Scale,
                t: "Risk-normalised sizing",
                d: "A master risking 1% on 4 lots becomes 1% on your equity, not 4 blind lots. Micro-scaling keeps small accounts in every trade instead of skipping signals they can't afford.",
              },
              {
                icon: LineChart,
                t: "Transparency by default",
                d: "Every master's track record is computed from executed fills, not screenshots. Max drawdown, profit factor and losing months are shown as prominently as returns.",
              },
            ].map((f) => (
              <div key={f.t} className="panel p-7">
                <span className="grid h-10 w-10 place-items-center rounded-md border border-border bg-surface-2">
                  <f.icon className="h-5 w-5 text-primary" />
                </span>
                <h3 className="mt-5 text-xl font-semibold">{f.t}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.d}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              ["Your capital stays at your broker", "CopyDesk never has withdrawal rights."],
              ["Drawdown circuit breaker", "Auto-pause copying at a loss threshold you set."],
            ].map(([t, d]) => (
              <div key={t} className="flex gap-3 rounded-lg border border-border bg-surface p-4">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <div className="text-sm font-medium">{t}</div>
                  <div className="text-xs text-muted-foreground">{d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Top masters */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-5 py-20">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <SectionTitle
              eyebrow="Live track records"
              title="Top-performing masters right now"
              sub="Ranked on ROI from verified fills. Drawdown shown alongside — always."
            />
            <Button asChild variant="outline">
              <Link to="/leaderboard">Full leaderboard</Link>
            </Button>
          </div>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {top.map(({ master: m, stats }) => (
              <Link
                key={m.account_id}
                to="/masters/$masterId"
                params={{ masterId: m.account_id }}
                className="panel group p-6 transition-all hover:border-primary/50"
                style={{ transitionProperty: "border-color, box-shadow" }}
              >
                <div className="flex items-center gap-3">
                  <Avatar name={m.display_name ?? "Master"} />
                  <div className="min-w-0">
                    <div className="truncate font-semibold">
                      {m.display_name ?? "Unnamed master"}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {m.platform ?? "—"}
                      {m.broker ? ` · ${m.broker}` : ""}
                    </div>
                  </div>
                  <Badge variant="outline" className="ml-auto shrink-0 text-[10px]">
                    {stats ? `${stats.trackRecordMonths}mo track record` : "—"}
                  </Badge>
                </div>
                <div className="mt-5 h-20">
                  {stats && stats.curve.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={stats.curve}>
                        <defs>
                          <linearGradient id={`g-${m.account_id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.4} />
                            <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area
                          type="monotone"
                          dataKey="equity"
                          stroke="var(--brand)"
                          strokeWidth={1.8}
                          fill={`url(#g-${m.account_id})`}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="grid h-full place-items-center text-xs text-muted-foreground">
                      No trade history yet
                    </div>
                  )}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4 text-center">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      ROI
                    </div>
                    {stats ? (
                      <PnL
                        value={stats.roiPct}
                        prefix=""
                        suffix="%"
                        digits={1}
                        className="text-sm"
                      />
                    ) : (
                      <div className="num text-sm text-muted-foreground">—</div>
                    )}
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Max DD
                    </div>
                    <div className="num text-sm font-medium text-warn">
                      {stats ? `${stats.maxDrawdownPct}%` : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Trades
                    </div>
                    <div className="num text-sm font-medium">
                      {stats ? stats.closedTrades.toLocaleString() : "—"}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="border-b border-border bg-surface/30">
        <div className="mx-auto max-w-7xl px-5 py-20">
          <SectionTitle
            eyebrow="Pricing"
            title="Flat monthly access. Masters set their own fee."
            sub="No spread markup, no hidden per-lot commission from us. What your broker charges is between you and your broker."
          />
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {packages.map((p) => (
              <div key={p.code} className="panel flex flex-col p-7">
                <div className="font-display text-lg font-semibold">{packageName(p)}</div>
                <div className="num mt-3 text-4xl font-bold">
                  {fmtMoney(packagePrice(p))}
                  <span className="text-sm font-normal text-muted-foreground">/mo</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {p.base_roster_size} roster slot{p.base_roster_size === 1 ? "" : "s"} included ·
                  billed every {p.duration_days} days
                </p>
                <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                  {[
                    `${p.base_roster_size} master slots in your roster`,
                    `${fmtMoney(Number(p.slot_fee_per_slot))} per additional roster slot`,
                    `${p.duration_days}-day billing cycle`,
                  ].map((f) => (
                    <li key={f} className="flex gap-2.5">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
                <Button asChild className="mt-7" variant="outline">
                  <Link to="/pricing">View plan</Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "var(--gradient-glow)" }}
        />
        <div className="relative mx-auto max-w-3xl px-5 py-24 text-center">
          <Gauge className="mx-auto h-8 w-8 text-primary" />
          <h2 className="mt-6 text-4xl font-bold sm:text-5xl">
            Connect an account. Copy your first fill today.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Free tier, one master, no card. Disconnect any time from your broker terminal.
          </p>
          <Button asChild size="lg" className="mt-8">
            <Link to="/auth">
              Create your desk <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
