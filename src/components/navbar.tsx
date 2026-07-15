import { Link } from "@tanstack/react-router";
import { Moon, Sun, Sparkles, Menu, X } from "lucide-react";
import { useState } from "react";
import { useTheme } from "./theme-provider";
import { Button } from "./ui/button";

export function Navbar() {
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);

  const links = [
    { to: "/", label: "Home" },
    { to: "/#features", label: "Features" },
    { to: "/#about", label: "About" },
    { to: "/compare", label: "Workflows" },
  ] as const;

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4">
      <nav className="glass mx-auto flex max-w-6xl items-center justify-between rounded-2xl px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-xl gradient-brand-bg text-white">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="gradient-text">FlowForge AI</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <a
              key={l.to}
              href={l.to}
              className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            aria-label="Toggle theme"
            onClick={toggle}
            className="grid h-9 w-9 place-items-center rounded-full border border-border/60 bg-background/40 text-foreground transition hover:bg-accent"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <Link to="/generate" className="hidden sm:block">
            <Button className="rounded-full gradient-brand-bg text-white hover:opacity-90">
              Generate Blueprint
            </Button>
          </Link>
          <button
            aria-label="Menu"
            onClick={() => setOpen((o) => !o)}
            className="grid h-9 w-9 place-items-center rounded-full border border-border/60 md:hidden"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="glass mx-auto mt-2 flex max-w-6xl flex-col gap-1 rounded-2xl p-3 md:hidden">
          {links.map((l) => (
            <a
              key={l.to}
              href={l.to}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
          <Link to="/generate" onClick={() => setOpen(false)}>
            <Button className="mt-1 w-full rounded-full gradient-brand-bg text-white">
              Generate Blueprint
            </Button>
          </Link>
        </div>
      )}
    </header>
  );
}
