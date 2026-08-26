"""
Central application configuration.

All configuration is loaded from environment variables (see .env.example).
Nothing sensitive is ever hardcoded here, and this module never exposes
secrets outside the backend process.
"""
import os
from dotenv import load_dotenv

load_dotenv()


def _split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


class Settings:
    # AI provider
    ai_provider: str = os.getenv("AI_PROVIDER", "gemini").lower()

    # Gemini
    #
    # "gemini-flash-latest" is a *rolling* alias: per Google's docs it "will
    # get hot-swapped with every new release" and can point at a stable,
    # preview, OR experimental build. Experimental builds "typically not be
    # suitable for production use" and are the most likely source of
    # intermittent 500 INTERNAL / 504 DEADLINE_EXCEEDED errors. We pin to a
    # named stable model instead; override via GEMINI_MODEL if needed.
    gemini_api_key: str | None = os.getenv("GEMINI_API_KEY") or None
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    # Per-attempt timeout. Kept moderate on purpose: the frontend's fetch call
    # (src/lib/api.ts) aborts after 60s, and one retry is allowed below, so
    # timeout*2 + backoff must stay comfortably under that or a successful
    # retry would arrive after the browser already gave up.
    gemini_timeout_ms: int = int(os.getenv("GEMINI_TIMEOUT_MS", "25000"))

    # CORS
    allowed_origins: list[str] = _split_csv(
        os.getenv("ALLOWED_ORIGINS", "http://localhost:5173")
    )

    # Misc
    environment: str = os.getenv("ENVIRONMENT", "development")


settings = Settings()
