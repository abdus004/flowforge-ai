"""
Smoke test for the Gemini integration - the ONLY test in this project that
talks to the real Gemini service (it needs a valid key and internet access).

It runs the exact production code path (GeminiProvider.generate_structured,
including retries and model fallback) with a tiny one-field schema. With
--full it instead generates a complete blueprint through the same service the
API uses, which also proves the full response schema is accepted by Gemini.

Usage (from backend/, venv active, real key in .env):

    python -m scripts.smoke_test_gemini           # quick check
    python -m scripts.smoke_test_gemini --full    # real, complete blueprint

Interpreting a failure: AI_AUTH_FAILED = key problem, AI_MODEL_NOT_FOUND =
wrong model name (run scripts/list_gemini_models.py), AI_PROVIDER_UNAVAILABLE
or AI_TIMEOUT = Google-side overload (retrying later is the only fix).
The API key is never printed.
"""
from __future__ import annotations

import sys
import time

from pydantic import BaseModel


class SmokeTestResult(BaseModel):
    status: str


def main(argv: list[str]) -> int:
    # Imported here so configuration problems surface with our own messages.
    from app.config import settings
    from app.services.ai_provider import AIProviderError
    from app.services.gemini_provider import GeminiProvider

    full = "--full" in argv
    chain = GeminiProvider._build_chain(settings.gemini_model, settings.gemini_fallback_models)
    print(f"Model chain:  {' -> '.join(chain)}")
    print(f"Per attempt:  {settings.gemini_timeout_ms / 1000:.0f}s | attempts per model: {settings.gemini_max_retries} "
          f"| overall budget: {settings.gemini_total_timeout_ms / 1000:.0f}s")
    print(f"API key:      {'set' if settings.gemini_api_key else 'NOT SET (edit backend/.env)'}")
    print("-" * 60)

    try:
        provider = GeminiProvider()
    except AIProviderError as exc:
        print(f"FAILED before any request - {exc.code}: {exc.message}")
        return 1

    started = time.monotonic()
    try:
        if full:
            from app.schemas.blueprint import BlueprintRequest
            from app.services.blueprint_service import BlueprintService

            request = BlueprintRequest(
                name="Smoke Test Project",
                description="A small web app that lets teams track tasks, deadlines and weekly progress reports.",
                teamSize="3", experience="intermediate", timelineValue="8", timelineUnit="weeks", workflow="ai-assisted",
            )
            blueprint = BlueprintService(provider).generate_blueprint(request)
            print(f"SUCCESS - full blueprint generated in {time.monotonic() - started:.1f}s")
            print(f"  project:    {blueprint.project.name}")
            print(f"  components: {len(blueprint.architecture.components)} | entities: {len(blueprint.database.entities)} "
                  f"| roadmap phases: {len(blueprint.roadmap)} | risks: {len(blueprint.risks)}")
        else:
            result = provider.generate_structured(
                system_prompt="You are a test endpoint. Respond only with the requested JSON.",
                user_prompt='Return JSON containing {"status": "ok"}',
                response_model=SmokeTestResult,
                temperature=0.0,
            )
            print(f"SUCCESS in {time.monotonic() - started:.1f}s - parsed result: {result.model_dump()}")
    except AIProviderError as exc:
        print(f"FAILED after {time.monotonic() - started:.1f}s - {exc.code} (HTTP {exc.status_code}):\n  {exc.message}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
