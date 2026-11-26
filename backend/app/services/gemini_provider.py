"""
Gemini implementation of AIProvider.

Uses the `google-genai` SDK's native structured-output support: a Pydantic
model is passed as `response_schema`, Gemini is constrained to that JSON
shape, and the response is parsed back into the same model.

This is a plain structured-generation request: no tools, no function calling,
no agent loop. Automatic Function Calling (enabled by default in the SDK even
with zero tools) is explicitly disabled.

Reliability strategy
--------------------
Google's 503 (UNAVAILABLE) and 504 (DEADLINE_EXCEEDED) errors are server-side
capacity/latency conditions. Nothing in this file can *fix* them; the goal is
to make the best use of the time available and then fail with a clear message.

1. ONE retry mechanism. The SDK's own retries are disabled (attempts=1), so
   every HTTP call you see in the logs is one of *our* attempts.
2. ONE overall time budget per user request (GEMINI_TOTAL_TIMEOUT_MS). Each
   attempt's timeout is capped by what is left, so the request can never run
   longer than the frontend is willing to wait.
3. Error-specific policy:
     503 / 500 / network error   retry the same model (bounded, exponential
                                 backoff with jitter, honours Retry-After),
                                 then try the next model.
     504 / client timeout        the job did not finish inside its deadline.
                                 Retrying the same job with the same deadline
                                 rarely helps, so move to the next model.
     429 / 404 / other 400       specific to this model -> next model.
     401 / 403 / bad API key     stop immediately (a retry cannot help).
     content blocked             stop immediately.
     empty / truncated / invalid retry (counts toward the attempt limit).
4. Fallback models come from GEMINI_FALLBACK_MODELS and default to models that
   Google's documentation lists as Stable with structured-output support.
5. `thinking_level=low` is sent only to models whose documented levels include
   it. Thinking tokens share the output-token limit, so lower thinking means
   faster responses and less risk of truncated JSON.
"""
from __future__ import annotations

import json
import logging
import random
import re
import time
from typing import Any, List, Optional, Tuple, Type, TypeVar

import httpx
import pydantic
from google import genai
from google.genai import types
from google.genai.errors import APIError, ClientError, ServerError

from app.config import settings
from app.services.ai_provider import AIProvider, AIProviderError

logger = logging.getLogger("flowforge.gemini")

T = TypeVar("T", bound=pydantic.BaseModel)

# Models documented (ai.google.dev, thinking guide, Nov 2026) to accept
# thinking_level="low". Any other model gets the model's default thinking.
_THINKING_LEVEL_MODELS = frozenset(
    {"gemini-3.6-flash", "gemini-3.8-flash", "gemini-3.5-flash-lite"}
)

# Do not start an attempt that has less than this long left to complete.
_MIN_ATTEMPT_S = 15.0
_MAX_BACKOFF_MS = 5_000
_MAX_RETRY_AFTER_S = 10.0

# Finish reasons meaning "Google refused to produce this content".
_BLOCKED_FINISH_REASONS = frozenset(
    {"SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION",
     "IMAGE_SAFETY", "IMAGE_PROHIBITED_CONTENT"}
)

# Indirection so tests can run deterministically without real waiting.
_monotonic = time.monotonic
_sleep = time.sleep

_API_KEY_PATTERN = re.compile(r"AIza[0-9A-Za-z_\-]{20,}")


class _AttemptFailure(Exception):
    """A recoverable failure of one attempt (internal; never leaves this module)."""

    def __init__(
        self,
        kind: str,
        label: str,
        *,
        retry_same_model: bool,
        retry_after_s: Optional[float] = None,
        detail: str = "",
    ) -> None:
        super().__init__(detail or label)
        self.kind = kind  # unavailable | timeout | network | rate_limited | not_found | bad_request | bad_response
        self.label = label  # short, user-safe label such as "503" or "timeout"
        self.retry_same_model = retry_same_model
        self.retry_after_s = retry_after_s
        self.detail = detail


class GeminiProvider(AIProvider):
    def __init__(self, client: Optional[Any] = None, config: Optional[Any] = None) -> None:
        """
        `client` and `config` exist so tests can inject a fake SDK client and
        settings. Production code calls `GeminiProvider()` with no arguments.
        """
        cfg = config if config is not None else settings
        self._cfg = cfg

        if client is None:
            if not cfg.gemini_api_key:
                raise AIProviderError(
                    code="AI_NOT_CONFIGURED",
                    message=(
                        "The AI provider is not configured on the server. "
                        "Set GEMINI_API_KEY in backend/.env and restart the backend."
                    ),
                    status_code=503,
                )
            client = genai.Client(api_key=cfg.gemini_api_key)
        self._client = client

        self._timeout_ms = int(cfg.gemini_timeout_ms)
        self._total_s = int(cfg.gemini_total_timeout_ms) / 1000.0
        self._max_attempts = max(1, int(cfg.gemini_max_retries))
        self._backoff_base_ms = max(0, int(cfg.gemini_backoff_base_ms))
        self._max_output_tokens = int(cfg.gemini_max_output_tokens)
        self._thinking_level = str(cfg.gemini_thinking_level).lower()
        self._chain = self._build_chain(cfg.gemini_model, cfg.gemini_fallback_models)

    # ------------------------------------------------------------------ public

    @staticmethod
    def _build_chain(primary: str, fallbacks: List[str]) -> List[str]:
        chain: List[str] = []
        for name in [primary, *fallbacks]:
            name = (name or "").strip()
            if name and name not in chain:
                chain.append(name)
        return chain

    def generate_structured(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        response_model: Type[T],
        temperature: float = 0.4,
    ) -> T:
        started = _monotonic()
        deadline = started + self._total_s
        failures: List[Tuple[str, _AttemptFailure]] = []
        total_attempts = 0

        for model_name in self._chain:
            for attempt in range(1, self._max_attempts + 1):
                remaining = deadline - _monotonic()
                if remaining < _MIN_ATTEMPT_S:
                    logger.error(
                        "Time budget exhausted (%.0f s total) after %d attempt(s).",
                        self._total_s, total_attempts,
                    )
                    raise self._final_error(failures, budget_exhausted=True)

                timeout_ms = int(min(self._timeout_ms, remaining * 1000))
                total_attempts += 1
                attempt_started = _monotonic()
                try:
                    result = self._call_model(
                        model_name=model_name,
                        system_prompt=system_prompt,
                        user_prompt=user_prompt,
                        response_model=response_model,
                        temperature=temperature,
                        timeout_ms=timeout_ms,
                    )
                except _AttemptFailure as failure:
                    failures.append((model_name, failure))
                    logger.warning(
                        "Gemini attempt failed: model=%s attempt=%d/%d kind=%s status=%s "
                        "after %.1fs%s",
                        model_name, attempt, self._max_attempts, failure.kind, failure.label,
                        _monotonic() - attempt_started,
                        f" ({failure.detail})" if failure.detail else "",
                    )
                    if failure.retry_same_model and attempt < self._max_attempts:
                        delay_s = self._backoff_s(attempt, failure.retry_after_s, failure.kind)
                        if delay_s + _MIN_ATTEMPT_S <= deadline - _monotonic():
                            if delay_s > 0:
                                logger.info("Retrying %s in %.2f s", model_name, delay_s)
                                _sleep(delay_s)
                            continue
                    break  # give up on this model; try the next one
                else:
                    logger.info(
                        "Gemini success: model=%s attempts=%d elapsed=%.1fs%s",
                        model_name, total_attempts, _monotonic() - started,
                        "" if model_name == self._chain[0] else " (fallback model)",
                    )
                    return result

        logger.error("All Gemini models exhausted: %s", self._summarise(failures))
        raise self._final_error(failures, budget_exhausted=False)

    # --------------------------------------------------------------- one call

    def _thinking_config(self, model_name: str) -> Optional[types.ThinkingConfig]:
        if self._thinking_level in ("", "default"):
            return None
        if model_name not in _THINKING_LEVEL_MODELS:
            return None  # cannot verify this model accepts the parameter
        return types.ThinkingConfig(thinking_level=types.ThinkingLevel[self._thinking_level.upper()])

    def _call_model(
        self,
        *,
        model_name: str,
        system_prompt: str,
        user_prompt: str,
        response_model: Type[T],
        temperature: float,
        timeout_ms: int,
    ) -> T:
        """One HTTP request. Returns a parsed model, or raises."""
        config_kwargs: dict = dict(
            system_instruction=system_prompt,
            response_mime_type="application/json",
            response_schema=response_model,
            temperature=temperature,
            max_output_tokens=self._max_output_tokens,
            http_options=types.HttpOptions(
                timeout=timeout_ms,
                # attempts=1 -> the SDK never retries by itself.
                retry_options=types.HttpRetryOptions(attempts=1),
            ),
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        )
        thinking = self._thinking_config(model_name)
        if thinking is not None:
            config_kwargs["thinking_config"] = thinking

        try:
            response = self._client.models.generate_content(
                model=model_name,
                contents=user_prompt,
                config=types.GenerateContentConfig(**config_kwargs),
            )
        except ServerError as exc:
            raise self._from_server_error(exc) from exc
        except ClientError as exc:
            raise self._from_client_error(exc, model_name) from exc
        except httpx.TimeoutException as exc:
            raise _AttemptFailure(
                "timeout", "timeout", retry_same_model=False,
                detail=f"client timeout after {timeout_ms / 1000:.0f}s",
            ) from exc
        except httpx.TransportError as exc:
            raise _AttemptFailure(
                "network", "network error", retry_same_model=True, detail=type(exc).__name__,
            ) from exc
        except APIError as exc:
            logger.error("Gemini API error: model=%s: %s", model_name, self._redact(str(exc)))
            raise AIProviderError(
                code="AI_GENERATION_FAILED",
                message="Unable to generate the blueprint right now. Please try again.",
                status_code=502,
            ) from exc
        except Exception as exc:  # noqa: BLE001 - never leak raw SDK errors
            logger.error(
                "Unexpected error calling Gemini: model=%s: %s",
                model_name, self._redact(f"{type(exc).__name__}: {exc}"),
            )
            raise AIProviderError(
                code="AI_GENERATION_FAILED",
                message="Unable to generate the blueprint right now. Please try again.",
                status_code=502,
            ) from exc

        return self._parse_response(response, response_model)

    # ----------------------------------------------------- error classification

    @staticmethod
    def _retry_after(exc: APIError) -> Optional[float]:
        try:
            raw = exc.response.headers.get("Retry-After")  # type: ignore[union-attr]
            return float(raw) if raw is not None else None
        except Exception:  # noqa: BLE001 - header is optional and may be malformed
            return None

    def _from_server_error(self, exc: ServerError) -> _AttemptFailure:
        status = getattr(exc, "code", None)
        if status == 504:
            return _AttemptFailure(
                "timeout", "504", retry_same_model=False,
                detail="DEADLINE_EXCEEDED: Google did not finish within the deadline",
            )
        return _AttemptFailure(
            "unavailable", str(status or "5xx"), retry_same_model=True,
            retry_after_s=self._retry_after(exc),
            detail=str(getattr(exc, "status", "") or "server error"),
        )

    def _from_client_error(self, exc: ClientError, model_name: str) -> Exception:
        status = getattr(exc, "code", None)
        message = str(getattr(exc, "message", "") or exc)
        logger.error(
            "Gemini client error: model=%s status=%s: %s",
            model_name, status, self._redact(message[:300]),
        )

        # Google reports an invalid or missing API key as 400, not 401/403.
        if status in (401, 403) or (status == 400 and "api key" in message.lower()):
            return AIProviderError(
                code="AI_AUTH_FAILED",
                message=(
                    "Google rejected the Gemini API key. Check GEMINI_API_KEY in "
                    "backend/.env (it may be missing, invalid, expired or restricted), "
                    "then restart the backend."
                ),
                status_code=503,
            )
        if status == 429:
            return _AttemptFailure("rate_limited", "429", retry_same_model=False,
                                   retry_after_s=self._retry_after(exc), detail="RESOURCE_EXHAUSTED")
        if status == 404:
            return _AttemptFailure("not_found", "404", retry_same_model=False, detail="model not found")
        if status == 408:
            return _AttemptFailure("timeout", "408", retry_same_model=False, detail="request timeout")
        if status == 400:
            return _AttemptFailure("bad_request", "400", retry_same_model=False, detail="INVALID_ARGUMENT")
        return AIProviderError(
            code="AI_REQUEST_FAILED",
            message="The AI provider could not process this request.",
            status_code=502,
        )

    # ------------------------------------------------------------- parsing

    @staticmethod
    def _enum_name(value: Any) -> str:
        return str(getattr(value, "name", value) or "")

    def _parse_response(self, response: Any, response_model: Type[T]) -> T:
        parsed = getattr(response, "parsed", None)
        if isinstance(parsed, response_model):
            return parsed

        candidates = getattr(response, "candidates", None) or []
        finish = self._enum_name(candidates[0].finish_reason) if candidates else ""
        block = self._enum_name(getattr(getattr(response, "prompt_feedback", None), "block_reason", None))
        text = getattr(response, "text", None)
        has_text = bool(text and text.strip())

        if not has_text and (
            finish in _BLOCKED_FINISH_REASONS
            or block not in ("", "BLOCKED_REASON_UNSPECIFIED")
        ):
            logger.warning("Gemini blocked the request: finish_reason=%s block_reason=%s", finish, block)
            raise AIProviderError(
                code="AI_CONTENT_BLOCKED",
                message=(
                    "The AI declined to generate a blueprint for this description "
                    "(blocked by Google's content safety filters). "
                    "Try rewording your project description."
                ),
                status_code=422,
            )

        if finish == "MAX_TOKENS":
            raise _AttemptFailure(
                "bad_response", "truncated", retry_same_model=True,
                detail="output hit max_output_tokens and was cut off",
            )
        if not has_text:
            raise _AttemptFailure(
                "bad_response", "empty", retry_same_model=True,
                detail=f"empty response (finish_reason={finish or 'none'})",
            )
        try:
            return response_model.model_validate_json(text)
        except (pydantic.ValidationError, json.JSONDecodeError, ValueError) as exc:
            where = ""
            if isinstance(exc, pydantic.ValidationError):
                where = ", ".join(".".join(str(p) for p in e["loc"]) for e in exc.errors()[:3])
            raise _AttemptFailure(
                "bad_response", "invalid", retry_same_model=True,
                detail=f"response did not match the schema ({where})" if where else "response was not valid JSON",
            ) from exc

    # ------------------------------------------------- backoff & final error

    def _backoff_s(self, attempt: int, retry_after_s: Optional[float], kind: str) -> float:
        if kind == "bad_response":
            return 0.0  # not an overload signal; no need to wait
        delay_ms = min(self._backoff_base_ms * (2 ** (attempt - 1)), _MAX_BACKOFF_MS)
        delay_s = delay_ms / 1000.0
        if retry_after_s:
            delay_s = max(delay_s, min(retry_after_s, _MAX_RETRY_AFTER_S))
        return delay_s + random.uniform(0, delay_s * 0.1)

    @staticmethod
    def _summarise(failures: List[Tuple[str, _AttemptFailure]]) -> str:
        per_model: dict[str, List[str]] = {}
        for model, failure in failures:
            per_model.setdefault(model, []).append(failure.label)
        return "; ".join(f"{m}: {', '.join(labels)}" for m, labels in per_model.items())

    def _final_error(
        self, failures: List[Tuple[str, _AttemptFailure]], *, budget_exhausted: bool
    ) -> AIProviderError:
        kinds = {f.kind for _, f in failures}
        summary = self._summarise(failures)
        tried = f" (tried: {summary})" if summary else ""

        if kinds == {"rate_limited"}:
            return AIProviderError(
                "AI_RATE_LIMITED",
                "The Gemini API rate limit or quota was reached for every configured model"
                f"{tried}. Wait a minute and try again, or check your quota in Google AI Studio.",
                429,
            )
        if kinds == {"not_found"}:
            return AIProviderError(
                "AI_MODEL_NOT_FOUND",
                "None of the configured Gemini models were found"
                f"{tried}. Check GEMINI_MODEL and GEMINI_FALLBACK_MODELS in backend/.env "
                "against the current model list (run scripts/list_gemini_models.py).",
                503,
            )
        if kinds == {"bad_request"}:
            return AIProviderError(
                "AI_INVALID_REQUEST",
                f"Google rejected the request on every configured model{tried}. "
                "Check the backend logs for details.",
                502,
            )
        if kinds == {"bad_response"}:
            return AIProviderError(
                "AI_MALFORMED_RESPONSE",
                f"The AI returned an incomplete or invalid response several times{tried}. "
                "Please try again.",
                502,
            )
        if kinds == {"timeout"}:
            return AIProviderError(
                "AI_TIMEOUT",
                f"The AI took too long to generate this blueprint{tried}. This is usually "
                "temporary. Please try again, or shorten the project description.",
                504,
            )
        limit = " The time limit for this request was reached." if budget_exhausted else ""
        return AIProviderError(
            "AI_PROVIDER_UNAVAILABLE",
            "Google's Gemini service is temporarily overloaded or unavailable"
            f"{tried}.{limit} Your request was retried automatically but did not succeed. "
            "This is a capacity problem on Google's side; please try again in a minute.",
            503,
        )

    # --------------------------------------------------------------- hygiene

    def _redact(self, text: str) -> str:
        """Remove anything that looks like an API key before it reaches a log."""
        key = getattr(self._cfg, "gemini_api_key", None)
        if key:
            text = text.replace(key, "[REDACTED]")
        return _API_KEY_PATTERN.sub("[REDACTED]", text)
