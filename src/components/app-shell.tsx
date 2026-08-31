import { Link } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Trophy,
  History,
  Target,
  CreditCard,
  Settings,
  ShieldCheck,
  Bell,
  Search,
  Menu,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Logo, Avatar } from "@/components/brand";
import { useMyAccounts, useSession, useIsAdmin, usePlatformStats } from "@/hooks/use-copydesk";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/masters", label: "Masters", icon: Users },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { to: "/trades", label: "Trade history", icon: History },
  { to: "/challenges", label: "Challenges", icon: Target },
  { to: "/billing", label: "Plans & billing", icon: CreditCard },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

const ADMIN_NAV = { to: "/admin", label: "Admin console", icon: ShieldCheck } as const;

export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { user } = useSession();
  const { isAdmin } = useIsAdmin();
  const { data: accounts = [] } = useMyAccounts();
  const { data: platformStats } = usePlatformStats();
  const avgLatency = platformStats?.avg_relay_latency_seconds_30d ?? null;
  const hasRelayData = avgLatency !== null;
  const name = user?.email?.split("@")[0] ?? "Your desk";

  return (
    <div className="min-h-screen bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 border-r border-sidebar-border bg-sidebar transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center border-b border-sidebar-border px-5">
          <Logo />
        </div>
        <nav className="space-y-1 p-3">
          {[...NAV, ...(isAdmin ? [ADMIN_NAV] : [])].map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              activeProps={{ className: "bg-sidebar-accent text-primary" }}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mx-3 mt-4 rounded-lg border border-sidebar-border bg-surface-2 p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className={cn("live-dot h-1.5 w-1.5 rounded-full", hasRelayData ? "bg-long" : "bg-muted-foreground")} />
            {hasRelayData ? "Relay healthy" : "No relay data yet"}
          </div>
          <div className="num mt-2 text-xl font-semibold text-primary">
            {hasRelayData ? `${avgLatency!.toFixed(1)}s` : "—"}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {hasRelayData ? "avg relay latency (30d)" : "no successful copies in the last 30 days"}
          </div>
        </div>
        <div className="absolute inset-x-3 bottom-3 flex items-center gap-3 rounded-lg border border-sidebar-border bg-surface-2 p-3">
          <Avatar name={name} size={34} />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{name}</div>
            <div className="truncate text-xs text-muted-foreground">
              {accounts.length} account{accounts.length === 1 ? "" : "s"}
            </div>
          </div>
        </div>
      </aside>

      {open && (
        <button
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-background/70 lg:hidden"
        />
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-border bg-background/85 px-4 backdrop-blur sm:px-6">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation">
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-lg font-semibold">{title}</h1>
            {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="hidden items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-muted-foreground md:flex">
            <Search className="h-3.5 w-3.5" />
            <span className="text-xs">Search masters, symbols…</span>
          </div>
          <button className="relative rounded-md border border-border bg-surface p-2" aria-label="Notifications">
            <Bell className="h-4 w-4" />
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
          </button>
          {actions}
        </header>
        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
