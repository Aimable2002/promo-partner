import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <a href="/#how" className="transition-colors hover:text-foreground">How it works</a>
          <Link to="/masters" className="transition-colors hover:text-foreground">Masters</Link>
          <Link to="/leaderboard" className="transition-colors hover:text-foreground">Leaderboard</Link>
          <Link to="/pricing" className="transition-colors hover:text-foreground">Pricing</Link>
          <Link to="/challenges" className="transition-colors hover:text-foreground">Challenges</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/auth">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/auth">Get started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-surface/40">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm text-muted-foreground">
            Fill-level trade replication between MT5 and cTrader accounts. Built for traders who
            care about slippage, sizing and proof.
          </p>
        </div>
        <FooterCol
          title="Platform"
          links={[
            ["Masters directory", "/masters"],
            ["Leaderboard", "/leaderboard"],
            ["Challenges", "/challenges"],
            ["Pricing", "/pricing"],
          ]}
        />
        <FooterCol
          title="Account"
          links={[
            ["Sign in", "/auth"],
            ["Dashboard", "/dashboard"],
            ["Plans & billing", "/billing"],
            ["Payment status", "/payment-status"],
          ]}
        />
        <div>
          <div className="text-sm font-semibold">Risk disclosure</div>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            CFDs are complex instruments and come with a high risk of losing money rapidly due to
            leverage. Past performance of any master account is not indicative of future results.
            Performance figures are computed from executed trade history and may lag live fills.
          </p>
        </div>
      </div>
      <div className="border-t border-border px-5 py-5 text-center text-xs text-muted-foreground">
        © 2026 CopyDesk. Not a broker. Not investment advice.
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <div className="text-sm font-semibold">{title}</div>
      <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
        {links.map(([label, to]) => (
          <li key={to}>
            <Link to={to as "/"} className="transition-colors hover:text-foreground">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
