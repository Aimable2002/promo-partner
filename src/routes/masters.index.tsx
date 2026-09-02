import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { AppShell } from "@/components/app-shell";
import { Avatar, PnL } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMastersDirectory, useMastersStats } from "@/hooks/use-copydesk";

export const Route = createFileRoute("/masters/")({
  head: () => ({
    meta: [
      { title: "Masters directory — verified copy-trading strategies | CopyDesk" },
      {
        name: "description",
        content:
          "Browse every master available to copy with live net P&L, max drawdown, win rate and trade count computed from executed fills.",
      },
      { property: "og:title", content: "Masters directory — verified strategies | CopyDesk" },
      {
        property: "og:description",
        content: "Compare verified master traders on P&L, drawdown and win rate.",
      },
    ],
  }),
  component: Directory,
});

function Directory() {
  const [q, setQ] = useState("");
  const [platform, setPlatform] = useState("all");
  const [sort, setSort] = useState("roi");

  const { data: masters = [], isLoading: dirLoading, isError: dirError } = useMastersDirectory();
  const statsMap = useMastersStats(masters);

  const list = useMemo(() => {
    const enriched = masters.map((m) => ({
      master: m,
      ...(statsMap.get(m.account_id) ?? {
        stats: null,
        trades: [],
        isLoading: true,
        isError: false,
      }),
    }));
    const needle = q.toLowerCase();
    return enriched
      .filter(({ master: m }) => (platform === "all" ? true : m.platform === platform))
      .filter(({ master: m }) => {
        if (!needle) return true;
        return (
          (m.display_name ?? "").toLowerCase().includes(needle) ||
          (m.bio ?? "").toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => {
        if (sort === "drawdown")
          return (a.stats?.maxDrawdownPct ?? Infinity) - (b.stats?.maxDrawdownPct ?? Infinity);
        if (sort === "winrate")
          return (b.stats?.winRate ?? -Infinity) - (a.stats?.winRate ?? -Infinity);
        if (sort === "pnl") return (b.stats?.netPnl ?? -Infinity) - (a.stats?.netPnl ?? -Infinity);
        return (b.stats?.roiPct ?? -Infinity) - (a.stats?.roiPct ?? -Infinity);
      });
  }, [masters, statsMap, platform, q, sort]);

  return (
    <AppShell title="Masters directory" subtitle={`${list.length} strategies accepting copiers`}>
      <div className="panel flex flex-wrap items-center gap-3 p-4">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or bio…"
            className="pl-9"
          />
        </div>
        <Select value={platform} onValueChange={setPlatform}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All platforms</SelectItem>
            <SelectItem value="MT5">MT5</SelectItem>
            <SelectItem value="cTrader">cTrader</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="roi">Sort: ROI</SelectItem>
            <SelectItem value="pnl">Sort: net P&L</SelectItem>
            <SelectItem value="drawdown">Sort: lowest drawdown</SelectItem>
            <SelectItem value="winrate">Sort: win rate</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {list.length === 0 && (
        <div className="panel mt-6 p-10 text-center text-sm text-muted-foreground">
          {dirLoading
            ? "Loading masters…"
            : dirError
              ? "Sign in to browse the masters directory."
              : masters.length === 0
                ? "No masters are accepting copiers yet."
                : "No masters match your filters."}
        </div>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map(({ master: m, stats, isLoading }) => (
          <div key={m.account_id} className="panel flex flex-col p-5">
            <div className="flex items-start gap-3">
              <Avatar name={m.display_name ?? "Master"} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold">
                    {m.display_name ?? "Unnamed master"}
                  </span>
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {m.bio || "No bio provided"}
                </div>
              </div>
              <Badge variant="outline" className="shrink-0 text-[10px]">
                {m.platform ?? "—"}
              </Badge>
            </div>

            <div className="mt-4 h-16">
              {stats && stats.curve.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.curve}>
                    <defs>
                      <linearGradient id={`d-${m.account_id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="equity"
                      stroke="var(--brand)"
                      strokeWidth={1.6}
                      fill={`url(#d-${m.account_id})`}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="grid h-full place-items-center text-xs text-muted-foreground">
                  {isLoading ? "Loading…" : "No trade history yet"}
                </div>
              )}
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-y-3 border-t border-border pt-4 text-sm">
              <Row
                label="Net P&L"
                value={
                  stats ? (
                    <PnL value={stats.netPnl} digits={0} className="text-sm" />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )
                }
              />
              <Row
                label="Max drawdown"
                value={
                  <span className="num text-warn">{stats ? `${stats.maxDrawdownPct}%` : "—"}</span>
                }
              />
              <Row
                label="Win rate"
                value={<span className="num">{stats ? `${stats.winRate}%` : "—"}</span>}
              />
              <Row
                label="Trades"
                value={
                  <span className="num">{stats ? stats.closedTrades.toLocaleString() : "—"}</span>
                }
              />
              <Row label="Broker" value={<span className="num">{m.broker ?? "—"}</span>} />
              <Row label="Country" value={<span className="num">{m.country ?? "—"}</span>} />
            </dl>

            <Button asChild className="mt-5" variant="outline">
              <Link to="/masters/$masterId" params={{ masterId: m.account_id }}>
                View profile
              </Link>
            </Button>
          </div>
        ))}
      </div>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}
