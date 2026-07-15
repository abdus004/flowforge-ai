import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Sparkles,
  Workflow,
  Database,
  Cpu,
  Layers,
  Shield,
  Zap,
  Rocket,
  Brain,
  GitBranch,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteLayout } from "@/components/site-layout";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <SiteLayout>
      <Hero />
      <Features />
      <HowItWorks />
      <WhyFlowForge />
      <CTA />
    </SiteLayout>
  );
}

function Hero() {
  return (
    <section className="relative px-4">
      <div className="mx-auto max-w-6xl pt-10 text-center sm:pt-16">
        <div className="glass mx-auto inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-muted-foreground">
          <span className="grid h-4 w-4 place-items-center rounded-full gradient-brand-bg">
            <Sparkles className="h-2.5 w-2.5 text-white" />
          </span>
          AI-powered software architect
        </div>

        <h1 className="mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
          <span className="gradient-text">FlowForge AI</span>
          <span className="mt-3 block text-foreground">
            Turn Ideas into <br className="hidden sm:block" />
            Development Blueprints.
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
          Transform your software ideas into complete AI-generated development blueprints
          including workflows, architecture, database design, AI recommendations and
          implementation plans.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/generate">
            <Button
              size="lg"
              className="group rounded-full gradient-brand-bg px-6 text-white shadow-lg hover:opacity-90"
            >
              Start Building
              <ArrowRight className="ml-1 h-4 w-4 transition group-hover:translate-x-0.5" />
            </Button>
          </Link>
          <a href="#features">
            <Button
              size="lg"
              variant="outline"
              className="rounded-full border-border bg-background/40 px-6 backdrop-blur"
            >
              Learn More
            </Button>
          </a>
        </div>

        <HeroPreview />
      </div>
    </section>
  );
}

function HeroPreview() {
  return (
    <div className="relative mx-auto mt-16 max-w-5xl">
      <div className="absolute inset-0 -z-10 gradient-brand-bg opacity-30 blur-3xl" />
      <div className="glass rounded-3xl p-4 sm:p-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: Workflow,
              title: "Workflow Map",
              body: "User → API → Queue → AI Worker → DB",
            },
            {
              icon: Database,
              title: "Schema",
              body: "users · projects · blueprints · runs",
            },
            {
              icon: Cpu,
              title: "AI Stack",
              body: "Gemini 2.5 · Embeddings · Vector Search",
            },
          ].map((c, i) => (
            <div
              key={i}
              className="rounded-2xl border border-border/60 bg-background/40 p-5 text-left"
            >
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg gradient-brand-soft">
                  <c.icon className="h-4 w-4 text-primary" />
                </span>
                <div className="text-sm font-semibold">{c.title}</div>
              </div>
              <p className="mt-3 font-mono text-xs text-muted-foreground">{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const FEATURES = [
  {
    icon: Workflow,
    title: "Complete Workflows",
    body: "Generate end-to-end user, system, and data flows tailored to your product idea.",
  },
  {
    icon: Layers,
    title: "System Architecture",
    body: "Get a modular architecture blueprint with services, integrations, and boundaries.",
  },
  {
    icon: Database,
    title: "Database Design",
    body: "Well-normalized schemas, relationships, and indexes ready for production.",
  },
  {
    icon: Brain,
    title: "AI Recommendations",
    body: "Best-fit models, embeddings, and vector strategies for your use case.",
  },
  {
    icon: GitBranch,
    title: "Implementation Plan",
    body: "Phase-by-phase roadmap with milestones, effort estimates, and risks.",
  },
  {
    icon: Shield,
    title: "Security by Default",
    body: "Auth flows, RLS policies, and data-safety guardrails baked in.",
  },
];

function Features() {
  return (
    <section id="features" className="px-4 pt-32">
      <div className="mx-auto max-w-6xl">
        <SectionHeader
          eyebrow="Features"
          title="Everything you need to ship, in one blueprint"
          subtitle="FlowForge translates fuzzy ideas into architecture-grade artifacts your team can build from on day one."
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="glass group rounded-3xl p-6 transition hover:-translate-y-1"
            >
              <span className="grid h-11 w-11 place-items-center rounded-2xl gradient-brand-bg text-white shadow-md">
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  {
    n: "01",
    title: "Describe your idea",
    body: "Share your product concept, target users, and constraints in plain language.",
  },
  {
    n: "02",
    title: "AI drafts the blueprint",
    body: "FlowForge analyzes and generates workflows, architecture, and database schema.",
  },
  {
    n: "03",
    title: "Compare workflows",
    body: "Explore alternative approaches side-by-side and pick the best fit.",
  },
  {
    n: "04",
    title: "Ship with confidence",
    body: "Export a complete implementation plan your engineering team can execute.",
  },
];

function HowItWorks() {
  return (
    <section id="how" className="px-4 pt-32">
      <div className="mx-auto max-w-6xl">
        <SectionHeader
          eyebrow="How It Works"
          title="From idea to blueprint in minutes"
          subtitle="A guided flow designed for founders, PMs, and engineers alike."
        />
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="glass relative rounded-3xl p-6">
              <div className="font-display text-4xl font-bold gradient-text">{s.n}</div>
              <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const WHY = [
  { icon: Zap, title: "10x faster planning", body: "Compress weeks of scoping into minutes without cutting corners." },
  { icon: Rocket, title: "Production-ready output", body: "Blueprints reflect real-world constraints and modern stacks." },
  { icon: CheckCircle2, title: "Opinionated but flexible", body: "Sensible defaults with room to compare and swap decisions." },
];

function WhyFlowForge() {
  return (
    <section id="about" className="px-4 pt-32">
      <div className="mx-auto max-w-6xl">
        <div className="glass overflow-hidden rounded-[2rem] p-8 sm:p-12">
          <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Why FlowForge AI
              </div>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                The <span className="gradient-text">architect co-pilot</span> your team has been missing.
              </h2>
              <p className="mt-4 text-muted-foreground">
                FlowForge combines domain-aware reasoning with battle-tested architecture
                patterns — so every blueprint feels handcrafted, not templated.
              </p>
            </div>
            <div className="grid gap-4">
              {WHY.map((w) => (
                <div
                  key={w.title}
                  className="flex gap-4 rounded-2xl border border-border/60 bg-background/40 p-5"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl gradient-brand-soft">
                    <w.icon className="h-5 w-5 text-primary" />
                  </span>
                  <div>
                    <h3 className="font-semibold">{w.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{w.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {eyebrow}
      </div>
      <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-muted-foreground">{subtitle}</p>
    </div>
  );
}
