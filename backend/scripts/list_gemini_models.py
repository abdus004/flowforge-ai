"""
List the Gemini models your API key can call with generateContent, and check
the models configured in backend/.env against that list.

This is the way to VERIFY model names instead of guessing them: the answer
comes from Google for YOUR key, not from documentation or memory.

Usage (from backend/, venv active, real key in .env):

    python -m scripts.list_gemini_models

Exit code 0 = the primary model is available; 1 = it is not (or the request failed).
The API key itself is never printed.
"""
from __future__ import annotations

import sys
from typing import Any, Iterable


def available_models(client: Any) -> dict[str, list[str]]:
    """Return {model_id: [supported actions]} for every model the key can see."""
    found: dict[str, list[str]] = {}
    for model in client.models.list():
        name = (getattr(model, "name", "") or "").removeprefix("models/")
        if name:
            found[name] = list(getattr(model, "supported_actions", None) or [])
    return found


def check_chain(found: dict[str, list[str]], chain: Iterable[str]) -> list[tuple[str, str]]:
    """Return [(model, status)] where status is OK, NO generateContent, or NOT FOUND."""
    rows = []
    for name in chain:
        if name not in found:
            rows.append((name, "NOT FOUND"))
        elif "generateContent" not in found[name]:
            rows.append((name, "NO generateContent"))
        else:
            rows.append((name, "OK"))
    return rows


def main() -> int:
    from google import genai

    from app.config import settings
    from app.services.gemini_provider import GeminiProvider

    if not settings.gemini_api_key:
        print("GEMINI_API_KEY is not set (or is still the placeholder). Edit backend/.env first.")
        return 1

    print("Asking Google which models this API key can use ...\n")
    try:
        found = available_models(genai.Client(api_key=settings.gemini_api_key))
    except Exception as exc:  # noqa: BLE001 - give a friendly message, never a traceback
        print(f"Could not list models: {type(exc).__name__}. Check your internet connection and GEMINI_API_KEY.")
        return 1

    usable = sorted(n for n, actions in found.items() if "generateContent" in actions and n.startswith("gemini"))
    print(f"Gemini models that support generateContent ({len(usable)}):")
    for name in usable:
        print(f"  {name}")

    chain = GeminiProvider._build_chain(settings.gemini_model, settings.gemini_fallback_models)
    print("\nYour configured model chain (primary first):")
    rows = check_chain(found, chain)
    for name, status in rows:
        print(f"  [{status:^18}] {name}")

    primary_ok = rows[0][1] == "OK"
    if not primary_ok:
        print("\nYour PRIMARY model is not available. Set GEMINI_MODEL in backend/.env to one of the names listed above.")
    if any(status != "OK" for _, status in rows[1:]):
        print("Some fallback models are not available. Fix GEMINI_FALLBACK_MODELS in backend/.env (or leave it empty).")
    print("\nNote: 'available' means the model exists for your key. It does not guarantee it is not overloaded right now.")
    return 0 if primary_ok else 1


if __name__ == "__main__":
    sys.exit(main())
