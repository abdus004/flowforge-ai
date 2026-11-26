"""The model-verification script, run against the real SDK + local fake server."""
from __future__ import annotations

from google import genai
from google.genai import types

from scripts.list_gemini_models import available_models, check_chain
from tests.fake_gemini_server import FakeGeminiServer

CATALOGUE = [
    {"name": "models/gemini-3.6-flash", "supportedGenerationMethods": ["generateContent", "countTokens"]},
    {"name": "models/gemini-3.8-flash", "supportedGenerationMethods": ["generateContent"]},
    {"name": "models/gemini-embedding-001", "supportedGenerationMethods": ["embedContent"]},
    {"name": "models/legacy-model", "supportedGenerationMethods": ["countTokens"]},
]


def test_lists_models_and_their_actions():
    with FakeGeminiServer(catalogue=CATALOGUE) as server:
        client = genai.Client(api_key="test-key-not-real", http_options=types.HttpOptions(base_url=server.base_url))
        found = available_models(client)
    assert found["gemini-3.6-flash"] == ["generateContent", "countTokens"]
    assert found["gemini-embedding-001"] == ["embedContent"]


def test_chain_check_distinguishes_ok_missing_and_unsupported():
    found = {"gemini-3.6-flash": ["generateContent"], "gemini-embedding-001": ["embedContent"]}
    rows = check_chain(found, ["gemini-3.6-flash", "gemini-embedding-001", "gemini-3.7-flash"])
    assert rows == [("gemini-3.6-flash", "OK"), ("gemini-embedding-001", "NO generateContent"), ("gemini-3.7-flash", "NOT FOUND")]
