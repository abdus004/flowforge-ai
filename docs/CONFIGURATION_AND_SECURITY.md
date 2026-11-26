# FlowForge AI — Configuration & Security Guide

This document explains environment variable configuration, security best practices, and credential management for FlowForge AI.

---

## 1. Secrets & Environment Files

### Golden Rule: Never Commit Secrets
- Real API credentials must **never** be hardcoded in application source code.
- Frontend code (`frontend/src/`) must **never** reference private API keys.
- Real `.env` files are ignored by `.gitignore` in both the root, `frontend/`, and `backend/`.
- Safe template files (`.env.example`) are checked into source control with placeholder values.

---

## 2. Gemini API Key Revocation & Generation

> [!WARNING]
> A previous commit in the legacy repository contained an exposed API key.
> That credential has been permanently excluded from this project.
> Do **not** attempt to reuse the previous key. Treat it as compromised.

### How to Revoke and Generate a Fresh API Key:
1. Navigate to Google AI Studio: [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. In the API Keys dashboard, locate any older or exposed keys and click **Delete / Revoke**.
3. Click **Create API Key**.
4. Choose or create a Google Cloud project to associate with the key.
5. Copy the newly generated key.
6. Open `backend/.env` (created from `backend/.env.example`) and insert your new key:
   ```env
   GEMINI_API_KEY=AIzaSy...YourNewKeyHere...
   ```

---

## 3. Backend Environment Configuration (`backend/.env`)

| Variable | Default Value | Description |
| --- | --- | --- |
| `GEMINI_API_KEY` | *(None)* | Your Google Gemini API key. Required for live generation. |
| `GEMINI_MODEL` | `gemini-3.6-flash` | Primary model. Use a pinned stable name, not a rolling `-latest` alias. |
| `GEMINI_FALLBACK_MODELS` | `gemini-3.8-flash,gemini-3.5-flash-lite` | Comma-separated models tried in order if the primary is overloaded. Empty disables fallbacks. Verify names with `python -m scripts.list_gemini_models`. |
| `GEMINI_TIMEOUT_MS` | `75000` | Timeout for ONE attempt (ms). Google enforces this as a server-side deadline, so a value that is too small causes `504 DEADLINE_EXCEEDED` on large blueprints. |
| `GEMINI_TOTAL_TIMEOUT_MS` | `150000` | Overall budget for one user request across all retries and fallbacks. Keep it below the frontend's 180 s timeout. |
| `GEMINI_MAX_RETRIES` | `2` | Maximum attempts per model, including the first. |
| `GEMINI_BACKOFF_BASE_MS` | `500` | Wait before the first retry (doubles each time, capped at 5 s). |
| `GEMINI_THINKING_LEVEL` | `low` | `low`, `medium`, `high` or `default`. Lower is faster and leaves more of the output limit for the blueprint. |
| `GEMINI_MAX_OUTPUT_TOKENS` | `32768` | Response size limit; thinking tokens count toward it. |
| `ALLOWED_ORIGINS` | `http://localhost:8080,http://127.0.0.1:8080,http://localhost:5173,http://127.0.0.1:5173` | Comma-separated allowed CORS origins. `localhost` and `127.0.0.1` count as different origins, so list the exact address you open the app at. |
| `AI_PROVIDER` | `gemini` | AI provider implementation (`gemini`). |
| `ENVIRONMENT` | `development` | Runtime environment (`development` or `production`). |

---

## 4. Frontend Environment Configuration (`frontend/.env`)

| Variable | Default Value | Description |
| --- | --- | --- |
| `VITE_API_URL` | `http://localhost:8000` | URL of the running FastAPI backend. |

---

## 5. Distinction: Working Directory vs Git History vs Revocation

When cleaning credentials, there are three distinct levels of security:
1. **Working Directory Cleanup (Completed in this project)**:
   - All `.env` files with real keys removed.
   - `.env.example` contains only placeholder values.
   - `.gitignore` configured to prevent committing `.env`.
2. **Git History Cleanup (Requires explicit developer action on Git repos)**:
   - If a Git repository has commits containing keys, git history rewriting tools (e.g. `git filter-repo` or BFG Repo-Cleaner) must be executed before pushing to public remotes.
   - Note: Cleaning files in the working directory does not rewrite historical commits.
3. **Credential Revocation (Must be done in Google AI Studio)**:
   - Once a secret is exposed to the internet, revocation at the provider dashboard is the only guarantee of safety.
