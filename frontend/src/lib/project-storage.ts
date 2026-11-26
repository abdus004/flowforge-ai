/**
 * Thin, typed wrapper around sessionStorage for the project draft and the
 * generated blueprint. No secrets are ever stored here — only the project
 * form fields the user typed and the blueprint JSON the backend returned.
 */
import type { Blueprint, ProjectInput, WorkflowChoice } from "@/lib/api";

const PROJECT_KEY = "flowforge:project";
const BLUEPRINT_KEY = "flowforge:blueprint";

export interface StoredProject extends ProjectInput {
  workflow: WorkflowChoice | "";
}

export function saveProject(project: StoredProject): void {
  try {
    sessionStorage.setItem(PROJECT_KEY, JSON.stringify(project));
  } catch {
    // sessionStorage can be unavailable (private mode, quota) — non-fatal
  }
}

export function loadProject(): StoredProject | null {
  try {
    const raw = sessionStorage.getItem(PROJECT_KEY);
    return raw ? (JSON.parse(raw) as StoredProject) : null;
  } catch {
    return null;
  }
}

export function saveBlueprint(blueprint: Blueprint): void {
  try {
    sessionStorage.setItem(BLUEPRINT_KEY, JSON.stringify(blueprint));
  } catch {
    // non-fatal
  }
}

export function loadBlueprint(): Blueprint | null {
  try {
    const raw = sessionStorage.getItem(BLUEPRINT_KEY);
    return raw ? (JSON.parse(raw) as Blueprint) : null;
  } catch {
    return null;
  }
}

export function clearBlueprint(): void {
  try {
    sessionStorage.removeItem(BLUEPRINT_KEY);
  } catch {
    // non-fatal
  }
}
