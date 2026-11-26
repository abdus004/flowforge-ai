import type { ReactNode } from "react";
import { Navbar } from "./navbar";
import { Footer } from "./footer";

export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div id="top" className="min-h-screen">
      <Navbar />
      <main className="pt-28">{children}</main>
      <Footer />
    </div>
  );
}
