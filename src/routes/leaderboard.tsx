import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowUpDown, Crown } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Avatar, PnL } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMastersDirectory, useMastersStats } from "@/hooks/use-copydesk";
import type { DirectoryMaster } from "@/lib/api";
import type { TradeStats } from "@/lib/trades";
import { fmtMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Master leaderboard — ranked trading performance | CopyDesk" },
      {
        name: "description",
        content:
          "Rank verified masters by ROI, net P&L, max drawdown, profit factor, return-to-drawdown, risk score, average win and loss, win rate and track record length.",
      },
      { property: "og:title", content: "Master leaderboard — ranked performance | CopyDesk" },
      {
        property: "og:description",
        content: "Compare every CopyDesk master across verified performance metrics computed from fills.",
      },
    ],
  }),
  component: Leaderboard,
});

type Row = { master: DirectoryMaster; stats: TradeStats | null };

type Col = {
  key: string;
  label: string;
  get: (r: Row) => number;
  render: (r: Row) => React.ReactNode;
};

const rtd = (r: Row) => {
  if (!r.stats) return -Infinity;
  return r.stats.roiPct / Math.max(r.stats.maxDrawdownPct, 0.1);
};

const dash = <span className="num text-sm text-muted-foreground">—</span>;

const COLS: Col[] = [
  { key: "roi", label: "ROI", get: (r) => r.stats?.roiPct ?? -Infinity, render: (r) => (r.stats ? <PnL value={r.stats.roiPct} prefix="" suffix="%" digits={1} className="text-sm" /> : dash) },
  { key: "netPnl", label: "Net P&L", get: (r) => r.stats?.netPnl ?? -Infinity, render: (r) => (r.stats ? <PnL value={r.stats.netPnl} digits={0} className="text-sm" /> : dash) },
  { key: "maxDrawdown", label: "Max DD", get: (r) => -(r.stats?.maxDrawdownPct ?? Infinity), render: (r) => (r.stats ? <span className="num text-warn">{r.stats.maxDrawdownPct}%</span> : dash) },
  { key: "profitFactor", label: "Profit factor", get: (r) => r.stats?.profitFactor ?? -Infinity, render: (r) => (r.stats ? <span className="num">{r.stats.profitFactor.toFixed(2)}</span> : dash) },
  { key: "rtd", label: "Return / DD", get: rtd, render: (r) => (r.stats ? <span className="num text-primary">{rtd(r).toFixed(2)}</span> : dash) },
  { key: "riskScore", label: "Risk score", get: (r) => -(r.stats?.riskScore ?? Infinity), render: (r) => (r.stats ? <span className="num">{r.stats.riskScore}/10</span> : dash) },
  { key: "avgWin", label: "Avg win", get: (r) => r.stats?.avgWin ?? -Infinity, render: (r) => (r.stats ? <span className="num text-long">{fmtMoney(r.stats.avgWin)}</span> : dash) },
  { key: "avgLoss", label: "Avg loss", get: (r) => r.stats?.avgLoss ?? Infinity, render: (r) => (r.stats ? <span className="num text-short">{fmtMoney(r.stats.avgLoss)}</span> : dash) },
  { key: "winRate", label: "Win rate", get: (r) => r.stats?.winRate ?? -Infinity, render: (r) => (r.stats ? <span className="num">{r.stats.winRate}%</span> : dash) },
  { key: "closedTrades", label: "Trades", get: (r) => r.stats?.closedTrades ?? -Infinity, render: (r) => (r.stats ? <span className="num">{r.stats.closedTrades.toLocaleString()}</span> : dash) },
  { key: "trackRecordMonths", label: "Track record", get: (r) => r.stats?.trackRecordMonths ?? -Infinity, render: (r) => (r.stats ? <span className="num">{r.stats.trackRecordMonths}mo</span> : dash) },
];

function Leaderboard() {
  const [sortKey, setSortKey] = useState("roi");
  const [asc, setAsc] = useState(false);

  const { data: masters = [] } = useMastersDirectory();
  const accountIds = useMemo(() => masters.map((m) => m.account_id), [masters]);
  const statsMap = useMastersStats(accountIds);

  const rows = useMemo<Row[]>(() => {
    const col = COLS.find((c) => c.key === sortKey) ?? COLS[0]!;
    const enriched: Row[] = masters.map((m) => ({
      master: m,
      stats: statsMap.get(m.account_id)?.stats ?? null,
    }));
    return enriched.sort((a, b) => (asc ? col.get(a) - col.get(b) : col.get(b) - col.get(a)));
  }, [masters, statsMap, sortKey, asc]);

  const podium = rows.slice(0, 3);

  return (
    <AppShell title="Leaderboard" subtitle="Ranked by verified trade history · updated live">
      <div className="grid gap-4 md:grid-cols-3">
        {podium.map(({ master: m, stats }, i) => (
          <div key={m.account_id} className={cn("panel p-5", i === 0 && "ring-1 ring-primary/50")}>
            <div className="flex items-center gap-3">
              <span className="num text-2xl font-bold text-muted-foreground">#{i + 1}</span>
              <Avatar name={m.display_name ?? "Master"} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-semibold">{m.display_name ?? "Unnamed master"}</span>
                  {i === 0 && <Crown className="h-3.5 w-3.5 text-warn" />}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {m.platform ?? "—"} · {m.broker ?? "—"}
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Mini label="ROI" node={stats ? <PnL value={stats.roiPct} prefix="" suffix="%" digits={1} className="text-sm" /> : dash} />
              <Mini label="PF" node={stats ? <span className="num text-sm">{stats.profitFactor.toFixed(2)}</span> : dash} />
              <Mini label="DD" node={stats ? <span className="num text-sm text-warn">{stats.maxDrawdownPct}%</span> : dash} />
            </div>
          </div>
        ))}
      </div>

      <div className="panel mt-6 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead className="min-w-52">Master</TableHead>
              {COLS.map((c) => (
                <TableHead key={c.key} className="whitespace-nowrap text-right">
                  <button
                    className={cn(
                      "inline-flex items-center gap-1 hover:text-foreground",
                      sortKey === c.key && "text-primary",
                    )}
                    onClick={() => {
                      if (sortKey === c.key) setAsc((v) => !v);
                      else {
                        setSortKey(c.key);
                        setAsc(false);
                      }
                    }}
                  >
                    {c.label}
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
              ))}
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={COLS.length + 2}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No ranked masters available yet.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r, i) => (
              <TableRow key={r.master.account_id}>
                <TableCell className="num text-muted-foreground">{i + 1}</TableCell>
                <TableCell>
                  <Link
                    to="/masters/$masterId"
                    params={{ masterId: r.master.account_id }}
                    className="flex items-center gap-2.5 hover:text-primary"
                  >
                    <Avatar name={r.master.display_name ?? "Master"} size={28} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{r.master.display_name ?? "Unnamed master"}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{r.master.bio || "No bio provided"}</div>
                    </div>
                    <Badge variant="outline" className="ml-1 shrink-0 text-[10px]">{r.master.platform ?? "—"}</Badge>
                  </Link>
                </TableCell>
                {COLS.map((c) => (
                  <TableCell key={c.key} className="whitespace-nowrap text-right">
                    {c.render(r)}
                  </TableCell>
                ))}
                <TableCell className="text-right">
                  <Button asChild size="sm" variant="outline">
                    <Link to="/masters/$masterId" params={{ masterId: r.master.account_id }}>
                      Copy
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}

function Mini({ label, node }: { label: string; node: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-surface-2 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      {node}
    </div>
  );
}
