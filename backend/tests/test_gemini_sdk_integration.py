"""
Run the REAL google-genai SDK against a LOCAL fake Gemini server.

What this proves: our provider works with the real SDK's request building,
headers, error classes and structured-output parsing, and that the SDK adds no
hidden retries.

What this does NOT prove: that Google's live service is reachable or healthy.
Only scripts/smoke_test_gemini.py (needs a real key) can show that.
"""
from __future__ import annotations

import time

import pytest
from google import genai
from google.genai import types

from app.schemas.blueprint import Blueprint
from app.services import gemini_provider as gp
from app.services.ai_provider import AIProviderError
from app.services.gemini_provider import GeminiProvider
from tests.fake_gemini_server import FakeGeminiServer
from tests.helpers import VALID_BLUEPRINT_JSON, make_cfg


@pytest.fixture(autouse=True)
def no_real_sleeping(monkeypatch: pytest.MonkeyPatch):
    sleeps: list[float] = []
    monkeypatch.setattr(gp, "_sleep", sleeps.append)
    return sleeps


def provider_for(server: FakeGeminiServer, **cfg) -> GeminiProvider:
    client = genai.Client(api_key="test-key-not-real", http_options=types.HttpOptions(base_url=server.base_url))
    return GeminiProvider(client=client, config=make_cfg(**cfg))


def generate(provider: GeminiProvider) -> Blueprint:
    return provider.generate_structured(system_prompt="SYSTEM-PROMPT", user_prompt="USER-PROMPT", response_model=Blueprint, temperature=0.5)


def test_successful_response_is_parsed_into_the_blueprint_model():
    with FakeGeminiServer({"*": [("ok", VALID_BLUEPRINT_JSON)]}) as server:
        result = generate(provider_for(server))
    assert isinstance(result, Blueprint)
    assert result.project.name == "CloudInventory"
    assert result.workflow.recommendation_reason == "Small team, short deadline."
    assert result.effort[0].estimated_days == 10


def test_request_sent_to_google_has_the_expected_shape():
    with FakeGeminiServer({"*": [("ok", VALID_BLUEPRINT_JSON)]}) as server:
        generate(provider_for(server))
        req = server.calls()[0]
    assert req["model"] == "gemini-3.6-flash"
    assert req["headers"]["x-goog-api-key"] == "test-key-not-real"  # key travels in a header, never the URL
    # The SDK forwards our timeout as a SERVER-SIDE deadline (this is why a too-small
    # timeout makes Google itself answer 504).
    assert req["headers"]["x-server-timeout"] == "75"
    body = req["body"]
    gen = body["generationConfig"]
    assert gen["maxOutputTokens"] == 32_768
    assert gen["responseMimeType"] == "application/json"
    # The SDK serialises this key in snake_case; protobuf-JSON accepts both spellings.
    thinking = gen["thinkingConfig"]
    assert (thinking.get("thinkingLevel") or thinking.get("thinking_level")).upper() == "LOW"
    assert "responseSchema" in gen or "responseJsonSchema" in gen
    assert body["systemInstruction"]["parts"][0]["text"] == "SYSTEM-PROMPT"
    assert body["contents"][0]["parts"][0]["text"] == "USER-PROMPT"
    assert "tools" not in body  # no function calling


def test_persistent_503_makes_exactly_attempts_x_models_http_calls():
    """Proves there is no nested retry: 3 models x 2 attempts = 6 HTTP requests, not more."""
    with FakeGeminiServer({"*": [("status", 503)]}) as server:
        with pytest.raises(AIProviderError) as err:
            generate(provider_for(server))
        counts = {m: len(server.calls(m)) for m in ("gemini-3.6-flash", "gemini-3.8-flash", "gemini-3.5-flash-lite")}
        assert len(server.calls()) == 6
    assert counts == {"gemini-3.6-flash": 2, "gemini-3.8-flash": 2, "gemini-3.5-flash-lite": 2}
    assert err.value.code == "AI_PROVIDER_UNAVAILABLE"
    assert err.value.status_code == 503


def test_503_then_success_recovers_on_the_same_model(no_real_sleeping):
    with FakeGeminiServer({"gemini-3.6-flash": [("status", 503), ("ok", VALID_BLUEPRINT_JSON)]}) as server:
        result = generate(provider_for(server))
        assert [r["model"] for r in server.calls()] == ["gemini-3.6-flash"] * 2
    assert result.project.name == "CloudInventory"
    assert len(no_real_sleeping) == 1


def test_overloaded_primary_falls_back_to_the_next_model():
    script = {"gemini-3.6-flash": [("status", 503)], "gemini-3.8-flash": [("ok", VALID_BLUEPRINT_JSON)]}
    with FakeGeminiServer(script) as server:
        result = generate(provider_for(server))
        assert [r["model"] for r in server.calls()] == ["gemini-3.6-flash", "gemini-3.6-flash", "gemini-3.8-flash"]
    assert result.project.name == "CloudInventory"


def test_504_from_google_is_not_retried_on_the_same_model():
    script = {"gemini-3.6-flash": [("status", 504)], "gemini-3.8-flash": [("ok", VALID_BLUEPRINT_JSON)]}
    with FakeGeminiServer(script) as server:
        generate(provider_for(server))
        assert [r["model"] for r in server.calls()] == ["gemini-3.6-flash", "gemini-3.8-flash"]


def test_all_504_reports_ai_timeout():
    with FakeGeminiServer({"*": [("status", 504)]}) as server:
        with pytest.raises(AIProviderError) as err:
            generate(provider_for(server))
        assert len(server.calls()) == 3
    assert err.value.code == "AI_TIMEOUT" and err.value.status_code == 504


def test_real_client_side_timeout_falls_through_to_the_next_model():
    """A real httpx read timeout (not simulated): the first model hangs, the second answers."""
    script = {"gemini-3.6-flash": [("sleep_then_ok", 3.0, VALID_BLUEPRINT_JSON)], "gemini-3.8-flash": [("ok", VALID_BLUEPRINT_JSON)]}
    with FakeGeminiServer(script) as server:
        started = time.monotonic()
        result = generate(provider_for(server, gemini_timeout_ms=1000))
        elapsed = time.monotonic() - started
        assert [r["model"] for r in server.calls()] == ["gemini-3.6-flash", "gemini-3.8-flash"]
    assert result.project.name == "CloudInventory"
    assert 0.9 < elapsed < 2.9  # gave up after ~1 s, did not wait the full 3 s


def test_invalid_api_key_from_google_stops_after_one_call():
    msg = "API key not valid. Please pass a valid API key."
    with FakeGeminiServer({"*": [("status", 400, msg)]}) as server:
        with pytest.raises(AIProviderError) as err:
            generate(provider_for(server))
        assert len(server.calls()) == 1
    assert err.value.code == "AI_AUTH_FAILED"
    assert "test-key-not-real" not in err.value.message


def test_429_on_primary_uses_the_fallback_model():
    script = {"gemini-3.6-flash": [("status", 429)], "gemini-3.8-flash": [("ok", VALID_BLUEPRINT_JSON)]}
    with FakeGeminiServer(script) as server:
        generate(provider_for(server))
        assert len(server.calls("gemini-3.6-flash")) == 1  # not retried


def test_truncated_output_is_detected_then_recovers():
    script = {"gemini-3.6-flash": [("ok", '{"project": {"name": "cut', "MAX_TOKENS"), ("ok", VALID_BLUEPRINT_JSON)]}
    with FakeGeminiServer(script) as server:
        result = generate(provider_for(server))
        assert len(server.calls()) == 2
    assert result.project.name == "CloudInventory"


def test_safety_block_is_reported_without_retrying():
    with FakeGeminiServer({"*": [("ok", "", "SAFETY")]}) as server:
        with pytest.raises(AIProviderError) as err:
            generate(provider_for(server))
        assert len(server.calls()) == 1
    assert err.value.code == "AI_CONTENT_BLOCKED" and err.value.status_code == 422
