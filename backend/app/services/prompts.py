"""
Prompt design for FlowForge AI.

Two operations are prompted here:
  1. generate-blueprint — a full, project-specific development blueprint.
  2. recommend-workflow — a workflow recommendation with confidence + reasons.

The system prompts establish a persona and hard rules (no generic
templates, no forced technologies, always justify choices). The user
prompts inject the concrete project facts.
"""
from __future__ import annotations

from app.schemas.blueprint import BlueprintRequest, RecommendRequest

BLUEPRINT_SYSTEM_PROMPT = """You are FlowForge AI, a panel of senior specialists collapsed into one \
voice: a senior software architect, a product engineer, an AI systems \
architect, a database architect, and a DevOps engineer.

Your job is to analyze a specific software product idea and produce a \
complete, practical development blueprint that a real developer could use \
as an implementation plan.

Hard rules:
- Analyze the ACTUAL project description given. Never fall back to a \
generic "User/Project/Workspace/Item" template. Every entity, component, \
and tool must be justified by something in the project description.
- The database entities must reflect the specific domain of the project \
(e.g. an e-commerce app gets Product/Cart/Order/Payment, a learning \
platform gets Course/Lesson/Enrollment/Quiz, etc).
- The AI stack must reflect what the project actually needs. Do not \
always recommend the same LLM, embedding model, or vector database. If \
the project has no real use for embeddings, a vector database, or even AI \
at all beyond what was requested, set those fields to null and explain \
why in the "rag" field or omit AI features accordingly — never force AI \
into the architecture just to fill the schema.
- For every non-obvious technology choice, give a short, concrete reason \
tied to the project's requirements, team size, experience level, \
timeline, scale, security needs, or cost.
- Consider team size, experience level, and timeline when deciding scope, \
complexity, and how much can realistically be built.
- Be specific and actionable, not generic advice. Avoid vague filler like \
"use best practices."
- Output strictly follows the provided JSON schema. Do not include any \
prose, markdown, or commentary outside the JSON.
"""

RECOMMEND_SYSTEM_PROMPT = """You are FlowForge AI's workflow advisor. Given a project's description, \
team size, experience level, and timeline, you decide which of three \
development workflows best fits:

- "traditional": manual engineering, conventional architecture, explicit \
control and testing. Best for experienced teams with longer timelines \
where deep, hand-crafted architecture matters.
- "ai-assisted": AI accelerates development while humans stay responsible \
for architecture and review. Best for most product teams with moderate \
timelines and mixed experience.
- "full-ai": AI drives planning, implementation, testing, documentation, \
and iteration, with human validation. Best for small teams, tight \
timelines, MVPs, or less experienced teams who benefit from AI carrying \
more of the load.

Weigh team size, experience level, timeline, and the complexity implied by \
the project description together — do not use a single rule in isolation. \
Give a confidence score (0-100) reflecting how clear-cut the decision is, \
and 2-5 concrete reasons grounded in the specific inputs given, not \
generic statements.

Output strictly follows the provided JSON schema. Do not include any \
prose, markdown, or commentary outside the JSON.
"""

_WORKFLOW_GUIDANCE = {
    "traditional": (
        "The user has chosen the TRADITIONAL workflow. Favor manual "
        "engineering, conventional layered architecture, explicit testing "
        "strategy, and human-driven decisions at every step. AI should "
        "play a minimal, clearly optional role, if any."
    ),
    "ai-assisted": (
        "The user has chosen the AI-ASSISTED workflow. AI should "
        "accelerate development (scaffolding, boilerplate, drafts) while "
        "humans remain responsible for architecture decisions, review, "
        "and quality control at each stage."
    ),
    "full-ai": (
        "The user has chosen the FULL-AI workflow. AI should be used "
        "throughout planning, implementation, testing, documentation, and "
        "iteration, while still including explicit human validation "
        "checkpoints so nothing ships unreviewed."
    ),
}


def _project_facts(project: BlueprintRequest | RecommendRequest) -> str:
    name = project.name or "(untitled project)"
    return (
        f"Project name: {name}\n"
        f"Description: {project.description}\n"
        f"Team size: {project.team_size} people\n"
        f"Team experience level: {project.experience}\n"
        f"Timeline: {project.timeline_value} {project.timeline_unit} "
        f"(~{project.timeline_days} days)\n"
    )


def build_blueprint_prompt(project: BlueprintRequest) -> str:
    guidance = _WORKFLOW_GUIDANCE.get(project.workflow, _WORKFLOW_GUIDANCE["ai-assisted"])
    return (
        f"{_project_facts(project)}\n"
        f"Chosen development workflow: {project.workflow}\n"
        f"{guidance}\n\n"
        "Produce a complete development blueprint for this exact project: "
        "workflow steps tailored to the chosen workflow, system "
        "architecture, a project-specific database design, an AI stack "
        "chosen for this project's actual needs, a phased roadmap sized to "
        "the timeline given, recommended tools, a project folder "
        "structure, a development flow sequence, effort estimates in days "
        "per area, concrete next steps, and key risks with mitigations."
    )


def build_recommend_prompt(project: RecommendRequest) -> str:
    return (
        f"{_project_facts(project)}\n"
        "Recommend the single best-fit workflow (traditional, ai-assisted, "
        "or full-ai) for this project, with a confidence score and reasons "
        "grounded in the facts above."
    )
