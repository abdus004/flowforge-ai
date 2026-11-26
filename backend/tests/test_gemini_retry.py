"""
Unit tests for GeminiProvider: retry, backoff, fallback, time budget, error
mapping and response parsing.

These tests use a FAKE SDK client and a FAKE clock. They prove our own logic.
They do not prove that Google's live service is available (see
test_gemini_sdk_integration.py for tests against the real SDK, and
scripts/smoke_test_gemini.py for the one test that calls real Gemini).
"""
from __future__ import annotations

import logging
from types import SimpleNamespace
from typing import Any

import httpx
import pytest
from google.genai import types
from google.genai.errors import ClientError, ServerError

from app.schemas.blueprint import Blueprint
from app.services import gemini_provider as gp
from app.services.ai_provider import AIProviderError
from app.services.gemini_provider import GeminiProvider
from tests.helpers import VALID_BLUEPRINT_JSON, make_cfg

# --------------------------------------------------------------------------
# Fakes
# --------------------------------------------------------------------------


class Clock:
    """Deterministic replacement for time.monotonic / time.sleep."""

    def __init__(self) -> None:
        self.t = 1000.0
        self.sleeps: list[float] = []

    def now(self) -> float:
        return self.t

    def sleep(self, seconds: float) -> None:
        self.sleeps.append(seconds)
        self.t += seconds


class FakeClient:
    """Mimics `client.models.generate_content(...)` with a scripted outcome list."""

    def __init__(self, script: list[dict], clock: Clock) -> None:
        self._script = list(script)
        self._clock = clock
        self.calls: list[SimpleNamespace] = []
        self.models = self  # client.models.generate_content

    def generate_content(self, *, model: str, contents: str, config: types.GenerateContentConfig):
        step = self._script.pop(0) if len(self._script) > 1 else self._script[0]
        self.calls.append(SimpleNamespace(model=model, contents=contents, config=config, at=self._clock.now()))
        self._clock.t += step.get("cost", 1.0)  # simulated duration of the call
        if "raise" in step:
            raise step["raise"]
        return step["response"]


def response(text: str | None, finish: str = "STOP", block: str | None = None):
    payload: dict[str, Any] = {}
    cand: dict[str, Any] = {"finishReason": finish}
    if text is not None:
        cand["content"] = {"role": "model", "parts": [{"text": text}]}
    payload["candidates"] = [cand]
    if block:
        payload["promptFeedback"] = {"blockReason": block}
    return types.GenerateContentResponse.model_validate(payload)


def ok(cost: float = 1.0) -> dict:
    return {"response": response(VALID_BLUEPRINT_JSON), "cost": cost}


def server_error(code: int, status: str, *, cost: float = 1.0, retry_after: str | None = None) -> dict:
    resp = SimpleNamespace(headers={"Retry-After": retry_after}) if retry_after else None
    return {"raise": ServerError(code, {"error": {"code": code, "message": f"{status} simulated", "status": status}}, resp), "cost": cost}


def client_error(code: int, status: str, message: str = "simulated", *, cost: float = 0.2) -> dict:
    return {"raise": ClientError(code, {"error": {"code": code, "message": message, "status": status}}), "cost": cost}


@pytest.fixture()
def clock(monkeypatch: pytest.MonkeyPatch) -> Clock:
    c = Clock()
    monkeypatch.setattr(gp, "_monotonic", c.now)
    monkeypatch.setattr(gp, "_sleep", c.sleep)
    monkeypatch.setattr(gp.random, "uniform", lambda a, b: 0.0)  # no jitter -> exact assertions
    return c


def make_provider(script: list[dict], clock: Clock, **cfg: Any) -> tuple[GeminiProvider, FakeClient]:
    client = FakeClient(script, clock)
    return GeminiProvider(client=client, config=make_cfg(**cfg)), client


def run(provider: GeminiProvider) -> Blueprint:
    return provider.generate_structured(system_prompt="system", user_prompt="user", response_model=Blueprint, temperature=0.5)


def models(client: FakeClient) -> list[str]:
    return [c.model for c in client.calls]


# --------------------------------------------------------------------------
# Configuration & model chain
# --------------------------------------------------------------------------


class TestConfigurationAndChain:
    def test_default_chain_uses_only_documented_models(self):
        from app.config import Settings

        chain = GeminiProvider._build_chain(Settings.gemini_model, Settings.gemini_fallback_models)
        assert chain == ["gemini-3.6-flash", "gemini-3.8-flash", "gemini-3.5-flash-lite"]
        # Regression guard: these were in the old chain but are unverified or
        # redundant (3.5-flash is routed to 3.6 on the Developer API).
        for bad in ("gemini-3.7-flash", "gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"):
            assert bad not in chain

    def test_chain_puts_primary_first_and_removes_duplicates(self):
        assert GeminiProvider._build_chain("b", ["a", "b", " ", "c", "a"]) == ["b", "a", "c"]

    def test_missing_api_key_is_a_clear_configuration_error(self):
        with pytest.raises(AIProviderError) as err:
            GeminiProvider(config=make_cfg(gemini_api_key=None))
        assert err.value.code == "AI_NOT_CONFIGURED"
        assert err.value.status_code == 503
        assert "GEMINI_API_KEY" in err.value.message

    def test_request_config_is_what_we_intend(self, clock):
        provider, client = make_provider([ok()], clock)
        run(provider)
        cfg = client.calls[0].config
        assert client.calls[0].model == "gemini-3.6-flash"
        assert cfg.max_output_tokens == 32_768
        assert cfg.response_mime_type == "application/json"
        assert cfg.response_schema is Blueprint
        assert cfg.http_options.timeout == 75_000
        assert cfg.http_options.retry_options.attempts == 1  # SDK must not retry on its own
        assert cfg.automatic_function_calling.disable is True
        assert cfg.thinking_config.thinking_level == types.ThinkingLevel.LOW

    def test_thinking_level_only_sent_to_models_documented_to_accept_it(self, clock):
        provider, client = make_provider([ok()], clock, gemini_model="some-custom-model", gemini_fallback_models=[])
        run(provider)
        assert client.calls[0].config.thinking_config is None

    def test_thinking_level_can_be_left_at_model_default(self, clock):
        provider, client = make_provider([ok()], clock, gemini_thinking_level="default")
        run(provider)
        assert client.calls[0].config.thinking_config is None


# --------------------------------------------------------------------------
# Success & parsing
# --------------------------------------------------------------------------


class TestSuccessAndParsing:
    def test_first_try_success_returns_validated_model(self, clock):
        provider, client = make_provider([ok()], clock)
        result = run(provider)
        assert isinstance(result, Blueprint)
        assert result.project.name == "CloudInventory"
        assert result.ai_stack.llm.name == "gemini-3.6-flash"
        assert len(client.calls) == 1 and clock.sleeps == []

    def test_sdk_pre_parsed_object_is_used_directly(self, clock):
        parsed = Blueprint.model_validate_json(VALID_BLUEPRINT_JSON)
        resp = SimpleNamespace(parsed=parsed, text=None, candidates=[], prompt_feedback=None)
        provider, _ = make_provider([{"response": resp}], clock)
        assert run(provider) is parsed

    @pytest.mark.parametrize(
        "resp, label",
        [
            (response(""), "empty"),
            (response(None), "empty"),
            (response('{"project": {"name": "cut off'), "invalid"),
            (response('{"project": {"name": "only a name"}}'), "invalid"),
            (response('{"project": {"name": "cut', finish="MAX_TOKENS"), "truncated"),
        ],
    )
    def test_bad_responses_are_retried_and_then_reported_clearly(self, clock, resp, label):
        provider, client = make_provider([{"response": resp}], clock)
        with pytest.raises(AIProviderError) as err:
            run(provider)
        assert err.value.code == "AI_MALFORMED_RESPONSE"
        assert err.value.status_code == 502
        assert len(client.calls) == 6  # 3 models x 2 attempts
        assert clock.sleeps == []  # a bad response is not an overload signal: no waiting

    def test_bad_response_then_good_response_succeeds(self, clock):
        provider, client = make_provider([{"response": response("not json")}, ok()], clock)
        assert run(provider).project.name == "CloudInventory"
        assert models(client) == ["gemini-3.6-flash", "gemini-3.6-flash"]

    @pytest.mark.parametrize(
        "resp",
        [response("", finish="SAFETY"), response(None, finish="PROHIBITED_CONTENT"), response(None, finish="STOP", block="SAFETY")],
    )
    def test_blocked_content_stops_immediately_with_422(self, clock, resp):
        provider, client = make_provider([{"response": resp}], clock)
        with pytest.raises(AIProviderError) as err:
            run(provider)
        assert err.value.code == "AI_CONTENT_BLOCKED"
        assert err.value.status_code == 422
        assert len(client.calls) == 1


# --------------------------------------------------------------------------
# Retry, backoff and fallback
# --------------------------------------------------------------------------


class TestRetryAndFallback:
    def test_503_is_retried_on_the_same_model_with_backoff(self, clock):
        provider, client = make_provider([server_error(503, "UNAVAILABLE"), ok()], clock)
        run(provider)
        assert models(client) == ["gemini-3.6-flash", "gemini-3.6-flash"]
        assert clock.sleeps == [0.5]

    def test_backoff_doubles_and_is_capped(self, clock):
        provider, _ = make_provider(
            [server_error(503, "UNAVAILABLE")], clock,
            gemini_fallback_models=[], gemini_max_retries=6, gemini_backoff_base_ms=1000,
        )
        with pytest.raises(AIProviderError):
            run(provider)
        assert clock.sleeps == [1.0, 2.0, 4.0, 5.0, 5.0]  # capped at 5 s

    def test_retry_after_header_is_honoured(self, clock):
        provider, _ = make_provider([server_error(503, "UNAVAILABLE", retry_after="3"), ok()], clock)
        run(provider)
        assert clock.sleeps == [3.0]

    def test_persistent_503_walks_every_model_then_reports_unavailable(self, clock):
        provider, client = make_provider([server_error(503, "UNAVAILABLE")], clock)
        with pytest.raises(AIProviderError) as err:
            run(provider)
        assert models(client) == ["gemini-3.6-flash"] * 2 + ["gemini-3.8-flash"] * 2 + ["gemini-3.5-flash-lite"] * 2
        assert err.value.code == "AI_PROVIDER_UNAVAILABLE"
        assert err.value.status_code == 503
        assert "Google" in err.value.message and "gemini-3.6-flash" in err.value.message

    def test_fallback_model_success_after_primary_overloaded(self, clock):
        provider, client = make_provider([server_error(503, "UNAVAILABLE"), server_error(503, "UNAVAILABLE"), ok()], clock)
        assert run(provider).project.name == "CloudInventory"
        assert models(client) == ["gemini-3.6-flash", "gemini-3.6-flash", "gemini-3.8-flash"]

    def test_504_moves_to_next_model_without_retrying_the_same_job(self, clock):
        provider, client = make_provider([server_error(504, "DEADLINE_EXCEEDED", cost=30), ok()], clock)
        run(provider)
        assert models(client) == ["gemini-3.6-flash", "gemini-3.8-flash"]
        assert clock.sleeps == []

    def test_client_side_timeout_is_treated_like_504(self, clock):
        provider, client = make_provider([{"raise": httpx.ReadTimeout("timed out"), "cost": 75}, ok()], clock)
        run(provider)
        assert models(client) == ["gemini-3.6-flash", "gemini-3.8-flash"]

    def test_all_timeouts_report_ai_timeout_504(self, clock):
        provider, _ = make_provider([server_error(504, "DEADLINE_EXCEEDED", cost=40)], clock)
        with pytest.raises(AIProviderError) as err:
            run(provider)
        assert err.value.code == "AI_TIMEOUT"
        assert err.value.status_code == 504

    def test_network_errors_are_retried_like_503(self, clock):
        provider, client = make_provider([{"raise": httpx.ConnectError("refused")}, ok()], clock)
        run(provider)
        assert models(client) == ["gemini-3.6-flash", "gemini-3.6-flash"]
        assert len(clock.sleeps) == 1

    def test_other_transport_errors_are_also_retried(self, clock):
        # Previously only ConnectError was handled; ReadError etc. aborted the request.
        provider, client = make_provider([{"raise": httpx.RemoteProtocolError("peer closed")}, ok()], clock)
        run(provider)
        assert len(client.calls) == 2

    def test_429_tries_the_next_model_and_succeeds(self, clock):
        provider, client = make_provider([client_error(429, "RESOURCE_EXHAUSTED"), ok()], clock)
        run(provider)
        assert models(client) == ["gemini-3.6-flash", "gemini-3.8-flash"]

    def test_429_on_every_model_reports_rate_limit(self, clock):
        provider, client = make_provider([client_error(429, "RESOURCE_EXHAUSTED")], clock)
        with pytest.raises(AIProviderError) as err:
            run(provider)
        assert err.value.code == "AI_RATE_LIMITED" and err.value.status_code == 429
        assert len(client.calls) == 3  # one per model, no same-model retries

    def test_404_tries_the_next_model(self, clock):
        provider, client = make_provider([client_error(404, "NOT_FOUND"), ok()], clock)
        run(provider)
        assert models(client) == ["gemini-3.6-flash", "gemini-3.8-flash"]

    def test_404_everywhere_points_the_user_at_their_env_settings(self, clock):
        provider, _ = make_provider([client_error(404, "NOT_FOUND")], clock)
        with pytest.raises(AIProviderError) as err:
            run(provider)
        assert err.value.code == "AI_MODEL_NOT_FOUND"
        assert "GEMINI_MODEL" in err.value.message and "list_gemini_models.py" in err.value.message

    def test_400_on_every_model_is_reported_as_invalid_request(self, clock):
        provider, _ = make_provider([client_error(400, "INVALID_ARGUMENT", "bad schema")], clock)
        with pytest.raises(AIProviderError) as err:
            run(provider)
        assert err.value.code == "AI_INVALID_REQUEST" and err.value.status_code == 502

    def test_mixed_failures_report_unavailable(self, clock):
        provider, _ = make_provider(
            [server_error(504, "DEADLINE_EXCEEDED"), client_error(429, "RESOURCE_EXHAUSTED"), server_error(503, "UNAVAILABLE")], clock
        )
        with pytest.raises(AIProviderError) as err:
            run(provider)
        assert err.value.code == "AI_PROVIDER_UNAVAILABLE"


# --------------------------------------------------------------------------
# Failures that must NOT be retried
# --------------------------------------------------------------------------


class TestTerminalFailures:
    @pytest.mark.parametrize("code, status", [(401, "UNAUTHENTICATED"), (403, "PERMISSION_DENIED")])
    def test_auth_errors_stop_immediately(self, clock, code, status):
        provider, client = make_provider([client_error(code, status)], clock)
        with pytest.raises(AIProviderError) as err:
            run(provider)
        assert err.value.code == "AI_AUTH_FAILED" and err.value.status_code == 503
        assert len(client.calls) == 1 and clock.sleeps == []

    def test_invalid_api_key_arrives_as_400_and_is_reported_as_auth_failure(self, clock):
        # Google reports a bad key as 400 INVALID_ARGUMENT, not 401/403.
        provider, client = make_provider([client_error(400, "INVALID_ARGUMENT", "API key not valid. Please pass a valid API key.")], clock)
        with pytest.raises(AIProviderError) as err:
            run(provider)
        assert err.value.code == "AI_AUTH_FAILED"
        assert "GEMINI_API_KEY" in err.value.message
        assert len(client.calls) == 1

    def test_unknown_4xx_stops_immediately(self, clock):
        provider, client = make_provider([client_error(418, "TEAPOT")], clock)
        with pytest.raises(AIProviderError) as err:
            run(provider)
        assert err.value.code == "AI_REQUEST_FAILED"
        assert len(client.calls) == 1

    def test_unexpected_exceptions_do_not_leak_details_or_keys(self, clock, caplog):
        secret = "AIza" + "x" * 35
        provider, client = make_provider([{"raise": RuntimeError(f"boom key={secret}")}], clock, gemini_api_key=secret)
        with caplog.at_level(logging.DEBUG, logger="flowforge.gemini"):
            with pytest.raises(AIProviderError) as err:
                run(provider)
        assert err.value.code == "AI_GENERATION_FAILED"
        assert secret not in err.value.message
        assert secret not in caplog.text
        assert "[REDACTED]" in caplog.text
        assert len(client.calls) == 1


# --------------------------------------------------------------------------
# Time budget
# --------------------------------------------------------------------------


class TestTimeBudget:
    def test_one_request_can_never_exceed_the_overall_budget(self, clock):
        # Every call takes its full 75 s and times out.
        provider, client = make_provider([server_error(504, "DEADLINE_EXCEEDED", cost=75)], clock)
        start = clock.t
        with pytest.raises(AIProviderError) as err:
            run(provider)
        assert clock.t - start <= 150.0 + 1.0
        assert len(client.calls) == 2  # a third attempt would not fit in the budget
        assert err.value.code == "AI_TIMEOUT"

    def test_attempt_timeout_is_capped_by_the_remaining_budget(self, clock):
        provider, client = make_provider([server_error(503, "UNAVAILABLE", cost=100), ok()], clock)
        run(provider)
        first, second = (c.config.http_options.timeout for c in client.calls)
        assert first == 75_000
        assert second < 50_000  # only ~49.5 s of the 150 s budget remained

    def test_budget_exhaustion_is_reported_with_a_clear_message(self, clock):
        provider, _ = make_provider([server_error(503, "UNAVAILABLE", cost=60)], clock)
        with pytest.raises(AIProviderError) as err:
            run(provider)
        assert err.value.code == "AI_PROVIDER_UNAVAILABLE"
        assert "time limit" in err.value.message

    def test_default_budget_is_below_the_frontend_timeout(self):
        from app.config import Settings

        frontend_timeout_ms = 180_000  # DEFAULT_TIMEOUT_MS in frontend/src/lib/api.ts
        assert Settings.gemini_total_timeout_ms < frontend_timeout_ms


# --------------------------------------------------------------------------
# Logging hygiene
# --------------------------------------------------------------------------


def test_api_key_is_never_written_to_logs_on_normal_failures(clock, caplog):
    secret = "AIza" + "y" * 35
    provider, _ = make_provider([server_error(503, "UNAVAILABLE")], clock, gemini_api_key=secret)
    with caplog.at_level(logging.DEBUG):
        with pytest.raises(AIProviderError):
            run(provider)
    assert secret not in caplog.text
