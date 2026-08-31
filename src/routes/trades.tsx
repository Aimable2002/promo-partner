import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { PnL, Stat } from "@/components/brand";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtTime } from "@/lib/format";
import { closedDeals, dealSide } from "@/lib/trades";
import { useMyAccounts, useActiveAccount, useAccountTrades } from "@/hooks/use-copydesk";

export const Route = createFileRoute("/trades")({
  head: () => ({
    meta: [
      { title: "Trade history — mirrored fills log | CopyDesk" },
      {
        name: "description",
        content:
          "Filter every historical copied trade by account, symbol, direction and result, with entry and exit times, pips and realised P&L.",
      },
      { property: "og:title", content: "Trade history — mirrored fills log | CopyDesk" },
      {
        property: "og:description",
        content: "A filterable log of every mirrored trade across your connected accounts.",
      },
    ],
  }),
  component: Trades,
});

function Trades() {
  const { data: accounts = [] } = useMyAccounts();
  const { accountId, select } = useActiveAccount();
  const { data: deals = [] } = useAccountTrades(accountId);

  const [symbol, setSymbol] = useState("all");
  const [side, setSide] = useState("all");
  const [result, setResult] = useState("all");
  const [q, setQ] = useState("");

  const symbols = useMemo(
    () => Array.from(new Set(deals.map((d) => d.symbol))).sort(),
    [deals],
  );

  const rows = useMemo(
    () =>
      closedDeals(deals)
        .filter((d) => (symbol === "all" ? true : d.symbol === symbol))
        .filter((d) => (side === "all" ? true : dealSide(d) === side))
        .filter((d) =>
          result === "all" ? true : result === "win" ? (Number(d.pnl) || 0) >= 0 : (Number(d.pnl) || 0) < 0,
        )
        .filter((d) =>
          q
            ? d.symbol.toLowerCase().includes(q.toLowerCase()) ||
              String(d.deal_ticket).includes(q)
            : true,
        )
        .slice()
        .sort((a, b) => new Date(b.deal_time).getTime() - new Date(a.deal_time).getTime()),
    [deals, symbol, side, result, q],
  );

  const closedRows = rows.filter((d) => d.entry === "out");
  const net = closedRows.reduce((s, d) => s + (Number(d.pnl) || 0), 0);
  const wins = closedRows.filter((d) => (Number(d.pnl) || 0) >= 0).length;

  return (
    <AppShell title="Trade history" subtitle={`${closedRows.length} closed trades matching filters`}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Net realised P&L" value={<PnL value={net} digits={0} className="text-2xl" />} />
        <Stat label="Closed trades" value={closedRows.length.toString()} />
        <Stat
          label="Win rate"
          value={`${closedRows.length ? ((wins / closedRows.length) * 100).toFixed(1) : "0.0"}%`}
          accent
        />
        <Stat
          label="Avg trade"
          value={<PnL value={closedRows.length ? net / closedRows.length : 0} className="text-2xl" />}
        />
      </div>

      <div className="panel mt-6 flex flex-wrap items-center gap-3 p-4">
        <Select value={accountId ?? ""} onValueChange={select}>
          <SelectTrigger className="w-60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((a) => (
              <SelectItem key={a.account_id} value={a.account_id}>
                {a.mt_login ?? a.account_id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={symbol} onValueChange={setSymbol}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All symbols</SelectItem>
            {symbols.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={side} onValueChange={setSide}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Both sides</SelectItem>
            <SelectItem value="BUY">Buy</SelectItem>
            <SelectItem value="SELL">Sell</SelectItem>
          </SelectContent>
        </Select>
        <Select value={result} onValueChange={setResult}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All results</SelectItem>
            <SelectItem value="win">Winners</SelectItem>
            <SelectItem value="loss">Losers</SelectItem>
          </SelectContent>
        </Select>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search ticket or symbol…"
          className="w-52"
        />
        <Button variant="outline" size="sm" className="ml-auto" onClick={() => toast.success("CSV export queued")}>
          <Download className="mr-1 h-4 w-4" /> Export CSV
        </Button>
      </div>

      <div className="panel mt-6 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticket</TableHead>
              <TableHead>Symbol</TableHead>
              <TableHead>Side</TableHead>
              <TableHead className="text-right">Lots</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead>Opened</TableHead>
              <TableHead>Closed</TableHead>
              <TableHead className="text-right">P&L</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((t) => (
              <TableRow key={String(t.deal_ticket)}>
                <TableCell className="num text-xs text-muted-foreground">{t.deal_ticket}</TableCell>
                <TableCell className="num font-medium">{t.symbol}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={dealSide(t) === "BUY" ? "border-long/40 text-long" : "border-short/40 text-short"}
                  >
                    {dealSide(t)}
                  </Badge>
                </TableCell>
                <TableCell className="num text-right">{Number(t.lots).toFixed(2)}</TableCell>
                <TableCell className="num text-right">{t.price ?? "—"}</TableCell>
                <TableCell className="num text-xs text-muted-foreground">
                  {t.entry === "in" ? fmtTime(t.deal_time) : "—"}
                </TableCell>
                <TableCell className="num text-xs text-muted-foreground">
                  {t.entry === "out" ? fmtTime(t.deal_time) : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <PnL value={Number(t.pnl) || 0} className="text-sm" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {rows.length === 0 && (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No trades match these filters.
          </div>
        )}
      </div>
    </AppShell>
  );
}
