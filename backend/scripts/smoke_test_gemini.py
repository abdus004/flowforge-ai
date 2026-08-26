"""
Smoke test for the Gemini integration.

Runs the *exact same* production code path (GeminiProvider.generate_structured)
used by /api/generate-blueprint, but with a tiny one-field schema instead of
the full Blueprint schema. This isolates four things in order:

  1. Is GEMINI_API_KEY valid?
  2. Does the configured GEMINI_MODEL respond?
  3. Does structured JSON output work at all?
  4. Does Pydantic validation of the result work?

If this fails, the problem is auth/model/connectivity, not the Blueprint
schema. If this succeeds but the full blueprint request still fails, the
problem is more likely schema size/complexity or output length.

Usage (from backend/, with your venv active and a real key in .env):

    python -m scripts.smoke_test_gemini
"""
from __future__ import annotations

import sys

from pydantic import BaseModel


class SmokeTestResult(BaseModel):
    status: str


def main() -> int:
    # Import here so a missing/invalid key fails inside the try block below
    # with our own error handling, instead of at module import time.
    from app.services.gemini_provider import GeminiProvider
    from app.services.ai_provider import AIProviderError
    from app.config import settings

    print(f"Model:   {settings.gemini_model}")
    print(f"Timeout: {settings.gemini_timeout_ms}ms per attempt (1 retry on 500/503/504)")
    print(f"API key: {'set (' + settings.gemini_api_key[:4] + '...)' if settings.gemini_api_key else 'NOT SET'}")
    print("-" * 50)

    try:
        provider = GeminiProvider()
    except AIProviderError as exc:
        print(f"FAILED before any request — {exc.code}: {exc.message}")
        return 1

    try:
        result = provider.generate_structured(
            system_prompt="You are a test endpoint. Respond only with the requested JSON.",
            user_prompt='Return JSON containing {"status": "ok"}',
            response_model=SmokeTestResult,
            temperature=0.0,
        )
    except AIProviderError as exc:
        print(f"FAILED — {exc.code}: {exc.message}")
        return 1

    print(f"SUCCESS — parsed result: {result.model_dump()}")
    if result.status.lower() != "ok":
        print(f"Note: model returned status={result.status!r} instead of 'ok' — "
              f"structured output still worked, content just varied.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
