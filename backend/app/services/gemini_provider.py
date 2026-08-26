"""
Gemini implementation of AIProvider.

Uses the `google-genai` SDK's native structured-output support: a Pydantic
model is passed directly as `response_schema`, Gemini is constrained to
that JSON shape, and the SDK parses the result back into the same model.

This is a plain structured-generation request: no tools, no function
calling, no agent loop. Automatic Function Calling (AFC) — an SDK feature
that is *enabled by default* even with zero tools configured — is
explicitly disabled so there is no ambiguity about what the request does.

Transient failures (500/503/504, or a dropped connection) are retried once
using the SDK's own retry mechanism (`HttpRetryOptions`), which handles
both HTTP-level 5xx responses and low-level transport timeouts uniformly.
"""
from __future__ import annotations

import json
import logging
from typing import Type, TypeVar

import httpx
import pydantic
from google import genai
from google.genai import types
from google.genai.errors import APIError, ClientError, ServerError

from app.config import settings
from app.services.ai_provider import AIProvider, AIProviderError

logger = logging.getLogger("flowforge.gemini")

T = TypeVar("T", bound=pydantic.BaseModel)

# Retry only genuinely transient server-side failures. 429 (rate limit) is
# deliberately excluded — retrying a quota error rarely helps within a
# single request and the caller should be told immediately.
_RETRYABLE_HTTP_STATUS_CODES = [500, 503, 504]


class GeminiProvider(AIProvider):
    def __init__(self) -> None:
        if not settings.gemini_api_key:
            raise AIProviderError(
                code="AI_NOT_CONFIGURED",
                message="The AI provider is not configured on the server.",
                status_code=503,
            )
        self._client = genai.Client(api_key=settings.gemini_api_key)
        self._model = settings.gemini_model
        self._timeout_ms = settings.gemini_timeout_ms

    def generate_structured(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        response_model: Type[T],
        temperature: float = 0.4,
    ) -> T:
        config = types.GenerateContentConfig(
            system_instruction=system_prompt,
            response_mime_type="application/json",
            response_schema=response_model,
            temperature=temperature,
            max_output_tokens=16384,
            # One initial attempt + one retry, only for the status codes
            # above. Backoff is short since we only allow a single retry.
            http_options=types.HttpOptions(
                timeout=self._timeout_ms,
                retry_options=types.HttpRetryOptions(
                    attempts=2,
                    initial_delay=1.0,
                    max_delay=3.0,
                    http_status_codes=_RETRYABLE_HTTP_STATUS_CODES,
                ),
            ),
            # Explicitly off — this is a single-shot structured-output
            # request, never a multi-turn tool-calling loop.
            automatic_function_calling=types.AutomaticFunctionCallingConfig(
                disable=True
            ),
        )

        try:
            response = self._client.models.generate_content(
                model=self._model,
                contents=user_prompt,
                config=config,
            )
        except ClientError as exc:
            status = getattr(exc, "code", None)
            logger.error("Gemini client error (status=%s): %s", status, exc)
            if status == 400:
                raise AIProviderError(
                    code="AI_INVALID_REQUEST",
                    message="The AI request was invalid. Please check your input and try again.",
                    status_code=502,
                ) from exc
            if status in (401, 403):
                raise AIProviderError(
                    code="AI_AUTH_FAILED",
                    message="The AI provider rejected the server's credentials.",
                    status_code=503,
                ) from exc
            if status == 429:
                raise AIProviderError(
                    code="AI_RATE_LIMITED",
                    message="The AI provider is rate limited right now. Please try again shortly.",
                    status_code=429,
                ) from exc
            raise AIProviderError(
                code="AI_REQUEST_FAILED",
                message="The AI provider could not process this request.",
                status_code=502,
            ) from exc
        except ServerError as exc:
            # Reaching here means the SDK's built-in retry already tried
            # this request twice and it still failed.
            status = getattr(exc, "code", None)
            logger.error("Gemini server error (status=%s) after retry: %s", status, exc)
            raise AIProviderError(
                code="AI_PROVIDER_UNAVAILABLE",
                message="The AI provider is temporarily unavailable. Please try again.",
                status_code=502,
            ) from exc
        except APIError as exc:
            logger.error("Gemini API error: %s", exc)
            raise AIProviderError(
                code="AI_GENERATION_FAILED",
                message="Unable to generate the blueprint right now. Please try again.",
                status_code=502,
            ) from exc
        except httpx.TimeoutException as exc:
            # The SDK already retried transient transport timeouts once;
            # this means both attempts timed out.
            logger.error("Gemini request timed out after retry: %s", exc)
            raise AIProviderError(
                code="AI_TIMEOUT",
                message="The AI provider took too long to respond. Please try again.",
                status_code=504,
            ) from exc
        except httpx.ConnectError as exc:
            logger.error("Could not connect to Gemini after retry: %s", exc)
            raise AIProviderError(
                code="AI_PROVIDER_UNAVAILABLE",
                message="Could not reach the AI provider. Please try again.",
                status_code=502,
            ) from exc
        except Exception as exc:  # noqa: BLE001 - never leak internals to the client
            logger.exception("Unexpected error calling Gemini")
            raise AIProviderError(
                code="AI_GENERATION_FAILED",
                message="Unable to generate the blueprint right now. Please try again.",
                status_code=502,
            ) from exc

        return self._parse_response(response, response_model)

    @staticmethod
    def _parse_response(response, response_model: Type[T]) -> T:
        parsed = getattr(response, "parsed", None)
        if isinstance(parsed, response_model):
            return parsed

        text = getattr(response, "text", None)
        if not text or not text.strip():
            logger.error("Gemini returned an empty response")
            raise AIProviderError(
                code="AI_EMPTY_RESPONSE",
                message="The AI provider returned an empty response. Please try again.",
                status_code=502,
            )

        try:
            return response_model.model_validate_json(text)
        except (pydantic.ValidationError, json.JSONDecodeError) as exc:
            logger.error("Malformed AI JSON response: %s", exc)
            raise AIProviderError(
                code="AI_MALFORMED_RESPONSE",
                message="The AI returned a response that could not be understood. Please try again.",
                status_code=502,
            ) from exc
