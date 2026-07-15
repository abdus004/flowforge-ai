import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  Sparkles,
  Trophy,
  Users,
  GraduationCap,
  Clock,
  FileText,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

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

type WorkflowId = "traditional" | "ai-assisted" | "full-ai";

type Project = {
  name?: string;
  description?: string;
  teamSize?: string;
  experience?: string;
  timelineValue?: string;
  timelineUnit?: string;
  workflow?: string;
};

const WORKFLOWS: {
  id: WorkflowId;
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
    cons: [
      "Requires review discipline",
      "Some ramp-up on AI tooling",
    ],
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
    cons: [
      "Less low-level control",
      "Needs clear product direction",
    ],
  },
];

function recommend(project: Project): { id: WorkflowId; confidence: number; reasons: string[] } {
  const team = parseInt(project.teamSize || "0", 10) || 1;
  const exp = project.experience || "intermediate";
  const tv = parseInt(project.timelineValue || "0", 10) || 4;
  const unit = project.timelineUnit || "weeks";
  const days =
    unit === "days" ? tv : unit === "weeks" ? tv * 7 : tv * 30;

  let id: WorkflowId = "ai-assisted";
  let confidence = 88;
  const reasons: string[] = [];

  if (days <= 21 || team <= 2 || exp === "beginner") {
    id = "full-ai";
    confidence = 94;
    reasons.push(
      team <= 2
        ? `Small team of ${team} benefits from AI handling most of the pipeline.`
        : "Tight timeline is best matched by an AI-driven pipeline.",
    );
    if (exp === "beginner")
      reasons.push("Beginner experience level pairs well with an AI-led workflow.");
    reasons.push("Fastest path from idea to a working blueprint.");
  } else if (days >= 90 && team >= 5 && exp === "advanced") {
    id = "traditional";
    confidence = 90;
    reasons.push(`Team of ${team} experienced engineers can absorb the manual overhead.`);
    reasons.push("Long timeline allows deep, hand-crafted architecture.");
    reasons.push("Advanced experience unlocks maximum control.");
  } else {
    id = "ai-assisted";
    confidence = 96;
    reasons.push(`Team of ${team} keeps ownership while AI accelerates delivery.`);
    reasons.push(`${exp.charAt(0).toUpperCase() + exp.slice(1)} experience fits a balanced workflow.`);
    reasons.push(`Timeline of ${tv} ${unit} aligns with an AI-assisted pace.`);
  }

  if (project.description && project.description.length > 200) {
    reasons.push("Project scope suggests structured architecture support.");
  }

  return { id, confidence, reasons };
}

function ComparePage() {
  const navigate = useNavigate();
  const [project, setProject] = useState<Project>({});

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("flowforge:project");
      if (raw) setProject(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  const rec = useMemo(() => recommend(project), [project]);

  const pick = (id: WorkflowId) => {
    try {
      sessionStorage.setItem(
        "flowforge:project",
        JSON.stringify({ ...project, workflow: id }),
      );
    } catch {
      // ignore
    }
    navigate({ to: "/result" });
  };

  const timeline =
    project.timelineValue && project.timelineUnit
      ? `${project.timelineValue} ${project.timelineUnit}`
      : "—";

  const expLabel = project.experience
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
                      <li key={c} className="flex items-start gap-2 text-sm text-muted-foreground">
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
                  {WORKFLOWS.find((w) => w.id === rec.id)?.name}
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
        </div>

        {/* Choose Workflow */}
        <div className="mt-12">
          <h2 className="font-display text-xl font-semibold">Choose Your Workflow</h2>
          <div className="mt-5 grid gap-5 md:grid-cols-3">
            {WORKFLOWS.map((w) => {
              const recommended = w.id === rec.id;
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
                    className={`mt-6 w-full rounded-full ${
                      recommended
                        ? "gradient-brand-bg text-white hover:opacity-90"
                        : ""
                    }`}
                    variant={recommended ? "default" : "outline"}
                  >
                    Select Workflow
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
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
