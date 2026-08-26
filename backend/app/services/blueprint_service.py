"""
Business logic for blueprint generation and workflow recommendation.

Routes stay thin; this module owns prompt selection and talks to the
AIProvider abstraction so it never depends on a specific vendor SDK.
"""
from __future__ import annotations

from app.schemas.blueprint import (
    Blueprint,
    BlueprintRequest,
    RecommendRequest,
    WorkflowRecommendation,
)
from app.services.ai_provider import AIProvider, get_ai_provider
from app.services.prompts import (
    BLUEPRINT_SYSTEM_PROMPT,
    RECOMMEND_SYSTEM_PROMPT,
    build_blueprint_prompt,
    build_recommend_prompt,
)


class BlueprintService:
    def __init__(self, provider: AIProvider):
        self._provider = provider

    def generate_blueprint(self, project: BlueprintRequest) -> Blueprint:
        return self._provider.generate_structured(
            system_prompt=BLUEPRINT_SYSTEM_PROMPT,
            user_prompt=build_blueprint_prompt(project),
            response_model=Blueprint,
            temperature=0.5,
        )

    def recommend_workflow(self, project: RecommendRequest) -> WorkflowRecommendation:
        return self._provider.generate_structured(
            system_prompt=RECOMMEND_SYSTEM_PROMPT,
            user_prompt=build_recommend_prompt(project),
            response_model=WorkflowRecommendation,
            temperature=0.3,
        )


def get_blueprint_service() -> BlueprintService:
    """FastAPI dependency factory."""
    return BlueprintService(get_ai_provider())
