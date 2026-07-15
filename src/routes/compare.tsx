import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, X, ArrowRight, Workflow, Zap, Layers } from "lucide-react";
import { SiteLayout } from "@/components/site-layout";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title: "Workflow Comparison — FlowForge AI" },
      {
        name: "description",
        content:
          "Compare AI-generated workflow options side-by-side to pick the right architecture for your project.",
      },
    ],
  }),
  component: ComparePage,
});

type Row = { label: string; a: boolean | string; b: boolean | string; c: boolean | string };

const WORKFLOWS = [
  {
    id: "lean",
    name: "Lean MVP",
    icon: Zap,
    tagline: "Ship fast. Validate faster.",
    price: "1–2 weeks",
    highlight: false,
  },
  {
    id: "scale",
    name: "Scale-Ready",
    icon: Layers,
    tagline: "Balanced for growth.",
    price: "3–5 weeks",
    highlight: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    icon: Workflow,
    tagline: "Compliance & control.",
    price: "6–10 weeks",
    highlight: false,
  },
];

const ROWS: Row[] = [
  { label: "Serverless architecture", a: true, b: true, c: false },
  { label: "Multi-tenant support", a: false, b: true, c: true },
  { label: "AI orchestration layer", a: "Basic", b: "Modular", c: "Full pipeline" },
  { label: "Database strategy", a: "Single Postgres", b: "Postgres + Vector", c: "Sharded + Vector" },
  { label: "Auth & SSO", a: "Email", b: "OAuth", c: "SSO / SAML" },
  { label: "Observability", a: "Logs", b: "Traces + Metrics", c: "Full APM" },
  { label: "Estimated cost / mo", a: "$50", b: "$400", c: "$2k+" },
  { label: "Rollout speed", a: "Fastest", b: "Balanced", c: "Deliberate" },
];

export function ComparePage() {
  return (
    <SiteLayout>
      <section className="px-4">
        <div className="mx-auto max-w-4xl text-center">
          <div className="glass mx-auto inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-muted-foreground">
            <Workflow className="h-3 w-3 text-primary" />
            Workflow Comparison
          </div>
          <h1 className="mt-6 font-display text-4xl font-bold sm:text-5xl">
            Pick the <span className="gradient-text">right shape</span> for your build
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Every idea can be built three ways. FlowForge maps the trade-offs so you can
            choose with clarity.
          </p>
        </div>

        {/* Cards */}
        <div className="mx-auto mt-12 grid max-w-6xl gap-5 md:grid-cols-3">
          {WORKFLOWS.map((w) => (
            <div
              key={w.id}
              className={`glass relative rounded-3xl p-6 transition hover:-translate-y-1 ${
                w.highlight ? "ring-2 ring-primary/60" : ""
              }`}
            >
              {w.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full gradient-brand-bg px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-white">
                  Recommended
                </div>
              )}
              <span className="grid h-11 w-11 place-items-center rounded-2xl gradient-brand-soft">
                <w.icon className="h-5 w-5 text-primary" />
              </span>
              <h3 className="mt-4 text-lg font-semibold">{w.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{w.tagline}</p>
              <div className="mt-5 flex items-baseline gap-2">
                <span className="font-display text-2xl font-bold gradient-text">{w.price}</span>
                <span className="text-xs text-muted-foreground">timeline</span>
              </div>
            </div>
          ))}
        </div>

        {/* Comparison table */}
        <div className="glass mx-auto mt-10 max-w-6xl overflow-hidden rounded-3xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs uppercase tracking-widest text-muted-foreground">
                  <th className="p-5">Capability</th>
                  {WORKFLOWS.map((w) => (
                    <th key={w.id} className="p-5">{w.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row, i) => (
                  <tr
                    key={row.label}
                    className={i % 2 ? "bg-background/30" : ""}
                  >
                    <td className="p-5 font-medium">{row.label}</td>
                    <Cell v={row.a} />
                    <Cell v={row.b} />
                    <Cell v={row.c} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mx-auto mt-10 flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Not sure which one? FlowForge picks a default based on your idea.
          </p>
          <Link to="/result">
            <Button size="lg" className="rounded-full gradient-brand-bg px-6 text-white hover:opacity-90">
              View Sample Blueprint
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </SiteLayout>
  );
}

function Cell({ v }: { v: boolean | string }) {
  if (typeof v === "boolean") {
    return (
      <td className="p-5">
        {v ? (
          <span className="inline-grid h-6 w-6 place-items-center rounded-full gradient-brand-soft text-primary">
            <Check className="h-3.5 w-3.5" />
          </span>
        ) : (
          <span className="inline-grid h-6 w-6 place-items-center rounded-full border border-border/60 text-muted-foreground">
            <X className="h-3.5 w-3.5" />
          </span>
        )}
      </td>
    );
  }
  return <td className="p-5 text-muted-foreground">{v}</td>;
}
