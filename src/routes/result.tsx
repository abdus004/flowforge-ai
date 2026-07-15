import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Sparkles,
  Workflow,
  Layers,
  Database,
  Brain,
  ListChecks,
  ArrowLeft,
  Download,
  Share2,
  CheckCircle2,
} from "lucide-react";
import { SiteLayout } from "@/components/site-layout";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/result")({
  head: () => ({
    meta: [
      { title: "Your Blueprint — FlowForge AI" },
      {
        name: "description",
        content:
          "A complete AI-generated development blueprint: workflow, architecture, database, and implementation plan.",
      },
    ],
  }),
  component: ResultPage,
});

const SECTIONS = [
  { id: "workflow", label: "Workflow", icon: Workflow },
  { id: "architecture", label: "Architecture", icon: Layers },
  { id: "database", label: "Database", icon: Database },
  { id: "ai", label: "AI Stack", icon: Brain },
  { id: "plan", label: "Implementation", icon: ListChecks },
];

function ResultPage() {
  return (
    <SiteLayout>
      <section className="px-4">
        <div className="mx-auto max-w-6xl">
          {/* Header */}
          <div className="glass rounded-3xl p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <Link
                  to="/generate"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
                >
                  <ArrowLeft className="h-3 w-3" /> Back to generator
                </Link>
                <div className="mt-3 inline-flex items-center gap-2 rounded-full gradient-brand-soft px-3 py-1 text-xs font-medium text-primary">
                  <Sparkles className="h-3 w-3" /> Blueprint ready
                </div>
                <h1 className="mt-4 font-display text-3xl font-bold sm:text-4xl">
                  Nimbus Notes — <span className="gradient-text">AI Knowledge Companion</span>
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  A collaborative note-taking app that turns team journals into searchable,
                  actionable knowledge using AI summarization and semantic search.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="rounded-full">
                  <Share2 className="mr-1 h-4 w-4" /> Share
                </Button>
                <Button className="rounded-full gradient-brand-bg text-white hover:opacity-90">
                  <Download className="mr-1 h-4 w-4" /> Export
                </Button>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-4">
              {[
                { k: "Stack", v: "React · Node · Postgres" },
                { k: "Approach", v: "Scale-Ready" },
                { k: "Est. timeline", v: "4 weeks" },
                { k: "Confidence", v: "High" },
              ].map((s) => (
                <div
                  key={s.k}
                  className="rounded-2xl border border-border/60 bg-background/40 p-4"
                >
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {s.k}
                  </div>
                  <div className="mt-1 text-sm font-semibold">{s.v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr]">
            {/* Sidebar TOC */}
            <aside className="lg:sticky lg:top-28 lg:h-fit">
              <div className="glass rounded-2xl p-3">
                <div className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Sections
                </div>
                <nav className="flex flex-col gap-1">
                  {SECTIONS.map((s) => (
                    <a
                      key={s.id}
                      href={`#${s.id}`}
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
                    >
                      <s.icon className="h-4 w-4" />
                      {s.label}
                    </a>
                  ))}
                </nav>
              </div>
            </aside>

            <div className="space-y-6">
              <BlueprintCard id="workflow" icon={Workflow} title="User & System Workflow">
                <ol className="space-y-3 text-sm">
                  {[
                    "User captures a note via web or mobile client.",
                    "Note is queued for enrichment (summary + embeddings).",
                    "AI worker generates title, tags, and vector embedding.",
                    "Embedding stored in vector index; metadata in Postgres.",
                    "User searches with natural language → hybrid ranker returns results.",
                  ].map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full gradient-brand-bg text-[11px] font-bold text-white">
                        {i + 1}
                      </span>
                      <span className="text-muted-foreground">{step}</span>
                    </li>
                  ))}
                </ol>
              </BlueprintCard>

              <BlueprintCard id="architecture" icon={Layers} title="System Architecture">
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { t: "Frontend", d: "React + Vite, TanStack Router, Tailwind" },
                    { t: "API Layer", d: "Node (Hono) on edge runtime" },
                    { t: "Queue", d: "Managed queue for async AI jobs" },
                    { t: "AI Worker", d: "Serverless functions with retry & backoff" },
                    { t: "Data", d: "Postgres + pgvector for hybrid search" },
                    { t: "Observability", d: "Structured logs, traces, error tracking" },
                  ].map((b) => (
                    <div
                      key={b.t}
                      className="rounded-2xl border border-border/60 bg-background/40 p-4"
                    >
                      <div className="text-sm font-semibold">{b.t}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{b.d}</div>
                    </div>
                  ))}
                </div>
              </BlueprintCard>

              <BlueprintCard id="database" icon={Database} title="Database Design">
                <pre className="overflow-x-auto rounded-2xl border border-border/60 bg-background/60 p-5 font-mono text-xs leading-relaxed text-muted-foreground">
{`table users            (id, email, name, created_at)
table workspaces       (id, owner_id → users, name)
table notes            (id, workspace_id, author_id, body, created_at)
table note_summaries   (note_id → notes, summary, tags[])
table note_embeddings  (note_id → notes, embedding vector(1536))
table search_queries   (id, user_id, query, results_count, latency_ms)

indexes
  ix_notes_workspace       btree(workspace_id, created_at desc)
  ix_note_embeddings_ivf   ivfflat(embedding vector_cosine_ops)`}
                </pre>
              </BlueprintCard>

              <BlueprintCard id="ai" icon={Brain} title="AI Recommendations">
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { t: "Summarization", d: "Gemini 2.5 Flash — cost-efficient at scale" },
                    { t: "Embeddings", d: "text-embedding-3-small · 1536 dims" },
                    { t: "Search", d: "Hybrid: BM25 + vector re-rank" },
                    { t: "Guardrails", d: "Content moderation on ingest & output" },
                  ].map((b) => (
                    <div
                      key={b.t}
                      className="rounded-2xl border border-border/60 bg-background/40 p-4"
                    >
                      <div className="text-sm font-semibold">{b.t}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{b.d}</div>
                    </div>
                  ))}
                </div>
              </BlueprintCard>

              <BlueprintCard id="plan" icon={ListChecks} title="Implementation Plan">
                <div className="space-y-3">
                  {[
                    { p: "Week 1", t: "Foundations", d: "Auth, workspaces, note CRUD, base UI kit." },
                    { p: "Week 2", t: "AI Ingest", d: "Queue, workers, summaries, embeddings." },
                    { p: "Week 3", t: "Search & Retrieval", d: "Hybrid search, filters, ranking." },
                    { p: "Week 4", t: "Polish & Launch", d: "Onboarding, billing hooks, observability." },
                  ].map((m) => (
                    <div
                      key={m.p}
                      className="flex gap-4 rounded-2xl border border-border/60 bg-background/40 p-4"
                    >
                      <div className="w-20 shrink-0 font-display text-lg font-bold gradient-text">
                        {m.p}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                          {m.t}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">{m.d}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </BlueprintCard>

              <div className="glass flex flex-wrap items-center justify-between gap-4 rounded-3xl p-6">
                <div>
                  <div className="text-sm font-semibold">Explore alternative workflows</div>
                  <div className="text-xs text-muted-foreground">
                    Compare lean, scale-ready, and enterprise variants side-by-side.
                  </div>
                </div>
                <Link to="/compare">
                  <Button className="rounded-full gradient-brand-bg text-white hover:opacity-90">
                    Compare workflows
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}

function BlueprintCard({
  id,
  icon: Icon,
  title,
  children,
}: {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="glass scroll-mt-28 rounded-3xl p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl gradient-brand-bg text-white">
          <Icon className="h-5 w-5" />
        </span>
        <h2 className="font-display text-xl font-bold sm:text-2xl">{title}</h2>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}
