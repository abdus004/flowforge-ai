# FlowForge AI — API Reference

Base URL (Local Development): `http://localhost:8000`  
Interactive Documentation: `http://localhost:8000/docs` (Swagger UI) / `http://localhost:8000/redoc` (ReDoc)

---

## 1. System Endpoints

### `GET /`
Returns a simple JSON heartbeat message.

**Response (200 OK):**
```json
{
  "message": "FlowForge Backend Running"
}
```

---

### `GET /api/health`
Health check endpoint for monitoring and uptime probes.

**Response (200 OK):**
```json
{
  "status": "ok",
  "service": "flowforge-api"
}
```

---

## 2. Blueprint Endpoints

### `POST /api/generate-blueprint`
Generates a complete, multi-section software engineering blueprint based on project specifications.

**Headers:**
- `Content-Type: application/json`

**Request Body:**
| Field | Type | Required | Description | Constraints |
| --- | --- | --- | --- | --- |
| `name` | string | Optional | Name of the proposed project | Max 200 chars |
| `description` | string | **Required** | Detailed description of the software idea | 10 – 4000 chars |
| `teamSize` | string | **Required** | Number of engineers / team members | Must be a positive integer |
| `experience` | string | **Required** | Experience level | `"beginner"`, `"intermediate"`, or `"advanced"` |
| `timelineValue` | string | **Required** | Target timeline duration | Must be a positive integer |
| `timelineUnit` | string | Optional | Unit of timeline duration | `"days"`, `"weeks"`, or `"months"` (default: `"weeks"`) |
| `workflow` | string | **Required** | Development workflow approach | `"traditional"`, `"ai-assisted"`, or `"full-ai"` |

**Sample Request Body:**
```json
{
  "name": "CloudInventory",
  "description": "A real-time inventory tracking system for multi-warehouse retail businesses with barcoding support.",
  "teamSize": "4",
  "experience": "intermediate",
  "timelineValue": "10",
  "timelineUnit": "weeks",
  "workflow": "ai-assisted"
}
```

**Response (200 OK):**
Returns the structured `Blueprint` object containing:
- `project`: Project name, summary, goals, assumptions.
- `workflow`: Workflow name, recommendation reason, steps.
- `architecture`: High-level overview, components (name, technology, purpose), data flow steps.
- `database`: Database engine type, entities (name, fields, description, relationships), indexes, notes.
- `aiStack`: LLM choice, embedding model choice, vector database, RAG architecture, AI features.
- `roadmap`: Array of phases (phase name, duration, objectives, deliverables).
- `tools`: Recommended tools (category, name, purpose).
- `projectStructure`: Directory tree items (path, purpose).
- `developmentFlow`: Step-by-step engineering process flow.
- `effort`: Effort estimates by domain (area, estimated days, technical rationale).
- `risks`: Risk items (risk description, impact level, mitigation strategy).
- `nextSteps`: Array of actionable next steps.

---

### `POST /api/recommend-workflow`
Evaluates project constraints and recommends the optimal development workflow methodology (`traditional`, `ai-assisted`, or `full-ai`).

**Request Body:**
Same as `generate-blueprint`, but `workflow` is optional.

**Response (200 OK):**
```json
{
  "recommendedWorkflow": "ai-assisted",
  "confidence": 92,
  "reasons": [
    "Team experience level matches modern AI assisted tooling.",
    "Target timeline of 10 weeks benefits from AI code generation and testing acceleration."
  ]
}
```

---

## 3. Error Responses

All API errors return a standard JSON structure:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error description."
  }
}
```

`confidence` is a whole number from 0 to 100.

| HTTP Status | Error Code | Meaning / what to do |
| --- | --- | --- |
| `422` | `VALIDATION_ERROR` | Request payload failed validation (e.g. description too short). Fix the input. |
| `422` | `AI_CONTENT_BLOCKED` | Google's safety filters declined the request. Reword the project description. |
| `429` | `AI_RATE_LIMITED` | Rate limit or quota reached on every configured model. Wait a minute, or check quota in Google AI Studio. |
| `502` | `AI_INVALID_REQUEST` | Google rejected the request on every model (see backend logs). |
| `502` | `AI_REQUEST_FAILED` | Google could not process the request (unexpected 4xx). |
| `502` | `AI_MALFORMED_RESPONSE` | The AI returned empty, truncated or invalid output several times. Try again. |
| `502` | `AI_GENERATION_FAILED` | Unexpected failure while calling Gemini (details are logged server-side only). |
| `503` | `AI_NOT_CONFIGURED` | `GEMINI_API_KEY` is missing or still the placeholder in `backend/.env`. |
| `503` | `AI_AUTH_FAILED` | Google rejected the API key (invalid, expired or restricted). |
| `503` | `AI_MODEL_NOT_FOUND` | None of the configured models exist for your key. Run `python -m scripts.list_gemini_models`. |
| `503` | `AI_PROVIDER_UNAVAILABLE` | Google is overloaded (503) or the time budget ran out after retries and fallbacks. Try again shortly. |
| `504` | `AI_TIMEOUT` | The AI did not finish within its deadline on any model. Try again or shorten the description. |
| `500` | `INTERNAL_ERROR` | Unexpected server exception (details are logged server-side only). |

Messages for the `AI_*` codes name the models that were tried (for example `gemini-3.6-flash: 503, 503`) but never contain the API key.
