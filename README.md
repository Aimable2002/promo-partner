# CopyDesk Signals

Build a web app called CopyDesk — a copy-trading platform for forex/CFD traders that mirrors a "master" trader's live positions into a "follower's" own MT5 or cTrader broker account in real time.

This is a frontend-only build using realistic mock data throughout — no backend, no real auth, no live API connections. All numbers, charts, and lists should be populated with plausible, internally-consistent sample data so every screen looks fully alive out of the box.

You have complete creative freedom over visual style, layout, structure, colors, typography, and how information is organized on each page. Below is only what needs to exist and be functional — not how to arrange or present it.

Public marketing page Introduces the product and what it does. Communicates: live platform stats (feed latency, follower P&L from open signals, number of masters, number of live accounts), which brokers/platforms are supported (MT5-based brokers, plus cTrader for masters), the process of going from signing up to having trades mirrored into your account, what makes the platform trustworthy and differentiated (real-time fill replication, transparency, risk-normalized position sizing), a look at top-performing masters, an overview of pricing, and a path to sign up.

Authentication Sign in and sign up.

Onboarding A new user chooses whether they're joining as a master (someone whose trades get copied) or a follower (someone copying a master). A master specifies whether they trade on MT5 or cTrader and provides their account details. A follower selects a master to copy, connects their own broker account, and chooses how their position sizing should scale relative to the master (including how very small accounts are still able to receive every trade).

Dashboard An overview of all accounts the user owns (master and/or follower), each showing live balance, equity, and status, plus a summary of overall performance across accounts. A way to add a new account.

Masters directory A browsable listing of all masters available to copy, each showing live performance data: net P&L, max drawdown, open exposure, win rate, follower count, and trading platform.

Leaderboard A ranked comparison of masters across performance metrics: 30-day return, P&L, max drawdown, profit factor, return-to-drawdown ratio, average win, average loss, win rate, number of closed trades, track record length, and follower count.

Master public profile A detailed view of a single master for prospective followers: key performance stats, risk profile, equity growth over time, performance broken down by traded symbol, trading activity by time of day, and a log of recent completed trades. A clear way to start copying this master.

Account details Controls to pause, resume, or close an account. For a master account: performance details, an editable profile, earnings, and payout request history with status. For a follower account: wallet balance, billing/subscription details, a list of followers currently copying (if applicable), spend history, and a trade log.

Trade history A filterable log of historical trades for an account (symbol, direction, timing, and result).

Challenges A listing of trading challenge programs (profit targets and drawdown limits to unlock something, prop-firm style). A live view of progress toward an active challenge's targets. A history of past challenge attempts and their outcomes.

Wallet & pricing Wallet balance and a way to top it up. A set of subscription tiers to choose from with their cost and value clearly explained. Billing management, including reactivating a cancelled subscription. A transaction history.

Checkout Payment via card, mobile money, or bank transfer, with the cost shown converted into the user's local currency.

Payment status Look up a payment by reference and see whether it's pending, completed, or failed.

Admin console Platform-wide KPIs. A queue of pending master payout requests to approve or reject. User management. A tool for creating and editing challenge programs. A tool for approving, featuring, or hiding masters from the public directory.

Account settings Update email and password, and sign out.

Design this as a complete, professional, trustworthy trading platform. Make the best possible design decisions for a forex/trading product — you decide everything about how it looks and feels.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9bbbb43a-4468-4775-bcad-356114d2e8ac).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
