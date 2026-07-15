import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, ArrowRight, Loader2, Lightbulb } from "lucide-react";
import { SiteLayout } from "@/components/site-layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

const EXAMPLES = [
  "A collaborative recipe app with AI meal planning for busy families.",
  "A B2B invoicing SaaS with automated reminders and Stripe payouts.",
  "A learning platform that generates personalized study paths from PDFs.",
];

function GeneratePage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [idea, setIdea] = useState("");
  const [audience, setAudience] = useState("");
  const [stack, setStack] = useState("Modern web (React + Node)");
  const [loading, setLoading] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!idea.trim()) return;
    setLoading(true);
    setTimeout(() => navigate({ to: "/result" }), 1200);
  };

  return (
    <SiteLayout>
      <section className="px-4">
        <div className="mx-auto max-w-4xl text-center">
          <div className="glass mx-auto inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" />
            Blueprint Generator
          </div>
          <h1 className="mt-6 font-display text-4xl font-bold sm:text-5xl">
            Describe your <span className="gradient-text">product idea</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            The more detail you share, the sharper your blueprint. Include users, jobs to
            be done, and any known constraints.
          </p>
        </div>

        <form
          onSubmit={submit}
          className="glass mx-auto mt-10 max-w-4xl rounded-3xl p-6 sm:p-10"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Project name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Nimbus Notes"
                className="rounded-xl bg-background/50"
              />
            </Field>
            <Field label="Target audience">
              <Input
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="e.g. Freelance designers"
                className="rounded-xl bg-background/50"
              />
            </Field>
          </div>

          <div className="mt-5">
            <Field label="Preferred stack (optional)">
              <Input
                value={stack}
                onChange={(e) => setStack(e.target.value)}
                className="rounded-xl bg-background/50"
              />
            </Field>
          </div>

          <div className="mt-5">
            <Field label="Describe your idea">
              <Textarea
                required
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="A tool that helps indie makers turn their journal entries into launch-ready product briefs..."
                className="min-h-40 rounded-2xl bg-background/50"
              />
            </Field>
          </div>

          <div className="mt-6 rounded-2xl border border-dashed border-border/70 bg-background/30 p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <Lightbulb className="h-4 w-4 text-primary" />
              Need inspiration?
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setIdea(ex)}
                  className="rounded-xl border border-border/60 bg-background/40 p-3 text-left text-xs text-muted-foreground transition hover:border-primary/60 hover:text-foreground"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Blueprints typically take under 30 seconds to generate.
            </p>
            <Button
              type="submit"
              size="lg"
              disabled={loading}
              className="rounded-full gradient-brand-bg px-6 text-white hover:opacity-90"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  Forging blueprint...
                </>
              ) : (
                <>
                  Generate Blueprint
                  <ArrowRight className="ml-1 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </form>
      </section>
    </SiteLayout>
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
