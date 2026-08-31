import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Target, Trophy } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Stat, StatusDot } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { endpoints, ApiError, type ChallengeApiRow, type ChallengeEnrollment } from "@/lib/api";
import { useActiveAccount, useLiveAccountState } from "@/hooks/use-copydesk";
import { fmtDate, fmtMoney } from "@/lib/format";

export const Route = createFileRoute("/challenges")({
  head: () => ({
    meta: [
      { title: "Trading challenges — earn a funded master seat | CopyDesk" },
      {
        name: "description",
        content:
          "Prop-firm style challenge programs with profit targets and drawdown limits. Track live progress on an active attempt and review past outcomes.",
      },
      { property: "og:title", content: "Trading challenges — funded master seats | CopyDesk" },
      {
        property: "og:description",
        content: "Hit the profit target inside the drawdown limits and unlock master status.",
      },
    ],
  }),
  component: ChallengesPage,
});

function elapsedDays(enrolledAt: string | null | undefined) {
  if (!enrolledAt) return 0;
  const start = new Date(enrolledAt);
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(1, Math.round((today.getTime() - start.getTime()) / 86400000) + 1);
}

function ChallengesPage() {
  const queryClient = useQueryClient();
  const { accounts: masterAccounts, accountId, account, select } = useActiveAccount(
    (a) => a.role === "master",
  );
  const liveState = useLiveAccountState(accountId ? [accountId] : []);
  const equity = accountId ? liveState[accountId]?.equity ?? null : null;

  const [enrollTarget, setEnrollTarget] = useState<ChallengeApiRow | null>(null);

  const challengesQuery = useQuery({
    queryKey: ["challenges"],
    queryFn: endpoints.challenges,
  });

  const statusQuery = useQuery({
    queryKey: ["challenge-status", accountId],
    queryFn: () => endpoints.challengeStatus(accountId!),
    enabled: !!accountId,
  });

  const historyQuery = useQuery({
    queryKey: ["challenge-history", accountId],
    queryFn: () => endpoints.challengeHistory(accountId!),
    enabled: !!accountId,
  });

  const enrollment: ChallengeEnrollment | null = statusQuery.data?.current_enrollment ?? null;
  const activeChallenge = useMemo(
    () => challengesQuery.data?.find((c) => c.id === enrollment?.challenge_id) ?? null,
    [challengesQuery.data, enrollment],
  );

  const metrics = useMemo(() => {
    if (!enrollment || equity == null) return null;
    const profitPct = enrollment.starting_equity
      ? ((equity - enrollment.starting_equity) / enrollment.starting_equity) * 100
      : 0;
    const dailyLossPct = enrollment.day_start_equity
      ? ((enrollment.day_start_equity - equity) / enrollment.day_start_equity) * 100
      : 0;
    const drawdownPct = enrollment.peak_equity
      ? ((enrollment.peak_equity - equity) / enrollment.peak_equity) * 100
      : 0;
    return {
      profitPct,
      dailyLossPct: Math.max(0, dailyLossPct),
      drawdownPct: Math.max(0, drawdownPct),
      days: elapsedDays(enrollment.enrolled_at),
    };
  }, [enrollment, equity]);

  const curve = (statusQuery.data?.equity_curve ?? []).map((p) => ({
    day: fmtDate(p.snapshot_date),
    equity: p.equity,
  }));

  const leave = async (challengeId: string) => {
    if (!accountId) return;
    try {
      await endpoints.leaveChallenge(accountId, challengeId);
      toast.success("Left the challenge attempt");
      queryClient.invalidateQueries({ queryKey: ["challenge-status", accountId] });
      queryClient.invalidateQueries({ queryKey: ["challenge-history", accountId] });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not leave challenge");
    }
  };

  return (
    <AppShell
      title="Challenges"
      subtitle="Prove the edge, unlock the seat"
      actions={
        masterAccounts.length > 1 ? (
          <Select value={accountId ?? undefined} onValueChange={select}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Select master account" />
            </SelectTrigger>
            <SelectContent>
              {masterAccounts.map((a) => (
                <SelectItem key={a.account_id} value={a.account_id}>
                  {a.platform ?? "Account"} · #{a.mt_login ?? a.account_id.slice(0, 8)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : undefined
      }
    >
      {!account && (
        <div className="panel p-6 text-sm text-muted-foreground">
          You need a master account to enroll in a challenge. Provision one from onboarding.
        </div>
      )}

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active attempt</TabsTrigger>
          <TabsTrigger value="programs">Programs</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-6">
          {statusQuery.isLoading ? (
            <div className="panel p-6 text-sm text-muted-foreground">Loading…</div>
          ) : !enrollment ? (
            <div className="panel p-6 text-sm text-muted-foreground">
              No active challenge attempt.{" "}
              {statusQuery.data?.phase === "graduated"
                ? "This master has already graduated."
                : "Start one from the Programs tab."}
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Stat
                  label="Program"
                  value={activeChallenge?.name ?? "—"}
                  hint={`Day ${metrics?.days ?? "—"} · started ${fmtDate(enrollment.enrolled_at)}`}
                />
                <Stat label="Equity" value={fmtMoney(equity ?? 0)} hint={`Start ${fmtMoney(enrollment.starting_equity)}`} />
                <Stat
                  label="Profit"
                  value={`${(metrics?.profitPct ?? 0).toFixed(2)}%`}
                  accent
                  hint={`Target ${activeChallenge?.profit_target_pct ?? "—"}%`}
                />
                <Stat
                  label="Drawdown used"
                  value={`${(metrics?.drawdownPct ?? 0).toFixed(2)}%`}
                  hint={`Limit ${activeChallenge?.max_drawdown_pct ?? "—"}%`}
                />
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-3">
                <div className="panel p-5 lg:col-span-2">
                  <h3 className="font-display font-semibold">Equity toward target</h3>
                  <div className="mt-5 h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={curve}>
                        <defs>
                          <linearGradient id="ch" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="day" tick={ax} tickLine={false} axisLine={false} />
                        <YAxis tick={ax} tickLine={false} axisLine={false} width={60} />
                        <Tooltip contentStyle={tt} />
                        <Area type="monotone" dataKey="equity" stroke="var(--brand)" strokeWidth={2} fill="url(#ch)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="panel p-5">
                  <h3 className="font-display font-semibold">Objectives</h3>
                  <div className="mt-5 space-y-5">
                    <Objective
                      label="Profit target"
                      value={metrics?.profitPct ?? 0}
                      max={activeChallenge?.profit_target_pct ?? 1}
                      unit="%"
                      tone="long"
                    />
                    <Objective
                      label="Daily loss used"
                      value={metrics?.dailyLossPct ?? 0}
                      max={activeChallenge?.max_daily_loss_pct ?? 1}
                      unit="%"
                      tone="warn"
                    />
                    <Objective
                      label="Max drawdown used"
                      value={metrics?.drawdownPct ?? 0}
                      max={activeChallenge?.max_drawdown_pct ?? 1}
                      unit="%"
                      tone="warn"
                    />
                    <Objective
                      label="Minimum days"
                      value={metrics?.days ?? 0}
                      max={activeChallenge?.min_days ?? 1}
                      unit=" days"
                      tone="long"
                    />
                  </div>
                  <p className="mt-5 text-xs text-muted-foreground">
                    A breach only ends this challenge attempt — your live account keeps running and
                    copying normally.
                  </p>
                  {activeChallenge && !activeChallenge.is_fixed && (
                    <Button
                      className="mt-4 w-full"
                      variant="outline"
                      onClick={() => leave(activeChallenge.id)}
                    >
                      Leave challenge
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="programs" className="mt-6">
          {challengesQuery.isLoading ? (
            <div className="panel p-6 text-sm text-muted-foreground">Loading…</div>
          ) : challengesQuery.isError ? (
            <div className="panel p-6 text-sm text-destructive">
              {challengesQuery.error instanceof ApiError
                ? challengesQuery.error.message
                : "Could not load challenges."}
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-3">
              {(challengesQuery.data ?? []).map((p) => (
                <div key={p.id} className="panel flex flex-col p-6">
                  <div className="flex items-center justify-between">
                    <Target className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="mt-4 font-display text-xl font-semibold">
                    {p.name} {p.is_fixed && <Badge className="ml-1 align-middle">Mandatory first</Badge>}
                  </h3>
                  <div className="num mt-1 text-2xl font-bold">
                    {fmtMoney(p.fee)}
                    <span className="text-sm font-normal text-muted-foreground"> entry</span>
                  </div>
                  {p.description && <p className="mt-2 text-xs text-muted-foreground">{p.description}</p>}
                  <dl className="mt-5 flex-1 space-y-2.5 text-sm">
                    <Row k="Profit target" v={`${p.profit_target_pct}%`} />
                    <Row k="Max daily loss" v={`${p.max_daily_loss_pct}%`} />
                    <Row k="Max drawdown" v={`${p.max_drawdown_pct}%`} />
                    <Row k="Minimum days" v={`${p.min_days}`} />
                  </dl>
                  <div className="mt-5 rounded-md border border-border bg-surface-2 p-3 text-xs text-muted-foreground">
                    <Trophy className="mb-1.5 h-3.5 w-3.5 text-warn" />
                    {p.reward_amount ? `${fmtMoney(p.reward_amount)} wallet credit on passing` : "No reward configured"}
                  </div>
                  <Button
                    className="mt-5"
                    disabled={!accountId}
                    onClick={() => setEnrollTarget(p)}
                  >
                    Start attempt
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          {historyQuery.isLoading ? (
            <div className="panel p-6 text-sm text-muted-foreground">Loading…</div>
          ) : !historyQuery.data?.length ? (
            <div className="panel p-6 text-sm text-muted-foreground">No past attempts yet.</div>
          ) : (
            <div className="panel overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Attempt</TableHead>
                    <TableHead>Program</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Ended</TableHead>
                    <TableHead className="text-right">Outcome</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyQuery.data.map((h, i) => {
                    const row = h as Record<string, unknown>;
                    const outcome = String(row.status ?? row.outcome ?? "—");
                    return (
                      <TableRow key={String(row.id ?? i)}>
                        <TableCell className="num text-xs">{String(row.id ?? i)}</TableCell>
                        <TableCell>{String(row.challenge_name ?? row.challenge_id ?? "—")}</TableCell>
                        <TableCell className="num text-xs text-muted-foreground">
                          {fmtDate(row.enrolled_at as string | undefined)}
                        </TableCell>
                        <TableCell className="num text-xs text-muted-foreground">
                          {fmtDate((row.ended_at ?? row.resolved_at) as string | undefined)}
                        </TableCell>
                        <TableCell className="text-right">
                          {outcome === "breached" ? (
                            <Badge variant="destructive">breached</Badge>
                          ) : outcome === "failed" ? (
                            <Badge variant="outline" className="border-warn/40 text-warn">
                              failed
                            </Badge>
                          ) : (
                            <StatusDot status={outcome} />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <EnrollDialog
        challenge={enrollTarget}
        accountId={accountId}
        onClose={() => setEnrollTarget(null)}
        onEnrolled={() => {
          queryClient.invalidateQueries({ queryKey: ["challenge-status", accountId] });
          queryClient.invalidateQueries({ queryKey: ["challenge-history", accountId] });
        }}
      />
    </AppShell>
  );
}

function EnrollDialog({
  challenge,
  accountId,
  onClose,
  onEnrolled,
}: {
  challenge: ChallengeApiRow | null;
  accountId: string | null;
  onClose: () => void;
  onEnrolled: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [network, setNetwork] = useState("mpesa");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challenge || !accountId) return;
    setBusy(true);
    try {
      const res = await endpoints.checkout({
        account_id: accountId,
        purpose: "challenge_entry",
        challenge_id: challenge.id,
        currency: "USD",
        method: "mobilemoney",
        phone_number: phone,
        network,
        redirect_url: typeof window !== "undefined" ? window.location.href : "",
      });
      const reference = String((res as Record<string, unknown>).reference ?? (res as Record<string, unknown>).id ?? "");
      if (!reference) {
        toast.error("Checkout did not return a payment reference");
        setBusy(false);
        return;
      }
      toast.message("Payment initiated — check your phone to confirm");
      await pollPayment(reference, () => {
        toast.success("Payment successful — checking enrollment…");
        setTimeout(() => {
          onEnrolled();
          toast.success("Enrollment updated. If it doesn't appear, contact support — your payment succeeded.");
        }, 1500);
      });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Checkout failed");
    } finally {
      setBusy(false);
      onClose();
    }
  };

  return (
    <Dialog open={!!challenge} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enroll in {challenge?.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Entry fee {challenge ? fmtMoney(challenge.fee) : ""}, paid via mobile money. Enrollment
            is created automatically once payment is confirmed.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="net">Network</Label>
            <Select value={network} onValueChange={setNetwork}>
              <SelectTrigger id="net">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mpesa">M-Pesa (Safaricom)</SelectItem>
                <SelectItem value="momo">MTN MoMo</SelectItem>
                <SelectItem value="airtel">Airtel Money</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ph">Mobile number</Label>
            <Input id="ph" className="num" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+254 7XX XXX XXX" required />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Processing…" : "Pay & enroll"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

async function pollPayment(reference: string, onSuccess: () => void, attempts = 20) {
  for (let i = 0; i < attempts; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    try {
      const status = await endpoints.paymentStatus(reference);
      const s = String((status as Record<string, unknown>).status ?? "");
      if (s === "successful") {
        onSuccess();
        return;
      }
      if (s && s !== "pending") {
        toast.error(`Payment ${s}`);
        return;
      }
    } catch {
      // keep polling
    }
  }
  toast.message("Still waiting on payment confirmation — check payment status later.");
}

function Objective({
  label,
  value,
  max,
  unit,
  tone,
}: {
  label: string;
  value: number;
  max: number;
  unit: string;
  tone: "long" | "warn";
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={`num ${tone === "long" ? "text-long" : "text-warn"}`}>
          {value.toFixed ? value.toFixed(1) : value}
          {unit} / {max}
          {unit}
        </span>
      </div>
      <Progress value={Math.min(100, (value / max) * 100)} className="mt-2 h-1.5" />
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="num">{v}</dd>
    </div>
  );
}

const ax = { fontSize: 11, fill: "var(--muted-foreground)" } as const;
const tt = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
} as const;
