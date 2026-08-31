# CopyDesk: replace mock data with real backend + Supabase

## Non-negotiable ground rules

1. **Wiring only.** Do NOT change layout, styling, component structure, or copy/wording
   except where a field no longer exists or was renamed. Every screen must look the same
   afterwards; only the data source changes. Keep the same JSX structure, class names,
   card order, chart types, table columns.
2. Nothing may import from `@/lib/mock` when you're done with your files. (Another agent
   deletes the file at the end — just remove your imports.)
3. Formatters `fmtMoney`, `fmtNum`, `fmtPct`, `fmtDate`, `fmtTime`, `initials` now live in
   `@/lib/format` (identical implementations). Just change the import path.
4. Never call `fetch` directly. Use `api` / `endpoints` from `@/lib/api`.
5. Loading/empty states: use the existing skeleton/empty patterns already present in the
   file if any; otherwise a simple muted "Loading…" / "No data yet" line inside the same
   container. Errors from `ApiError` have a user-safe `.message` — show it (toast via
   `sonner`, or inline text). Do NOT invent new page layouts.
6. Do not use `loader:` on routes for authenticated data — fetch in the component with
   `useQuery` (TanStack Start SSR/prerender has no session).
7. Write real TypeScript — no `any` unless unavoidable; prefer the exported types.

## Available data layer (already built — read these files first)

- `src/lib/supabase.ts` — `supabase` client + row types (`AccountRow`, `SubscriptionRow`,
  `LiveAccountStateRow`, `PackageRow`, `ChallengeRow`, `MasterChallengeEnrollmentRow`,
  `WalletTransactionRow`, `OpenPosition`) + helpers `fetchMyAccounts`,
  `fetchActiveSubscription`, `fetchActivePackages`, `packagePrice`, `packageName`.
- `src/lib/api.ts` — `api.get/post`, `ApiError`, `endpoints.*` (full backend surface),
  types `Deal`, `DirectoryMaster`, `MasterFollower`, `ChallengeStatus`,
  `ChallengeApiRow`, `PaymentCurrency`, `CheckoutBody`, `ProvisionBody`, `PayoutBody`,
  `unwrapList`.
- `src/lib/trades.ts` — `computeStats`, `equityCurve`, `lastNDays`, `maxDrawdown`,
  `bySymbol`, `byHour`, `riskScore`, `closedDeals`, `dealSide`, `relativeTime`.
  ALL performance math must come from here — do not re-implement.
- `src/hooks/use-copydesk.ts` — `useSession`, `useRequireAuth`, `useMyAccounts`,
  `useActiveAccount`, `useLiveAccountState`, `freshnessMs`, `useMastersDirectory`,
  `useMasterTrades`, `useAccountTrades`, `usePackages`.
  Add new hooks here if several of your screens need the same query.

## Data source split

- **Supabase direct reads**: `accounts` (own list), `subscriptions` (follower's current
  master), `live_account_state` (realtime balance/equity/open_positions), `packages`
  (pricing), `challenges` (admin CRUD only).
- **Backend API** for everything else.

## Verified backend paths (from the live openapi.json — do not invent others)

```
POST /accounts/provision                POST /accounts/ctrader/start
GET  /accounts/{id}/trades              POST /accounts/{id}/pause|resume|close
GET  /accounts/{id}/roster              POST /accounts/{id}/roster/switch
GET  /accounts/{id}/wallet              GET  /accounts/{id}/wallet/transactions
GET  /accounts/{id}/billing             POST /accounts/{id}/billing/select-package
GET  /challenges                        GET  /masters/directory
GET  /masters/{id}/trades|followers|earnings|payouts
POST /masters/{id}/payouts              POST /masters/{id}/profile
GET  /masters/{id}/challenges/status|history
POST /masters/{id}/challenges/{challenge_id}/leave
GET  /payments/currencies               POST /payments/quote
POST /payments/checkout                 GET  /payments/{reference}
GET  /admin/summary|users|masters|payouts
GET  /admin/analytics/revenue|growth|symbol-exposure|top-masters
GET  /admin/masters/{id}   POST /admin/masters/{id}/public
POST /admin/payouts/{payout_id}/approve|reject
```

`GET /challenges` returns `{ challenges: [...] }`; `/masters/directory` returns a bare
array. `endpoints.*` already normalises both.

Note: although the spec marks `/challenges` and `/masters/directory` public, the live
deployment requires a bearer token, so call them through `endpoints` (which attaches the
token when a session exists) — never with `anonymous: true`.

## Features that DO NOT exist — remove any UI for them, never add

- Master performance fee / rate / fee-split / breakeven widgets (fully retired).
  Master earnings = **challenge rewards only**.
- Embedded cTrader curated strategies.
- Card / bank-transfer payments (only `mobilemoney` works).
- A separate challenge evaluation account (`account_size_label` is a cosmetic reward-tier
  label; challenges run on the master's real live account).
- Automatic payouts (admin settles manually), payout "instant" buttons.
- Broker/server whitelists (`BROKERS`) — login/password/server/broker are free text.
- Challenge countdowns/deadlines/expiry, "trading days" concept.
- A master "featured" flag — sort by a performance metric and take the top N instead.
- `rate_percent` / `billed_pnl` on admin top-masters (now `net_pnl`, `null` when the
  master isn't connected → show "unavailable", never 0).
- Any copy referencing "performance fee", "fee split", "80% split", or
  `profit_share_*` as a going-forward flow. Existing historical wallet transaction rows
  may render generically from their own description.

## Sizing modes (the only four)

- `proportional` — no extra input.
- `fixed-lot` — "Lot size per trade", must be > 0.
- `micro-scale` — "Minimum lot size", must be >= 0.01.
- `risk-percent` — "Risk % of equity per trade" (e.g. 2 = 2%).

`sizing_value` = the number from whichever input showed; null for `proportional`.

## Challenge math (client-side, from `challengeStatus` + live equity)

- Elapsed days = calendar days since `enrolled_at`, inclusive of today.
- Profit % = (equity − starting_equity) / starting_equity × 100
- Daily loss % = (day_start_equity − equity) / day_start_equity × 100 (only meaningful > 0)
- Drawdown % = (peak_equity − equity) / peak_equity × 100
- Compare to `profit_target_pct` / `max_daily_loss_pct` / `max_drawdown_pct` for progress
  bars. Pass/breach decisions are server-side; the UI only reflects state.
- Enrolling is payment-only: `POST /payments/checkout` with
  `purpose: "challenge_entry"`, `challenge_id`, `method: "mobilemoney"`,
  `phone_number`, `network`, `redirect_url`. Poll `GET /payments/{reference}` until
  status !== "pending"; on `"successful"` refresh challenge status. If the payment
  succeeded but no enrollment appeared, show a clear "payment went through but enrollment
  was rejected — contact support" message.
- Leaving only allowed for non-`is_fixed` challenges.
- History outcomes: `passed`, `breached`, `failed`, `left`, `reset` — `breached` and
  `failed` must be visually distinct.
- Worth reflecting in copy: a breach ends only that challenge attempt; the master's real
  account keeps running and copying normally.
