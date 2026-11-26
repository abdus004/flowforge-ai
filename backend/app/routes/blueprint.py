from fastapi import APIRouter, Depends

from app.schemas.blueprint import (
    Blueprint,
    BlueprintRequest,
    RecommendRequest,
    WorkflowRecommendation,
)
from app.services.blueprint_service import BlueprintService, get_blueprint_service

router = APIRouter(prefix="/api", tags=["blueprint"])


@router.post("/generate-blueprint", response_model=Blueprint, response_model_by_alias=True)
def generate_blueprint(
    payload: BlueprintRequest,
    service: BlueprintService = Depends(get_blueprint_service),
) -> Blueprint:
    return service.generate_blueprint(payload)


@router.post(
    "/recommend-workflow",
    response_model=WorkflowRecommendation,
    response_model_by_alias=True,
)
def recommend_workflow(
    payload: RecommendRequest,
    service: BlueprintService = Depends(get_blueprint_service),
) -> WorkflowRecommendation:
    return service.recommend_workflow(payload)
