import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  Loader2,
  Trophy,
  Users,
  GraduationCap,
  Clock,
  FileText,
  X,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  ApiError,
  generateBlueprint,
  recommendWorkflow,
  type RealWorkflow,
  type WorkflowRecommendation,
} from "@/lib/api";
import { loadProject, saveBlueprint, saveProject, type StoredProject } from "@/lib/project-storage";

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title: "Workflow Recommendation — FlowForge AI" },
      {
        name: "description",
        content:
          "Compare development workflows and get an AI-powered recommendation tailored to your project.",
      },
    ],
  }),
  component: ComparePage,
});

const WORKFLOWS: {
  id: RealWorkflow;
  name: string;
  description: string;
  speed: string;
  learningCurve: string;
  bestFor: string;
  pros: string[];
  cons: string[];
}[] = [
  {
    id: "traditional",
    name: "Traditional",
    description: "Manual development with minimal AI assistance.",
    speed: "Slow",
    learningCurve: "High",
    bestFor: "Teams with strong engineering fundamentals and long timelines.",
    pros: [
      "Full control over every implementation detail",
      "Predictable, well-understood workflow",
      "Deep knowledge stays inside the team",
    ],
    cons: [
      "Significantly slower delivery",
      "Higher engineering cost",
      "Slower iteration on new ideas",
    ],
  },
  {
    id: "ai-assisted",
    name: "AI Assisted",
    description: "A balanced mix of AI tooling and manual engineering.",
    speed: "Fast",
    learningCurve: "Medium",
    bestFor: "Most product teams shipping modern web or SaaS apps.",
    pros: [
      "Great balance of speed and control",
      "AI accelerates repetitive work",
      "Team still owns architecture decisions",
    ],
    cons: ["Requires review discipline", "Some ramp-up on AI tooling"],
  },
  {
    id: "full-ai",
    name: "Full AI",
    description: "AI drives the entire development pipeline end-to-end.",
    speed: "Very Fast",
    learningCurve: "Low",
    bestFor: "Small teams, MVPs, prototypes and rapid validation.",
    pros: [
      "Fastest path from idea to product",
      "Minimal engineering overhead",
      "Effortless iteration and refactors",
    ],
    cons: ["Less low-level control", "Needs clear product direction"],
  },
];

function ComparePage() {
  const navigate = useNavigate();
  const [project, setProject] = useState<StoredProject | null>(null);
  const [rec, setRec] = useState<WorkflowRecommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<RealWorkflow | null>(null);

  useEffect(() => {
    const stored = loadProject();
    setProject(stored);
    if (!stored) {
      setLoading(false);
      setError("No project details found. Please fill out the generator form first.");
      return;
    }
    fetchRecommendation(stored);
  }, []);

  const fetchRecommendation = async (p: StoredProject) => {
    setLoading(true);
    setError(null);
    try {
      const result = await recommendWorkflow({
        name: p.name,
        description: p.description,
        teamSize: p.teamSize,
        experience: p.experience,
        timelineValue: p.timelineValue,
        timelineUnit: p.timelineUnit,
        workflow: p.workflow,
      });
      setRec(result);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Could not get an AI recommendation right now.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const pick = async (id: RealWorkflow) => {
    if (!project || selecting) return;
    const updated: StoredProject = { ...project, workflow: id };
    saveProject(updated);
    setSelecting(id);
    try {
      const blueprint = await generateBlueprint({
        name: updated.name,
        description: updated.description,
        teamSize: updated.teamSize,
        experience: updated.experience,
        timelineValue: updated.timelineValue,
        timelineUnit: updated.timelineUnit,
        workflow: id,
      });
      saveBlueprint(blueprint);
      navigate({ to: "/result" });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Something went wrong while generating your blueprint. Please try again.";
      toast.error(message);
    } finally {
      setSelecting(null);
    }
  };

  const timeline =
    project?.timelineValue && project?.timelineUnit
      ? `${project.timelineValue} ${project.timelineUnit}`
      : "—";

  const expLabel = project?.experience
    ? project.experience.charAt(0).toUpperCase() + project.experience.slice(1)
    : "—";

  return (
    <div className="min-h-screen px-4 py-10 sm:py-14">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="glass mx-auto inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" />
            AI Workflow Analysis
          </div>
          <h1 className="mt-5 font-display text-3xl font-bold sm:text-4xl">
            Compare & <span className="gradient-text">Recommend</span>
          </h1>
        </div>

        {!project ? (
          <div className="glass rounded-3xl p-10 text-center">
            <p className="text-sm text-muted-foreground">{error || "No project details found."}</p>
            <Link
              to="/generate"
              className="mt-6 inline-flex items-center justify-center rounded-full gradient-brand-bg px-6 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
            >
              Back to generator
            </Link>
          </div>
        ) : (
          <>
            {/* Project Summary */}
            <div className="glass rounded-3xl p-6 sm:p-8">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <h2 className="font-display text-lg font-semibold">Project Summary</h2>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryItem
                  icon={<Sparkles className="h-4 w-4 text-primary" />}
                  label="Project Name"
                  value={project.name || "Untitled Project"}
                />
                <SummaryItem
                  icon={<Users className="h-4 w-4 text-primary" />}
                  label="Team Size"
                  value={project.teamSize ? `${project.teamSize} people` : "—"}
                />
                <SummaryItem
                  icon={<GraduationCap className="h-4 w-4 text-primary" />}
                  label="Experience Level"
                  value={expLabel}
                />
                <SummaryItem
                  icon={<Clock className="h-4 w-4 text-primary" />}
                  label="Timeline"
                  value={timeline}
                />
              </div>
              <p className="mt-6 text-sm text-muted-foreground leading-relaxed">
                FlowForge AI analyzed your project requirements and compared all development
                workflows to recommend the most suitable development approach.
              </p>
            </div>

            {/* Comparison Cards */}
            <div className="mt-10">
              <h2 className="font-display text-xl font-semibold">Workflow Comparison</h2>
              <div className="mt-5 grid gap-5 md:grid-cols-3">
                {WORKFLOWS.map((w) => (
                  <div key={w.id} className="glass rounded-3xl p-6">
                    <h3 className="font-display text-lg font-semibold">{w.name}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{w.description}</p>

                    <dl className="mt-5 space-y-3 text-sm">
                      <MetaRow label="Development Speed" value={w.speed} />
                      <MetaRow label="Learning Curve" value={w.learningCurve} />
                      <MetaRow label="Best For" value={w.bestFor} />
                    </dl>

                    <div className="mt-5">
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Pros
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {w.pros.map((p) => (
                          <li key={p} className="flex items-start gap-2 text-sm">
                            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                            <span>{p}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Cons
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {w.cons.map((c) => (
                          <li
                            key={c}
                            className="flex items-start gap-2 text-sm text-muted-foreground"
                          >
                            <X className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <span>{c}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Recommendation */}
            <div className="glass relative mt-12 overflow-hidden rounded-3xl p-6 sm:p-8 ring-2 ring-primary/60">
              <div className="absolute inset-0 -z-10 gradient-brand-soft opacity-60" />

              {loading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing your project…
                </div>
              ) : error || !rec ? (
                <div className="flex flex-col items-center gap-4 py-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    {error || "Could not get a recommendation."}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => project && fetchRecommendation(project)}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Try again
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="grid h-11 w-11 place-items-center rounded-2xl gradient-brand-bg text-white">
                        <Trophy className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                          FlowForge AI Recommendation
                        </p>
                        <h3 className="font-display text-2xl font-bold">
                          {WORKFLOWS.find((w) => w.id === rec.recommendedWorkflow)?.name}
                        </h3>
                      </div>
                    </div>
                    <div className="glass rounded-2xl px-4 py-3 text-center">
                      <p className="font-display text-2xl font-bold gradient-text">
                        {rec.confidence}%
                      </p>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Match
                      </p>
                    </div>
                  </div>

                  <p className="mt-5 text-sm text-muted-foreground">
                    Based on your team size, experience level, timeline and project requirements:
                  </p>
                  <ul className="mt-3 space-y-2">
                    {rec.reasons.map((r) => (
                      <li key={r} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            {/* Choose Workflow */}
            <div className="mt-12">
              <h2 className="font-display text-xl font-semibold">Choose Your Workflow</h2>
              <div className="mt-5 grid gap-5 md:grid-cols-3">
                {WORKFLOWS.map((w) => {
                  const recommended = rec?.recommendedWorkflow === w.id;
                  const isSelecting = selecting === w.id;
                  return (
                    <div
                      key={w.id}
                      className={`glass relative rounded-3xl p-6 transition hover:-translate-y-1 ${
                        recommended ? "ring-2 ring-primary/60" : ""
                      }`}
                    >
                      {recommended && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full gradient-brand-bg px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-white">
                          Recommended
                        </div>
                      )}
                      <h3 className="font-display text-lg font-semibold">{w.name}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">{w.description}</p>
                      <Button
                        type="button"
                        onClick={() => pick(w.id)}
                        disabled={selecting !== null}
                        className={`mt-6 w-full rounded-full ${
                          recommended ? "gradient-brand-bg text-white hover:opacity-90" : ""
                        }`}
                        variant={recommended ? "default" : "outline"}
                      >
                        {isSelecting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Forging blueprint...
                          </>
                        ) : (
                          <>
                            Select Workflow
                            <ArrowRight className="ml-1 h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-2 font-display text-base font-semibold truncate">{value}</p>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1">{value}</dd>
    </div>
  );
}
