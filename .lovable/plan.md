# Admin console: restore the missing analytics charts

## What's actually missing

The Analytics tab in the admin console currently renders only one thing: a small "Top masters" table (master, followers, net P&L). Three analytics data sources the backend already exposes are wired up in `src/lib/api.ts` but never called or rendered anywhere:

- `GET /admin/analytics/revenue` — revenue over time
- `GET /admin/analytics/growth` — accounts/users growth over time
- `GET /admin/analytics/symbol-exposure` — platform-wide exposure per traded symbol

So the tab has no chart content at all, even though the rest of the app (dashboard, master profile, challenges) uses Recharts for exactly this kind of visual.

## What to build

Add three charts above the existing top-masters table, in the Analytics tab only. Nothing else on the page changes.

1. **Revenue** — area/line chart of revenue over time (from `/admin/analytics/revenue`), with the period total shown as a caption.
2. **Growth** — line chart of new accounts/masters/followers over time (from `/admin/analytics/growth`).
3. **Symbol exposure** — horizontal bar chart of open exposure per symbol (from `/admin/analytics/symbol-exposure`), top symbols first.

Keep the top-masters table where it is, below the charts.

## Behaviour details

- Each chart is its own panel with a title, and follows the existing panel/typography/token styling used elsewhere — no new colors, all series use existing chart tokens.
- Loading: a skeleton-height panel; error: the same inline error style already used in the tab; empty data: a short "No data yet" line instead of an empty chart frame.
- Responsive: charts stack on mobile, revenue + growth side by side on wide screens.

## Technical notes

- Add `useQuery` calls for `endpoints.adminRevenue`, `adminGrowth`, `adminSymbolExposure`, gated on `enabled: isAdmin`, alongside the existing admin queries.
- The OpenAPI spec declares these responses as untyped JSON, so normalise defensively in the component: unwrap `{ items | data | series | points }` envelopes with the existing `unwrapList` helper, coerce values with the existing `num()` helper, and accept common key aliases (e.g. `date`/`day`/`month`, `revenue`/`amount`/`total`, `symbol`, `exposure`/`lots`/`notional`).
- Use Recharts directly (already a dependency and the pattern used in `dashboard.tsx`), formatting money with `fmtMoney` and dates with `fmtDate`.
- No backend, schema, or routing changes.
