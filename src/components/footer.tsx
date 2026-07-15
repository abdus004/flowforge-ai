import { Link } from "@tanstack/react-router";
import { Sparkles, Github, Twitter, Linkedin } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-24 px-4 pb-10">
      <div className="glass mx-auto max-w-6xl rounded-3xl p-8 sm:p-12">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
              <span className="grid h-8 w-8 place-items-center rounded-xl gradient-brand-bg text-white">
                <Sparkles className="h-4 w-4" />
              </span>
              <span className="gradient-text">FlowForge AI</span>
            </Link>
            <p className="mt-4 max-w-sm text-sm text-muted-foreground">
              The AI-powered software architect that turns ideas into complete development
              blueprints — from workflows to database design.
            </p>
            <div className="mt-5 flex gap-2">
              {[Github, Twitter, Linkedin].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  aria-label="Social link"
                  className="grid h-9 w-9 place-items-center rounded-full border border-border/60 text-muted-foreground transition hover:bg-accent hover:text-foreground"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          <FooterCol
            title="Product"
            items={[
              { label: "Generate", to: "/generate" },
              { label: "Features", to: "/#features" },
            ]}
          />
          <FooterCol
            title="Company"
            items={[
              { label: "About", to: "/#about" },
              { label: "How it Works", to: "/#how" },
              { label: "Why FlowForge", to: "/#why" },
            ]}
          />
          <FooterCol
            title="Resources"
            items={[
              { label: "Docs", to: "#" },
              { label: "Guides", to: "#" },
              { label: "Support", to: "#" },
            ]}
          />
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} FlowForge AI. All rights reserved.</p>
          <p>Crafted with intention.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  items,
}: {
  title: string;
  items: { label: string; to: string }[];
}) {
  return (
    <div>
      <h4 className="mb-4 text-sm font-semibold">{title}</h4>
      <ul className="space-y-2 text-sm text-muted-foreground">
        {items.map((i) => (
          <li key={i.label}>
            <a href={i.to} className="transition hover:text-foreground">
              {i.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
