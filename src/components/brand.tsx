import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <Link to="/" className={cn("flex items-center gap-2.5", className)}>
      <span className="relative grid h-8 w-8 place-items-center rounded-md border border-border bg-surface-2">
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" aria-hidden>
          <path d="M3 16.5 8 10l4 4.5L21 4" stroke="var(--brand)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M3 21l5-6.5 4 4.5 9-10.5" stroke="var(--muted-foreground)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
        </svg>
      </span>
      {!compact && (
        <span className="font-display text-lg font-bold tracking-tight text-foreground">
          Copy<span className="text-primary">Desk</span>
        </span>
      )}
    </Link>
  );
}

export function PnL({
  value,
  prefix = "$",
  suffix = "",
  digits = 2,
  className,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  digits?: number;
  className?: string;
}) {
  const pos = value >= 0;
  return (
    <span className={cn("num font-medium", pos ? "text-long" : "text-short", className)}>
      {pos ? "+" : "−"}
      {prefix}
      {Math.abs(value).toLocaleString("en-US", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })}
      {suffix}
    </span>
  );
}

export function StatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    live: "bg-long",
    active: "bg-long",
    completed: "bg-long",
    paid: "bg-long",
    passed: "bg-long",
    paused: "bg-warn",
    pending: "bg-warn",
    closed: "bg-muted-foreground",
    cancelled: "bg-muted-foreground",
    suspended: "bg-short",
    failed: "bg-short",
    rejected: "bg-short",
    breached: "bg-short",
  };
  return (
    <span className="inline-flex items-center gap-1.5 text-xs capitalize text-muted-foreground">
      <span className={cn("h-1.5 w-1.5 rounded-full", map[status] ?? "bg-muted-foreground", status === "live" && "live-dot")} />
      {status}
    </span>
  );
}

export function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="panel p-4">
      <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className={cn("num mt-2 text-2xl font-semibold", accent && "text-primary")}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  sub,
  className,
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
  className?: string;
}) {
  return (
    <div className={cn("max-w-2xl", className)}>
      {eyebrow && (
        <div className="mb-3 text-[11px] uppercase tracking-[0.22em] text-primary">{eyebrow}</div>
      )}
      <h2 className="text-3xl font-bold sm:text-4xl">{title}</h2>
      {sub && <p className="mt-3 text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const hue = (name.charCodeAt(0) * 37) % 360;
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-display text-sm font-bold text-background"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(140deg, hsl(${hue} 65% 62%), hsl(${(hue + 55) % 360} 70% 48%))`,
        fontSize: size * 0.36,
      }}
    >
      {name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)}
    </span>
  );
}
