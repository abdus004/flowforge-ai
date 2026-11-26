"""
End-to-end tests of the HTTP API through FastAPI's TestClient.

The AI provider is replaced by a fake, so these test routing, validation,
response shape (camelCase contract with the frontend) and error format.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.blueprint import Blueprint, WorkflowRecommendation
from app.services.ai_provider import AIProvider, AIProviderError
from app.services.blueprint_service import BlueprintService, get_blueprint_service
from tests.helpers import BLUEPRINT_REQUEST, VALID_BLUEPRINT_JSON


class FakeProvider(AIProvider):
    def __init__(self) -> None:
        self.calls: list[dict] = []
        self.error: Exception | None = None

    def generate_structured(self, *, system_prompt, user_prompt, response_model, temperature=0.4):
        self.calls.append({"system": system_prompt, "user": user_prompt, "model": response_model, "temperature": temperature})
        if self.error:
            raise self.error
        if response_model is Blueprint:
            return Blueprint.model_validate_json(VALID_BLUEPRINT_JSON)
        return WorkflowRecommendation(recommendedWorkflow="ai-assisted", confidence=82, reasons=["Small team", "Short deadline"])


@pytest.fixture()
def provider():
    p = FakeProvider()
    app.dependency_overrides[get_blueprint_service] = lambda: BlueprintService(p)
    yield p
    app.dependency_overrides.clear()


@pytest.fixture()
def client(provider):
    # raise_server_exceptions=False so the app's own 500 handler is exercised.
    return TestClient(app, raise_server_exceptions=False)


class TestGenerateBlueprint:
    def test_success_returns_camel_case_contract(self, client, provider):
        r = client.post("/api/generate-blueprint", json=BLUEPRINT_REQUEST)
        assert r.status_code == 200
        body = r.json()
        # These are the exact keys the frontend (src/lib/api.ts) reads.
        assert set(body) == {"project", "workflow", "architecture", "database", "aiStack", "roadmap", "tools",
                             "projectStructure", "developmentFlow", "effort", "nextSteps", "risks"}
        assert body["workflow"]["recommendationReason"]
        assert body["database"]["databaseType"] == "PostgreSQL"
        assert body["effort"][0]["estimatedDays"] == 10
        assert "recommendation_reason" not in body["workflow"]  # no snake_case leakage

    def test_user_input_reaches_the_prompt(self, client, provider):
        client.post("/api/generate-blueprint", json=BLUEPRINT_REQUEST)
        call = provider.calls[0]
        assert "multi-warehouse retail" in call["user"]
        assert call["model"] is Blueprint

    @pytest.mark.parametrize(
        "patch, field",
        [
            ({"description": "too short"}, "description"),
            ({"description": ""}, "description"),
            ({"teamSize": "abc"}, "teamSize"),
            ({"teamSize": "0"}, "teamSize"),
            ({"timelineValue": "-3"}, "timelineValue"),
            ({"experience": "wizard"}, "experience"),
            ({"workflow": "compare"}, "workflow"),
            ({"timelineUnit": "years"}, "timelineUnit"),
        ],
    )
    def test_invalid_input_is_rejected_before_calling_the_ai(self, client, provider, patch, field):
        r = client.post("/api/generate-blueprint", json={**BLUEPRINT_REQUEST, **patch})
        assert r.status_code == 422
        assert r.json()["error"]["code"] == "VALIDATION_ERROR"
        assert field in r.json()["error"]["message"]
        assert provider.calls == []  # no tokens spent on bad input

    def test_missing_field_is_rejected(self, client, provider):
        payload = {k: v for k, v in BLUEPRINT_REQUEST.items() if k != "teamSize"}
        r = client.post("/api/generate-blueprint", json=payload)
        assert r.status_code == 422 and provider.calls == []

    def test_overlong_description_is_rejected(self, client, provider):
        r = client.post("/api/generate-blueprint", json={**BLUEPRINT_REQUEST, "description": "x" * 4001})
        assert r.status_code == 422 and provider.calls == []

    def test_wrong_http_method(self, client):
        assert client.get("/api/generate-blueprint").status_code == 405

    @pytest.mark.parametrize(
        "code, status",
        [("AI_PROVIDER_UNAVAILABLE", 503), ("AI_TIMEOUT", 504), ("AI_RATE_LIMITED", 429),
         ("AI_AUTH_FAILED", 503), ("AI_CONTENT_BLOCKED", 422), ("AI_MALFORMED_RESPONSE", 502)],
    )
    def test_ai_errors_use_the_documented_error_shape(self, client, provider, code, status):
        provider.error = AIProviderError(code, "A clear message for the user.", status)
        r = client.post("/api/generate-blueprint", json=BLUEPRINT_REQUEST)
        assert r.status_code == status
        assert r.json() == {"error": {"code": code, "message": "A clear message for the user."}}

    def test_unexpected_exception_returns_generic_500_without_internals(self, client, provider):
        provider.error = RuntimeError("secret internal detail /etc/passwd AIzaSyFAKE")
        r = client.post("/api/generate-blueprint", json=BLUEPRINT_REQUEST)
        assert r.status_code == 500
        assert r.json()["error"]["code"] == "INTERNAL_ERROR"
        assert "secret" not in r.text and "AIza" not in r.text


class TestRecommendWorkflow:
    def test_success(self, client, provider):
        r = client.post("/api/recommend-workflow", json={**BLUEPRINT_REQUEST, "workflow": "compare"})
        assert r.status_code == 200
        assert r.json() == {"recommendedWorkflow": "ai-assisted", "confidence": 82, "reasons": ["Small team", "Short deadline"]}

    def test_validation(self, client, provider):
        r = client.post("/api/recommend-workflow", json={**BLUEPRINT_REQUEST, "teamSize": "x"})
        assert r.status_code == 422 and provider.calls == []


class TestHealthAndCors:
    def test_health(self, client):
        r = client.get("/api/health")
        assert r.status_code == 200 and r.json() == {"status": "ok", "service": "flowforge-api"}

    @pytest.mark.parametrize("origin", ["http://localhost:8080", "http://127.0.0.1:8080"])
    def test_default_frontend_origins_are_allowed(self, client, origin):
        r = client.options("/api/generate-blueprint", headers={
            "Origin": origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"})
        assert r.status_code == 200
        assert r.headers["access-control-allow-origin"] == origin

    def test_unknown_origin_is_not_allowed(self, client):
        r = client.options("/api/generate-blueprint", headers={
            "Origin": "https://evil.example", "Access-Control-Request-Method": "POST"})
        assert "access-control-allow-origin" not in r.headers
