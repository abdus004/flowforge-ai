"""Environment parsing: bad values must never crash the server at import time."""
from __future__ import annotations

import importlib

import pytest

import app.config as config_module


def reload_settings(monkeypatch: pytest.MonkeyPatch, **env: str):
    for key in [k for k in ("GEMINI_MODEL", "GEMINI_FALLBACK_MODELS", "GEMINI_TIMEOUT_MS", "GEMINI_TOTAL_TIMEOUT_MS",
                            "GEMINI_MAX_RETRIES", "GEMINI_BACKOFF_BASE_MS", "GEMINI_MAX_OUTPUT_TOKENS",
                            "GEMINI_THINKING_LEVEL", "ALLOWED_ORIGINS", "GEMINI_API_KEY")]:
        monkeypatch.delenv(key, raising=False)
    # Prevent a developer's real backend/.env from leaking into these tests.
    monkeypatch.setattr("dotenv.load_dotenv", lambda *a, **k: False)
    for key, value in env.items():
        monkeypatch.setenv(key, value)
    importlib.reload(config_module)
    return config_module.settings


@pytest.fixture(autouse=True)
def restore_config():
    yield
    importlib.reload(config_module)


def test_defaults(monkeypatch):
    s = reload_settings(monkeypatch)
    assert s.gemini_model == "gemini-3.6-flash"
    assert s.gemini_fallback_models == ["gemini-3.8-flash", "gemini-3.5-flash-lite"]
    assert s.gemini_timeout_ms == 75_000
    assert s.gemini_total_timeout_ms == 150_000
    assert s.gemini_max_retries == 2
    assert s.gemini_max_output_tokens == 32_768
    assert s.gemini_thinking_level == "low"
    assert s.gemini_api_key is None


def test_default_cors_origins_cover_the_vite_dev_server(monkeypatch):
    s = reload_settings(monkeypatch)
    assert "http://localhost:8080" in s.allowed_origins  # vite.config.ts uses port 8080
    assert "http://127.0.0.1:8080" in s.allowed_origins


def test_values_with_units_do_not_crash_import(monkeypatch):
    s = reload_settings(monkeypatch, GEMINI_TIMEOUT_MS="60s", GEMINI_MAX_RETRIES="two")
    assert s.gemini_timeout_ms == 75_000 and s.gemini_max_retries == 2


def test_values_below_minimum_are_raised(monkeypatch):
    s = reload_settings(monkeypatch, GEMINI_TIMEOUT_MS="10", GEMINI_MAX_RETRIES="0")
    assert s.gemini_timeout_ms == 5_000 and s.gemini_max_retries == 1


def test_fallbacks_can_be_disabled_or_customised(monkeypatch):
    assert reload_settings(monkeypatch, GEMINI_FALLBACK_MODELS="").gemini_fallback_models == []
    assert reload_settings(monkeypatch, GEMINI_FALLBACK_MODELS=" a , b ").gemini_fallback_models == ["a", "b"]


@pytest.mark.parametrize("value, expected", [("HIGH", "high"), ("default", "default"), ("minimal", "low"), ("bogus", "low")])
def test_thinking_level_is_validated(monkeypatch, value, expected):
    assert reload_settings(monkeypatch, GEMINI_THINKING_LEVEL=value).gemini_thinking_level == expected


@pytest.mark.parametrize("value", ["", "   ", "your_gemini_api_key_here", "YOUR_KEY", "paste_api_key_here"])
def test_blank_or_placeholder_api_key_counts_as_not_set(monkeypatch, value):
    assert reload_settings(monkeypatch, GEMINI_API_KEY=value).gemini_api_key is None


def test_real_looking_api_key_is_kept_and_trimmed(monkeypatch):
    assert reload_settings(monkeypatch, GEMINI_API_KEY="  fake-test-key-12345  ").gemini_api_key == "fake-test-key-12345"
