"""
Central application configuration.

All configuration is loaded from environment variables (see .env.example).
Nothing sensitive is ever hardcoded here, and this module never exposes
secrets outside the backend process.
"""
import logging
import os

from dotenv import load_dotenv

load_dotenv()

_log = logging.getLogger("flowforge.config")


def _split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def _int_env(name: str, default: int, *, minimum: int = 0) -> int:
    """
    Read an integer environment variable.

    A bad value (for example "60s") must not crash the server at import time
    with an obscure traceback, so we log a clear warning and use the default.
    """
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    try:
        value = int(raw.strip())
    except ValueError:
        _log.warning("Ignoring %s=%r (not a whole number); using default %d", name, raw, default)
        return default
    if value < minimum:
        _log.warning("%s=%d is below the minimum %d; using %d", name, value, minimum, minimum)
        return minimum
    return value


def _api_key_env() -> str | None:
    """
    Read GEMINI_API_KEY. A blank value or the unedited placeholder from
    .env.example counts as "not set", so the user gets a clear
    "not configured" message instead of a confusing rejection from Google.
    """
    key = (os.getenv("GEMINI_API_KEY") or "").strip()
    if not key or key.lower().startswith("your_") or "api_key_here" in key.lower():
        return None
    return key


_THINKING_LEVELS = {"low", "medium", "high", "default"}


def _thinking_level_env(default: str = "low") -> str:
    raw = (os.getenv("GEMINI_THINKING_LEVEL") or default).strip().lower() or default
    if raw not in _THINKING_LEVELS:
        # "minimal" is deliberately not accepted: Google documents that
        # gemini-3.8-flash rejects it with an error.
        _log.warning(
            "Ignoring GEMINI_THINKING_LEVEL=%r (use low, medium, high or default); using %r",
            raw,
            default,
        )
        return default
    return raw


class Settings:
    # AI provider
    ai_provider: str = os.getenv("AI_PROVIDER", "gemini").lower()

    # --- Gemini -----------------------------------------------------------
    gemini_api_key: str | None = _api_key_env()

    # Primary model. Pinned to a named stable model rather than a rolling
    # alias such as "gemini-flash-latest" (aliases can silently point at a
    # preview/experimental build, a common cause of intermittent errors).
    # Verified against Google's model pages (Nov 2026): stable, supports
    # structured output.
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-3.6-flash").strip()

    # Models tried, in order, if the primary is overloaded or unavailable.
    # Both are listed as Stable with structured-output support in Google's
    # docs. "gemini-3.5-flash" is intentionally NOT used: on the Gemini
    # Developer API it is routed to gemini-3.6-flash, so it would hit the
    # same overloaded backend. Set GEMINI_FALLBACK_MODELS= (empty) to disable.
    gemini_fallback_models: list[str] = _split_csv(
        os.getenv("GEMINI_FALLBACK_MODELS", "gemini-3.8-flash,gemini-3.5-flash-lite")
    )

    # Per-attempt timeout. IMPORTANT: the SDK forwards this to Google as a
    # server-side deadline (X-Server-Timeout), so a value that is too small
    # makes Google itself answer 504 DEADLINE_EXCEEDED on large blueprints.
    gemini_timeout_ms: int = _int_env("GEMINI_TIMEOUT_MS", 75_000, minimum=5_000)

    # Overall budget for ONE user request across all retries and fallbacks.
    # Must stay below the frontend's fetch timeout (180 s in src/lib/api.ts)
    # so the browser always receives our clear error instead of timing out.
    gemini_total_timeout_ms: int = _int_env("GEMINI_TOTAL_TIMEOUT_MS", 150_000, minimum=10_000)

    # Maximum attempts PER MODEL (including the first), for transient 5xx and
    # network errors. 2 means "try, then retry once". The name is kept for
    # compatibility with existing .env files.
    gemini_max_retries: int = _int_env("GEMINI_MAX_RETRIES", 2, minimum=1)

    # Backoff base in milliseconds (doubles each retry, capped at 5 s).
    gemini_backoff_base_ms: int = _int_env("GEMINI_BACKOFF_BASE_MS", 500)

    # Output cap. Thinking tokens count toward this limit, so it must be
    # generous (Google documents truncated/empty output when it is hit).
    # The three default models all allow 65,536.
    gemini_max_output_tokens: int = _int_env("GEMINI_MAX_OUTPUT_TOKENS", 32_768, minimum=1_024)

    # "low" keeps structured generation fast and lowers the chance of 504s.
    # Use "default" to leave the model's own default (medium) untouched.
    gemini_thinking_level: str = _thinking_level_env("low")

    # CORS. Defaults cover the Vite dev server (port 8080, see vite.config.ts)
    # and the common 5173 port, on both localhost and 127.0.0.1.
    allowed_origins: list[str] = _split_csv(
        os.getenv(
            "ALLOWED_ORIGINS",
            "http://localhost:8080,http://127.0.0.1:8080,"
            "http://localhost:5173,http://127.0.0.1:5173",
        )
    )

    # Misc
    environment: str = os.getenv("ENVIRONMENT", "development")


settings = Settings()
