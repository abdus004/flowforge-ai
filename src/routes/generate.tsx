import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError, generateBlueprint, type ExperienceLevel, type RealWorkflow } from "@/lib/api";
import { saveBlueprint, saveProject } from "@/lib/project-storage";

export const Route = createFileRoute("/generate")({
  head: () => ({
    meta: [
      { title: "Generate Blueprint — FlowForge AI" },
      {
        name: "description",
        content: "Describe your idea and generate a complete AI development blueprint.",
      },
    ],
  }),
  component: GeneratePage,
});

type Workflow = RealWorkflow | "compare";

const WORKFLOWS: {
  value: Workflow;
  title: string;
  description: string;
}[] = [
  {
    value: "traditional",
    title: "Traditional",
    description: "Manual development with minimal AI assistance.",
  },
  {
    value: "ai-assisted",
    title: "AI Assisted",
    description: "Balance between AI tools and manual coding.",
  },
  {
    value: "full-ai",
    title: "Full AI",
    description: "Use AI throughout the entire development process.",
  },
  {
    value: "compare",
    title: "Compare & Recommend",
    description: "Compare every workflow and let AI recommend the best one.",
  },
];

function validate(fields: {
  description: string;
  teamSize: string;
  experience: string;
  timelineValue: string;
  workflow: string;
}): string | null {
  if (!fields.description.trim() || fields.description.trim().length < 10) {
    return "Please describe your project in at least 10 characters.";
  }
  const team = parseInt(fields.teamSize, 10);
  if (!fields.teamSize || Number.isNaN(team) || team <= 0) {
    return "Team size must be a positive number.";
  }
  if (!fields.experience) {
    return "Please select an experience level.";
  }
  const timeline = parseInt(fields.timelineValue, 10);
  if (!fields.timelineValue || Number.isNaN(timeline) || timeline <= 0) {
    return "Timeline must be a positive number.";
  }
  if (!fields.workflow) {
    return "Please choose a development workflow.";
  }
  return null;
}

function GeneratePage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [teamSize, setTeamSize] = useState("");
  const [experience, setExperience] = useState<ExperienceLevel | "">("");
  const [timelineValue, setTimelineValue] = useState("");
  const [timelineUnit, setTimelineUnit] = useState<"days" | "weeks" | "months">("weeks");
  const [workflow, setWorkflow] = useState<Workflow | "">("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const validationError = validate({
      description,
      teamSize,
      experience,
      timelineValue,
      workflow,
    });
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const project = {
      name: name.trim(),
      description: description.trim(),
      teamSize,
      experience: experience as ExperienceLevel,
      timelineValue,
      timelineUnit,
      workflow: workflow as Workflow,
    };

    saveProject(project);

    if (workflow === "compare") {
      navigate({ to: "/compare" });
      return;
    }

    setLoading(true);
    try {
      const blueprint = await generateBlueprint({
        ...project,
        workflow: workflow as RealWorkflow,
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
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-10 sm:py-14">
      <div className="mx-auto max-w-3xl">
        <div className="mb-10 text-center">
          <div className="glass mx-auto inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" />
            Blueprint Generator
          </div>
          <h1 className="mt-5 font-display text-3xl font-bold sm:text-4xl">
            Project <span className="gradient-text">Workspace</span>
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
            Tell us about your project. We will turn your inputs into a complete development
            blueprint.
          </p>
        </div>

        <form onSubmit={submit} className="glass rounded-3xl p-6 sm:p-10">
          <div className="space-y-6">
            <Field label="Project Name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Nimbus Notes"
                className="rounded-xl bg-background/50"
                disabled={loading}
              />
            </Field>

            <Field label="Project Description">
              <Textarea
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what you want to build, its main features, goals and any important requirements."
                className="min-h-36 rounded-2xl bg-background/50"
                disabled={loading}
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Team Size">
                <Input
                  type="number"
                  min={1}
                  value={teamSize}
                  onChange={(e) => setTeamSize(e.target.value)}
                  placeholder="e.g. 3"
                  className="rounded-xl bg-background/50"
                  disabled={loading}
                />
              </Field>

              <Field label="Experience Level">
                <Select
                  value={experience}
                  onValueChange={(v) => setExperience(v as ExperienceLevel)}
                  disabled={loading}
                >
                  <SelectTrigger className="rounded-xl bg-background/50">
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field label="Project Timeline">
              <div className="grid grid-cols-[1fr_auto] gap-3">
                <Input
                  type="number"
                  min={1}
                  value={timelineValue}
                  onChange={(e) => setTimelineValue(e.target.value)}
                  placeholder="e.g. 4"
                  className="rounded-xl bg-background/50"
                  disabled={loading}
                />
                <Select
                  value={timelineUnit}
                  onValueChange={(v) => setTimelineUnit(v as "days" | "weeks" | "months")}
                  disabled={loading}
                >
                  <SelectTrigger className="w-32 rounded-xl bg-background/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="days">Days</SelectItem>
                    <SelectItem value="weeks">Weeks</SelectItem>
                    <SelectItem value="months">Months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Field>

            <div>
              <Label className="mb-3 block text-sm font-medium">Development Workflow</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                {WORKFLOWS.map((w) => (
                  <button
                    key={w.value}
                    type="button"
                    disabled={loading}
                    onClick={() => setWorkflow(w.value)}
                    className={`glass rounded-2xl p-5 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      workflow === w.value
                        ? "border-primary/60 ring-1 ring-primary"
                        : "hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-display text-base font-semibold">{w.title}</span>
                      <span
                        className={`h-4 w-4 rounded-full border-2 ${
                          workflow === w.value
                            ? "border-primary bg-primary"
                            : "border-muted-foreground/40"
                        }`}
                      />
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                      {w.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-10 flex justify-center">
            <Button
              type="submit"
              size="lg"
              disabled={loading}
              className="rounded-full gradient-brand-bg px-10 text-white hover:opacity-90"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Forging blueprint...
                </>
              ) : (
                <>
                  Generate Blueprint
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-2 block text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}
