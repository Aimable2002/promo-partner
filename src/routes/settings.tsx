import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRequireAuth } from "@/hooks/use-copydesk";

import { LogOut, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Account settings — email, password and sessions | CopyDesk" },
      {
        name: "description",
        content:
          "Update your CopyDesk email and password, manage copy notifications and two-factor protection, and sign out of your account.",
      },
      { property: "og:title", content: "Account settings — CopyDesk" },
      {
        property: "og:description",
        content: "Manage your CopyDesk login credentials, security and notifications.",
      },
    ],
  }),
  component: Settings,
});

function Settings() {
  const navigate = useNavigate();
  const { session, loading } = useRequireAuth();
  const [email, setEmail] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  useEffect(() => {
    if (session?.user?.email) setEmail(session.user.email);
  }, [session?.user?.email]);

  return (
    <AppShell title="Settings" subtitle="Manage your login, security and notifications">
      <div className="grid max-w-3xl gap-6">
        <form
          className="panel space-y-4 p-6"
          onSubmit={async (e) => {
            e.preventDefault();
            setEmailBusy(true);
            const { error } = await supabase.auth.updateUser({ email });
            setEmailBusy(false);
            if (error) toast.error(error.message);
            else toast.success("Email updated — confirmation sent");
          }}
        >
          <div>
            <h2 className="font-display font-semibold">Email address</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Used for sign-in, copy alerts and payout receipts.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="em">Email</Label>
            <Input
              id="em"
              type="email"
              value={email}
              disabled={loading}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={emailBusy || loading}>
            {emailBusy ? "Updating…" : "Update email"}
          </Button>
        </form>

        <form
          className="panel space-y-4 p-6"
          onSubmit={async (e) => {
            e.preventDefault();
            if (newPw.length < 8) {
              toast.error("Password must be at least 8 characters");
              return;
            }
            if (newPw !== confirmPw) {
              toast.error("Passwords do not match");
              return;
            }
            setPwBusy(true);
            const { error } = await supabase.auth.updateUser({ password: newPw });
            setPwBusy(false);
            if (error) {
              toast.error(error.message);
              return;
            }
            setNewPw("");
            setConfirmPw("");
            toast.success("Password changed");
          }}
        >
          <div>
            <h2 className="font-display font-semibold">Password</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Changing your password signs out every other device.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="np">New password</Label>
              <Input
                id="np"
                type="password"
                placeholder="••••••••"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rp">Confirm new password</Label>
              <Input
                id="rp"
                type="password"
                placeholder="••••••••"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
              />
            </div>
          </div>
          <Button type="submit" disabled={pwBusy}>
            {pwBusy ? "Saving…" : "Change password"}
          </Button>
        </form>


        <div className="panel p-6">
          <h2 className="font-display font-semibold">Security & alerts</h2>
          <div className="mt-5 space-y-5">
            <Toggle
              title="Two-factor authentication"
              desc="Require an authenticator code when signing in."
              defaultChecked
            />
            <Separator />
            <Toggle
              title="Copy execution alerts"
              desc="Email me when a mirrored order is rejected by my broker."
              defaultChecked
            />
            <Separator />
            <Toggle
              title="Master activity digest"
              desc="Weekly summary of the masters I copy."
            />
          </div>
          <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            CopyDesk only ever holds read-and-trade credentials — never withdrawal rights.
          </p>
        </div>

        <div className="panel flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <h2 className="font-display font-semibold">Sign out</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Copying keeps running on the relay while you're signed out.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={async () => {
              await supabase.auth.signOut();
              toast.success("Signed out");
              navigate({ to: "/auth" });
            }}

          >
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

function Toggle({
  title,
  desc,
  defaultChecked,
}: {
  title: string;
  desc: string;
  defaultChecked?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="mt-0.5 text-sm text-muted-foreground">{desc}</div>
      </div>
      <Switch defaultChecked={defaultChecked ?? false} />
    </div>
  );
}
