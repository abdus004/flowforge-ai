"""
AI provider abstraction.

Routes and business logic depend only on the `AIProvider` interface, never
on a specific vendor SDK. Gemini is the first implementation
(`gemini_provider.GeminiProvider`); adding OpenAI/Anthropic later means
adding a new provider class and one branch in `get_ai_provider()`, without
touching routes or the frontend.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from functools import lru_cache
from typing import Type, TypeVar

from pydantic import BaseModel

from app.config import settings
from app.utils.errors import AppError

T = TypeVar("T", bound=BaseModel)


class AIProviderError(AppError):
    """Raised when the underlying AI provider fails in some way."""

    def __init__(self, code: str, message: str, status_code: int = 502):
        super().__init__(code=code, message=message, status_code=status_code)


class AIProvider(ABC):
    """Common interface every AI provider must implement."""

    @abstractmethod
    def generate_structured(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        response_model: Type[T],
        temperature: float = 0.4,
    ) -> T:
        """
        Generate content constrained to `response_model`'s JSON schema and
        return a validated instance of it. Implementations must never raise
        raw SDK exceptions — only `AIProviderError`.
        """
        raise NotImplementedError


@lru_cache(maxsize=1)
def get_ai_provider() -> AIProvider:
    """Factory returning the configured AI provider (singleton)."""
    provider = settings.ai_provider

    if provider == "gemini":
        from app.services.gemini_provider import GeminiProvider

        return GeminiProvider()

    raise AIProviderError(
        code="AI_NOT_CONFIGURED",
        message="No supported AI provider is configured on the server.",
        status_code=503,
    )
