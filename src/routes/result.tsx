import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
  Wrench,
  FolderTree,
  GitBranch,
  Timer,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/result")({
  head: () => ({
    meta: [
      { title: "Your Blueprint — FlowForge AI" },
      {
        name: "description",
        content:
          "A complete AI-generated development blueprint: workflow, architecture, database, AI stack, tools, and implementation plan.",
      },
    ],
  }),
  component: ResultPage,
});

type WorkflowId = "traditional" | "ai-assisted" | "full-ai";

type Project = {
  name: string;
  description: string;
  teamSize: string;
  experience: string;
  timelineValue: string;
  timelineUnit: "days" | "weeks" | "months" | string;
  workflow: WorkflowId | "compare" | "";
};

const WORKFLOW_LABEL: Record<WorkflowId, string> = {
  traditional: "Traditional",
  "ai-assisted": "AI Assisted",
  "full-ai": "Full AI",
};

const SECTIONS = [
  { id: "workflow", label: "Workflow", icon: Workflow },
  { id: "architecture", label: "Architecture", icon: Layers },
  { id: "database", label: "Database", icon: Database },
  { id: "ai", label: "AI Stack", icon: Brain },
  { id: "roadmap", label: "Roadmap", icon: ListChecks },
  { id: "tools", label: "Tools", icon: Wrench },
  { id: "structure", label: "Structure", icon: FolderTree },
  { id: "flow", label: "Dev Flow", icon: GitBranch },
  { id: "effort", label: "Effort", icon: Timer },
  { id: "next", label: "Next Steps", icon: ClipboardList },
];

function ResultPage() {
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("flowforge:project");
      if (raw) setProject(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  const activeWorkflow: WorkflowId = useMemo(() => {
    const w = project?.workflow;
    if (w === "traditional" || w === "ai-assisted" || w === "full-ai") return w;
    return "ai-assisted";
  }, [project]);

  const timelineValue = Math.max(1, parseInt(project?.timelineValue || "4", 10) || 4);
  const timelineUnit = (project?.timelineUnit || "weeks") as Project["timelineUnit"];

  const confidence = useMemo(() => {
    let score = 70;
    const tv = timelineValue;
    if (tv >= 3 && tv <= 12) score += 10;
    if (project?.experience === "advanced") score += 10;
    if (project?.experience === "intermediate") score += 6;
    if (project?.description && project.description.length > 120) score += 8;
    return Math.min(96, score);
  }, [project, timelineValue]);

  const workflowSteps = getWorkflowSteps(activeWorkflow);
  const architecture = getArchitecture(activeWorkflow);
  const aiStack = getAIStack(activeWorkflow);
  const roadmap = buildRoadmap(timelineValue, timelineUnit);
  const effort = getEffort(activeWorkflow);

  return (
    <div className="min-h-screen px-4 py-10 sm:py-14">
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
                {project?.name || "Untitled Project"} —{" "}
                <span className="gradient-text">AI Blueprint</span>
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
                FlowForge AI analyzed your requirements and generated a complete development
                blueprint including workflow, architecture, database design, AI stack,
                implementation roadmap and recommended tools.
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

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat k="Workflow" v={WORKFLOW_LABEL[activeWorkflow]} />
            <Stat
              k="Timeline"
              v={`${timelineValue} ${cap(timelineUnit)}`}
            />
            <Stat k="Team Size" v={project?.teamSize ? `${project.teamSize} people` : "—"} />
            <Stat k="Confidence" v={`${confidence}%`} />
          </div>
        </div>

        {/* Content */}
        <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr]">
          <aside className="lg:sticky lg:top-10 lg:h-fit">
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
                {workflowSteps.map((step, i) => (
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
                {architecture.map((b) => (
                  <TileCard key={b.t} title={b.t} desc={b.d} />
                ))}
              </div>
            </BlueprintCard>

            <BlueprintCard id="database" icon={Database} title="Database Design">
              <div className="space-y-5 text-sm">
                <SubBlock title="Entities">
                  <div className="flex flex-wrap gap-2">
                    {["User", "Project", "Workspace", "Item", "ActivityLog", "Setting"].map(
                      (e) => (
                        <span
                          key={e}
                          className="rounded-full border border-border/60 bg-background/40 px-3 py-1 text-xs text-muted-foreground"
                        >
                          {e}
                        </span>
                      ),
                    )}
                  </div>
                </SubBlock>

                <SubBlock title="Relationships">
                  <ul className="space-y-1.5 text-xs text-muted-foreground">
                    <li>• User 1 — n Workspace (owner)</li>
                    <li>• Workspace 1 — n Project</li>
                    <li>• Project 1 — n Item</li>
                    <li>• User 1 — n ActivityLog</li>
                  </ul>
                </SubBlock>

                <SubBlock title="Key Tables">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      { t: "users", d: "Auth accounts, profile, preferences." },
                      { t: "workspaces", d: "Team-level container for projects." },
                      { t: "projects", d: "Blueprints and generated artifacts." },
                      { t: "items", d: "Individual entities inside a project." },
                      { t: "activity_logs", d: "Audit trail for user actions." },
                      { t: "settings", d: "Per-user and per-workspace config." },
                    ].map((r) => (
                      <div
                        key={r.t}
                        className="rounded-2xl border border-border/60 bg-background/40 p-4"
                      >
                        <div className="font-mono text-xs font-semibold text-foreground">
                          {r.t}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">{r.d}</div>
                      </div>
                    ))}
                  </div>
                </SubBlock>

                <SubBlock title="Indexes">
                  <ul className="space-y-1.5 font-mono text-xs text-muted-foreground">
                    <li>• ix_projects_workspace  btree(workspace_id, created_at desc)</li>
                    <li>• ix_items_project        btree(project_id)</li>
                    <li>• ix_activity_user_time   btree(user_id, created_at desc)</li>
                  </ul>
                </SubBlock>
              </div>
            </BlueprintCard>

            <BlueprintCard id="ai" icon={Brain} title="Recommended AI Stack">
              <div className="grid gap-3 sm:grid-cols-2">
                {aiStack.map((b) => (
                  <TileCard key={b.t} title={b.t} desc={b.d} />
                ))}
              </div>
            </BlueprintCard>

            <BlueprintCard id="roadmap" icon={ListChecks} title="Implementation Roadmap">
              <div className="space-y-3">
                {roadmap.map((m) => (
                  <div
                    key={m.p}
                    className="flex gap-4 rounded-2xl border border-border/60 bg-background/40 p-4"
                  >
                    <div className="w-24 shrink-0 font-display text-lg font-bold gradient-text">
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

            <BlueprintCard id="tools" icon={Wrench} title="Recommended Development Tools">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { t: "Lovable", p: "AI app builder", r: "Ship full-stack apps from prompts." },
                  { t: "Supabase", p: "Backend & database", r: "Auth, Postgres and storage in one." },
                  { t: "Gemini AI", p: "LLM & multimodal", r: "Fast, cost-efficient generation." },
                  { t: "GitHub", p: "Source control", r: "Collaboration, PRs and CI/CD." },
                  { t: "VS Code", p: "Editor", r: "Extensible IDE with AI plugins." },
                  { t: "Vercel", p: "Hosting", r: "Zero-config edge deployments." },
                  { t: "Figma", p: "UI design", r: "Design systems and prototyping." },
                  { t: "Postman", p: "API testing", r: "Debug and document endpoints." },
                ].map((tl) => (
                  <div
                    key={tl.t}
                    className="rounded-2xl border border-border/60 bg-background/40 p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold">{tl.t}</div>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        {tl.p}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">{tl.r}</div>
                  </div>
                ))}
              </div>
            </BlueprintCard>

            <BlueprintCard id="structure" icon={FolderTree} title="Project Folder Structure">
              <pre className="overflow-x-auto rounded-2xl border border-border/60 bg-background/60 p-5 font-mono text-xs leading-relaxed text-muted-foreground">
{`${slug(project?.name) || "project"}/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── lib/
│   └── public/
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   ├── services/
│   │   └── utils/
│   └── tests/
├── database/
│   ├── migrations/
│   └── seed/
├── docs/
│   ├── architecture.md
│   └── api.md
├── public/
└── README.md`}
              </pre>
            </BlueprintCard>

            <BlueprintCard id="flow" icon={GitBranch} title="Development Flow">
              <div className="flex flex-wrap gap-2">
                {[
                  "Requirements",
                  "UI Design",
                  "Frontend",
                  "Backend",
                  "Database",
                  "Authentication",
                  "AI Integration",
                  "Testing",
                  "Deployment",
                ].map((step, i, arr) => (
                  <div key={step} className="flex items-center gap-2">
                    <div className="rounded-full border border-border/60 bg-background/40 px-3 py-1.5 text-xs font-medium">
                      <span className="mr-1.5 text-primary">{i + 1}.</span>
                      {step}
                    </div>
                    {i < arr.length - 1 && (
                      <span className="text-muted-foreground/60">→</span>
                    )}
                  </div>
                ))}
              </div>
            </BlueprintCard>

            <BlueprintCard id="effort" icon={Timer} title="Estimated Development Effort">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {effort.map((e) => (
                  <div
                    key={e.t}
                    className="rounded-2xl border border-border/60 bg-background/40 p-4"
                  >
                    <div className="text-sm font-semibold">{e.t}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{e.d}</div>
                  </div>
                ))}
                <div className="rounded-2xl gradient-brand-bg p-4 text-white sm:col-span-2 lg:col-span-1">
                  <div className="text-sm font-semibold">Overall Estimated Time</div>
                  <div className="mt-1 text-xs opacity-90">
                    ~{timelineValue} {cap(timelineUnit)} end-to-end
                  </div>
                </div>
              </div>
            </BlueprintCard>

            <BlueprintCard id="next" icon={ClipboardList} title="Next Steps">
              <ul className="space-y-2 text-sm">
                {[
                  "Create GitHub Repository",
                  "Design UI in Figma",
                  "Setup Supabase project",
                  "Setup Gemini API keys",
                  "Develop Frontend",
                  "Develop Backend",
                  "Run Tests",
                  "Deploy to production",
                ].map((step) => (
                  <li
                    key={step}
                    className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/40 px-4 py-2.5"
                  >
                    <span className="grid h-5 w-5 place-items-center rounded-md border border-border/60">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary/70" />
                    </span>
                    <span className="text-muted-foreground">{step}</span>
                  </li>
                ))}
              </ul>
            </BlueprintCard>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {k}
      </div>
      <div className="mt-1 text-sm font-semibold">{v}</div>
    </div>
  );
}

function TileCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-xs text-muted-foreground">{desc}</div>
    </div>
  );
}

function SubBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </div>
      {children}
    </div>
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
    <section id={id} className="glass scroll-mt-10 rounded-3xl p-6 sm:p-8">
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

function cap(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function slug(s?: string) {
  return (s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getWorkflowSteps(w: WorkflowId): string[] {
  if (w === "traditional") {
    return [
      "Gather product requirements and write specs.",
      "Design UI in Figma and review with stakeholders.",
      "Manually build frontend components and pages.",
      "Implement backend APIs and database schema.",
      "Write tests, fix bugs and prepare release.",
      "Deploy to production and monitor.",
    ];
  }
  if (w === "full-ai") {
    return [
      "Describe the project in natural language.",
      "AI drafts UI, backend and database from the prompt.",
      "Review generated code and iterate with follow-up prompts.",
      "AI writes tests and fixes issues automatically.",
      "One-click deploy to production.",
      "AI monitors and suggests improvements.",
    ];
  }
  return [
    "Define requirements and outline user flows.",
    "Use AI to draft UI components and layouts.",
    "Hand-tune business logic and integrations.",
    "AI assists with backend endpoints and schema.",
    "Pair-program tests with AI, refine manually.",
    "Deploy with CI/CD and observe in production.",
  ];
}

function getArchitecture(w: WorkflowId) {
  const base = [
    { t: "Frontend", d: "React + Vite, TanStack Router, Tailwind." },
    { t: "Backend", d: "Node (Hono) API on edge runtime." },
    { t: "Database", d: "Postgres with typed schema and RLS." },
    { t: "Authentication", d: "Email + OAuth via managed auth provider." },
    { t: "Storage", d: "Object storage for uploads and exports." },
    { t: "AI Services", d: "LLM + embeddings behind a thin gateway." },
    { t: "Deployment", d: "Edge hosting with preview environments." },
  ];
  if (w === "traditional") base[5].d = "Optional AI microservice for specific features.";
  if (w === "full-ai") base[5].d = "AI at every layer — generation, retrieval and QA.";
  return base;
}

function getAIStack(w: WorkflowId) {
  return [
    {
      t: "LLM",
      d: `Gemini 2.5 Flash — ${w === "full-ai" ? "primary reasoning engine across the stack." : "cost-efficient generation for user features."}`,
    },
    {
      t: "Embedding Model",
      d: "text-embedding-3-small (1536 dims) — strong recall at low cost.",
    },
    { t: "Database", d: "Postgres + pgvector — hybrid keyword + vector search." },
    { t: "Authentication", d: "Supabase Auth — email, OAuth and RLS out of the box." },
    { t: "Hosting", d: "Vercel — global edge with instant previews." },
    { t: "Frontend Framework", d: "React 19 with TanStack Router for typed routing." },
    { t: "Backend Framework", d: "Hono — fast, portable, works on edge runtimes." },
    { t: "Deployment Platform", d: "Vercel + GitHub Actions for CI/CD." },
  ];
}

function buildRoadmap(value: number, unit: Project["timelineUnit"]) {
  const labelUnit =
    unit === "days" ? "Day" : unit === "months" ? "Month" : "Week";
  const count = Math.max(1, Math.min(8, value));
  const templates = [
    { t: "Foundations", d: "Auth, base UI kit, project scaffolding." },
    { t: "Core Features", d: "Primary user flows and data models." },
    { t: "AI Integration", d: "LLM, embeddings, retrieval and prompts." },
    { t: "Polish & Launch", d: "Onboarding, billing hooks, observability." },
    { t: "Iteration", d: "User feedback loops and refinements." },
    { t: "Scale", d: "Performance, caching, cost tuning." },
    { t: "Hardening", d: "Security review, load tests, backups." },
    { t: "Growth", d: "Analytics, experiments and integrations." },
  ];
  return Array.from({ length: count }, (_, i) => ({
    p: `${labelUnit} ${i + 1}`,
    ...templates[i % templates.length],
  }));
}

function getEffort(w: WorkflowId) {
  const speed = w === "full-ai" ? 0.5 : w === "ai-assisted" ? 0.75 : 1;
  const est = (base: number) => `${Math.max(1, Math.round(base * speed))} days`;
  return [
    { t: "UI Development", d: est(8) },
    { t: "Backend", d: est(7) },
    { t: "Database", d: est(3) },
    { t: "AI Integration", d: est(5) },
    { t: "Testing", d: est(4) },
    { t: "Deployment", d: est(2) },
  ];
}
