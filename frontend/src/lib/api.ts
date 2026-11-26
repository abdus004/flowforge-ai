/**
 * Typed API client for the FlowForge backend.
 *
 * All fetch calls to the backend go through this module — components never
 * call `fetch` directly. The backend URL comes from `VITE_API_URL`; no
 * localhost is ever hardcoded.
 */

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const DEFAULT_TIMEOUT_MS = 180_000;

// ---------------------------------------------------------------------------
// Shared project input types
// ---------------------------------------------------------------------------

export type ExperienceLevel = "beginner" | "intermediate" | "advanced";
export type TimelineUnit = "days" | "weeks" | "months";
export type RealWorkflow = "traditional" | "ai-assisted" | "full-ai";
export type WorkflowChoice = RealWorkflow | "compare";

export interface ProjectInput {
  name: string;
  description: string;
  teamSize: string;
  experience: ExperienceLevel | "";
  timelineValue: string;
  timelineUnit: TimelineUnit;
}

export interface BlueprintRequestBody extends ProjectInput {
  workflow: RealWorkflow;
}

export interface RecommendRequestBody extends ProjectInput {
  workflow?: string;
}

// ---------------------------------------------------------------------------
// Blueprint response types (mirrors backend/app/schemas/blueprint.py)
// ---------------------------------------------------------------------------

export interface ProjectSummary {
  name: string;
  summary: string;
  goals: string[];
  assumptions: string[];
}

export interface WorkflowPlan {
  name: string;
  recommendationReason: string;
  steps: string[];
}

export interface ArchitectureComponent {
  name: string;
  purpose: string;
  technology: string;
}

export interface Architecture {
  overview: string;
  components: ArchitectureComponent[];
  dataFlow: string[];
}

export interface DatabaseEntity {
  name: string;
  description: string;
  fields: string[];
  relationships: string[];
}

export interface DatabaseDesign {
  databaseType: string;
  entities: DatabaseEntity[];
  indexes: string[];
  notes: string[];
}

export interface AIModelChoice {
  name: string;
  reason: string;
}

export interface AIStack {
  llm: AIModelChoice | null;
  embeddingModel: AIModelChoice | null;
  vectorDatabase: AIModelChoice | null;
  rag: string;
  aiFeatures: string[];
}

export interface RoadmapPhase {
  phase: string;
  duration: string;
  objectives: string[];
  deliverables: string[];
}

export interface ToolRecommendation {
  category: string;
  name: string;
  purpose: string;
}

export interface ProjectStructureItem {
  path: string;
  purpose: string;
}

export interface EffortEstimate {
  area: string;
  estimatedDays: number;
  reason: string;
}

export interface Risk {
  risk: string;
  impact: string;
  mitigation: string;
}

export interface Blueprint {
  project: ProjectSummary;
  workflow: WorkflowPlan;
  architecture: Architecture;
  database: DatabaseDesign;
  aiStack: AIStack;
  roadmap: RoadmapPhase[];
  tools: ToolRecommendation[];
  projectStructure: ProjectStructureItem[];
  developmentFlow: string[];
  effort: EffortEstimate[];
  nextSteps: string[];
  risks: Risk[];
}

export interface WorkflowRecommendation {
  recommendedWorkflow: RealWorkflow;
  confidence: number;
  reasons: string[];
}

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

interface ErrorBody {
  error?: { code?: string; message?: string };
}

async function postJson<TResponse>(
  path: string,
  body: unknown,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<TResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError("TIMEOUT", "The request took too long. Please try again.", 408);
    }
    throw new ApiError("NETWORK_ERROR", "Could not reach the FlowForge backend. Is it running?", 0);
  } finally {
    clearTimeout(timer);
  }

  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    // ignore — handled by !response.ok / empty-body branches below
  }

  if (!response.ok) {
    const body = (json ?? {}) as ErrorBody;
    throw new ApiError(
      body.error?.code || "UNKNOWN_ERROR",
      body.error?.message || "Something went wrong. Please try again.",
      response.status,
    );
  }

  return json as TResponse;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function generateBlueprint(project: BlueprintRequestBody): Promise<Blueprint> {
  return postJson<Blueprint>("/api/generate-blueprint", project);
}

export function recommendWorkflow(project: RecommendRequestBody): Promise<WorkflowRecommendation> {
  return postJson<WorkflowRecommendation>("/api/recommend-workflow", project);
}
