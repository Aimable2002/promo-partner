import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Stat, StatusDot } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError, endpoints } from "@/lib/api";
import { supabase, type ChallengeRow } from "@/lib/supabase";
import {
  createPromoCodes,
  deletePromoCode,
  fetchPromoCodes,
  setPromoActive,
  type PromoCodeRow,
} from "@/lib/promo";
import { fmtDate, fmtMoney } from "@/lib/format";
import { useRequireAdmin, usePackages } from "@/hooks/use-copydesk";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin console — payouts, users and challenges | CopyDesk" },
      {
        name: "description",
        content:
          "Platform KPIs, the pending master payout queue, user management, challenge program editing and directory moderation for CopyDesk operators.",
      },
      { property: "og:title", content: "Admin console — CopyDesk" },
      {
        property: "og:description",
        content: "Operate the relay: payouts, users, challenge programs and master moderation.",
      },
    ],
  }),
  component: Admin,
});

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const EMPTY_CHALLENGE_FORM: Omit<ChallengeRow, "id" | "created_at"> = {
  name: "",
  description: "",
  is_fixed: false,
  fee: 0,
  profit_target_pct: 8,
  max_daily_loss_pct: 5,
  max_drawdown_pct: 10,
  min_days: 5,
  reward_amount: 0,
  active: true,
};

function Admin() {
  const queryClient = useQueryClient();
  const { isAdmin, loading: adminLoading } = useRequireAdmin();

  const summaryQuery = useQuery({
    queryKey: ["admin-summary"],
    queryFn: endpoints.adminSummary,
    enabled: isAdmin,
  });
  const topMastersQuery = useQuery({
    queryKey: ["admin-top-masters"],
    queryFn: endpoints.adminTopMasters,
    enabled: isAdmin,
  });
  const usersQuery = useQuery({ queryKey: ["admin-users"], queryFn: endpoints.adminUsers, enabled: isAdmin });
  const payoutsQuery = useQuery({ queryKey: ["admin-payouts"], queryFn: endpoints.adminPayouts, enabled: isAdmin });
  const mastersQuery = useQuery({ queryKey: ["admin-masters"], queryFn: endpoints.adminMasters, enabled: isAdmin });
  const challengesQuery = useQuery({
    queryKey: ["admin-challenges"],
    enabled: isAdmin,
    queryFn: async (): Promise<ChallengeRow[]> => {
      const { data, error } = await supabase
        .from("challenges")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ChallengeRow[];
    },
  });

  const [form, setForm] = useState(EMPTY_CHALLENGE_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);

  const startEdit = (c: ChallengeRow) => {
    const { id: _id, created_at: _created_at, ...rest } = c;
    setForm(rest);
    setEditingId(c.id);
  };

  const cancelEdit = () => {
    setForm(EMPTY_CHALLENGE_FORM);
    setEditingId(null);
  };

  const fixedChallenge = useMemo(
    () => (challengesQuery.data ?? []).find((c) => c.is_fixed) ?? null,
    [challengesQuery.data],
  );

  const decide = async (id: string, action: "approve" | "reject") => {
    try {
      if (action === "approve") await endpoints.adminApprovePayout(id);
      else await endpoints.adminRejectPayout(id);
      toast.success(`Payout ${action}d`);
      queryClient.invalidateQueries({ queryKey: ["admin-payouts"] });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not update payout");
    }
  };

  const toggleUserAction = (email: string, status: string) => {
    toast.message(`No suspend endpoint yet — ${email} is ${status}`);
  };

  const setMasterPublic = async (id: string, isPublic: boolean) => {
    try {
      await endpoints.adminSetMasterPublic(id, isPublic);
      toast.success(isPublic ? "Master made public" : "Master hidden from directory");
      queryClient.invalidateQueries({ queryKey: ["admin-masters"] });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not update visibility");
    }
  };

  const saveChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    const isEditing = editingId !== null;
    // Unsetting the current "mandatory first" holder only makes sense when
    // this save is about to hand that flag to a *different* challenge -
    // editing the fixed challenge itself while leaving is_fixed on is a
    // no-op, not a hand-off.
    const willReassignFixed =
      form.is_fixed && fixedChallenge && fixedChallenge.id !== editingId;
    if (willReassignFixed) {
      toast.message(`Saving will unset "mandatory first" on ${fixedChallenge!.name}`);
    }
    try {
      if (willReassignFixed) {
        await supabase.from("challenges").update({ is_fixed: false }).eq("id", fixedChallenge!.id);
      }
      if (isEditing) {
        const { error } = await supabase.from("challenges").update(form).eq("id", editingId);
        if (error) throw error;
        toast.success("Challenge program updated");
      } else {
        const { error } = await supabase.from("challenges").insert(form);
        if (error) throw error;
        toast.success("Challenge program created");
      }
      cancelEdit();
      queryClient.invalidateQueries({ queryKey: ["admin-challenges"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Could not ${isEditing ? "update" : "create"} challenge`);
    }
  };

  const toggleChallengeActive = async (c: ChallengeRow) => {
    try {
      const { error } = await supabase
        .from("challenges")
        .update({ active: !c.active })
        .eq("id", c.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["admin-challenges"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update challenge");
    }
  };

  const summary = summaryQuery.data as Record<string, unknown> | undefined;
  const kpis = summary
    ? [
        { label: "MRR", value: fmtMoney(num(summary.mrr)) },
        { label: "Accounts", value: String(num(summary.accounts_total)) },
        { label: "Masters", value: String(num(summary.masters_count)) },
        { label: "Followers", value: String(num(summary.followers_count)) },
        {
          label: "Payouts pending",
          value: `${fmtMoney(num(summary.payouts_pending_amount))} · ${num(summary.payouts_pending_count)}`,
        },
        { label: "At-risk wallets", value: String(num(summary.at_risk_wallets_count)) },
        { label: "Copied today", value: String(num(summary.copied_today)) },
        { label: "Failed copies (24h)", value: String(num(summary.failed_copies_24h)) },
        { label: "Failed copy rate (24h)", value: `${num(summary.failed_copies_pct_24h).toFixed(1)}%` },
      ]
    : [];

  const payouts = (payoutsQuery.data ?? []) as Record<string, unknown>[];
  const pending = payouts.filter((p) => String(p.status ?? "") === "pending");

  if (adminLoading || !isAdmin) {
    return (
      <AppShell title="Admin console" subtitle="Platform operations — restricted access">
        <div className="panel p-6 text-sm text-muted-foreground">
          {adminLoading ? "Checking access…" : "Redirecting…"}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Admin console"
      subtitle="Platform operations — restricted access"
      actions={<Badge variant="outline">Operator</Badge>}
    >
      {summaryQuery.isError ? (
        <div className="panel p-6 text-sm text-destructive">
          {summaryQuery.error instanceof ApiError ? summaryQuery.error.message : "Could not load summary."}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {kpis.map((k) => (
            <Stat key={k.label} label={k.label} value={k.value} />
          ))}
        </div>
      )}

      <Tabs defaultValue="payouts" className="mt-8">
        <TabsList>
          <TabsTrigger value="payouts">Payouts ({pending.length})</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="challenges">Challenges</TabsTrigger>
          <TabsTrigger value="directory">Directory</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="payouts" className="mt-5">
          {payoutsQuery.isError ? (
            <div className="panel p-6 text-sm text-destructive">
              {payoutsQuery.error instanceof ApiError ? payoutsQuery.error.message : "Could not load payouts."}
            </div>
          ) : (
            <div className="panel overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Master</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts.map((p, i) => {
                    const id = String(p.id ?? i);
                    const status = String(p.status ?? "pending");
                    return (
                      <TableRow key={id}>
                        <TableCell className="num">{id}</TableCell>
                        <TableCell>{String(p.master_account_id ?? p.master ?? "—")}</TableCell>
                        <TableCell className="num">{fmtMoney(num(p.amount))}</TableCell>
                        <TableCell className="text-muted-foreground">{String(p.payout_method ?? "—")}</TableCell>
                        <TableCell className="num text-xs">{String(p.payout_account_number ?? "—")}</TableCell>
                        <TableCell className="num text-muted-foreground">{fmtDate(p.created_at as string | undefined)}</TableCell>
                        <TableCell>
                          <StatusDot status={status} />
                        </TableCell>
                        <TableCell className="text-right">
                          {status === "pending" ? (
                            <div className="flex justify-end gap-2">
                              <Button size="sm" onClick={() => decide(id, "approve")}>
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => decide(id, "reject")}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Resolved</span>
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

        <TabsContent value="users" className="mt-5">
          {usersQuery.isError ? (
            <div className="panel p-6 text-sm text-destructive">
              {usersQuery.error instanceof ApiError ? usersQuery.error.message : "Could not load users."}
            </div>
          ) : (
            <div className="panel overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Accounts</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {((usersQuery.data ?? []) as Record<string, unknown>[]).map((u, i) => {
                    const id = String(u.id ?? i);
                    const email = String(u.email ?? "—");
                    const status = String(u.status ?? "active");
                    return (
                      <TableRow key={id}>
                        <TableCell className="num">{id}</TableCell>
                        <TableCell>{email}</TableCell>
                        <TableCell className="capitalize text-muted-foreground">{String(u.role ?? "—")}</TableCell>
                        <TableCell className="num">{String(u.accounts ?? "—")}</TableCell>
                        <TableCell className="num text-muted-foreground">{fmtDate(u.joined as string | undefined)}</TableCell>
                        <TableCell>
                          <StatusDot status={status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => toggleUserAction(email, status)}>
                            {status === "suspended" ? "Reinstate" : "Suspend"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="challenges" className="mt-5">
          {challengesQuery.isError ? (
            <div className="panel p-6 text-sm text-destructive">Could not load challenges.</div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
              <div className="space-y-4">
                {(challengesQuery.data ?? []).map((c) => (
                  <div key={c.id} className="panel p-5">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="font-display font-semibold">{c.name}</div>
                      {c.is_fixed && <Badge>Mandatory first</Badge>}
                      <span className="num ml-auto text-sm text-muted-foreground">Fee {fmtMoney(c.fee)}</span>
                      <Button size="sm" variant="outline" onClick={() => startEdit(c)}>
                        Edit
                      </Button>
                      <Switch checked={c.active} onCheckedChange={() => toggleChallengeActive(c)} />
                    </div>
                    <div className="num mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                      <Field k="Profit target" v={`${c.profit_target_pct}%`} />
                      <Field k="Max daily loss" v={`${c.max_daily_loss_pct}%`} />
                      <Field k="Max drawdown" v={`${c.max_drawdown_pct}%`} />
                      <Field k="Min days" v={String(c.min_days)} />
                    </div>
                    <p className="mt-4 text-xs text-muted-foreground">
                      Reward: {c.reward_amount ? `${fmtMoney(c.reward_amount)} wallet credit` : "no wallet credit"}
                    </p>
                  </div>
                ))}
              </div>

              <form className="panel h-fit space-y-4 p-5" onSubmit={saveChallenge}>
                <div className="flex items-center justify-between">
                  <div className="font-display font-semibold">
                    {editingId ? "Edit program" : "New program"}
                  </div>
                  {editingId && (
                    <Button type="button" size="sm" variant="ghost" onClick={cancelEdit}>
                      Cancel
                    </Button>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pn">Program name</Label>
                  <Input id="pn" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ds">Description</Label>
                  <Textarea id="ds" value={form.description ?? ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="fe">Entry fee</Label>
                    <Input id="fe" className="num" type="number" value={form.fee} onChange={(e) => setForm((f) => ({ ...f, fee: Number(e.target.value) }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pt">Profit target %</Label>
                    <Input id="pt" className="num" type="number" value={form.profit_target_pct} onChange={(e) => setForm((f) => ({ ...f, profit_target_pct: Number(e.target.value) }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="dl">Max daily loss %</Label>
                    <Input id="dl" className="num" type="number" value={form.max_daily_loss_pct} onChange={(e) => setForm((f) => ({ ...f, max_daily_loss_pct: Number(e.target.value) }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="dd">Max drawdown %</Label>
                    <Input id="dd" className="num" type="number" value={form.max_drawdown_pct} onChange={(e) => setForm((f) => ({ ...f, max_drawdown_pct: Number(e.target.value) }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="md">Minimum days</Label>
                    <Input id="md" className="num" type="number" value={form.min_days} onChange={(e) => setForm((f) => ({ ...f, min_days: Number(e.target.value) }))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ra">Reward amount (wallet credit)</Label>
                  <Input id="ra" className="num" type="number" value={form.reward_amount ?? 0} onChange={(e) => setForm((f) => ({ ...f, reward_amount: Number(e.target.value) }))} />
                </div>
                <div className="flex items-center justify-between rounded-md border border-border p-3">
                  <div>
                    <Label htmlFor="fixed">Mandatory first challenge</Label>
                    {fixedChallenge && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Currently held by "{fixedChallenge.name}" — saving here will unset it there.
                      </p>
                    )}
                  </div>
                  <Switch id="fixed" checked={form.is_fixed} onCheckedChange={(v) => setForm((f) => ({ ...f, is_fixed: v }))} />
                </div>
                <Button type="submit" className="w-full">
                  {editingId ? "Save changes" : "Create program"}
                </Button>
              </form>
            </div>
          )}
        </TabsContent>

        <TabsContent value="directory" className="mt-5">
          {mastersQuery.isError ? (
            <div className="panel p-6 text-sm text-destructive">
              {mastersQuery.error instanceof ApiError ? mastersQuery.error.message : "Could not load masters."}
            </div>
          ) : (
            <div className="space-y-3">
              {((mastersQuery.data ?? []) as Record<string, unknown>[]).map((m, i) => {
                const id = String(m.account_id ?? m.id ?? i);
                const isPublic = Boolean(m.is_public ?? m.public);
                return (
                  <div key={id} className="panel flex flex-wrap items-center gap-4 p-4">
                    <div className="min-w-40">
                      <div className="font-medium">{String(m.display_name ?? id)}</div>
                      <div className="num text-xs text-muted-foreground">
                        {String(m.platform ?? "—")} · {String(m.followers_count ?? m.followers ?? 0)} followers
                      </div>
                    </div>
                    <div className="ml-auto flex flex-wrap items-center gap-2">
                      {!isPublic && <Badge variant="outline">Hidden</Badge>}
                      <Button
                        size="sm"
                        variant={isPublic ? "outline" : "default"}
                        onClick={() => setMasterPublic(id, !isPublic)}
                      >
                        {isPublic ? "Hide" : "Make public"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="mt-5">
          {topMastersQuery.isError ? (
            <div className="panel p-6 text-sm text-destructive">Could not load analytics.</div>
          ) : (
            <div className="panel overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Master</TableHead>
                    <TableHead>Followers</TableHead>
                    <TableHead className="text-right">Net P&L</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {((topMastersQuery.data ?? []) as Record<string, unknown>[]).map((m, i) => (
                    <TableRow key={String(m.account_id ?? i)}>
                      <TableCell>{String(m.display_name ?? m.account_id ?? "—")}</TableCell>
                      <TableCell className="num">{String(m.followers ?? m.followers_count ?? "—")}</TableCell>
                      <TableCell className="num text-right">
                        {m.net_pnl == null ? (
                          <span className="text-muted-foreground">unavailable</span>
                        ) : (
                          fmtMoney(num(m.net_pnl))
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className="mt-0.5">{v}</div>
    </div>
  );
}
