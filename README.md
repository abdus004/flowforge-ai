# FlowForge AI

**FlowForge AI** is an intelligent software architecture platform that transforms software product concepts into complete, production-ready engineering blueprints — encompassing user & system workflows, architecture specifications, relational & NoSQL database schemas, AI tech stack recommendations, implementation roadmaps, tooling, and risk mitigation strategies.

---

## 🌟 Key Features

- **Automated Blueprint Generation**: Translates natural language project descriptions, timelines, team constraints, and experience levels into detailed architecture blueprints.
- **Workflow Recommendation Engine**: Compares Traditional, AI-Assisted, and Full-AI development workflows and recommends the optimal strategy.
- **Multi-Format Export Suite**:
  - **Dynamic PDF Export**: Multi-page PDF generated entirely in your browser, with every blueprint section, styled tables that repeat their headers across pages, running headers and page numbers. The built-in PDF fonts cover Western European text; characters outside that set (for example Chinese or emoji) appear as `?` in the PDF (Markdown and JSON keep them intact).
  - **Structured Markdown Export**: Full-fidelity technical documentation formatted for GitHub, Obsidian, and documentation engines.
  - **Complete JSON Export**: Exact raw structured data schema export for pipeline integration.
  - **Copy Blueprint Action**: Formatted clipboard copy with one click and visual confirmation.
- **Clean Decoupled Architecture**: Strict separation between the React/TypeScript frontend and FastAPI backend.
- **Secure, Resilient Gemini Integration**: Google GenAI SDK with native structured output schemas, one bounded retry mechanism, verified fallback models and a per-request time budget. Credentials remain strictly isolated on the backend server.

---

## 🏗️ Architecture

```
FlowForge AI Architecture
─────────────────────────────────────────────────────────────
[Client Browser]
       │
       │ HTTP /api/*
       ▼
[FastAPI Backend :8000]
       │
       │ AIProvider Interface
       ▼
[GeminiProvider (Structured Output)]
       │
       │ HTTPS
       ▼
[Google Gemini API (gemini-3.6-flash, automatic fallback models)]
─────────────────────────────────────────────────────────────
```

---

## 📂 Project Structure

```
flowforge-ai-final/
│
├── frontend/                     # Frontend Application
│   ├── public/                   # Static assets (favicons, robots)
│   ├── src/
│   │   ├── components/           # UI and layout components
│   │   │   ├── ui/               # Active shadcn/ui components
│   │   │   ├── navbar.tsx        # Top navigation bar
│   │   │   ├── footer.tsx        # Site footer
│   │   │   └── theme-provider.tsx# Dark/Light theme provider
│   │   ├── lib/                  # Utilities and services
│   │   │   ├── api.ts            # Typed backend API client
│   │   │   ├── pdf-export.ts     # Client-side vector PDF generation
│   │   │   ├── project-storage.ts# Session storage persistence
│   │   │   └── utils.ts          # Styling & formatting helpers
│   │   ├── routes/               # TanStack Router file-based pages
│   │   │   ├── __root.tsx        # App shell layout
│   │   │   ├── index.tsx         # Landing page
│   │   │   ├── generate.tsx      # Project input workspace
│   │   │   ├── compare.tsx       # Workflow recommendation
│   │   │   └── result.tsx        # Interactive blueprint results
│   │   └── styles.css            # Tailwind CSS design system
│   ├── .env.example              # Frontend environment template
│   ├── package.json              # Clean dependency manifest
│   ├── tsconfig.json             # TypeScript configuration
│   └── vite.config.ts            # Vite build & dev configuration
│
├── backend/                      # Backend Service
│   ├── app/
│   │   ├── routes/               # API endpoint routers
│   │   ├── schemas/              # Pydantic v2 data models
│   │   ├── services/             # AI provider & business logic
│   │   ├── utils/                # Error handling utilities
│   │   ├── config.py             # App settings loader
│   │   └── main.py               # FastAPI entry point & CORS
│   ├── tests/                    # Automated backend test suite
│   ├── scripts/                  # Diagnostics & smoke tests
│   ├── .env.example              # Safe environment variable template
│   └── requirements.txt          # Python dependencies
│
├── docs/                         # Detailed Documentation
│   ├── ARCHITECTURE.md           # Deep architectural breakdown
│   ├── API_REFERENCE.md          # REST API specifications
│   ├── CONFIGURATION_AND_SECURITY.md # Secrets & security guide
│   └── WINDOWS_SETUP.md          # Step-by-step Windows setup
│
├── .gitignore                    # Git ignore rules (protects .env)
├── README.md                     # Project documentation
└── start-windows.ps1             # Convenience Windows startup script
```

---

## 🚀 Quickstart Guide (Windows)

### Prerequisites
- **Python 3.10+** (Tested on Python 3.12)
- **Node.js 22.12 or newer** (required by the frontend toolchain; tested on Node.js 22 and 24)
- A **Google Gemini API Key** from [Google AI Studio](https://aistudio.google.com/apikey)

### Fastest way: one script
After the one-time setup below, you can start everything with:
```powershell
.\start-windows.ps1
```
(It opens two PowerShell windows. It starts the backend with the virtual environment's own `python.exe`, so it works even when PowerShell blocks `Activate.ps1`.)

### 1. Backend Setup
Open a PowerShell terminal in the project folder:
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```
> If PowerShell says *"running scripts is disabled"* when activating, run
> `Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned` and activate again, or skip activation and
> use `.\.venv\Scripts\python.exe -m uvicorn ...` below.

Edit `backend/.env` and paste your Gemini API key (keep the other lines as they are):
```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
```
Run the backend:
```powershell
uvicorn app.main:app --reload --port 8000
```
- Health Check: [http://localhost:8000/api/health](http://localhost:8000/api/health)
- Swagger API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)

### 2. Frontend Setup
Open a second PowerShell terminal:
```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```
Open [http://localhost:8080](http://localhost:8080) in your browser.

### 3. Check your Gemini setup (recommended, 30 seconds)
With the backend virtual environment active, from the `backend` folder:
```powershell
python -m scripts.list_gemini_models     # lists the models YOUR key can call, and checks your .env
python -m scripts.smoke_test_gemini      # one tiny real request to Gemini
python -m scripts.smoke_test_gemini --full   # a complete real blueprint (the real end-to-end test)
```

---

## 🤖 How AI reliability works (and its limits)

Google's `503 UNAVAILABLE` ("high demand") and `504 DEADLINE_EXCEEDED` errors come from Google's servers. **Nothing in this project can fix Google's capacity**; the backend only makes the best use of the available time and then tells you clearly what happened.

- **One retry mechanism.** The SDK's own retries are switched off, so every attempt you see in the logs is ours.
- **503 / network errors:** retried on the same model with exponential backoff (default: 2 attempts per model).
- **504 / timeouts:** moved straight to the next model (repeating the same slow job with the same deadline rarely helps).
- **Fallback models:** `gemini-3.6-flash` then `gemini-3.8-flash` then `gemini-3.5-flash-lite` (all listed as Stable with structured output in Google's documentation). Change them with `GEMINI_MODEL` / `GEMINI_FALLBACK_MODELS`.
- **One time budget per request:** 150 s in total (`GEMINI_TOTAL_TIMEOUT_MS`), safely below the frontend's 180 s limit.
- **Clear errors:** invalid key, wrong model name, rate limit, timeout, overload and blocked content each produce their own message (see `docs/API_REFERENCE.md`).

If you still see `AI_PROVIDER_UNAVAILABLE`, Google is overloaded right now: wait a minute and try again.

---

## 🧪 Testing

### Backend tests
```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python -m pytest -v
```
(Use `pytest`, not `unittest`: the retry and fallback tests are pytest tests and `unittest discover` silently skips them.)
These tests use fakes and a local imitation of Gemini; they need no API key and no internet. They prove our logic, **not** that Google is up. Only `scripts.smoke_test_gemini` talks to the real service.

### Frontend checks
```powershell
cd frontend
npm run typecheck
npm run lint
npm run test:pdf     # builds sample PDFs and validates their structure; prints where it saved them
npm run build
```

---

## 🔒 Security & Environment Notes

- Real `.env` files are excluded from Git. Never commit `.env`.
- An earlier legacy key found in public commit history was treated as compromised and removed.
- To use the app, generate a new key at [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey).
- For complete security guidelines, see [docs/CONFIGURATION_AND_SECURITY.md](docs/CONFIGURATION_AND_SECURITY.md).

---

## 📄 License
This project is licensed under the MIT License.
