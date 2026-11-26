/**
 * PDF export smoke test.
 *
 * Run from the frontend folder:   npm run test:pdf
 *
 * What it does:
 *  1. Compiles src/lib/pdf-export.ts with the TypeScript already installed.
 *  2. Removes Node's `Buffer` global so the code runs like it does in a browser
 *     (using Buffer in the PDF code was what made exports fail before).
 *  3. Builds a normal blueprint and a "stress" blueprint (very long title,
 *     unbreakable URL, accents, dozens of table rows).
 *  4. Checks the PDF structure byte by byte: header, xref offsets, stream
 *     lengths, page count, trailer, and that every section is present.
 *  5. Saves the PDFs to your temp folder so you can open them and look.
 *
 * It needs no extra packages and no network access.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import ts from "typescript";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(here, "..", "src", "lib", "pdf-export.ts");
const outDir = path.join(os.tmpdir(), "flowforge-pdf-smoke");
fs.mkdirSync(outDir, { recursive: true });

// --- 1. compile the real source file -------------------------------------
const compiled = ts.transpileModule(fs.readFileSync(source, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const compiledPath = path.join(outDir, "pdf-export.compiled.mjs");
fs.writeFileSync(compiledPath, compiled);
const { buildBlueprintPdf, pdfFileName } = await import(pathToFileURL(compiledPath).href);

// --- 2. behave like a browser: no Node-only globals ----------------------
delete globalThis.Buffer;

// --- 3. fixtures ----------------------------------------------------------
const sentence = "Real-time inventory synchronisation across warehouses keeps stock counts consistent under heavy concurrent load. ";
function sampleBlueprint() {
  return {
    project: { name: "CloudInventory", summary: sentence.repeat(3), goals: ["Track stock in real time", "Reduce stock-outs by 30%"], assumptions: ["Team knows TypeScript", "Initial scale under 50,000 SKUs"] },
    workflow: { name: "AI Assisted", recommendationReason: sentence, steps: ["Capture requirements", "Generate skeleton", "Implement and review", "Test", "Deploy"] },
    architecture: { overview: sentence.repeat(2), components: [{ name: "Inventory API", technology: "FastAPI", purpose: sentence }, { name: "Admin Console", technology: "React", purpose: "Dashboards." }], dataFlow: ["Scanner posts a movement", "API validates and stores it", "Event is published"] },
    database: { databaseType: "PostgreSQL 16", entities: [{ name: "Product", description: "A sellable SKU.", fields: ["id", "sku", "name"], relationships: ["has many StockLevel"] }], indexes: ["CREATE INDEX idx_sku ON product (sku)"], notes: ["Partition the ledger monthly"] },
    aiStack: { llm: { name: "gemini-3.6-flash", reason: "Fast structured generation." }, embeddingModel: null, vectorDatabase: null, rag: "No retrieval pipeline is required.", aiFeatures: ["Natural-language stock queries"] },
    roadmap: [{ phase: "Phase 1: Foundations", duration: "2 weeks", objectives: ["Set up CI", "Model schema"], deliverables: ["API skeleton"] }],
    tools: [{ category: "Backend", name: "FastAPI", purpose: "Typed async API framework." }],
    projectStructure: [{ path: "backend/app/api/", purpose: "HTTP routers" }],
    developmentFlow: ["Plan", "Implement", "Review", "Release"],
    effort: [{ area: "Backend", estimatedDays: 18, reason: "Domain logic." }, { area: "Mobile", estimatedDays: 10.5, reason: "Offline sync." }],
    risks: [{ risk: "Offline sync conflicts", impact: "high", mitigation: "Server reconciliation." }],
    nextSteps: ["Create the repository", "Draft the first migration"],
  };
}
function stressBlueprint() {
  const bp = sampleBlueprint();
  bp.project.name = "Enterprise-Grade Multi-Tenant Omnichannel Inventory Orchestration and Demand Forecasting Platform for Global Retail Operations";
  bp.project.summary = "Caf\u00e9 na\u00efve \u00fcber \u00f1 \u20ac \u201Cquotes\u201D \u2014 dash \u2022 bullet \u2026 CJK \u4f60\u597d emoji \uD83D\uDE80. " + sentence.repeat(6);
  bp.project.goals.push("https://example.com/a/very/long/url/with/no/spaces/that/must/be/hard/broken/to/stay/inside/the/page/margin?query=1234567890abcdefghijklmnopqrstuvwxyz");
  bp.database.databaseType = "PostgreSQL 16 with pgvector, TimescaleDB hypertables and logical replication to an analytics warehouse";
  for (let i = 0; i < 40; i++) bp.database.entities.push({ name: `Entity_${i}_with_a_rather_long_table_name`, description: sentence.repeat(2), fields: Array.from({ length: 14 }, (_, k) => `field_${k}_name`), relationships: [`belongs to Entity_${i + 1}`] });
  for (let i = 0; i < 12; i++) bp.roadmap.push({ phase: `Phase ${i + 2}`, duration: `${i + 1} weeks`, objectives: Array.from({ length: 6 }, (_, k) => `Objective ${k}: ${sentence}`), deliverables: ["A", "B"] });
  return bp;
}
function emptyBlueprint() {
  return { project: { name: "", summary: "", goals: [], assumptions: [] }, workflow: { name: "", recommendationReason: "", steps: [] }, architecture: { overview: "", components: [], dataFlow: [] }, database: { databaseType: "", entities: [], indexes: [], notes: [] }, aiStack: { llm: null, embeddingModel: null, vectorDatabase: null, rag: "", aiFeatures: [] }, roadmap: [], tools: [], projectStructure: [], developmentFlow: [], effort: [], nextSteps: [], risks: [] };
}

// --- 4. structural validation --------------------------------------------
function validate(bytes, expectedTitles) {
  const problems = [];
  let s = "";
  for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192));

  if (!s.startsWith("%PDF-1.")) problems.push("missing %PDF- header");
  if (!s.trimEnd().endsWith("%%EOF")) problems.push("missing %%EOF trailer");

  const sx = /startxref\n(\d+)\n%%EOF/.exec(s);
  if (!sx) { problems.push("missing startxref"); return problems; }
  const xrefAt = Number(sx[1]);
  if (!s.startsWith("xref\n", xrefAt)) problems.push(`startxref (${xrefAt}) does not point at the xref table`);

  const head = /^xref\n0 (\d+)\n/.exec(s.slice(xrefAt, xrefAt + 40));
  if (!head) { problems.push("unreadable xref header"); return problems; }
  const count = Number(head[1]);
  let pos = xrefAt + head[0].length;
  for (let i = 0; i < count; i++, pos += 20) {
    const entry = s.slice(pos, pos + 20);
    if (!/^\d{10} \d{5} [nf] \n$/.test(entry)) { problems.push(`xref entry ${i} is not exactly 20 bytes`); break; }
    if (i > 0 && !s.startsWith(`${i} 0 obj`, Number(entry.slice(0, 10)))) problems.push(`xref entry ${i} points at the wrong offset`);
  }

  const streamRe = /<< \/Length (\d+) >>\nstream\n/g;
  let m, streams = 0;
  while ((m = streamRe.exec(s))) {
    streams++;
    const start = m.index + m[0].length;
    if (s.slice(start + Number(m[1]), start + Number(m[1]) + 10) !== "\nendstream") problems.push(`stream ${streams}: /Length ${m[1]} does not match its data`);
  }
  const pageObjs = (s.match(/\/Type \/Page \/Parent/g) || []).length;
  const declared = Number((/\/Count (\d+)/.exec(s) || [])[1]);
  if (pageObjs !== declared || pageObjs !== streams) problems.push(`page count mismatch: objects=${pageObjs}, /Count=${declared}, streams=${streams}`);

  for (const t of expectedTitles) if (!s.includes(t)) problems.push(`missing section text: "${t}"`);
  return problems;
}

const FULL_SECTIONS = ["Project Overview", "Recommended Development Workflow", "System Architecture", "Database Design", "AI Technology Stack", "Implementation Roadmap", "Recommended Tools", "Project Folder Structure", "Development Flow", "Effort & Timeline Estimate", "Risks & Mitigation", "Next Steps"];
const cases = [
  ["normal blueprint", sampleBlueprint(), "CloudInventory", FULL_SECTIONS],
  ["stress blueprint (long title/URL, 40 entities)", stressBlueprint(), stressBlueprint().project.name, FULL_SECTIONS],
  ["empty blueprint (must not crash)", emptyBlueprint(), "", []],
];

let failed = 0;
console.log(`typeof Buffer in this run: ${typeof globalThis.Buffer} (browser-like)\n`);
for (const [label, bp, name, titles] of cases) {
  try {
    const bytes = buildBlueprintPdf(bp, name, new Date("2026-01-15T10:00:00Z"));
    const file = path.join(outDir, `${label.split(" ")[0]}.pdf`);
    fs.writeFileSync(file, bytes);
    const problems = validate(bytes, titles);
    if (problems.length) { failed++; console.log(`FAIL  ${label}`); problems.forEach((p) => console.log(`        - ${p}`)); }
    else console.log(`PASS  ${label}  (${bytes.length.toLocaleString()} bytes)  ->  ${file}`);
  } catch (err) {
    failed++; console.log(`FAIL  ${label}: threw ${err && err.name}: ${err && err.message}`);
  }
}

const nameChecks = [["CloudInventory", "cloudinventory-blueprint.pdf"], ["Caf\u00e9 \u00dcber", "cafe-uber-blueprint.pdf"], ["", "flowforge-project-blueprint.pdf"]];
for (const [input, expected] of nameChecks) {
  const got = pdfFileName(input);
  if (got === expected) console.log(`PASS  file name "${input}" -> ${got}`); else { failed++; console.log(`FAIL  file name "${input}" -> ${got} (expected ${expected})`); }
}

console.log(failed ? `\n${failed} check(s) FAILED` : "\nAll PDF checks passed. Open the files above to look at them.");
process.exit(failed ? 1 : 0);
