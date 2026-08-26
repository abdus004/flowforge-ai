"""
Request and response schemas for the FlowForge blueprint API.

Field aliases use camelCase so the JSON contract matches what the React
frontend expects. Pydantic validates incoming JSON against the alias by
default, and `model_json_schema(by_alias=True)` (the Pydantic v2 default)
is what gets sent to Gemini as the structured-output schema, so the model
naturally returns camelCase keys that already match this contract.
"""
from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator, ConfigDict

ExperienceLevel = Literal["beginner", "intermediate", "advanced"]
TimelineUnit = Literal["days", "weeks", "months"]
RealWorkflow = Literal["traditional", "ai-assisted", "full-ai"]


# --------------------------------------------------------------------------
# Requests
# --------------------------------------------------------------------------


class ProjectBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)

    name: str = Field(default="", max_length=200)
    description: str = Field(..., min_length=10, max_length=4000)
    team_size: str = Field(..., alias="teamSize")
    experience: ExperienceLevel
    timeline_value: str = Field(..., alias="timelineValue")
    timeline_unit: TimelineUnit = Field(default="weeks", alias="timelineUnit")

    @field_validator("description")
    @classmethod
    def description_required(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Project description is required.")
        return v.strip()

    @field_validator("team_size")
    @classmethod
    def team_size_positive(cls, v: str) -> str:
        try:
            n = int(v)
        except (TypeError, ValueError):
            raise ValueError("Team size must be a positive number.")
        if n <= 0:
            raise ValueError("Team size must be a positive number.")
        return v

    @field_validator("timeline_value")
    @classmethod
    def timeline_positive(cls, v: str) -> str:
        try:
            n = int(v)
        except (TypeError, ValueError):
            raise ValueError("Timeline must be a positive number.")
        if n <= 0:
            raise ValueError("Timeline must be a positive number.")
        return v

    @property
    def team_size_int(self) -> int:
        return int(self.team_size)

    @property
    def timeline_days(self) -> int:
        n = int(self.timeline_value)
        if self.timeline_unit == "days":
            return n
        if self.timeline_unit == "months":
            return n * 30
        return n * 7


class BlueprintRequest(ProjectBase):
    """POST /api/generate-blueprint"""

    workflow: RealWorkflow


class RecommendRequest(ProjectBase):
    """POST /api/recommend-workflow"""

    workflow: Optional[str] = None


# --------------------------------------------------------------------------
# Blueprint response
# --------------------------------------------------------------------------


class ProjectSummary(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    name: str
    summary: str
    goals: List[str] = Field(default_factory=list)
    assumptions: List[str] = Field(default_factory=list)


class WorkflowPlan(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    name: str
    recommendation_reason: str = Field(alias="recommendationReason")
    steps: List[str]


class ArchitectureComponent(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    name: str
    purpose: str
    technology: str


class Architecture(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    overview: str
    components: List[ArchitectureComponent]
    data_flow: List[str] = Field(default_factory=list, alias="dataFlow")


class DatabaseEntity(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    name: str
    description: str
    fields: List[str] = Field(default_factory=list)
    relationships: List[str] = Field(default_factory=list)


class DatabaseDesign(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    database_type: str = Field(alias="databaseType")
    entities: List[DatabaseEntity]
    indexes: List[str] = Field(default_factory=list)
    notes: List[str] = Field(default_factory=list)


class AIModelChoice(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    name: str
    reason: str


class AIStack(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    llm: Optional[AIModelChoice] = None
    embedding_model: Optional[AIModelChoice] = Field(default=None, alias="embeddingModel")
    vector_database: Optional[AIModelChoice] = Field(default=None, alias="vectorDatabase")
    rag: str = ""
    ai_features: List[str] = Field(default_factory=list, alias="aiFeatures")


class RoadmapPhase(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    phase: str
    duration: str
    objectives: List[str] = Field(default_factory=list)
    deliverables: List[str] = Field(default_factory=list)


class ToolRecommendation(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    category: str
    name: str
    purpose: str


class ProjectStructureItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    path: str
    purpose: str


class EffortEstimate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    area: str
    estimated_days: float = Field(alias="estimatedDays")
    reason: str


class Risk(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    risk: str
    impact: str
    mitigation: str


class Blueprint(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    project: ProjectSummary
    workflow: WorkflowPlan
    architecture: Architecture
    database: DatabaseDesign
    ai_stack: AIStack = Field(alias="aiStack")
    roadmap: List[RoadmapPhase]
    tools: List[ToolRecommendation]
    project_structure: List[ProjectStructureItem] = Field(alias="projectStructure")
    development_flow: List[str] = Field(alias="developmentFlow")
    effort: List[EffortEstimate]
    next_steps: List[str] = Field(alias="nextSteps")
    risks: List[Risk] = Field(default_factory=list)


# --------------------------------------------------------------------------
# Workflow recommendation response
# --------------------------------------------------------------------------


class WorkflowRecommendation(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    recommended_workflow: RealWorkflow = Field(alias="recommendedWorkflow")
    confidence: int = Field(ge=0, le=100)
    reasons: List[str]
