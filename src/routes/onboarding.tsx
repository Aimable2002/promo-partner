import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, Radio, Users } from "lucide-react";
import { toast } from "sonner";
import { Logo, Avatar } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { endpoints, ApiError, type DirectoryMaster } from "@/lib/api";
import type { SizingMode } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Set up your desk — CopyDesk onboarding" },
      {
        name: "description",
        content:
          "Choose whether you publish trades as a master or copy one as a follower, connect your MT5 or cTrader account and set your position sizing rule.",
      },
      { property: "og:title", content: "Set up your desk — CopyDesk onboarding" },
      {
        property: "og:description",
        content: "Connect your broker account and configure risk-normalised copy sizing.",
      },
    ],
  }),
  component: Onboarding,
});

type Role = "master" | "follower" | null;
type Platform = "MT5" | "cTrader";

type DoneInfo = {
  status: "live" | "awaiting_attention" | "ctrader_connected";
  message: string | null;
};

function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<Role>(null);
  const [platform, setPlatform] = useState<Platform>("MT5");

  const [masterId, setMasterId] = useState<string | null>(null);
  const [sizing, setSizing] = useState<SizingMode>("risk-percent");
  const [risk, setRisk] = useState(0.75);
  const [fixedLot, setFixedLot] = useState("0.10");
  const [microLot, setMicroLot] = useState("0.01");

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [server, setServer] = useState("");
  const [broker, setBroker] = useState("");
  const [bio, setBio] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [doneInfo, setDoneInfo] = useState<DoneInfo | null>(null);

  const mastersQuery = useQuery({
    queryKey: ["onboarding-masters-directory"],
    queryFn: (): Promise<DirectoryMaster[]> => endpoints.mastersDirectory(),
  });

  // Handle cTrader OAuth redirect back to this page.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const status = params.get("ctrader_status");
    const message = params.get("message");
    if (!status) return;
    if (status === "connected") {
      setRole("master");
      setPlatform("cTrader");
      setDoneInfo({ status: "live", message: message ?? null });
      setStep(3);
      toast.success(message ?? "cTrader account connected");
    } else {
      toast.error(message ?? "cTrader connection failed");
      setFormError(message ?? "cTrader connection failed");
    }
  }, []);

  const steps = role === "master" ? ["Role", "Platform", "Account", "Done"] : ["Role", "Master", "Account", "Sizing", "Done"];
  const last = steps.length - 1;
  const accountStepIndex = role === "master" ? 2 : 2;
  const doneStepIndex = last;

  const visibleMasters = (mastersQuery.data ?? []).slice(0, 5);

  useEffect(() => {
    if (!masterId && visibleMasters.length) setMasterId(visibleMasters[0]!.account_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleMasters.length]);

  function validateSizingValue(): { value: number | null; error: string | null } {
    if (sizing === "proportional") return { value: null, error: null };
    if (sizing === "risk-percent") {
      if (!(risk > 0)) return { value: null, error: "Risk % must be greater than 0" };
      return { value: risk, error: null };
    }
    if (sizing === "fixed-lot") {
      const n = Number(fixedLot);
      if (!(n > 0)) return { value: null, error: "Lot size must be greater than 0" };
      return { value: n, error: null };
    }
    // micro-scale
    const n = Number(microLot);
    if (!(n >= 0.01)) return { value: null, error: "Minimum lot size must be at least 0.01" };
    return { value: n, error: null };
  }

  const goDashboard = () => navigate({ to: "/dashboard" });

  const handleProvisionResult = (res: { status?: string; account_id?: string; message?: string }) => {
    if (res.status === "awaiting_attention") {
      toast.info(
        res.message ??
          "Your account may need a manual step (e.g. a broker popup). Provisioning is finishing in the background.",
      );
      goDashboard();
      return;
    }
    setDoneInfo({ status: "live", message: res.message ?? null });
    setStep(doneStepIndex);
  };

  const finish = async () => {
    setFormError(null);

    if (role === "master") {
      if (platform === "cTrader") {
        setSubmitting(true);
        try {
          const res = await endpoints.ctraderStart({ role: "master", broker: broker || null });
          const url = res.redirect_url ?? res.url ?? res.authorization_url;
          if (!url) throw new Error("No redirect URL returned for cTrader connection.");
          window.location.assign(url);
        } catch (err) {
          const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Failed to start cTrader connection";
          setFormError(message);
          toast.error(message);
        } finally {
          setSubmitting(false);
        }
        return;
      }

      if (!login || !password || !server) {
        setFormError("Login, password and server are required");
        return;
      }
      setSubmitting(true);
      try {
        const res = await endpoints.provision({
          role: "master",
          login,
          password,
          server,
          broker: broker || null,
        });
        handleProvisionResult(res);
      } catch (err) {
        const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Provisioning failed";
        setFormError(message);
        toast.error(message);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // follower
    if (!masterId) {
      setFormError("Pick a master to copy");
      return;
    }
    if (!login || !password || !server) {
      setFormError("Login, password and server are required");
      return;
    }
    const { value: sizingValue, error: sizingError } = validateSizingValue();
    if (sizingError) {
      setFormError(sizingError);
      return;
    }
    setSubmitting(true);
    try {
      const res = await endpoints.provision({
        role: "follower",
        login,
        password,
        server,
        broker: broker || null,
        master_account_id: masterId,
        sizing_mode: sizing,
        sizing_value: sizingValue,
      });
      handleProvisionResult(res);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Provisioning failed";
      setFormError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const canContinue = () => {
    if (step === 0) return !!role;
    return true;
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5">
          <Logo />
          <span className="text-xs text-muted-foreground">
            Step {Math.min(step + 1, steps.length)} of {steps.length}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-12">
        <div className="mb-10 flex items-center gap-2">
          {steps.map((s, i) => (
            <div key={s} className="flex flex-1 items-center gap-2">
              <span
                className={cn(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] num",
                  i < step
                    ? "border-primary bg-primary text-primary-foreground"
                    : i === step
                      ? "border-primary text-primary"
                      : "border-border text-muted-foreground",
                )}
              >
                {i < step ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className={cn("text-xs", i === step ? "text-foreground" : "text-muted-foreground")}>
                {s}
              </span>
              {i < steps.length - 1 && <span className="h-px flex-1 bg-border" />}
            </div>
          ))}
        </div>

        {step === 0 && (
          <Panel title="How are you joining?" sub="You can add the other side later from your dashboard.">
            <div className="grid gap-4 sm:grid-cols-2">
              <RoleCard
                active={role === "master"}
                onClick={() => setRole("master")}
                icon={Radio}
                title="Master"
                desc="Publish your live fills. Followers mirror them and you earn a performance or monthly fee."
                bullets={["MT5 or cTrader", "Public profile & directory listing", "Monthly payouts"]}
              />
              <RoleCard
                active={role === "follower"}
                onClick={() => setRole("follower")}
                icon={Users}
                title="Follower"
                desc="Copy a verified master into your own broker account, sized to your equity and risk."
                bullets={["MT5 brokers", "Risk-normalised sizing", "Pause any time"]}
              />
            </div>
          </Panel>
        )}

        {step === 1 && role === "master" && (
          <Panel title="Where do you trade?" sub="This is the account whose fills get published.">
            <div className="grid gap-4 sm:grid-cols-2">
              {(["MT5", "cTrader"] as Platform[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPlatform(p)}
                  className={cn(
                    "rounded-lg border p-5 text-left transition-colors",
                    platform === p ? "border-primary bg-surface-2" : "border-border bg-surface hover:border-border",
                  )}
                >
                  <div className="font-display text-lg font-semibold">{p}</div>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {p === "MT5"
                      ? "Connect via login, password and server. Works with any MT5 broker."
                      : "Connect via cTrader Open API OAuth. No password shared."}
                  </p>
                </button>
              ))}
            </div>
          </Panel>
        )}

        {step === 1 && role === "follower" && (
          <Panel title="Pick a master to copy" sub="Change or add more later — Pro allows unlimited subscriptions.">
            <div className="space-y-3">
              {mastersQuery.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
              {!mastersQuery.isLoading && visibleMasters.length === 0 && (
                <p className="text-sm text-muted-foreground">No masters available yet.</p>
              )}
              {visibleMasters.map((m) => (
                <button
                  key={m.account_id}
                  onClick={() => setMasterId(m.account_id)}
                  className={cn(
                    "flex w-full items-center gap-4 rounded-lg border p-4 text-left transition-colors",
                    masterId === m.account_id ? "border-primary bg-surface-2" : "border-border bg-surface",
                  )}
                >
                  <Avatar name={m.display_name ?? "Master"} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{m.display_name ?? "Unnamed master"}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {m.bio ?? "No bio yet"} · {m.platform ?? "—"}
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">{m.country ?? ""}</div>
                </button>
              ))}
            </div>
          </Panel>
        )}

        {step === accountStepIndex && (role === "master" || role === "follower") && (
          <Panel
            title="Connect your broker account"
            sub={
              role === "master" && platform === "cTrader"
                ? "cTrader uses OAuth — we only need your broker label."
                : "Use your trading credentials. CopyDesk cannot withdraw funds."
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="broker">Broker name (optional)</Label>
                <Input
                  id="broker"
                  placeholder="IC Markets"
                  value={broker}
                  onChange={(e) => setBroker(e.target.value)}
                />
              </div>
              {!(role === "master" && platform === "cTrader") && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="server">Server</Label>
                    <Input
                      id="server"
                      placeholder="ICMarkets-Live12"
                      value={server}
                      onChange={(e) => setServer(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="login">Account login</Label>
                    <Input
                      id="login"
                      placeholder="51840223"
                      className="num"
                      value={login}
                      onChange={(e) => setLogin(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pw">Trading password</Label>
                    <Input
                      id="pw"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </>
              )}
              {role === "master" && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="bio">Public strategy description</Label>
                  <Textarea
                    id="bio"
                    rows={3}
                    placeholder="London breakout on majors, fixed 1% risk, no grid…"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                  />
                </div>
              )}
            </div>
            {formError && <p className="mt-4 text-sm text-destructive">{formError}</p>}
          </Panel>
        )}

        {step === 3 && role === "follower" && (
          <Panel title="How should your positions be sized?" sub="This is the single most important setting on the platform.">
            <div className="grid gap-3">
              {[
                {
                  id: "proportional" as const,
                  t: "Proportional to equity",
                  d: "Your lot = master lot × (your equity ÷ master equity). The classic 1:1 mirror.",
                },
                {
                  id: "risk-percent" as const,
                  t: "Fixed % risk per trade",
                  d: "Every trade risks the same slice of your equity, regardless of the master's own sizing.",
                },
                {
                  id: "fixed-lot" as const,
                  t: "Fixed lot size",
                  d: "Always trade the same volume. Simple, but ignores stop distance.",
                },
                {
                  id: "micro-scale" as const,
                  t: "Micro-scaling (small accounts)",
                  d: "Scales down to your broker's 0.01 minimum and tracks the fractional remainder, so a $150 account still receives every single signal instead of skipping the ones it can't afford.",
                },
              ].map((o) => (
                <button
                  key={o.id}
                  onClick={() => setSizing(o.id)}
                  className={cn(
                    "rounded-lg border p-4 text-left transition-colors",
                    sizing === o.id ? "border-primary bg-surface-2" : "border-border bg-surface",
                  )}
                >
                  <div className="flex items-center gap-2 font-medium">
                    {o.t}
                    {o.id === "micro-scale" && <Badge variant="outline" className="text-[10px]">for accounts under $500</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{o.d}</p>
                </button>
              ))}
            </div>

            {sizing === "risk-percent" && (
              <div className="mt-6 rounded-lg border border-border bg-surface p-5">
                <div className="flex items-center justify-between">
                  <Label>Risk % of equity per trade</Label>
                  <span className="num text-primary">{risk.toFixed(2)}%</span>
                </div>
                <Slider
                  className="mt-4"
                  value={[risk]}
                  min={0.1}
                  max={3}
                  step={0.05}
                  onValueChange={(v) => setRisk(v[0] ?? 0.75)}
                />
                <p className="mt-3 text-xs text-muted-foreground">
                  On a $4,820 account that's about ${(4820 * risk / 100).toFixed(2)} at stop-loss per position.
                </p>
              </div>
            )}

            {sizing === "fixed-lot" && (
              <div className="mt-6 space-y-1.5 rounded-lg border border-border bg-surface p-5">
                <Label htmlFor="fixed-lot">Lot size per trade</Label>
                <Input
                  id="fixed-lot"
                  className="num"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={fixedLot}
                  onChange={(e) => setFixedLot(e.target.value)}
                />
              </div>
            )}

            {sizing === "micro-scale" && (
              <div className="mt-6 space-y-1.5 rounded-lg border border-border bg-surface p-5">
                <Label htmlFor="micro-lot">Minimum lot size</Label>
                <Input
                  id="micro-lot"
                  className="num"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={microLot}
                  onChange={(e) => setMicroLot(e.target.value)}
                />
              </div>
            )}

            {formError && <p className="mt-4 text-sm text-destructive">{formError}</p>}
          </Panel>
        )}

        {step === doneStepIndex && (
          <Panel
            title={doneInfo?.status === "ctrader_connected" ? "cTrader connected" : "You're all set"}
            {...(doneInfo?.message ? { sub: doneInfo.message } : {})}
          >
            <div className="rounded-lg border border-border bg-surface p-6 text-center">
              <Check className="mx-auto h-8 w-8 text-primary" />
              <p className="mt-3 text-sm text-muted-foreground">
                Your account is live. Head to your dashboard to watch it work.
              </p>
            </div>
          </Panel>
        )}

        <div className="mt-8 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || step === doneStepIndex}
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          {step === doneStepIndex ? (
            <Button onClick={goDashboard}>
              Go to dashboard <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button
              disabled={!canContinue() || submitting}
              onClick={() => (step === last - 1 ? finish() : setStep((s) => s + 1))}
            >
              {step === last - 1 ? (submitting ? "Submitting…" : "Finish setup") : "Continue"} <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Panel({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section>
      <h1 className="text-2xl font-bold">{title}</h1>
      {sub && <p className="mt-1.5 text-sm text-muted-foreground">{sub}</p>}
      <div className="mt-7">{children}</div>
    </section>
  );
}

function RoleCard({
  active,
  onClick,
  icon: Icon,
  title,
  desc,
  bullets,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  title: string;
  desc: string;
  bullets: string[];
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-lg border p-6 text-left transition-colors",
        active ? "border-primary bg-surface-2" : "border-border bg-surface",
      )}
    >
      <Icon className="h-5 w-5 text-primary" />
      <div className="mt-4 font-display text-lg font-semibold">{title}</div>
      <p className="mt-1.5 text-sm text-muted-foreground">{desc}</p>
      <ul className="mt-4 space-y-1.5">
        {bullets.map((b) => (
          <li key={b} className="flex items-center gap-2 text-xs text-muted-foreground">
            <Check className="h-3 w-3 text-primary" /> {b}
          </li>
        ))}
      </ul>
    </button>
  );
}
