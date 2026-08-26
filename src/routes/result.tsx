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
  ShieldAlert,
  FileWarning,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Blueprint, RealWorkflow } from "@/lib/api";
import { loadBlueprint, loadProject, type StoredProject } from "@/lib/project-storage";

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

const WORKFLOW_LABEL: Record<RealWorkflow, string> = {
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
  { id: "risks", label: "Risks", icon: ShieldAlert },
  { id: "next", label: "Next Steps", icon: ClipboardList },
];

function ResultPage() {
  const [project, setProject] = useState<StoredProject | null>(null);
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setProject(loadProject());
    setBlueprint(loadBlueprint());
    setReady(true);
  }, []);

  const activeWorkflow: RealWorkflow = useMemo(() => {
    const w = project?.workflow;
    if (w === "traditional" || w === "ai-assisted" || w === "full-ai") return w;
    return "ai-assisted";
  }, [project]);

  const timelineValue = project?.timelineValue || "—";
  const timelineUnit = project?.timelineUnit || "weeks";

  if (ready && !blueprint) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="glass max-w-md rounded-3xl p-10 text-center">
          <FileWarning className="mx-auto h-10 w-10 text-primary" />
          <h1 className="mt-4 font-display text-xl font-semibold">No blueprint yet</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We couldn't find a generated blueprint for this session. Head back to the generator to
            create one.
          </p>
          <Link
            to="/generate"
            className="mt-6 inline-flex items-center justify-center rounded-full gradient-brand-bg px-6 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
          >
            Go to generator
          </Link>
        </div>
      </div>
    );
  }

  if (!blueprint) {
    return <div className="min-h-screen" />;
  }

  const projectName = blueprint.project.name || project?.name || "Untitled Project";

  const exportJson = () => {
    downloadFile(
      `${slug(projectName)}-blueprint.json`,
      JSON.stringify(blueprint, null, 2),
      "application/json",
    );
    toast.success("Blueprint exported as JSON.");
  };

  const exportMarkdown = () => {
    downloadFile(
      `${slug(projectName)}-blueprint.md`,
      toMarkdown(blueprint, projectName),
      "text/markdown",
    );
    toast.success("Blueprint exported as Markdown.");
  };

  const share = async () => {
    const summary = toMarkdown(blueprint, projectName);
    try {
      await navigator.clipboard.writeText(summary);
      toast.success("Blueprint copied to clipboard — paste it anywhere to share.", {
        description: "Persistent shareable links require backend storage, coming later.",
      });
    } catch {
      toast.error("Couldn't access the clipboard. Try exporting instead.");
    }
  };

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
                {projectName} — <span className="gradient-text">AI Blueprint</span>
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
                {blueprint.project.summary}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="rounded-full" onClick={share}>
                <Share2 className="mr-1 h-4 w-4" /> Share
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="rounded-full gradient-brand-bg text-white hover:opacity-90">
                    <Download className="mr-1 h-4 w-4" /> Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={exportJson}>Export as JSON</DropdownMenuItem>
                  <DropdownMenuItem onClick={exportMarkdown}>Export as Markdown</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat k="Workflow" v={WORKFLOW_LABEL[activeWorkflow]} />
            <Stat k="Timeline" v={`${timelineValue} ${cap(timelineUnit)}`} />
            <Stat k="Team Size" v={project?.teamSize ? `${project.teamSize} people` : "—"} />
            <Stat k="Database" v={blueprint.database.databaseType || "—"} />
          </div>

          {blueprint.project.goals.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {blueprint.project.goals.map((g) => (
                <span
                  key={g}
                  className="rounded-full border border-border/60 bg-background/40 px-3 py-1 text-xs text-muted-foreground"
                >
                  {g}
                </span>
              ))}
            </div>
          )}
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
              {blueprint.workflow.recommendationReason && (
                <p className="mb-4 text-sm text-muted-foreground">
                  {blueprint.workflow.recommendationReason}
                </p>
              )}
              <ol className="space-y-3 text-sm">
                {blueprint.workflow.steps.map((step, i) => (
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
              {blueprint.architecture.overview && (
                <p className="mb-4 text-sm text-muted-foreground">
                  {blueprint.architecture.overview}
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {blueprint.architecture.components.map((c) => (
                  <TileCard key={c.name} title={c.name} desc={`${c.technology} — ${c.purpose}`} />
                ))}
              </div>
              {blueprint.architecture.dataFlow.length > 0 && (
                <div className="mt-5">
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Data Flow
                  </div>
                  <ol className="space-y-1.5 text-xs text-muted-foreground">
                    {blueprint.architecture.dataFlow.map((d, i) => (
                      <li key={i}>
                        {i + 1}. {d}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </BlueprintCard>

            <BlueprintCard id="database" icon={Database} title="Database Design">
              <div className="space-y-5 text-sm">
                <SubBlock title={`Entities (${blueprint.database.databaseType})`}>
                  <div className="flex flex-wrap gap-2">
                    {blueprint.database.entities.map((e) => (
                      <span
                        key={e.name}
                        className="rounded-full border border-border/60 bg-background/40 px-3 py-1 text-xs text-muted-foreground"
                      >
                        {e.name}
                      </span>
                    ))}
                  </div>
                </SubBlock>

                {blueprint.database.entities.some((e) => e.relationships.length > 0) && (
                  <SubBlock title="Relationships">
                    <ul className="space-y-1.5 text-xs text-muted-foreground">
                      {blueprint.database.entities.flatMap((e) =>
                        e.relationships.map((r, i) => <li key={`${e.name}-${i}`}>• {r}</li>),
                      )}
                    </ul>
                  </SubBlock>
                )}

                <SubBlock title="Entity Details">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {blueprint.database.entities.map((e) => (
                      <div
                        key={e.name}
                        className="rounded-2xl border border-border/60 bg-background/40 p-4"
                      >
                        <div className="font-mono text-xs font-semibold text-foreground">
                          {e.name}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">{e.description}</div>
                        {e.fields.length > 0 && (
                          <div className="mt-2 text-[11px] text-muted-foreground/80">
                            {e.fields.join(", ")}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </SubBlock>

                {blueprint.database.indexes.length > 0 && (
                  <SubBlock title="Indexes">
                    <ul className="space-y-1.5 font-mono text-xs text-muted-foreground">
                      {blueprint.database.indexes.map((idx, i) => (
                        <li key={i}>• {idx}</li>
                      ))}
                    </ul>
                  </SubBlock>
                )}

                {blueprint.database.notes.length > 0 && (
                  <SubBlock title="Notes">
                    <ul className="space-y-1.5 text-xs text-muted-foreground">
                      {blueprint.database.notes.map((n, i) => (
                        <li key={i}>• {n}</li>
                      ))}
                    </ul>
                  </SubBlock>
                )}
              </div>
            </BlueprintCard>

            <BlueprintCard id="ai" icon={Brain} title="Recommended AI Stack">
              <div className="grid gap-3 sm:grid-cols-2">
                {blueprint.aiStack.llm && (
                  <TileCard
                    title={`LLM — ${blueprint.aiStack.llm.name}`}
                    desc={blueprint.aiStack.llm.reason}
                  />
                )}
                {blueprint.aiStack.embeddingModel && (
                  <TileCard
                    title={`Embeddings — ${blueprint.aiStack.embeddingModel.name}`}
                    desc={blueprint.aiStack.embeddingModel.reason}
                  />
                )}
                {blueprint.aiStack.vectorDatabase && (
                  <TileCard
                    title={`Vector DB — ${blueprint.aiStack.vectorDatabase.name}`}
                    desc={blueprint.aiStack.vectorDatabase.reason}
                  />
                )}
              </div>
              {blueprint.aiStack.rag && (
                <p className="mt-4 text-sm text-muted-foreground">{blueprint.aiStack.rag}</p>
              )}
              {blueprint.aiStack.aiFeatures.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {blueprint.aiStack.aiFeatures.map((f) => (
                    <span
                      key={f}
                      className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              )}
              {!blueprint.aiStack.llm &&
                !blueprint.aiStack.embeddingModel &&
                !blueprint.aiStack.vectorDatabase && (
                  <p className="text-sm text-muted-foreground">
                    FlowForge AI determined this project doesn't need a dedicated AI stack beyond
                    what was requested.
                  </p>
                )}
            </BlueprintCard>

            <BlueprintCard id="roadmap" icon={ListChecks} title="Implementation Roadmap">
              <div className="space-y-3">
                {blueprint.roadmap.map((m, i) => (
                  <div
                    key={i}
                    className="flex gap-4 rounded-2xl border border-border/60 bg-background/40 p-4"
                  >
                    <div className="w-24 shrink-0 font-display text-lg font-bold gradient-text">
                      {m.duration}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        {m.phase}
                      </div>
                      {m.objectives.length > 0 && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {m.objectives.join(" • ")}
                        </div>
                      )}
                      {m.deliverables.length > 0 && (
                        <div className="mt-1 text-[11px] text-muted-foreground/80">
                          Deliverables: {m.deliverables.join(", ")}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </BlueprintCard>

            <BlueprintCard id="tools" icon={Wrench} title="Recommended Development Tools">
              <div className="grid gap-3 sm:grid-cols-2">
                {blueprint.tools.map((tl, i) => (
                  <div key={i} className="rounded-2xl border border-border/60 bg-background/40 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold">{tl.name}</div>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        {tl.category}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">{tl.purpose}</div>
                  </div>
                ))}
              </div>
            </BlueprintCard>

            <BlueprintCard id="structure" icon={FolderTree} title="Project Folder Structure">
              <pre className="overflow-x-auto rounded-2xl border border-border/60 bg-background/60 p-5 font-mono text-xs leading-relaxed text-muted-foreground">
                {blueprint.projectStructure
                  .map((item) => `${item.path}    ${item.purpose}`)
                  .join("\n")}
              </pre>
            </BlueprintCard>

            <BlueprintCard id="flow" icon={GitBranch} title="Development Flow">
              <div className="flex flex-wrap gap-2">
                {blueprint.developmentFlow.map((step, i, arr) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="rounded-full border border-border/60 bg-background/40 px-3 py-1.5 text-xs font-medium">
                      <span className="mr-1.5 text-primary">{i + 1}.</span>
                      {step}
                    </div>
                    {i < arr.length - 1 && <span className="text-muted-foreground/60">→</span>}
                  </div>
                ))}
              </div>
            </BlueprintCard>

            <BlueprintCard id="effort" icon={Timer} title="Estimated Development Effort">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {blueprint.effort.map((e, i) => (
                  <div key={i} className="rounded-2xl border border-border/60 bg-background/40 p-4">
                    <div className="text-sm font-semibold">{e.area}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      ~{e.estimatedDays} {e.estimatedDays === 1 ? "day" : "days"}
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground/80">{e.reason}</div>
                  </div>
                ))}
                <div className="rounded-2xl gradient-brand-bg p-4 text-white sm:col-span-2 lg:col-span-1">
                  <div className="text-sm font-semibold">Overall Estimated Time</div>
                  <div className="mt-1 text-xs opacity-90">
                    ~{blueprint.effort.reduce((sum, e) => sum + e.estimatedDays, 0)} days total ·
                    Target {timelineValue} {cap(timelineUnit)}
                  </div>
                </div>
              </div>
            </BlueprintCard>

            {blueprint.risks.length > 0 && (
              <BlueprintCard id="risks" icon={ShieldAlert} title="Key Risks & Mitigations">
                <div className="space-y-3">
                  {blueprint.risks.map((r, i) => (
                    <div
                      key={i}
                      className="rounded-2xl border border-border/60 bg-background/40 p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold">{r.risk}</div>
                        <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                          {r.impact} impact
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        Mitigation: {r.mitigation}
                      </div>
                    </div>
                  ))}
                </div>
              </BlueprintCard>
            )}

            <BlueprintCard id="next" icon={ClipboardList} title="Next Steps">
              <ul className="space-y-2 text-sm">
                {blueprint.nextSteps.map((step, i) => (
                  <li
                    key={i}
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
  return (
    (s || "project")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "project"
  );
}

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function toMarkdown(bp: Blueprint, projectName: string): string {
  const list = (items: string[]) => items.map((i) => `- ${i}`).join("\n");
  const lines: string[] = [];

  lines.push(`# ${projectName} — AI Development Blueprint`);
  lines.push("");
  lines.push(bp.project.summary);
  if (bp.project.goals.length) {
    lines.push("", "## Goals", list(bp.project.goals));
  }
  if (bp.project.assumptions.length) {
    lines.push("", "## Assumptions", list(bp.project.assumptions));
  }

  lines.push("", "## Workflow", `**${bp.workflow.name}** — ${bp.workflow.recommendationReason}`);
  lines.push(bp.workflow.steps.map((s, i) => `${i + 1}. ${s}`).join("\n"));

  lines.push("", "## Architecture", bp.architecture.overview);
  bp.architecture.components.forEach((c) => {
    lines.push(`- **${c.name}** (${c.technology}) — ${c.purpose}`);
  });

  lines.push("", `## Database (${bp.database.databaseType})`);
  bp.database.entities.forEach((e) => {
    lines.push(`- **${e.name}** — ${e.description}`);
  });

  lines.push("", "## AI Stack");
  if (bp.aiStack.llm) lines.push(`- LLM: ${bp.aiStack.llm.name} — ${bp.aiStack.llm.reason}`);
  if (bp.aiStack.embeddingModel)
    lines.push(
      `- Embeddings: ${bp.aiStack.embeddingModel.name} — ${bp.aiStack.embeddingModel.reason}`,
    );
  if (bp.aiStack.vectorDatabase)
    lines.push(
      `- Vector DB: ${bp.aiStack.vectorDatabase.name} — ${bp.aiStack.vectorDatabase.reason}`,
    );
  if (bp.aiStack.rag) lines.push(`- RAG: ${bp.aiStack.rag}`);

  lines.push("", "## Roadmap");
  bp.roadmap.forEach((m) => {
    lines.push(`### ${m.phase} (${m.duration})`);
    if (m.objectives.length) lines.push(list(m.objectives));
  });

  lines.push("", "## Tools");
  bp.tools.forEach((t) => lines.push(`- **${t.name}** (${t.category}) — ${t.purpose}`));

  lines.push("", "## Next Steps", list(bp.nextSteps));

  if (bp.risks.length) {
    lines.push("", "## Risks");
    bp.risks.forEach((r) =>
      lines.push(`- **${r.risk}** (${r.impact} impact) — Mitigation: ${r.mitigation}`),
    );
  }

  return lines.join("\n");
}
