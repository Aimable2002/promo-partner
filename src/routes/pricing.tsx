import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { MarketingFooter, MarketingNav } from "@/components/marketing";
import { SectionTitle } from "@/components/brand";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { usePackages } from "@/hooks/use-copydesk";
import { packageName, packagePrice } from "@/lib/supabase";
import { fmtMoney } from "@/lib/format";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — copy-trading plans from free to Desk | CopyDesk" },
      {
        name: "description",
        content:
          "Flat monthly access from $0. Compare Starter, Pro and Desk tiers: account limits, relay priority, sizing engine and master publishing.",
      },
      { property: "og:title", content: "Pricing — copy-trading plans | CopyDesk" },
      {
        property: "og:description",
        content: "Free tier for one master, Pro for multi-account followers, Desk for master traders.",
      },
    ],
  }),
  component: Pricing,
});

const FAQ = [
  [
    "Do you take a cut of my trading profits?",
    "No. CopyDesk charges a flat monthly subscription only — there are no profit shares or performance fees, for you or from masters.",
  ],
  [
    "Can I copy on a $150 account?",
    "Yes. Micro-scaling drops volume to your broker's 0.01 minimum and tracks the fractional remainder so you still receive every signal instead of skipping the ones your equity can't carry.",
  ],
  [
    "What happens if I cancel?",
    "Copying stops at the end of the paid period. Your open positions stay in your account — CopyDesk never force-closes them on cancellation, and you keep terminal control at all times.",
  ],
  [
    "Which platforms are supported?",
    "Followers connect any MT5-based broker. Masters can publish from MT5 or cTrader. MT4 is not supported.",
  ],
] as const;

function Pricing() {
  const { data: packages = [] } = usePackages();

  return (
    <div className="min-h-screen">
      <MarketingNav />
      <section className="relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute inset-0" style={{ background: "var(--gradient-glow)" }} />
        <div className="relative mx-auto max-w-7xl px-5 py-20">
          <SectionTitle
            eyebrow="Pricing"
            title="One flat fee. No spread markup."
            sub="Your broker charges what your broker charges. We don't touch it, mark it up, or take a rebate for routing you."
          />
          <div className="mt-14 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {packages.map((p) => (
              <div key={p.code} className="panel flex flex-col p-7">
                <div className="font-display text-lg font-semibold">{packageName(p)}</div>
                <div className="num mt-3 text-4xl font-bold">
                  {fmtMoney(packagePrice(p))}
                  <span className="text-sm font-normal text-muted-foreground">/mo</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {p.base_roster_size} roster slot{p.base_roster_size === 1 ? "" : "s"} included · billed
                  every {p.duration_days} days
                </p>
                <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                  {[
                    `${p.base_roster_size} master slots in your roster`,
                    `${fmtMoney(Number(p.slot_fee_per_slot))} per additional roster slot`,
                    `${p.duration_days}-day billing cycle`,
                  ].map((f) => (
                    <li key={f} className="flex gap-2.5">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
                <Button asChild className="mt-7" variant="outline">
                  <Link to="/checkout">Get started</Link>
                </Button>
              </div>
            ))}
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            Prices in USD. Local currency conversion (KES, NGN, GHS, ZAR) is shown at checkout with
            the rate applied.
          </p>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-3xl px-5 py-20">
          <SectionTitle title="Questions traders actually ask" />
          <Accordion type="single" collapsible className="mt-8">
            {FAQ.map(([q, a]) => (
              <AccordionItem key={q} value={q}>
                <AccordionTrigger className="text-left">{q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
