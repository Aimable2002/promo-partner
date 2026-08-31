import type { Deal } from "./api";

export type CurvePoint = { t: string; equity: number; balance: number };

export const isClosed = (d: Deal) => d.entry === "out";

export function closedDeals(deals: Deal[]): Deal[] {
  return deals
    .filter(isClosed)
    .slice()
    .sort((a, b) => new Date(a.deal_time).getTime() - new Date(b.deal_time).getTime());
}

/** Running realized balance curve built from closed deals. */
export function equityCurve(deals: Deal[], startingBalance = 0): CurvePoint[] {
  const closed = closedDeals(deals);
  let running = startingBalance;
  return closed.map((d) => {
    running += Number(d.pnl) || 0;
    return {
      t: d.deal_time,
      equity: Math.round(running * 100) / 100,
      balance: Math.round(running * 100) / 100,
    };
  });
}

export function lastNDays(points: CurvePoint[], days = 30): CurvePoint[] {
  const cutoff = Date.now() - days * 86400000;
  return points.filter((p) => new Date(p.t).getTime() >= cutoff);
}

export function maxDrawdown(points: CurvePoint[]) {
  let peak = -Infinity;
  let abs = 0;
  let pct = 0;
  for (const p of points) {
    if (p.equity > peak) peak = p.equity;
    const dd = peak - p.equity;
    if (dd > abs) {
      abs = dd;
      pct = peak > 0 ? (dd / peak) * 100 : 0;
    }
  }
  return { abs: Math.round(abs * 100) / 100, pct: Math.round(pct * 100) / 100 };
}

export type TradeStats = {
  netPnl: number;
  closedTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  grossProfit: number;
  grossLoss: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  riskScore: number;
  roiPct: number;
  firstTrade: string | null;
  lastTrade: string | null;
  trackRecordMonths: number;
  curve: CurvePoint[];
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export function computeStats(deals: Deal[], startingBalance = 0): TradeStats {
  const closed = closedDeals(deals);
  const pnls = closed.map((d) => Number(d.pnl) || 0);
  const wins = pnls.filter((p) => p > 0);
  const losses = pnls.filter((p) => p < 0);
  const grossProfit = wins.reduce((s, p) => s + p, 0);
  const grossLoss = Math.abs(losses.reduce((s, p) => s + p, 0));
  const curve = equityCurve(deals, startingBalance);
  const dd = maxDrawdown(curve);
  const netPnl = pnls.reduce((s, p) => s + p, 0);
  const first = closed[0]?.deal_time ?? null;
  const last = closed[closed.length - 1]?.deal_time ?? null;
  const months =
    first && last
      ? Math.max(
          1,
          Math.round((new Date(last).getTime() - new Date(first).getTime()) / (30 * 86400000)),
        )
      : 0;

  return {
    netPnl: r2(netPnl),
    closedTrades: closed.length,
    wins: wins.length,
    losses: losses.length,
    winRate: closed.length ? r2((wins.length / closed.length) * 100) : 0,
    profitFactor: grossLoss > 0 ? r2(grossProfit / grossLoss) : grossProfit > 0 ? 99 : 0,
    avgWin: wins.length ? r2(grossProfit / wins.length) : 0,
    avgLoss: losses.length ? r2(-grossLoss / losses.length) : 0,
    grossProfit: r2(grossProfit),
    grossLoss: r2(grossLoss),
    maxDrawdown: dd.abs,
    maxDrawdownPct: dd.pct,
    riskScore: riskScore(dd.pct),
    roiPct: startingBalance > 0 ? r2((netPnl / startingBalance) * 100) : 0,
    firstTrade: first,
    lastTrade: last,
    trackRecordMonths: months,
    curve,
  };
}

export function riskScore(maxDrawdownPct: number) {
  return Math.min(10, Math.max(1, Math.round(maxDrawdownPct / 2.4)));
}

export function bySymbol(deals: Deal[]) {
  const map = new Map<string, { symbol: string; pnl: number; trades: number; wins: number }>();
  for (const d of closedDeals(deals)) {
    const key = d.symbol ?? "—";
    const row = map.get(key) ?? { symbol: key, pnl: 0, trades: 0, wins: 0 };
    row.pnl += Number(d.pnl) || 0;
    row.trades += 1;
    if ((Number(d.pnl) || 0) > 0) row.wins += 1;
    map.set(key, row);
  }
  return [...map.values()]
    .map((r) => ({
      symbol: r.symbol,
      pnl: r2(r.pnl),
      trades: r.trades,
      winRate: r.trades ? r2((r.wins / r.trades) * 100) : 0,
    }))
    .sort((a, b) => b.pnl - a.pnl);
}

export function byHour(deals: Deal[]) {
  const buckets = Array.from({ length: 24 }, (_, h) => ({
    hour: `${String(h).padStart(2, "0")}:00`,
    trades: 0,
    pnl: 0,
  }));
  for (const d of closedDeals(deals)) {
    const h = new Date(d.deal_time).getHours();
    const b = buckets[h];
    if (!b) continue;
    b.trades += 1;
    b.pnl = r2(b.pnl + (Number(d.pnl) || 0));
  }
  return buckets;
}

/** Normalises a raw deal into the row shape used by trade tables. */
export function dealSide(d: Deal): "BUY" | "SELL" {
  const t = String(d.type ?? "").toLowerCase();
  return t.includes("sell") || t === "1" ? "SELL" : "BUY";
}

export function fmtMoney(n: number, digits = 2) {
  return `$${Number(n ?? 0).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function relativeTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff)) return "—";
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m ago`;
  return `${Math.floor(h / 24)}d ago`;
}
