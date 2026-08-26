# FlowForge AI

Describe a software product idea and FlowForge AI generates a complete,
project-specific development blueprint: workflow, architecture, database
design, AI stack, roadmap, tools, project structure, development flow,
effort estimation, risks, and next steps.

## Architecture

```
React / TanStack Start (frontend)
        |
        | POST /api/generate-blueprint
        | POST /api/recommend-workflow
        v
FastAPI backend
        |
        v
AIProvider abstraction
        |
        v
GeminiProvider  ->  Gemini API (structured JSON output)
```

- The frontend never talks to Gemini directly and never sees the API key.
- The backend validates every request with Pydantic before calling the AI.
- The AI is constrained to a strict JSON schema (via `response_schema`),
  so the backend always gets back a shape the frontend can render.
- Gemini is the first `AIProvider` implementation. Adding OpenAI or
  Anthropic later means adding a new provider class in
  `backend/app/services/` and one branch in `get_ai_provider()` — no
  route or frontend changes required.

## Local setup

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `backend/.env` and set `GEMINI_API_KEY` to a **new** key from
https://aistudio.google.com/apikey.

> The key that used to ship in this repo was committed to source control
> and must be treated as compromised — it has been removed. Generate a
> fresh key; don't reuse the old one.

Run the backend:

```bash
uvicorn app.main:app --reload --port 8000
```

Visit `http://localhost:8000/api/health` to confirm it's running, and
`http://localhost:8000/docs` for interactive API docs.

### Frontend

```bash
npm install
cp .env.example .env   # VITE_API_URL=http://localhost:8000 by default
npm run dev
```

Visit `http://localhost:5173`.

## Environment variables

**`backend/.env`**

| Variable | Description | Default |
|---|---|---|
| `GEMINI_API_KEY` | Your Gemini API key. Required. | — |
| `GEMINI_MODEL` | Gemini model to use. | `gemini-flash-latest` |
| `GEMINI_TIMEOUT_MS` | Timeout for Gemini requests, in ms. | `45000` |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins. | `http://localhost:5173` |
| `AI_PROVIDER` | Which `AIProvider` to use. | `gemini` |

**`.env`** (frontend root)

| Variable | Description | Default |
|---|---|---|
| `VITE_API_URL` | Base URL of the FastAPI backend. | `http://localhost:8000` |

Neither `.env` file is committed — see `.gitignore`.

## API endpoints

### `GET /api/health`
Returns `{ "status": "ok", "service": "flowforge-api" }`.

### `POST /api/generate-blueprint`
Generates a full blueprint for one of the three real workflows.

```json
{
  "name": "Nimbus Notes",
  "description": "AI platform that converts product ideas into technical blueprints",
  "teamSize": "3",
  "experience": "intermediate",
  "timelineValue": "4",
  "timelineUnit": "weeks",
  "workflow": "ai-assisted"
}
```

Returns a `Blueprint` object (see `backend/app/schemas/blueprint.py` for
the full shape, mirrored in `src/lib/api.ts` on the frontend).

### `POST /api/recommend-workflow`
Same input shape (workflow optional/ignored). Returns:

```json
{ "recommendedWorkflow": "ai-assisted", "confidence": 87, "reasons": ["..."] }
```

### Errors
Every error response has the shape:

```json
{ "error": { "code": "AI_GENERATION_FAILED", "message": "Unable to generate the blueprint right now. Please try again." } }
```

No stack traces, provider payloads, or environment details are ever
returned to the client — everything internal is logged server-side only.

## AI flow

1. User fills out the generator form (or picks a workflow on the compare
   page) → frontend validates client-side, then POSTs to the backend.
2. FastAPI validates with Pydantic (`ProjectBase` / `BlueprintRequest` /
   `RecommendRequest`) — rejecting bad input before any AI call is made.
3. `BlueprintService` builds a system + user prompt
   (`backend/app/services/prompts.py`) tailored to the chosen workflow and
   project facts, and calls the configured `AIProvider`.
4. `GeminiProvider` calls Gemini with `response_mime_type=application/json`
   and `response_schema=<Pydantic model>`, so Gemini's output is
   constrained to the exact JSON shape the frontend expects.
5. The parsed, validated model is returned to the frontend, stored in
   `sessionStorage` (project input + generated blueprint only — never
   secrets), and rendered on `/result`.

## Development workflows

- **Traditional** — manual engineering, conventional architecture,
  explicit testing and control.
- **AI Assisted** — AI accelerates development; humans own architecture
  and review.
- **Full AI** — AI drives planning, implementation, testing, and docs,
  with human validation checkpoints.
- **Compare & Recommend** — sends the project to
  `/api/recommend-workflow`; the AI picks among the three real workflows
  above with a confidence score and reasons. Selecting one then calls
  `/api/generate-blueprint`.

## Export & Share

- **Export** (on the result page) downloads the generated blueprint as
  either JSON or Markdown — both built from the real AI response, never
  fabricated.
- **Share** copies a Markdown summary of the blueprint to the clipboard.
  There's no backend persistence yet, so this isn't a hosted shareable
  link — that would require adding storage, which is intentionally out
  of scope for this first version (see "Limitations" below).

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| "Could not reach the FlowForge backend" toast | Backend isn't running, or `VITE_API_URL` is wrong. |
| `503 AI_NOT_CONFIGURED` / `AI_AUTH_FAILED` | `GEMINI_API_KEY` missing or invalid in `backend/.env`. |
| `429 AI_RATE_LIMITED` | Gemini rate limit hit — retry shortly. |
| CORS error in browser console | Frontend origin isn't in `ALLOWED_ORIGINS`. |
| Stuck on "Forging blueprint..." | Shouldn't happen — all AI failure paths resolve to a toast and re-enable the button. If it does, check the backend logs. |

## Limitations

- No database/persistence — blueprints live only in the browser's
  `sessionStorage` for the current session.
- No authentication.
- Share is clipboard-based, not a real hosted link.
- Single AI provider configured (Gemini), though the codebase is set up
  to add more.
