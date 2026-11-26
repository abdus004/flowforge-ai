"""Shared test helpers (no network, no real API key)."""
from __future__ import annotations

import json
from types import SimpleNamespace
from typing import Any

# A minimal but fully valid Blueprint, in the camelCase wire format that
# Gemini is asked to produce.
VALID_BLUEPRINT: dict[str, Any] = {
    "project": {"name": "CloudInventory", "summary": "Inventory platform.", "goals": ["Track stock"], "assumptions": []},
    "workflow": {"name": "AI Assisted", "recommendationReason": "Small team, short deadline.", "steps": ["Plan", "Build"]},
    "architecture": {"overview": "Modular monolith.", "components": [{"name": "API", "purpose": "REST", "technology": "FastAPI"}], "dataFlow": ["Client -> API"]},
    "database": {"databaseType": "PostgreSQL", "entities": [{"name": "Product", "description": "SKU", "fields": ["id"], "relationships": []}], "indexes": [], "notes": []},
    "aiStack": {"llm": {"name": "gemini-3.6-flash", "reason": "Fast."}, "rag": "", "aiFeatures": []},
    "roadmap": [{"phase": "Phase 1", "duration": "2 weeks", "objectives": ["Setup"], "deliverables": ["Repo"]}],
    "tools": [{"category": "Backend", "name": "FastAPI", "purpose": "API"}],
    "projectStructure": [{"path": "backend/", "purpose": "API code"}],
    "developmentFlow": ["Plan", "Build", "Ship"],
    "effort": [{"area": "Backend", "estimatedDays": 10, "reason": "Core logic"}],
    "nextSteps": ["Create repo"],
    "risks": [{"risk": "Scope creep", "impact": "medium", "mitigation": "Weekly review"}],
}
VALID_BLUEPRINT_JSON = json.dumps(VALID_BLUEPRINT)

BLUEPRINT_REQUEST = {
    "name": "CloudInventory",
    "description": "A real-time inventory tracking system for multi-warehouse retail businesses.",
    "teamSize": "4",
    "experience": "intermediate",
    "timelineValue": "10",
    "timelineUnit": "weeks",
    "workflow": "ai-assisted",
}


def make_cfg(**overrides: Any) -> SimpleNamespace:
    """Settings-like object with the production defaults; override per test."""
    values: dict[str, Any] = dict(
        gemini_api_key="test-key-not-real",
        gemini_model="gemini-3.6-flash",
        gemini_fallback_models=["gemini-3.8-flash", "gemini-3.5-flash-lite"],
        gemini_timeout_ms=75_000,
        gemini_total_timeout_ms=150_000,
        gemini_max_retries=2,
        gemini_backoff_base_ms=500,
        gemini_max_output_tokens=32_768,
        gemini_thinking_level="low",
    )
    values.update(overrides)
    return SimpleNamespace(**values)
