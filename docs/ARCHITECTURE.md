# FlowForge AI — Architecture & System Design

FlowForge AI is an intelligent software architecture platform that transforms natural language project descriptions and constraints into comprehensive, production-ready software blueprints.

---

## 1. High-Level Architecture Overview

```
+-------------------------------------------------------------+
|                     Client Browser                          |
|  - React 19 + TypeScript + Vite                             |
|  - TanStack Router (File-based routing)                     |
|  - Tailwind CSS + Lucide Icons + Sonner                     |
|  - Client-Side Vector PDF Generator (Pure TS)               |
+------------------------------+------------------------------+
                               |
                               | HTTP JSON (CORS Allowed)
                               v
+-------------------------------------------------------------+
|                     FastAPI Backend                         |
|  - Port 8000 (Uvicorn ASGI Server)                          |
|  - Pydantic v2 Request Validation & Error Formatting        |
|  - Dependency Injection (get_blueprint_service)             |
|  - Endpoints:                                               |
|      * GET  /                                               |
|      * GET  /api/health                                     |
|      * POST /api/generate-blueprint                         |
|      * POST /api/recommend-workflow                         |
+------------------------------+------------------------------+
                               |
                               | AIProvider Abstraction
                               v
+-------------------------------------------------------------+
|                     GeminiProvider                          |
|  - Google GenAI SDK (google-genai)                          |
|  - Pydantic Response Schema Constraints                     |
|  - Bounded retry (503/network) + model fallback             |
|  - One overall time budget per request                      |
|  - Zero Function Calling Overhead (AFC disabled)            |
+------------------------------+------------------------------+
                               |
                               | HTTPS (TLS)
                               v
+-------------------------------------------------------------+
|                  Google Gemini API                          |
|  - Models: gemini-3.6-flash, then fallbacks (see .env)      |
+-------------------------------------------------------------+
```

---

## 2. Frontend Subsystem (`frontend/`)

### Key Technologies
- **React 19 & TypeScript 5**: Component rendering, type safety, state management.
- **TanStack Router**: File-based client routing:
  - `/` (`src/routes/index.tsx`): Product overview and features.
  - `/generate` (`src/routes/generate.tsx`): Project input form with client-side validation.
  - `/compare` (`src/routes/compare.tsx`): Workflow comparison and recommendations.
  - `/result` (`src/routes/result.tsx`): Interactive blueprint viewer, PDF/Markdown/JSON export, clipboard copy.
- **Client-Side Export Engine (`src/lib/pdf-export.ts`)**:
  - Pure TypeScript vector PDF generator with zero third-party dependencies.
  - Produces standard PDF 1.4 binary documents.
  - Dynamic page calculations, running headers, footers with page numbering, tables, and word wrapping.
- **State & Storage (`src/lib/project-storage.ts`)**:
  - Local session storage for retaining generated blueprints across page refreshes.

---

## 3. Backend Subsystem (`backend/`)

### Directory Breakdown
- `app/main.py`: FastAPI application initialization, CORS configuration, centralized exception handlers.
- `app/config.py`: Environment settings loader using `python-dotenv`.
- `app/routes/`:
  - `health.py`: Health checks for monitoring and readiness probes.
  - `blueprint.py`: POST endpoints for blueprint generation and workflow recommendations.
- `app/schemas/blueprint.py`: Pydantic models defining input contracts and Gemini output schemas.
- `app/services/`:
  - `ai_provider.py`: Generic abstract base class for AI providers.
  - `gemini_provider.py`: Google Gemini implementation using structured output schemas.
  - `blueprint_service.py`: Domain service assembling prompts and executing requests.
  - `prompts.py`: System prompts and user prompt templates.
- `app/utils/errors.py`: Custom application exception types.
- `tests/`: Automated unit tests covering health endpoints, schema validation, routes, and error handlers.

---

## 4. Security Principles

1. **API Key Isolation**: The Google Gemini API key resides solely on the backend server. The frontend never accesses or transmits the key.
2. **Schema Enforcement**: All AI responses are constrained to Pydantic models via Google GenAI SDK's `response_schema`. Raw, unvalidated AI output is never passed to users.
3. **Safe Error Handling**: Internal stack traces and environment details are logged server-side only. Clients receive standardized error codes (`VALIDATION_ERROR`, `AI_NOT_CONFIGURED`, `INTERNAL_ERROR`).
4. **CORS Hardening**: Cross-Origin Resource Sharing is strictly constrained to allowed origins defined in `.env`.
